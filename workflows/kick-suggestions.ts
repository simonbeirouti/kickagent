import { Client } from "eve/client";
import { sleep } from "workflow";
import { cleanupExpiredData as deleteExpiredData } from "@/lib/cleanup";
import { appUrl } from "@/lib/env";
import { query } from "@/lib/db";
import { findConnectionById } from "@/lib/kick/repository";
import { streamAnalysisSchema, type StreamAnalysis } from "@/lib/kick/types";
import { nextWindow } from "@/lib/kick/webhook";
import { signInternalJwt } from "@/lib/security";
import { buildSuggestionPrompt, type PromptChatMessage } from "@/lib/suggestions";

interface WindowPlan {
  readonly end: string;
  readonly start: string;
  readonly stop: boolean;
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
    const plan = await planNextWindow(connectionId, generation);
    if (plan.stop) return;
    await sleep(new Date(plan.end));
    try {
      await analyzeWindow(connectionId, generation, plan.start, plan.end);
    } catch (error) {
      await markWindowFailed(connectionId, plan.start, plan.end, String(error));
    }
    completedTicks += 1;
    if (completedTicks % 2_880 === 0) await cleanupExpiredData(connectionId);
  }
}

async function planNextWindow(connectionId: string, generation: number): Promise<WindowPlan> {
  "use step";
  const connection = await findConnectionById(connectionId);
  if (!connection || !connection.active || connection.workflow_generation !== generation) {
    return { end: new Date().toISOString(), start: new Date().toISOString(), stop: true };
  }
  const window = nextWindow(new Date());
  return { end: window.end.toISOString(), start: window.start.toISOString(), stop: false };
}

async function analyzeWindow(
  connectionId: string,
  generation: number,
  windowStart: string,
  windowEnd: string,
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
  ]);
  const prompt = buildSuggestionPrompt({
    categoryName: connection.category_name ?? undefined,
    recentChat: [],
    recentSuggestions: recentSuggestionRows.map((row) => row.suggestion),
    streamTitle: connection.stream_title ?? undefined,
    windowChat: cachedRows.reverse().map(toPromptMessage),
  });
  const suggestion = await requestSuggestion(connectionId, prompt);
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
  const result = await response.result();
  if (result.status === "failed" || !result.data) throw new Error("Suggestion agent failed.");
  return streamAnalysisSchema.parse(result.data);
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
