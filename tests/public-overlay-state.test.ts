import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { widgetKindSchema } from "@/lib/overlay-layout";

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
    const analysis = {
      basis: "chat",
      generated_at: new Date().toISOString(),
      hype_score: 78,
      status: "complete",
      suggestion: "Ask chat which setup change made the biggest difference.",
      summary: "Chat is comparing the setup upgrades that improved their streams.",
      topics: [{ label: "Setup upgrades", percentage: 80 }],
      window_start: new Date().toISOString(),
    };
    query
      .mockResolvedValueOnce([
        {
          content: "Public message",
          created_at: "2026-08-01T02:00:00.000Z",
          message_id: "message-1",
          sender_username: "viewer",
        },
      ])
      .mockResolvedValueOnce([analysis])
      .mockResolvedValueOnce([analysis])
      // Remaining queries (hype lookback) return no rows.
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
      // Hype comes from the engine's chat lookback (empty here), not the
      // agent's stored hype_score.
      hypeReady: false,
      hypeScore: 0,
      hypeTrend: "steady",
      messages: [{ content: "Public message", username: "viewer" }],
      suggestion: { basis: "chat" },
      summary: {
        text: "Chat is comparing the setup upgrades that improved their streams.",
        topics: [{ label: "Setup upgrades", percentage: 80 }],
      },
    });
    expect(findOwnerConnection).toHaveBeenCalledOnce();
  });

  it("carries live engine hype fields and every placed widget kind to the public overlay", async () => {
    const everyKindLayout = widgetKindSchema.options.map((kind, index) => ({
      height: 2,
      id: kind,
      kind,
      width: 3,
      x: index,
      y: 0,
    }));
    findOwnerConnection.mockReset();
    query.mockReset();
    findOwnerConnection.mockResolvedValue({
      active: true,
      category_id: "1",
      category_name: "Just Chatting",
      channel_slug: "bsimon",
      display_name: "bsimon",
      id: "00000000-0000-4000-8000-000000000002",
      is_live: true,
      overlay_layout: [],
      profile_picture: null,
      screen_layouts: { public: everyKindLayout },
      stream_title: "Live now",
      updated_at: new Date().toISOString(),
    });
    // Two minutes of steady chat — comfortably past the engine's 45s warm-up,
    // so the baseline locks and the score is a live computation, never a
    // static or agent-stored number.
    const now = Date.now();
    const hypeRows = Array.from({ length: 40 }, (_, index) => ({
      content: index % 3 === 0 ? "LETS GO 🔥" : "this stream is wild",
      created_at: new Date(now - 120_000 + index * 2_800).toISOString(),
      message_id: `hype-message-${index}`,
      sender_user_id: String(100 + (index % 7)),
      sender_username: `viewer${index % 7}`,
    }));
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(hypeRows)
      .mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/overlay/state?public=overlay"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.hypeReady).toBe(true);
    expect(body.hypeScore).toBeGreaterThanOrEqual(0);
    expect(body.hypeScore).toBeLessThanOrEqual(100);
    expect(["falling", "rising", "steady"]).toContain(body.hypeTrend);
    expect(
      body.screenLayouts.public.map((item: { kind: string }) => item.kind),
    ).toEqual([...widgetKindSchema.options]);
  });

  it("keeps statement-only analysis compatible with graceful defaults", async () => {
    findOwnerConnection.mockReset();
    query.mockReset();
    findOwnerConnection.mockResolvedValue({
      active: true,
      category_id: "1",
      category_name: "Just Chatting",
      channel_slug: "bsimon",
      display_name: "bsimon",
      id: "00000000-0000-4000-8000-000000000001",
      is_live: true,
      overlay_layout: [],
      profile_picture: null,
      stream_title: "Live now",
      updated_at: new Date().toISOString(),
    });
    const analysis = {
      basis: "chat",
      generated_at: new Date().toISOString(),
      hype_score: null,
      status: "complete",
      suggestion: "Ask chat which setup upgrade mattered most.",
      summary: null,
      topics: [],
      window_start: new Date().toISOString(),
    };
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([analysis])
      .mockResolvedValueOnce([analysis])
      // Remaining queries (hype lookback) return no rows.
      .mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/overlay/state?public=overlay"));

    await expect(response.json()).resolves.toMatchObject({
      hypeScore: 0,
      suggestion: { text: "Ask chat which setup upgrade mattered most." },
      summary: null,
    });
  });
});
