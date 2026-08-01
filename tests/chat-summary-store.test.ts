import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const storePath = resolve(tmpdir(), `chat-summary-store-${randomUUID()}.json`);
process.env.CHAT_SUMMARY_STORE_PATH = storePath;

const { listChatSummaryWindows, pruneChatSummaryWindows, upsertChatSummaryWindow } = await import(
  "@/lib/kick/chat-summary-store"
);

describe("local chat summary store", () => {
  const connectionId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    await rm(storePath, { force: true });
  });

  afterEach(async () => {
    await rm(storePath, { force: true });
  });

  it("writes and reads back a completed window", async () => {
    await upsertChatSummaryWindow(connectionId, {
      generatedAt: "2026-08-01T00:00:20.000Z",
      interest: "medium",
      messageCount: 3,
      purpose: "Chatting about the map.",
      requests: [],
      status: "complete",
      summary: "Quiet, friendly chat.",
      suggestions: ["Ask chat about their favourite map."],
      tone: "calm",
      updatedAt: "2026-08-01T00:00:20.000Z",
      windowEnd: "2026-08-01T00:00:20.000Z",
      windowStart: "2026-08-01T00:00:00.000Z",
    });

    const windows = await listChatSummaryWindows(connectionId);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ status: "complete", summary: "Quiet, friendly chat." });
  });

  it("upserts by window start instead of duplicating", async () => {
    const base = {
      generatedAt: "2026-08-01T00:00:20.000Z",
      interest: "low" as const,
      messageCount: 1,
      purpose: "p",
      requests: [],
      status: "complete" as const,
      summary: "first",
      suggestions: ["s"],
      tone: "t",
      updatedAt: "2026-08-01T00:00:20.000Z",
      windowEnd: "2026-08-01T00:00:20.000Z",
      windowStart: "2026-08-01T00:00:00.000Z",
    };
    await upsertChatSummaryWindow(connectionId, base);
    await upsertChatSummaryWindow(connectionId, { ...base, summary: "second" });

    const windows = await listChatSummaryWindows(connectionId);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ summary: "second" });
  });

  it("records failures distinctly from completed windows", async () => {
    await upsertChatSummaryWindow(connectionId, {
      error: "agent timed out",
      status: "failed",
      updatedAt: "2026-08-01T00:00:20.000Z",
      windowEnd: "2026-08-01T00:00:20.000Z",
      windowStart: "2026-08-01T00:00:00.000Z",
    });

    const windows = await listChatSummaryWindows(connectionId);
    expect(windows).toEqual([
      {
        error: "agent timed out",
        status: "failed",
        updatedAt: "2026-08-01T00:00:20.000Z",
        windowEnd: "2026-08-01T00:00:20.000Z",
        windowStart: "2026-08-01T00:00:00.000Z",
      },
    ]);
  });

  it("prunes windows older than the retention cutoff", async () => {
    await upsertChatSummaryWindow(connectionId, {
      generatedAt: "2020-01-01T00:00:20.000Z",
      interest: "low",
      messageCount: 1,
      purpose: "p",
      requests: [],
      status: "complete",
      summary: "stale",
      suggestions: ["s"],
      tone: "t",
      updatedAt: "2020-01-01T00:00:20.000Z",
      windowEnd: "2020-01-01T00:00:20.000Z",
      windowStart: "2020-01-01T00:00:00.000Z",
    });
    await upsertChatSummaryWindow(connectionId, {
      generatedAt: new Date().toISOString(),
      interest: "low",
      messageCount: 1,
      purpose: "p",
      requests: [],
      status: "complete",
      summary: "fresh",
      suggestions: ["s"],
      tone: "t",
      updatedAt: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
      windowStart: new Date().toISOString(),
    });

    await pruneChatSummaryWindows(connectionId);

    const windows = await listChatSummaryWindows(connectionId);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ summary: "fresh" });
  });
});
