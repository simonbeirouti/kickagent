import { query } from "@/lib/db";
import { kickChatEventSchema } from "@/lib/kick/types";
import { windowStartFor } from "@/lib/kick/webhook";

interface ChatIngestResult extends Record<string, unknown> {
  readonly connection_id: string | null;
  readonly connection_matched: boolean;
  readonly message_inserted: boolean;
  readonly suggestion_message_count: number | null;
}

export interface ChatIngestOutcome {
  readonly connectionId?: string;
  readonly inserted: boolean;
  readonly messageCount: number;
  readonly shouldGenerateSuggestion: boolean;
}

export async function ingestChat(
  eventMessageId: string,
  eventType: string,
  input: unknown,
): Promise<ChatIngestOutcome> {
  const event = kickChatEventSchema.parse(input);
  const createdAt = new Date(event.created_at);
  const rows = await query<ChatIngestResult>(
    `WITH connection AS (
      SELECT id
      FROM kick_connections
      WHERE kick_user_id = $3 AND active = true
      FOR UPDATE
    ), accepted AS (
      INSERT INTO kick_webhook_events (event_message_id, event_type)
      SELECT $1, $2 FROM connection
      ON CONFLICT DO NOTHING
      RETURNING event_message_id
    ), matched AS (
      UPDATE kick_connections
      SET last_webhook_at = now(), updated_at = now()
      WHERE id IN (SELECT id FROM connection) AND EXISTS (SELECT 1 FROM accepted)
      RETURNING id
    ), inserted_chat AS (
      INSERT INTO chat_messages (
        message_id, event_message_id, connection_id, sender_user_id, sender_username,
        sender_profile_picture, content, reply_to_message_id, created_at, window_start,
        ingested_at
      )
      SELECT $4, $1, matched.id, $5, $6, $7, $8, $9, $10, $11, clock_timestamp()
      FROM matched
      ON CONFLICT DO NOTHING
      RETURNING
        connection_id, sender_user_id, sender_username, sender_profile_picture, created_at
    ), cadence AS (
      UPDATE kick_connections
      SET suggestion_message_count = suggestion_message_count + 1,
          updated_at = now()
      WHERE id IN (SELECT connection_id FROM inserted_chat)
      RETURNING id, suggestion_message_count
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
    ), activity AS (
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
        )
      RETURNING connection_id
    )
    SELECT
      EXISTS (SELECT 1 FROM connection) AS connection_matched,
      (SELECT connection_id FROM inserted_chat LIMIT 1) AS connection_id,
      EXISTS (SELECT 1 FROM inserted_chat) AS message_inserted,
      (SELECT suggestion_message_count FROM cadence LIMIT 1) AS suggestion_message_count`,
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
  const result = rows[0];
  if (!result?.connection_matched) {
    throw new Error(`No active Kick connection for broadcaster ${event.broadcaster.user_id}.`);
  }
  if (!result.message_inserted || !result.connection_id) {
    return { inserted: false, messageCount: 0, shouldGenerateSuggestion: false };
  }
  await query(
    `DELETE FROM chat_messages
     WHERE connection_id = $1
       AND message_id IN (
         SELECT message_id
         FROM chat_messages
         WHERE connection_id = $1
         ORDER BY created_at DESC, ingested_at DESC
         OFFSET 5
       )`,
    [result.connection_id],
  );
  const messageCount = result.suggestion_message_count ?? 0;
  return {
    connectionId: result.connection_id,
    inserted: true,
    messageCount,
    shouldGenerateSuggestion: messageCount >= 5,
  };
}
