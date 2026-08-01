import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectionIdFromRequest,
  createOverlayAccessToken,
  findConnectionById,
} = vi.hoisted(() => ({
  connectionIdFromRequest: vi.fn(),
  createOverlayAccessToken: vi.fn(),
  findConnectionById: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ appUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/kick/repository", () => ({ findConnectionById }));
vi.mock("@/lib/session", () => ({
  connectionIdFromRequest,
  createOverlayAccessToken,
  statelessKickMode: () => false,
  statelessSessionFromRequest: vi.fn(),
}));

import { POST } from "@/app/api/overlay/access/route";

describe("overlay access route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionIdFromRequest.mockResolvedValue("connection-1");
    findConnectionById.mockResolvedValue({ active: true, workflow_generation: 7 });
    createOverlayAccessToken.mockReturnValue("share-token");
  });

  it("creates an unauthenticated overlay URL for the signed-in connection", async () => {
    const response = await POST(new Request("http://localhost:3000/api/overlay/access", {
      body: JSON.stringify({ layout: [] }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "http://localhost:3000/overlay/share-token",
    });
    expect(createOverlayAccessToken).toHaveBeenCalledWith({
      connectionId: "connection-1",
      workflowGeneration: 7,
    });
  });

  it("does not create a URL without an authenticated connection", async () => {
    connectionIdFromRequest.mockResolvedValue(undefined);
    const response = await POST(new Request("http://localhost:3000/api/overlay/access", {
      headers: { origin: "http://localhost:3000" },
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(createOverlayAccessToken).not.toHaveBeenCalled();
  });
});
