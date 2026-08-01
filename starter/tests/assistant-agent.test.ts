import { beforeEach, describe, expect, it } from "vitest";
import { AssistantAgent, MEME_COOLDOWN_MS } from "@/lib/assistant/agent";

/**
 * The agent delegates scoring to the shared hype engine (z-score, saturation,
 * spam flags — the math itself is covered by hype-engine/test). These tests
 * cover the WIRING: events reach the engine, samples drive bands/emits,
 * suggestions surface as coach lines, bet accepts get impact verdicts and
 * hype spikes get captured as highlights.
 */

const NOW = 1_700_000_000_000;

let published: { type: string; payload: any }[];
let agent: AssistantAgent;

beforeEach(() => {
  published = [];
  agent = new AssistantAgent((type, payload) => published.push({ type, payload }));
});

const chat = (content: string, at: number, username = "viewer") =>
  agent.ingest(
    "chat.message.sent",
    { content, sender: { username, user_id: username } },
    at,
  );

const ofType = (t: string) => published.filter((p) => p.type === t);

/** Flood n distinct users in one burst so the crowd (not one keyboard) spikes. */
const crowd = (at: number, n: number, prefix = "u", text = () => "LETS GOOO") => {
  for (let i = 0; i < n; i++) chat(`${text()} ${i}`, at, `${prefix}${at}-${i}`);
};

describe("engine-driven scoring", () => {
  it("score is 0 before any sample and rises after a crowd burst", () => {
    agent.tick(NOW); // seed the baseline while the room is quiet
    expect(agent.score).toBe(0);
    crowd(NOW + 500, 10);
    agent.tick(NOW + 1000);
    expect(agent.score).toBeGreaterThan(20);
  });

  it("cools back down through silence", () => {
    agent.tick(NOW);
    crowd(NOW + 500, 10);
    agent.tick(NOW + 1000);
    const hot = agent.score;
    for (let t = 2; t <= 60; t++) agent.tick(NOW + t * 1000);
    expect(agent.score).toBeLessThan(hot);
    expect(agent.score).toBeLessThan(20);
  });

  it("velocity counts msgs/min and drops old messages", () => {
    chat("hi", NOW);
    chat("yo", NOW + 1000);
    chat("hey", NOW + 2000);
    expect(agent.velocity).toBe(3);
    chat("late", NOW + 63_000); // first three now out of the 60s window
    expect(agent.velocity).toBe(1);
  });

  it("labels breakdown sources: chat, bets, predictions", () => {
    chat("hello", NOW);
    agent.ingest("assistant.bet.created", { user: "u1", wager: 50, condition: "c" }, NOW);
    agent.ingest("assistant.prediction.wager", { user: "u2", amount: 100 }, NOW);
    const labels = agent.breakdown.map((s) => s.label);
    expect(labels).toContain("High chat activity");
    expect(labels).toContain("Bets & participation");
    expect(labels).toContain("Predictions placed");
  });

  it("aggregates repeated chat into one breakdown entry", () => {
    chat("a", NOW, "alice");
    chat("b", NOW + 100, "bob");
    const chatEntries = agent.breakdown.filter((s) => s.label === "High chat activity");
    expect(chatEntries).toHaveLength(1);
  });
});

describe("spam → meme detection", () => {
  it("fires assistant.meme once when a token floods recent chat", () => {
    for (let i = 0; i < 7; i++) chat("67 67 67", NOW + i * 500, `user${i}`);
    const memes = ofType("assistant.meme");
    expect(memes).toHaveLength(1);
    expect(memes[0].payload.token).toBe("67");
  });

  it("respects the cooldown, then can fire again", () => {
    for (let i = 0; i < 7; i++) chat("67 67 67", NOW + i * 500, `user${i}`);
    for (let i = 0; i < 7; i++) chat("67 67 67", NOW + 5000 + i * 500, `u${i}`);
    expect(ofType("assistant.meme")).toHaveLength(1);
    const later = NOW + MEME_COOLDOWN_MS + 10_000;
    for (let i = 0; i < 7; i++) chat("gg gg gg", later + i * 500, `w${i}`);
    expect(ofType("assistant.meme")).toHaveLength(2);
    expect(ofType("assistant.meme")[1].payload.token).toBe("gg");
  });

  it("ignores tokens spread over more than 15s", () => {
    for (let i = 0; i < 8; i++) chat("67", NOW + i * 4000, `user${i}`);
    expect(ofType("assistant.meme")).toHaveLength(0);
  });
});

describe("bands and hype emits", () => {
  it("emits coach tip and summary when a burst crosses a band upward", () => {
    agent.tick(NOW);
    crowd(NOW + 500, 12);
    agent.tick(NOW + 1000);
    expect(ofType("assistant.coach").length).toBeGreaterThan(0);
    expect(ofType("assistant.summary").length).toBeGreaterThan(0);
  });

  it("throttles assistant.hype and carries engine fields", () => {
    agent.tick(NOW);
    agent.tick(NOW + 200); // same band, within throttle → no second emit
    const hype = ofType("assistant.hype");
    expect(hype).toHaveLength(1);
    expect(hype[0].payload).toMatchObject({
      score: expect.any(Number),
      label: expect.any(String),
      trend: expect.any(String),
      ready: expect.any(Boolean),
    });
    expect(Array.isArray(hype[0].payload.breakdown)).toBe(true);
    expect(Array.isArray(hype[0].payload.topics)).toBe(true);
  });

  it("emits summary lines for bet lifecycle events", () => {
    agent.ingest("assistant.bet.validated", { user: "HypeKing", condition: "talk" }, NOW);
    expect(ofType("assistant.summary").length).toBeGreaterThan(0);
  });
});

describe("topics → coach card", () => {
  it("tracks what the crowd is on about", () => {
    agent.tick(NOW);
    for (let i = 0; i < 8; i++) chat("that poker hand was insane", NOW + 200 + i * 50, `p${i}`);
    agent.tick(NOW + 1000);
    const topics = agent.topTopics.map((t) => t.topic);
    expect(topics).toContain("poker");
  });
});

describe("bet impact verdicts (trackAction wiring)", () => {
  it("a dare followed by a crowd eruption gets an 'up' verdict on that bet", () => {
    agent.tick(NOW);
    for (let t = 1; t <= 5; t++) agent.tick(NOW + t * 1000); // quiet pre-window
    agent.ingest(
      "assistant.bet.accepted",
      { id: "b1", user: "HypeKing", wager: 50, condition: "talk to the girls" },
      NOW + 5000,
    );
    // chat erupts for the whole 15s measurement window
    for (let t = 6; t <= 22; t++) {
      crowd(NOW + t * 1000, 6, `w${t}-`);
      agent.tick(NOW + t * 1000 + 10);
    }
    const impacts = ofType("assistant.bet.impact");
    expect(impacts).toHaveLength(1);
    expect(impacts[0].payload.id).toBe("b1");
    expect(impacts[0].payload.impact.verdict).toBe("up");
    expect(impacts[0].payload.impact.delta).toBeGreaterThanOrEqual(8);
    // and the room was told
    expect(ofType("assistant.summary").some((s) => /moved hype/.test(s.payload.text))).toBe(true);
  });

  it("every accepted bet gets a verdict with pre/post numbers", () => {
    agent.tick(NOW);
    for (let t = 1; t <= 30; t++) {
      crowd(NOW + t * 1000, 5, `s${t}-`);
      agent.tick(NOW + t * 1000 + 10);
    }
    agent.ingest("assistant.bet.accepted", { id: "b2", user: "u", wager: 10, condition: "c" }, NOW + 30_000);
    for (let t = 31; t <= 47; t++) {
      crowd(NOW + t * 1000, 5, `s${t}-`);
      agent.tick(NOW + t * 1000 + 10);
    }
    const impacts = ofType("assistant.bet.impact");
    expect(impacts).toHaveLength(1);
    const { impact } = impacts[0].payload;
    expect(impacts[0].payload.id).toBe("b2");
    expect(["up", "flat", "down"]).toContain(impact.verdict);
    expect(typeof impact.delta).toBe("number");
    expect(typeof impact.preHype).toBe("number");
    expect(typeof impact.postHype).toBe("number");
  });
});

describe("highlights (HighlightTracker wiring)", () => {
  it("captures a spike as a highlight after the baseline is ready", () => {
    agent.tick(NOW);
    // steady light chatter until the engine's warm-up completes
    for (let t = 1; t <= 46; t++) {
      chat("steady chatter", NOW + t * 1000, `regular${t % 7}`);
      agent.tick(NOW + t * 1000 + 10);
    }
    expect(agent.ready).toBe(true);
    // eruption: a large crowd + a fat kicks gift
    for (let t = 47; t <= 51; t++) {
      crowd(NOW + t * 1000, 20, `e${t}-`);
      agent.ingest(
        "kicks.gifted",
        { gifter: { username: "whale_wendy", user_id: "ww" }, gift: { amount: 500 } },
        NOW + t * 1000,
      );
      agent.tick(NOW + t * 1000 + 10);
    }
    // silence lets it fall back below the exit threshold and close
    for (let t = 52; t <= 90; t++) agent.tick(NOW + t * 1000);

    const highlights = ofType("assistant.highlight");
    expect(highlights.length).toBeGreaterThanOrEqual(1);
    const h = highlights[0].payload;
    expect(h.peakHype).toBeGreaterThanOrEqual(75);
    expect(typeof h.headline).toBe("string");
    expect(agent.highlights.length).toBeGreaterThanOrEqual(1);
  });
});
