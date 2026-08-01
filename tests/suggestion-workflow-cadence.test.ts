import { beforeEach, describe, expect, it, vi } from "vitest";

const { findConnectionById, query, sleep } = vi.hoisted(() => ({
  findConnectionById: vi.fn(),
  query: vi.fn(),
  sleep: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ query }));
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
    expect(statement).toContain("suggestion_message_count = 0");
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
});
