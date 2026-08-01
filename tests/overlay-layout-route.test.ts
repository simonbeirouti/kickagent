import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateOverlayLayout } = vi.hoisted(() => ({ updateOverlayLayout: vi.fn() }));

vi.mock("@/lib/env", () => ({ appUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/kick/repository", () => ({ updateOverlayLayout }));
vi.mock("@/lib/session", () => ({
  connectionIdFromRequest: vi.fn().mockResolvedValue("connection-1"),
  statelessKickMode: () => false,
}));

import { PUT } from "@/app/api/overlay/layout/route";

describe("overlay layout route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the selected screen layout", async () => {
    const layout = [{ height: 6, id: "chat", kind: "chat", width: 8, x: 16, y: 1 }];
    const response = await PUT(new Request("http://localhost:3000/api/overlay/layout", {
      body: JSON.stringify({ layout, screen: "phone" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      method: "PUT",
    }));

    expect(response.status).toBe(200);
    expect(updateOverlayLayout).toHaveBeenCalledWith("connection-1", "phone", layout);
  });

  it("rejects a layout without a screen", async () => {
    const response = await PUT(new Request("http://localhost:3000/api/overlay/layout", {
      body: JSON.stringify({ layout: [] }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      method: "PUT",
    }));

    expect(response.status).toBe(400);
    expect(updateOverlayLayout).not.toHaveBeenCalled();
  });
});
