import { Client } from "eve/client";
import { sleep } from "workflow";
import { cleanupExpiredData as deleteExpiredData } from "@/lib/cleanup";
import { appUrl } from "@/lib/env";
import { query } from "@/lib/db";
import { computeHypeSnapshot, type HypeChatRow } from "@/lib/hype";
import { findConnectionById } from "@/lib/kick/repository";
import { streamAnalysisSchema, type StreamAnalysis } from "@/lib/kick/types";
import { signInternalJwt } from "@/lib/security";
import { buildSuggestionPrompt, type PromptChatMessage } from "@/lib/suggestions";

// Trailing lookback the hype engine replays each tick to compute its signal. Must
// comfortably exceed HypeEngine's default 45s warm-up so `ready` reflects a locked
// baseline rather than the workflow step's own cold start.
const HYPE_LOOKBACK_MS = 3 * 60_000;

interface WindowPlan {
  readonly dueAt: string;
  readonly stop: boolean;
}

type TriggerReason = "message_count" | "timer";

interface TriggerClaim extends Record<string, unknown> {
  readonly window_end: string;
  readonly window_start: string;
}

interface ChatRow extends Record<string, unknown> {
  readonly content: string;
  readonly created_at: string;
  readonly message_id: string;
  readonly sender_profile_picture: string | null;
  readonly sender_user_id: string | null;
  readonly sender_username: string;
}

interface SuggestionRow extends Record<string, unknown> {
  readonly suggestion: string;
}

interface ExistingWindowRow extends Record<string, unknown> {
  readonly status: string;
}

const outputSchema = {
  additionalProperties: false,
  properties: {
    basis: { enum: ["chat", "stream_context"], type: "string" },
    hypeScore: { maximum: 100, minimum: 0, type: "integer" },
    summary: { maxLength: 280, minLength: 1, type: "string" },
    suggestion: { maxLength: 140, minLength: 1, type: "string" },
    topics: {
      items: {
        additionalProperties: false,
        properties: {
          label: { maxLength: 48, minLength: 1, type: "string" },
          percentage: { maximum: 100, minimum: 0, type: "integer" },
        },
        required: ["label", "percentage"],
        type: "object",
      },
      maxItems: 3,
      type: "array",
    },
  },
  required: ["suggestion", "summary", "topics", "hypeScore", "basis"],
  type: "object",
} as const;

export async function kickSuggestionWorkflow(
  connectionId: string,
  generation: number,
): Promise<void> {
  "use workflow";

  let completedTicks = 0;
  while (true) {
    const plan = await planNextTrigger(connectionId, generation);
    if (plan.stop) return;
    await sleep(new Date(plan.dueAt));
    const claim = await claimSuggestionTrigger(connectionId, generation, "timer");
    if (claim) {
      await runClaimedAnalysis(connectionId, generation, claim, "timer");
    }
    completedTicks += 1;
    if (completedTicks % 2_880 === 0) await cleanupExpiredData(connectionId);
  }
}

export async function kickMessageSuggestionWorkflow(
  connectionId: string,
  generation: number,
): Promise<void> {
  "use workflow";

  const claim = await claimSuggestionTrigger(connectionId, generation, "message_count");
  if (claim) await runClaimedAnalysis(connectionId, generation, claim, "message_count");
}

async function runClaimedAnalysis(
  connectionId: string,
  generation: number,
  claim: TriggerClaim,
  reason: TriggerReason,
): Promise<void> {
  try {
    await analyzeWindow(
      connectionId,
      generation,
      claim.window_start,
      claim.window_end,
      reason,
    );
  } catch (error) {
    await markWindowFailed(connectionId, claim.window_start, claim.window_end, String(error));
  }
}

async function planNextTrigger(connectionId: string, generation: number): Promise<WindowPlan> {
  "use step";
  const connection = await findConnectionById(connectionId);
  if (!connection || !connection.active || connection.workflow_generation !== generation) {
    return { dueAt: new Date().toISOString(), stop: true };
  }
  return { dueAt: connection.suggestion_next_at, stop: false };
}

async function claimSuggestionTrigger(
  connectionId: string,
  generation: number,
  reason: TriggerReason,
): Promise<TriggerClaim | undefined> {
  "use step";
  const rows = await query<TriggerClaim>(
    `WITH candidate AS (
       SELECT suggestion_window_start AS window_start
       FROM kick_connections
       WHERE id = $1 AND active = true AND workflow_generation = $2
         AND (
           ($3 = 'timer' AND suggestion_next_at <= now()) OR
           ($3 = 'message_count' AND suggestion_message_count >= 5)
         )
       FOR UPDATE
     ), claimed AS (
       UPDATE kick_connections AS connection SET
         suggestion_message_count = 0,
         suggestion_window_start = clock_timestamp(),
         suggestion_next_at = clock_timestamp() + interval '30 seconds',
         updated_at = now()
       FROM candidate
       WHERE connection.id = $1
       RETURNING candidate.window_start, connection.suggestion_window_start AS window_end
     )
     SELECT window_start, window_end FROM claimed`,
    [connectionId, generation, reason],
  );
  const claim = rows[0];
  if (claim) {
    console.info("[suggestion:trigger] claimed", {
      connectionId,
      reason,
      windowEnd: claim.window_end,
      windowStart: claim.window_start,
    });
  }
  return claim;
}

async function analyzeWindow(
  connectionId: string,
  generation: number,
  windowStart: string,
  windowEnd: string,
  reason: TriggerReason,
): Promise<void> {
  "use step";
  const connection = await findConnectionById(connectionId);
  if (
    !connection ||
    !connection.active ||
    connection.workflow_generation !== generation
  ) {
    return;
  }
  const existing = await query<ExistingWindowRow>(
    `SELECT status FROM analysis_windows
     WHERE connection_id = $1 AND window_start = $2`,
    [connectionId, windowStart],
  );
  if (existing[0]?.status === "complete") return;
  await query(
    `INSERT INTO analysis_windows (connection_id, window_start, window_end, status, updated_at)
     VALUES ($1, $2, $3, 'processing', now())
     ON CONFLICT (connection_id, window_start) DO UPDATE SET
       status = 'processing', error = NULL, updated_at = now()`,
    [connectionId, windowStart, windowEnd],
  );

  const windowEndMs = new Date(windowEnd).getTime();
  const [cachedRows, recentSuggestionRows, hypeLookbackRows] = await Promise.all([
    query<ChatRow>(
      `SELECT
         message_id, sender_user_id::text, sender_username, sender_profile_picture,
         content, created_at
       FROM chat_messages
       WHERE connection_id = $1
       ORDER BY created_at DESC, ingested_at DESC LIMIT 5`,
      [connectionId],
    ),
    query<SuggestionRow>(
      `SELECT suggestion FROM analysis_windows
       WHERE connection_id = $1 AND status = 'complete' AND suggestion IS NOT NULL
       ORDER BY window_start DESC LIMIT 4`,
      [connectionId],
    ),
    query<HypeChatRow>(
      `SELECT message_id, sender_user_id::text, sender_username, content, created_at
       FROM chat_messages
       WHERE connection_id = $1 AND created_at >= $2 AND created_at < $3
       ORDER BY created_at ASC`,
      [connectionId, new Date(windowEndMs - HYPE_LOOKBACK_MS).toISOString(), windowEnd],
    ),
  ]);
  const hype = computeHypeSnapshot(hypeLookbackRows, windowEndMs);
  const prompt = buildSuggestionPrompt({
    categoryName: connection.category_name ?? undefined,
    hype,
    recentChat: [],
    recentSuggestions: recentSuggestionRows.map((row) => row.suggestion),
    streamTitle: connection.stream_title ?? undefined,
    windowChat: cachedRows.reverse().map(toPromptMessage),
  });
  console.info("[suggestion:analysis] requesting", {
    connectionId,
    messageCount: cachedRows.length,
    messageIds: cachedRows.map((row) => row.message_id),
    reason,
    windowEnd,
    windowStart,
  });
  const suggestion = await requestSuggestion(connectionId, prompt);
  // Surfaces the engine-computed hype next to the agent's read in run logs.
  console.info(
    `[kick-suggestions] connection=${connectionId} window=${windowStart} hype=${hype.score} summary=${JSON.stringify(suggestion.summary)}`,
  );
  await query(
    `UPDATE analysis_windows SET
      status = 'complete', suggestion = $4, basis = $5, summary = $6,
      topics = $7::jsonb, hype_score = $8, error = NULL,
      generated_at = now(), updated_at = now()
     WHERE connection_id = $1 AND window_start = $2 AND window_end = $3`,
    [
      connectionId,
      windowStart,
      windowEnd,
      suggestion.suggestion,
      suggestion.basis,
      suggestion.summary,
      JSON.stringify(suggestion.topics),
      suggestion.hypeScore,
    ],
  );
}

async function requestSuggestion(
  connectionId: string,
  prompt: string,
): Promise<StreamAnalysis> {
  const client = new Client({
    auth: { bearer: signInternalJwt(connectionId) },
    host: `${appUrl()}/eve/agents/suggester`,
    redirect: "error",
  });
  const response = await client.session().send<StreamAnalysis>({ message: prompt, outputSchema });
  const startedAt = Date.now();
  let result: unknown;
  console.info("[eve:suggester] started", { connectionId, sessionId: response.sessionId });
  try {
    for await (const event of response) {
      console.info("[eve:suggester] event", {
        at: event.meta.at,
        eventId: event.meta.id,
        sessionId: response.sessionId,
        type: event.type,
      });
      if (event.type === "result.completed") result = event.data.result;
    }
    const parsed = streamAnalysisSchema.parse(result);
    console.info("[eve:suggester] completed", {
      basis: parsed.basis,
      durationMs: Date.now() - startedAt,
      sessionId: response.sessionId,
      suggestion: parsed.suggestion,
    });
    return parsed;
  } catch (error) {
    console.error("[eve:suggester] failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      sessionId: response.sessionId,
    });
    throw error;
  }
}

async function markWindowFailed(
  connectionId: string,
  windowStart: string,
  windowEnd: string,
  error: string,
): Promise<void> {
  "use step";
  await query(
    `INSERT INTO analysis_windows (
       connection_id, window_start, window_end, status, error, updated_at
     ) VALUES ($1, $2, $3, 'failed', $4, now())
     ON CONFLICT (connection_id, window_start) DO UPDATE SET
       status = 'failed', error = EXCLUDED.error, updated_at = now()`,
    [connectionId, windowStart, windowEnd, error.slice(0, 500)],
  );
}

async function cleanupExpiredData(connectionId: string): Promise<void> {
  "use step";
  await deleteExpiredData(connectionId);
}

function toPromptMessage(row: ChatRow): PromptChatMessage {
  return {
    content: row.content,
    createdAt: row.created_at,
    messageId: row.message_id,
    profilePicture: row.sender_profile_picture ?? undefined,
    senderUserId: row.sender_user_id ?? undefined,
    username: row.sender_username,
  };
}
