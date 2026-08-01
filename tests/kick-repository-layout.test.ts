import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/db", () => ({ query }));

import {
  updateOverlayLayout,
  upgradeSuggestionWorkflow,
} from "@/lib/kick/repository";

describe("Kick overlay layout persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("casts serialized layouts through text before storing them as jsonb", async () => {
    const layout = [{ height: 5, id: "hype", kind: "hype" as const, width: 8, x: 2, y: 3 }];
    await updateOverlayLayout("connection-1", "public", layout);

    expect(query).toHaveBeenCalledOnce();
    const [statement, parameters] = query.mock.calls[0];
    expect(statement).toContain("$3::text::jsonb");
    expect(parameters).toEqual(["connection-1", "public", JSON.stringify(layout)]);
  });

  it("atomically upgrades an old suggestion workflow generation", async () => {
    query.mockResolvedValueOnce([{ id: "connection-1", workflow_generation: 4 }]);

    await expect(upgradeSuggestionWorkflow("connection-1")).resolves.toMatchObject({
      workflow_generation: 4,
    });

    const [statement, parameters] = query.mock.calls[0];
    expect(statement).toContain("workflow_generation = workflow_generation + 1");
    expect(statement).toContain("suggestion_workflow_version < $2");
    expect(parameters).toEqual(["connection-1", 1]);
  });
});
