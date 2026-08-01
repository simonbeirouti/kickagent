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
      },
    ]).mockResolvedValueOnce([]);

    await ingestChat("event-1", "chat.message.sent", chatEvent);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("OFFSET 5");
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
