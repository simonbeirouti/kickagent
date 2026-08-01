import { beforeEach, describe, expect, it, vi } from "vitest";

const { findConnectionById, generateSuggestion, query, sleep } = vi.hoisted(() => ({
  findConnectionById: vi.fn(),
  generateSuggestion: vi.fn(),
  query: vi.fn(),
  sleep: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ query }));
vi.mock("@/lib/generate-suggestion", () => ({ generateSuggestion }));
vi.mock("@/lib/kick/repository", () => ({ findConnectionById }));
vi.mock("workflow", () => ({ sleep }));

import {
  kickMessageSuggestionWorkflow,
  kickSuggestionWorkflow,
} from "@/workflows/kick-suggestions";

const activeConnection = {
  active: true,
  suggestion_next_at: "2026-08-01T00:00:30.000Z",
  workflow_generation: 4,
};

describe("suggestion workflow cadence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims the fifth-message trigger with the atomic shared window update", async () => {
    query.mockResolvedValueOnce([]);

    await kickMessageSuggestionWorkflow("connection-1", 4);

    const [statement, parameters] = query.mock.calls[0] ?? [];
    expect(statement).toContain("$3 = 'message_count' AND suggestion_message_count >= 5");
    expect(statement).toContain("FOR UPDATE");
    expect(statement).toContain("GREATEST(connection.suggestion_message_count - 5, 0)");
    expect(statement).toContain("suggestion_next_at = clock_timestamp() + interval '30 seconds'");
    expect(parameters).toEqual(["connection-1", 4, "message_count"]);
  });

  it("claims the 30-second timer through the same race-safe update", async () => {
    findConnectionById
      .mockResolvedValueOnce(activeConnection)
      .mockResolvedValueOnce({ ...activeConnection, active: false });
    query.mockResolvedValueOnce([]);

    await kickSuggestionWorkflow("connection-1", 4);

    expect(sleep).toHaveBeenCalledWith(new Date(activeConnection.suggestion_next_at));
    const [statement, parameters] = query.mock.calls[0] ?? [];
    expect(statement).toContain("$3 = 'timer' AND suggestion_next_at <= now()");
    expect(statement).toContain("FOR UPDATE");
    expect(parameters).toEqual(["connection-1", 4, "timer"]);
  });

  it("generates directly from only the messages ingested in the claimed window", async () => {
    const claim = {
      window_end: "2026-08-01T00:00:30.000Z",
      window_start: "2026-08-01T00:00:00.000Z",
    };
    findConnectionById.mockResolvedValue(activeConnection);
    query
      .mockResolvedValueOnce([claim])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        content: "What game is next?",
        created_at: "2026-08-01T00:00:20.000Z",
        message_id: "message-5",
        sender_username: "viewer",
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    generateSuggestion.mockResolvedValue("Ask chat what game should be next.");

    await kickMessageSuggestionWorkflow("connection-1", 4);

    const [messageQuery, messageParameters] = query.mock.calls[3] ?? [];
    expect(messageQuery).toContain("ingested_at >= $2");
    expect(messageQuery).toContain("ingested_at < $3");
    expect(messageParameters).toEqual([
      "connection-1",
      claim.window_start,
      claim.window_end,
    ]);
    expect(generateSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{
        content: "What game is next?",
        createdAt: "2026-08-01T00:00:20.000Z",
        username: "viewer",
      }],
    }));
  });
});
