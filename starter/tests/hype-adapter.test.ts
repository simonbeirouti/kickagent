import { describe, expect, it } from "vitest";
import { toEngineEvents } from "@/lib/assistant/hype-adapter";

const TS = 1_700_000_000_000;

describe("toEngineEvents", () => {
  it("maps chat with sender id, text and timestamp", () => {
    const [ev] = toEngineEvents(
      "chat.message.sent",
      { message_id: "m1", content: "hello 67", sender: { user_id: 42, username: "zaza" } },
      TS,
    );
    expect(ev).toMatchObject({ type: "chat", userId: "42", username: "zaza", text: "hello 67", ts: TS });
  });

  it("buckets anonymous chat senders together", () => {
    const [a] = toEngineEvents("chat.message.sent", { content: "x" }, TS);
    const [b] = toEngineEvents("chat.message.sent", { content: "y" }, TS);
    expect(a.userId).toBe(b.userId);
  });

  it("maps follows and subs", () => {
    expect(toEngineEvents("channel.followed", { follower: { username: "f" } }, TS)[0].type).toBe("follow");
    expect(toEngineEvents("channel.subscription.new", { subscriber: { username: "s" } }, TS)[0].type).toBe("sub");
  });

  it("fans gift subs out to one sub event per giftee", () => {
    const evs = toEngineEvents(
      "channel.subscription.gifts",
      { gifter: { username: "g" }, giftees: [{ username: "a" }, { username: "b" }, { username: "c" }] },
      TS,
    );
    expect(evs).toHaveLength(3);
    expect(evs.every((e) => e.type === "sub")).toBe(true);
  });

  it("maps kicks with the gifted amount as raw", () => {
    const [ev] = toEngineEvents("kicks.gifted", { gifter: { username: "w" }, gift: { amount: 500 } }, TS);
    expect(ev).toMatchObject({ type: "kicks", raw: 500 });
  });

  it("weighs bets and wagers as kicks-sized stake", () => {
    const [bet] = toEngineEvents("assistant.bet.created", { user: "u", wager: 50 }, TS);
    expect(bet).toMatchObject({ type: "kicks", raw: 50 });
    const [wager] = toEngineEvents("assistant.prediction.wager", { user: "u", amount: 100 }, TS);
    expect(wager).toMatchObject({ type: "kicks", raw: 100 });
  });

  it("ignores kinds the engine doesn't score", () => {
    expect(toEngineEvents("livestream.status.updated", { is_live: true }, TS)).toHaveLength(0);
    expect(toEngineEvents("assistant.meme", { token: "67" }, TS)).toHaveLength(0);
  });
});
