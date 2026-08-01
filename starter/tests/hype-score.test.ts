import { describe, expect, it } from "vitest";
import { pointsFor } from "@/lib/hype-score";

// Hype scoring itself is the shared engine (see tests/assistant-agent.test.ts
// and hype-engine/test); pointsFor remains as game-page point weights.

describe("pointsFor", () => {
  it("scores chat lowest and subs higher than follows", () => {
    const chat = pointsFor("chat.message.sent", {});
    const follow = pointsFor("channel.followed", {});
    const sub = pointsFor("channel.subscription.new", {});
    expect(chat).toBeLessThan(follow);
    expect(follow).toBeLessThan(sub);
  });

  it("scales kicks with amount, clamped to 5..60", () => {
    expect(pointsFor("kicks.gifted", { gift: { amount: 1 } })).toBe(5);
    expect(pointsFor("kicks.gifted", { gift: { amount: 100 } })).toBe(30);
    expect(pointsFor("kicks.gifted", { gift: { amount: 10_000 } })).toBe(60);
    expect(pointsFor("kicks.gifted", {})).toBe(5);
  });

  it("scales gifted subs with giftee count, clamped", () => {
    expect(pointsFor("channel.subscription.gifts", { giftees: [{}] })).toBe(15);
    expect(pointsFor("channel.subscription.gifts", { giftees: Array(10).fill({}) })).toBe(60);
    expect(pointsFor("channel.subscription.gifts", {})).toBe(15);
  });

  it("scores unknown events zero", () => {
    expect(pointsFor("something.else", {})).toBe(0);
  });
});
