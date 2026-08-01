import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eventBus, type KickEvent } from "@/lib/event-bus";
import {
  advanceBet,
  createBet,
  createPrediction,
  listBets,
  listPredictions,
  oddsFor,
  placeWager,
  resetAssistantStore,
  settlePrediction,
} from "@/lib/assistant/bets-store";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

let events: KickEvent[];
const collect = (e: KickEvent) => events.push(e);

beforeEach(() => {
  resetAssistantStore();
  events = [];
  eventBus.on("event", collect);
});

afterEach(() => {
  eventBus.off("event", collect);
});

const kinds = () => events.map((e) => e.type);

describe("predictions", () => {
  it("creates an open prediction with empty pools and publishes", () => {
    const p = createPrediction("Will Neon hit 13,000 trophies?", 2 * HOUR, NOW);
    expect(p.status).toBe("open");
    expect(p.pools).toEqual({ yes: 0, no: 0 });
    expect(p.endsAt).toBe(NOW + 2 * HOUR);
    expect(listPredictions()).toHaveLength(1);
    expect(kinds()).toContain("assistant.prediction.created");
  });

  it("accumulates wagers into pools and publishes", () => {
    const p = createPrediction("q", HOUR, NOW);
    placeWager(p.id, "HypeKing", "yes", 1000, NOW + 1);
    const updated = placeWager(p.id, "doubter", "no", 480, NOW + 2);
    expect(updated.pools).toEqual({ yes: 1000, no: 480 });
    expect(updated.wagers).toHaveLength(2);
    expect(kinds().filter((k) => k === "assistant.prediction.wager")).toHaveLength(2);
  });

  it("computes odds from pools, 50/50 when empty, summing to 100", () => {
    const p = createPrediction("q", HOUR, NOW);
    expect(oddsFor(p)).toEqual({ yes: 50, no: 50 });
    placeWager(p.id, "a", "yes", 1250, NOW);
    const updated = placeWager(p.id, "b", "no", 480, NOW);
    const odds = oddsFor(updated);
    expect(odds).toEqual({ yes: 72, no: 28 });
    expect(odds.yes + odds.no).toBe(100);
  });

  it("rejects wagers on unknown, settled or ended predictions", () => {
    expect(() => placeWager("nope", "a", "yes", 10, NOW)).toThrow();
    const p = createPrediction("q", HOUR, NOW);
    settlePrediction(p.id, "yes");
    expect(() => placeWager(p.id, "a", "yes", 10, NOW)).toThrow(/settled/);
    const p2 = createPrediction("q2", HOUR, NOW);
    expect(() => placeWager(p2.id, "a", "yes", 10, NOW + HOUR + 1)).toThrow(/ended/);
  });

  it("rejects non-positive wagers", () => {
    const p = createPrediction("q", HOUR, NOW);
    expect(() => placeWager(p.id, "a", "yes", 0, NOW)).toThrow();
    expect(() => placeWager(p.id, "a", "yes", -5, NOW)).toThrow();
  });

  it("settles with an outcome and publishes", () => {
    const p = createPrediction("q", HOUR, NOW);
    const settled = settlePrediction(p.id, "no");
    expect(settled.status).toBe("settled");
    expect(settled.outcome).toBe("no");
    expect(kinds()).toContain("assistant.prediction.settled");
  });
});

describe("action bets", () => {
  it("creates an open bet and publishes", () => {
    const b = createBet("HypeKing", 50, "talk to the girls on the left", HOUR, NOW);
    expect(b.status).toBe("open");
    expect(b.deadline).toBe(NOW + HOUR);
    expect(listBets()).toHaveLength(1);
    expect(kinds()).toContain("assistant.bet.created");
  });

  it("walks the full lifecycle open→accepted→watching→validated→paid", () => {
    const b = createBet("HypeKing", 50, "cond", HOUR, NOW);
    expect(advanceBet(b.id, "accept").status).toBe("accepted");
    expect(advanceBet(b.id, "watch").status).toBe("watching");
    expect(advanceBet(b.id, "validate").status).toBe("validated");
    expect(advanceBet(b.id, "pay").status).toBe("paid");
    expect(kinds()).toEqual(
      expect.arrayContaining([
        "assistant.bet.accepted",
        "assistant.bet.watching",
        "assistant.bet.validated",
        "assistant.bet.paid",
      ]),
    );
  });

  it("pays out double the wager", () => {
    const b = createBet("HypeKing", 50, "cond", HOUR, NOW);
    advanceBet(b.id, "accept");
    advanceBet(b.id, "watch");
    advanceBet(b.id, "validate");
    advanceBet(b.id, "pay");
    const paid = events.find((e) => e.type === "assistant.bet.paid");
    expect((paid?.payload as any).payout).toBe(100);
  });

  it("can decline an open bet, then nothing else", () => {
    const b = createBet("u", 10, "cond", HOUR, NOW);
    expect(advanceBet(b.id, "decline").status).toBe("declined");
    expect(() => advanceBet(b.id, "accept")).toThrow();
  });

  it("rejects invalid transitions and unknown ids", () => {
    const b = createBet("u", 10, "cond", HOUR, NOW);
    expect(() => advanceBet(b.id, "watch")).toThrow(/open/);
    expect(() => advanceBet(b.id, "pay")).toThrow();
    expect(() => advanceBet("nope", "accept")).toThrow();
  });
});

describe("resetAssistantStore", () => {
  it("clears everything", () => {
    createPrediction("q", HOUR, NOW);
    createBet("u", 10, "c", HOUR, NOW);
    resetAssistantStore();
    expect(listPredictions()).toHaveLength(0);
    expect(listBets()).toHaveLength(0);
  });
});
