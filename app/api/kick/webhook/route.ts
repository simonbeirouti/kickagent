import { query } from "@/lib/db";
import {
  kickChatEventSchema,
  kickLivestreamMetadataEventSchema,
  kickLivestreamStatusEventSchema,
} from "@/lib/kick/types";
import { verifyKickWebhook, windowStartFor } from "@/lib/kick/webhook";

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
    switch (envelope.eventType) {
      case "chat.message.sent":
        await ingestChat(envelope.eventMessageId, envelope.eventType, body);
        break;
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

async function ingestChat(eventMessageId: string, eventType: string, input: unknown): Promise<void> {
  const event = kickChatEventSchema.parse(input);
  const createdAt = new Date(event.created_at);
  await query(
    `WITH accepted AS (
      INSERT INTO kick_webhook_events (event_message_id, event_type)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING event_message_id
    ), matched AS (
      UPDATE kick_connections
      SET last_webhook_at = now(), updated_at = now()
      WHERE kick_user_id = $3 AND EXISTS (SELECT 1 FROM accepted)
      RETURNING id
    ), inserted_chat AS (
    INSERT INTO chat_messages (
      message_id, event_message_id, connection_id, sender_user_id, sender_username,
      sender_profile_picture, content, reply_to_message_id, created_at, window_start
    )
    SELECT $4, $1, matched.id, $5, $6, $7, $8, $9, $10, $11
    FROM matched
    ON CONFLICT DO NOTHING
    RETURNING
      connection_id, sender_user_id, sender_username, sender_profile_picture, created_at
    ), member AS (
      INSERT INTO community_members (
        connection_id, kick_user_id, username, profile_picture,
        first_seen_at, last_seen_at, total_message_count
      )
      SELECT
        connection_id, sender_user_id, sender_username, sender_profile_picture,
        created_at, created_at, 1
      FROM inserted_chat
      WHERE sender_user_id IS NOT NULL
      ON CONFLICT (connection_id, kick_user_id) DO UPDATE SET
        username = EXCLUDED.username,
        profile_picture = COALESCE(EXCLUDED.profile_picture, community_members.profile_picture),
        last_seen_at = GREATEST(community_members.last_seen_at, EXCLUDED.last_seen_at),
        total_message_count = community_members.total_message_count + 1,
        updated_at = now()
      RETURNING id, connection_id, last_seen_at
    )
    INSERT INTO community_member_activity (
      connection_id, member_id, activity_date, message_count, first_message_at, last_message_at
    )
    SELECT connection_id, id, last_seen_at::date, 1, last_seen_at, last_seen_at
    FROM member
    ON CONFLICT (connection_id, member_id, activity_date) DO UPDATE SET
      message_count = community_member_activity.message_count + 1,
      first_message_at = LEAST(
        community_member_activity.first_message_at, EXCLUDED.first_message_at
      ),
      last_message_at = GREATEST(
        community_member_activity.last_message_at, EXCLUDED.last_message_at
      )`,
    [
      eventMessageId,
      eventType,
      event.broadcaster.user_id,
      event.message_id,
      event.sender.user_id ?? null,
      event.sender.username ?? "Anonymous",
      event.sender.profile_picture ?? null,
      event.content,
      event.replies_to?.message_id ?? null,
      createdAt.toISOString(),
      windowStartFor(createdAt).toISOString(),
    ],
  );
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
