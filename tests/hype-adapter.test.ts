/**
 * Webhook-ingest → hype engine path: proves that the exact payload shape the
 * webhook route parses (kickChatEventSchema, same as app/api/kick/webhook)
 * maps into events HypeEngine.ingest accepts and scores.
 */
import { describe, expect, it } from "vitest";
import { HypeEngine } from "@/hype-engine/src/engine.js";
import { toHypeChatEvent } from "@/lib/kick/hype-adapter";
import { kickChatEventSchema } from "@/lib/kick/types";

const webhookPayload = (overrides: Record<string, unknown> = {}) => ({
  broadcaster: {
    is_anonymous: false,
    profile_picture: null,
    user_id: 987654,
    username: "streamer",
  },
  content: "this poker hand is unreal",
  created_at: "2026-08-01T10:00:00+00:00",
  message_id: "msg-001",
  replies_to: null,
  sender: {
    is_anonymous: false,
    profile_picture: "https://example.com/pic.png",
    user_id: 123456,
    username: "pixel_ninja",
  },
  ...overrides,
});

describe("webhook chat payload → HypeEngine adapter", () => {
  it("maps a schema-parsed payload onto the engine's event shape", () => {
    const parsed = kickChatEventSchema.parse(webhookPayload());
    const ev = toHypeChatEvent(parsed);
    expect(ev).toEqual({
      badges: [],
      id: "msg-001",
      text: "this poker hand is unreal",
      ts: Date.parse("2026-08-01T10:00:00+00:00"),
      type: "chat",
      userId: "123456",
      username: "pixel_ninja",
    });
  });

  it("buckets anonymous senders under one userId", () => {
    const parsed = kickChatEventSchema.parse(
      webhookPayload({
        sender: { is_anonymous: true, profile_picture: null, user_id: null, username: null },
      }),
    );
    const ev = toHypeChatEvent(parsed);
    expect(ev.userId).toBe("anonymous");
    expect(ev.username).toBe("Anonymous");
  });

  it("feeds adapted events through a real engine and scores them", () => {
    const engine = new HypeEngine();
    const t0 = Date.parse("2026-08-01T10:00:00+00:00");

    // 40 distinct chatters over 60s — a live-looking channel.
    for (let i = 0; i < 40; i++) {
      const parsed = kickChatEventSchema.parse(
        webhookPayload({
          content: `live chat line ${i}`,
          created_at: new Date(t0 + i * 1_500).toISOString(),
          message_id: `msg-${i}`,
          sender: {
            is_anonymous: false,
            profile_picture: null,
            user_id: 1000 + i,
            username: `viewer_${i}`,
          },
        }),
      );
      const weight = engine.ingest(toHypeChatEvent(parsed));
      expect(weight).toBeGreaterThan(0);
    }

    const state = engine.sample(t0 + 60_000);
    expect(state.hype).toBeGreaterThanOrEqual(0);
    expect(state.hype).toBeLessThanOrEqual(100);
    expect(state.ready).toBe(true); // 60s in, past the 45s warm-up
  });

  it("spam protection carries through the adapter path", () => {
    const engine = new HypeEngine();
    const t0 = Date.parse("2026-08-01T10:00:00+00:00");
    for (let i = 0; i < 40; i++) {
      const parsed = kickChatEventSchema.parse(
        webhookPayload({
          content: "SAME SPAM LINE EVERY TIME",
          created_at: new Date(t0 + i * 300).toISOString(),
          message_id: `spam-${i}`,
          sender: {
            is_anonymous: false,
            profile_picture: null,
            user_id: 555,
            username: "spammer",
          },
        }),
      );
      engine.ingest(toHypeChatEvent(parsed));
    }
    expect(engine.isFlagged("555")).toBe(true);
  });
});
