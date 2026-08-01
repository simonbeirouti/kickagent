import { sleep } from "workflow";
import { cleanupExpiredData as deleteExpiredData } from "@/lib/cleanup";
import { query } from "@/lib/db";
import { generateSuggestion } from "@/lib/generate-suggestion";
import { findConnectionById } from "@/lib/kick/repository";
import {
  type PromptChatMessage,
  type SuggestionGenerationRequest,
} from "@/lib/suggestions";

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
  readonly sender_username: string;
}

interface SuggestionRow extends Record<string, unknown> {
  readonly suggestion: string;
}

interface ExistingWindowRow extends Record<string, unknown> {
  readonly status: string;
}

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
         suggestion_message_count = CASE
           WHEN $3 = 'message_count'
             THEN GREATEST(connection.suggestion_message_count - 5, 0)
           ELSE 0
         END,
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

  const [cachedRows, recentSuggestionRows] = await Promise.all([
    query<ChatRow>(
      `SELECT message_id, sender_username, content, created_at
       FROM chat_messages
       WHERE connection_id = $1
         AND ingested_at >= $2
         AND ingested_at < $3
       ORDER BY created_at DESC, ingested_at DESC LIMIT 5`,
      [connectionId, windowStart, windowEnd],
    ),
    query<SuggestionRow>(
      `SELECT suggestion FROM analysis_windows
       WHERE connection_id = $1 AND status = 'complete' AND suggestion IS NOT NULL
       ORDER BY window_start DESC LIMIT 4`,
      [connectionId],
    ),
  ]);
  const suggestionRequest: SuggestionGenerationRequest = {
    categoryName: connection.category_name ?? undefined,
    messages: cachedRows.reverse().map(toPromptMessage),
    recentSuggestions: recentSuggestionRows.map((row) => row.suggestion),
    streamTitle: connection.stream_title ?? undefined,
  };
  console.info("[suggestion:analysis] requesting", {
    connectionId,
    messageCount: cachedRows.length,
    messageIds: cachedRows.map((row) => row.message_id),
    reason,
    windowEnd,
    windowStart,
  });
  const startedAt = Date.now();
  const statement = await generateSuggestion(suggestionRequest);
  const basis = suggestionRequest.messages.length > 0 ? "chat" : "stream_context";
  console.info("[suggestion:analysis] completed", {
    basis,
    connectionId,
    durationMs: Date.now() - startedAt,
    messageIds: cachedRows.map((row) => row.message_id),
    reason,
    windowEnd,
    windowStart,
  });
  await query(
    `UPDATE analysis_windows SET
      status = 'complete', suggestion = $4, basis = $5, summary = NULL,
      topics = '[]'::jsonb, hype_score = NULL, error = NULL,
      generated_at = now(), updated_at = now()
     WHERE connection_id = $1 AND window_start = $2 AND window_end = $3`,
    [connectionId, windowStart, windowEnd, statement, basis],
  );
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
    username: row.sender_username,
  };
}
