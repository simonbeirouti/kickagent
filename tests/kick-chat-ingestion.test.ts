import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/db", () => ({ query }));

import { ingestChat } from "@/lib/kick/ingestion";

const chatEvent = {
  broadcaster: { user_id: 4083762, username: "bsimon" },
  content: "hello from chat",
  created_at: "2026-08-01T02:00:00Z",
  message_id: "message-1",
  sender: { user_id: 99, username: "viewer" },
};

describe("Kick chat ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only the five latest messages after an insert", async () => {
    query.mockResolvedValueOnce([
      {
        connection_id: "00000000-0000-0000-0000-000000000001",
        connection_matched: true,
        message_inserted: true,
        suggestion_message_count: 1,
      },
    ]).mockResolvedValueOnce([]);

    const outcome = await ingestChat("event-1", "chat.message.sent", chatEvent);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[0]?.[0]).toContain("clock_timestamp()");
    expect(query.mock.calls[1]?.[0]).toContain("OFFSET 5");
    expect(outcome).toMatchObject({ inserted: true, messageCount: 1, shouldGenerateSuggestion: false });
  });

  it("requests an immediate suggestion on the fifth message", async () => {
    query.mockResolvedValueOnce([
      {
        connection_id: "00000000-0000-0000-0000-000000000001",
        connection_matched: true,
        message_inserted: true,
        suggestion_message_count: 5,
      },
    ]).mockResolvedValueOnce([]);

    await expect(ingestChat("event-5", "chat.message.sent", chatEvent)).resolves.toMatchObject({
      inserted: true,
      messageCount: 5,
      shouldGenerateSuggestion: true,
    });
  });

  it("keeps requesting generation above five until a workflow claims the count", async () => {
    query.mockResolvedValueOnce([
      {
        connection_id: "00000000-0000-0000-0000-000000000001",
        connection_matched: true,
        message_inserted: true,
        suggestion_message_count: 6,
      },
    ]).mockResolvedValueOnce([]);

    await expect(ingestChat("event-6", "chat.message.sent", chatEvent)).resolves.toMatchObject({
      inserted: true,
      messageCount: 6,
      shouldGenerateSuggestion: true,
    });
  });

  it("does not increment cadence for a duplicate webhook", async () => {
    query.mockResolvedValueOnce([
      {
        connection_id: null,
        connection_matched: true,
        message_inserted: false,
        suggestion_message_count: null,
      },
    ]);

    await expect(ingestChat("event-1", "chat.message.sent", chatEvent)).resolves.toEqual({
      inserted: false,
      messageCount: 0,
      shouldGenerateSuggestion: false,
    });
    expect(query).toHaveBeenCalledOnce();
  });

  it("surfaces a webhook that cannot be matched to an active connection", async () => {
    query.mockResolvedValueOnce([
      { connection_id: null, connection_matched: false, message_inserted: false },
    ]);

    await expect(ingestChat("event-1", "chat.message.sent", chatEvent)).rejects.toThrow(
      "No active Kick connection",
    );
    expect(query).toHaveBeenCalledOnce();
  });
});
