import { query } from "@/lib/db";
import { start } from "workflow/api";
import { ingestChat } from "@/lib/kick/ingestion";
import { findConnectionById, upgradeSuggestionWorkflow } from "@/lib/kick/repository";
import {
  kickChatEventSchema,
  kickLivestreamMetadataEventSchema,
  kickLivestreamStatusEventSchema,
} from "@/lib/kick/types";
import { verifyKickWebhook } from "@/lib/kick/webhook";
import {
  kickMessageSuggestionWorkflow,
  kickSuggestionWorkflow,
} from "@/workflows/kick-suggestions";

export const runtime = "nodejs";

const SUPPORTED_EVENTS = new Set([
  "chat.message.sent",
  "livestream.status.updated",
  "livestream.metadata.updated",
]);

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  let envelope;
  try {
    envelope = verifyKickWebhook(request, rawBody);
  } catch (error) {
    return Response.json({ error: toMessage(error), ok: false }, { status: 401 });
  }
  if (envelope.eventVersion !== "1" || !SUPPORTED_EVENTS.has(envelope.eventType)) {
    return Response.json({ error: "Unsupported Kick event.", ok: false }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ error: "Invalid JSON payload.", ok: false }, { status: 400 });
  }

  try {
    console.info("[kick:webhook] received", {
      eventMessageId: envelope.eventMessageId,
      eventType: envelope.eventType,
    });
    switch (envelope.eventType) {
      case "chat.message.sent": {
        const outcome = await ingestChat(envelope.eventMessageId, envelope.eventType, body);
        const event = kickChatEventSchema.parse(body);
        console.info("[kick:chat] ingested", {
          connectionId: outcome.connectionId,
          inserted: outcome.inserted,
          messageCount: outcome.messageCount,
          messageId: event.message_id,
          username: event.sender.username ?? "Anonymous",
        });
        const upgradedConnection = outcome.connectionId
          ? await upgradeSuggestionWorkflow(outcome.connectionId)
          : undefined;
        if (upgradedConnection) {
          await start(kickSuggestionWorkflow, [
            upgradedConnection.id,
            upgradedConnection.workflow_generation,
          ]);
        }
        if (outcome.shouldGenerateSuggestion && outcome.connectionId) {
          const connection = await findConnectionById(outcome.connectionId);
          if (connection?.active) {
            console.info("[suggestion:trigger] queued", {
              connectionId: connection.id,
              messageCount: outcome.messageCount,
              reason: "message_count",
            });
            await start(kickMessageSuggestionWorkflow, [
              connection.id,
              connection.workflow_generation,
            ]);
          }
        }
        break;
      }
      case "livestream.status.updated":
        await ingestStatus(envelope.eventMessageId, envelope.eventType, body);
        break;
      case "livestream.metadata.updated":
        await ingestMetadata(envelope.eventMessageId, envelope.eventType, body);
        break;
    }
  } catch (error) {
    console.error("Failed to ingest Kick webhook", error);
    return Response.json({ error: "Unable to ingest event.", ok: false }, { status: 400 });
  }
  return Response.json({ ok: true });
}

async function ingestStatus(eventMessageId: string, eventType: string, input: unknown): Promise<void> {
  const event = kickLivestreamStatusEventSchema.parse(input);
  await query(
    `WITH accepted AS (
      INSERT INTO kick_webhook_events (event_message_id, event_type)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING event_message_id
    )
    UPDATE kick_connections SET
      is_live = $4,
      stream_title = COALESCE($5, stream_title),
      last_webhook_at = now(),
      updated_at = now()
    WHERE kick_user_id = $3 AND EXISTS (SELECT 1 FROM accepted)`,
    [eventMessageId, eventType, event.broadcaster.user_id, event.is_live, event.title ?? null],
  );
}

async function ingestMetadata(
  eventMessageId: string,
  eventType: string,
  input: unknown,
): Promise<void> {
  const event = kickLivestreamMetadataEventSchema.parse(input);
  await query(
    `WITH accepted AS (
      INSERT INTO kick_webhook_events (event_message_id, event_type)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING event_message_id
    )
    UPDATE kick_connections SET
      stream_title = COALESCE($4, stream_title),
      category_id = COALESCE($5, category_id),
      category_name = COALESCE($6, category_name),
      last_webhook_at = now(),
      updated_at = now()
    WHERE kick_user_id = $3 AND EXISTS (SELECT 1 FROM accepted)`,
    [
      eventMessageId,
      eventType,
      event.broadcaster.user_id,
      event.metadata.title ?? null,
      event.metadata.category?.id ?? null,
      event.metadata.category?.name ?? null,
    ],
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid Kick webhook.";
}
