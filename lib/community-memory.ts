import type { SessionContext } from "eve/context";
import { optionalEnv } from "@/lib/env";
import { query } from "@/lib/db";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface MemberObservationInput {
  kickUserId: string;
  username: string;
  profilePicture?: string;
  sourceMessageId: string;
  observedAt: string;
  contextSummary: string;
  chatExcerpt?: string;
  streamTitle?: string;
  categoryName?: string;
  facts: string[];
}

interface SavedObservationRow extends Record<string, unknown> {
  member_id: string;
  username: string;
  observation_count: number;
  observation_saved: boolean;
}

interface MemberContextRow extends Record<string, unknown> {
  member_id: string;
  kick_user_id: string;
  username: string;
  profile_picture: string | null;
  first_seen_at: string | Date;
  last_seen_at: string | Date;
  total_message_count: number;
  active_day_count: number;
  observation_count: number;
  observed_at: string | Date | null;
  context_summary: string | null;
  chat_excerpt: string | null;
  stream_title: string | null;
  category_name: string | null;
  facts: unknown;
}

interface ConsistentMemberRow extends Record<string, unknown> {
  member_id: string;
  kick_user_id: string;
  username: string;
  profile_picture: string | null;
  first_seen_at: string | Date;
  last_seen_at: string | Date;
  total_message_count: number;
  active_day_count: number;
  observation_count: number;
  latest_context: string | null;
}

export function requireKickConnectionId(ctx: SessionContext): string {
  const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
  const claimedConnectionId = caller?.attributes.connection_id;
  const connectionId =
    typeof claimedConnectionId === "string"
      ? claimedConnectionId
      : optionalEnv("KICK_CONNECTION_ID");

  if (!connectionId || !UUID_PATTERN.test(connectionId)) {
    throw new Error(
      "A valid Kick connection scope is required. Include connection_id in the signed caller token or set KICK_CONNECTION_ID for local development.",
    );
  }

  return connectionId;
}

export async function saveMemberObservation(
  connectionId: string,
  input: MemberObservationInput,
) {
  const rows = await query<SavedObservationRow>(
    `WITH observation AS (
       INSERT INTO community_member_context (
         connection_id,
         member_id,
         source_message_id,
         observed_at,
         context_summary,
         chat_excerpt,
         stream_title,
         category_name,
         facts
       )
       SELECT $1::uuid, id, $6, $5::timestamptz, $7, $8, $9, $10, $11::jsonb
       FROM community_members
       WHERE connection_id = $1::uuid AND kick_user_id = $2::bigint
       ON CONFLICT (connection_id, source_message_id) DO NOTHING
       RETURNING member_id
     )
     UPDATE community_members AS cm SET
       username = $3,
       profile_picture = COALESCE($4, cm.profile_picture),
       observation_count = cm.observation_count + CASE
         WHEN EXISTS (SELECT 1 FROM observation WHERE member_id = cm.id) THEN 1 ELSE 0
       END,
       updated_at = now()
     WHERE cm.connection_id = $1::uuid AND cm.kick_user_id = $2::bigint
     RETURNING
       cm.id AS member_id,
       cm.username,
       cm.observation_count,
       EXISTS (SELECT 1 FROM observation WHERE member_id = cm.id) AS observation_saved`,
    [
      connectionId,
      input.kickUserId,
      input.username,
      input.profilePicture ?? null,
      input.observedAt,
      input.sourceMessageId,
      input.contextSummary,
      input.chatExcerpt ?? null,
      input.streamTitle ?? null,
      input.categoryName ?? null,
      JSON.stringify(input.facts),
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Unable to save community member context.");
  }

  return {
    memberId: row.member_id,
    username: row.username,
    observationCount: row.observation_count,
    observationSaved: row.observation_saved,
  };
}

export async function recallMemberContext(
  connectionId: string,
  input: { kickUserId?: string; username?: string; limit: number },
) {
  const rows = await query<MemberContextRow>(
    `SELECT
       cm.id AS member_id,
       cm.kick_user_id::text,
       cm.username,
       cm.profile_picture,
       cm.first_seen_at,
       cm.last_seen_at,
       cm.total_message_count,
       (SELECT count(*)::integer FROM community_member_activity AS activity
        WHERE activity.connection_id = cm.connection_id AND activity.member_id = cm.id
       ) AS active_day_count,
       cm.observation_count,
       context.observed_at,
       context.context_summary,
       context.chat_excerpt,
       context.stream_title,
       context.category_name,
       context.facts
     FROM community_members AS cm
     LEFT JOIN LATERAL (
       SELECT
         observed_at,
         context_summary,
         chat_excerpt,
         stream_title,
         category_name,
         facts
       FROM community_member_context
       WHERE connection_id = cm.connection_id AND member_id = cm.id
       ORDER BY observed_at DESC
       LIMIT $4
     ) AS context ON true
     WHERE cm.connection_id = $1::uuid
       AND ($2::bigint IS NULL OR cm.kick_user_id = $2::bigint)
       AND ($3::text IS NULL OR lower(cm.username) = lower($3::text))
     ORDER BY context.observed_at DESC NULLS LAST`,
    [connectionId, input.kickUserId ?? null, input.username ?? null, input.limit],
  );

  const first = rows[0];
  if (!first) {
    return { found: false as const, member: null, observations: [] };
  }

  return {
    found: true as const,
    member: {
      memberId: first.member_id,
      kickUserId: first.kick_user_id,
      username: first.username,
      profilePicture: first.profile_picture,
      firstSeenAt: toIsoString(first.first_seen_at),
      lastSeenAt: toIsoString(first.last_seen_at),
      totalMessageCount: first.total_message_count,
      activeDayCount: first.active_day_count,
      observationCount: first.observation_count,
    },
    observations: rows
      .filter((row) => row.observed_at !== null)
      .map((row) => ({
        observedAt: toIsoString(row.observed_at!),
        summary: row.context_summary,
        chatExcerpt: row.chat_excerpt,
        streamTitle: row.stream_title,
        categoryName: row.category_name,
        facts: Array.isArray(row.facts)
          ? row.facts.filter((fact): fact is string => typeof fact === "string")
          : [],
      })),
  };
}

export async function listConsistentMembers(
  connectionId: string,
  input: { minimumActiveDays: number; activeSince?: string; limit: number },
) {
  const rows = await query<ConsistentMemberRow>(
    `SELECT
       cm.id AS member_id,
       cm.kick_user_id::text,
       cm.username,
       cm.profile_picture,
       cm.first_seen_at,
       cm.last_seen_at,
       cm.total_message_count,
       activity.active_day_count,
       cm.observation_count,
       latest.context_summary AS latest_context
     FROM community_members AS cm
     LEFT JOIN LATERAL (
       SELECT context_summary
       FROM community_member_context
       WHERE connection_id = cm.connection_id AND member_id = cm.id
       ORDER BY observed_at DESC
       LIMIT 1
     ) AS latest ON true
     CROSS JOIN LATERAL (
       SELECT count(*)::integer AS active_day_count
       FROM community_member_activity
       WHERE connection_id = cm.connection_id AND member_id = cm.id
     ) AS activity
     WHERE cm.connection_id = $1::uuid
       AND activity.active_day_count >= $2
       AND ($3::timestamptz IS NULL OR cm.last_seen_at >= $3::timestamptz)
     ORDER BY activity.active_day_count DESC, cm.last_seen_at DESC
     LIMIT $4`,
    [
      connectionId,
      input.minimumActiveDays,
      input.activeSince ?? null,
      input.limit,
    ],
  );

  return rows.map((row) => ({
    memberId: row.member_id,
    kickUserId: row.kick_user_id,
    username: row.username,
    profilePicture: row.profile_picture,
    firstSeenAt: toIsoString(row.first_seen_at),
    lastSeenAt: toIsoString(row.last_seen_at),
    totalMessageCount: row.total_message_count,
    activeDayCount: row.active_day_count,
    observationCount: row.observation_count,
    latestContext: row.latest_context,
  }));
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
