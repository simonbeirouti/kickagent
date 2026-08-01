import { Client } from "eve/client";
import { sleep } from "workflow";
import { appUrl } from "@/lib/env";
import { query } from "@/lib/db";
import { buildChatSummaryPrompt } from "@/lib/chat-summary";
import type { PromptChatMessage } from "@/lib/suggestions";
import {
  listChatSummaryWindows,
  pruneChatSummaryWindows,
  upsertChatSummaryWindow,
  type ChatSummaryWindowRecord,
} from "@/lib/kick/chat-summary-store";
import { nextChatSummaryWindow } from "@/lib/kick/chat-summary-window";
import { findConnectionById } from "@/lib/kick/repository";
import { chatSummarySchema, type ChatSummary } from "@/lib/kick/types";
import { signInternalJwt } from "@/lib/security";

interface WindowPlan {
  readonly end: string;
  readonly start: string;
  readonly stop: boolean;
}

interface ChatRow extends Record<string, unknown> {
  readonly content: string;
  readonly created_at: string;
  readonly message_id: string;
  readonly sender_user_id: string | null;
  readonly sender_username: string;
}

const outputSchema = {
  additionalProperties: false,
  properties: {
    interest: { enum: ["low", "medium", "high"], type: "string" },
    purpose: { maxLength: 160, minLength: 1, type: "string" },
    requests: { items: { maxLength: 120, minLength: 1, type: "string" }, maxItems: 5, type: "array" },
    summary: { maxLength: 280, minLength: 1, type: "string" },
    suggestions: {
      items: { maxLength: 140, minLength: 1, type: "string" },
      maxItems: 3,
      minItems: 1,
      type: "array",
    },
    tone: { maxLength: 60, minLength: 1, type: "string" },
  },
  required: ["summary", "purpose", "requests", "tone", "interest", "suggestions"],
  type: "object",
} as const;

export async function kickChatSummaryWorkflow(
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
      await summarizeWindow(connectionId, generation, plan.start, plan.end);
    } catch (error) {
      await markWindowFailed(connectionId, plan.start, plan.end, String(error));
    }
    completedTicks += 1;
    if (completedTicks % 4_320 === 0) await pruneHistory(connectionId);
  }
}

async function planNextWindow(connectionId: string, generation: number): Promise<WindowPlan> {
  "use step";
  const connection = await findConnectionById(connectionId);
  if (!connection || !connection.active || connection.workflow_generation !== generation) {
    return { end: new Date().toISOString(), start: new Date().toISOString(), stop: true };
  }
  const window = nextChatSummaryWindow(new Date());
  return { end: window.end.toISOString(), start: window.start.toISOString(), stop: false };
}

async function summarizeWindow(
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
    !connection.is_live ||
    connection.workflow_generation !== generation
  ) {
    return;
  }

  const existing = await listChatSummaryWindows(connectionId);
  if (existing.some((record) => record.windowStart === windowStart && record.status === "complete")) {
    return;
  }

  const windowRows = await query<ChatRow>(
    `SELECT message_id, sender_user_id::text, sender_username, content, created_at
     FROM chat_messages
     WHERE connection_id = $1 AND created_at >= $2 AND created_at < $3
     ORDER BY created_at ASC`,
    [connectionId, windowStart, windowEnd],
  );
  if (windowRows.length === 0) return;

  const previous = [...existing].reverse().find((record) => record.status === "complete");
  const prompt = buildChatSummaryPrompt({
    previousSummary: previous?.status === "complete" ? previous.summary : undefined,
    windowChat: windowRows.map(toPromptMessage),
  });
  const summary = await requestChatSummary(connectionId, prompt);
  const now = new Date().toISOString();
  await upsertChatSummaryWindow(connectionId, {
    ...summary,
    generatedAt: now,
    messageCount: windowRows.length,
    status: "complete",
    updatedAt: now,
    windowEnd,
    windowStart,
  });
}

async function requestChatSummary(connectionId: string, prompt: string): Promise<ChatSummary> {
  const client = new Client({
    auth: { bearer: signInternalJwt(connectionId) },
    host: `${appUrl()}/eve/agents/chat-summarizer`,
    redirect: "error",
  });
  const response = await client.session().send<ChatSummary>({ message: prompt, outputSchema });
  const result = await response.result();
  if (result.status === "failed" || !result.data) throw new Error("Chat summary agent failed.");
  return chatSummarySchema.parse(result.data);
}

async function markWindowFailed(
  connectionId: string,
  windowStart: string,
  windowEnd: string,
  error: string,
): Promise<void> {
  "use step";
  const record: ChatSummaryWindowRecord = {
    error: error.slice(0, 500),
    status: "failed",
    updatedAt: new Date().toISOString(),
    windowEnd,
    windowStart,
  };
  await upsertChatSummaryWindow(connectionId, record);
}

async function pruneHistory(connectionId: string): Promise<void> {
  "use step";
  await pruneChatSummaryWindows(connectionId);
}

function toPromptMessage(row: ChatRow): PromptChatMessage {
  return {
    content: row.content,
    createdAt: row.created_at,
    messageId: row.message_id,
    senderUserId: row.sender_user_id ?? undefined,
    username: row.sender_username,
  };
}
