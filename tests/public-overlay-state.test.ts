import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findOwnerConnection, query } = vi.hoisted(() => ({
  findOwnerConnection: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ query }));
vi.mock("@/lib/kick/repository", () => ({
  findConnectionById: vi.fn(),
  findOwnerConnection,
  refreshKickChannelIfStale: vi.fn(),
}));

import { GET } from "@/app/api/overlay/state/route";

describe("public overlay state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KICK_STATELESS_MODE = "true";
    findOwnerConnection.mockResolvedValue({
      active: true,
      category_id: "1",
      category_name: "Just Chatting",
      channel_slug: "bsimon",
      display_name: "bsimon",
      id: "00000000-0000-0000-0000-000000000001",
      is_live: true,
      overlay_layout: [],
      profile_picture: null,
      stream_title: "Live now",
      updated_at: new Date().toISOString(),
    });
    query
      .mockResolvedValueOnce([
        {
          content: "Public message",
          created_at: "2026-08-01T02:00:00.000Z",
          message_id: "message-1",
          sender_username: "viewer",
        },
      ])
      // Remaining queries (analysis windows, hype lookback) return no rows.
      .mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.KICK_STATELESS_MODE;
  });

  it("uses the persisted owner without a signed-in cookie", async () => {
    const response = await GET(
      new Request("http://localhost/api/overlay/state?public=overlay"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      channel: { slug: "bsimon" },
      messages: [{ content: "Public message", username: "viewer" }],
    });
    expect(findOwnerConnection).toHaveBeenCalledOnce();
  });

  it("serves demo state without a cookie or database connection", async () => {
    const response = await GET(
      new Request("http://localhost/api/overlay/state?demo=1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      channel: { slug: "bsimon" },
      live: true,
      privateContext: { notes: expect.any(Array) },
      suggestion: { basis: "chat" },
      surfaceContent: {
        glassesCues: expect.any(Array),
        phoneTopics: expect.any(Array),
        viewerCount: "1.8K",
      },
    });
    expect(findOwnerConnection).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
