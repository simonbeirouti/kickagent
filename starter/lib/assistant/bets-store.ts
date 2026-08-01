import { randomUUID } from "crypto";
import { publishAssistant } from "@/lib/assistant/publish";
import type { ActionBet, BetImpact, BetStatus, Prediction, PredictionSide } from "@/lib/assistant/types";

type Store = { predictions: Map<string, Prediction>; bets: Map<string, ActionBet> };

declare global {
  // survives Next.js dev-mode module reloads
  var __assistantStore: Store | undefined;
}

const store: Store = (globalThis.__assistantStore ??= {
  predictions: new Map(),
  bets: new Map(),
});

export function createPrediction(question: string, durationMs: number, now: number): Prediction {
  const p: Prediction = {
    id: randomUUID(),
    question,
    createdAt: now,
    endsAt: now + durationMs,
    pools: { yes: 0, no: 0 },
    wagers: [],
    status: "open",
  };
  store.predictions.set(p.id, p);
  publishAssistant("assistant.prediction.created", p);
  return p;
}

export function placeWager(
  id: string,
  user: string,
  side: PredictionSide,
  amount: number,
  now: number,
): Prediction {
  const p = store.predictions.get(id);
  if (!p) throw new Error(`unknown prediction ${id}`);
  if (p.status === "settled") throw new Error("prediction already settled");
  if (now > p.endsAt) throw new Error("prediction has ended");
  if (!(amount > 0)) throw new Error("wager must be positive");
  p.pools[side] += amount;
  p.wagers.push({ user, side, amount });
  publishAssistant("assistant.prediction.wager", { prediction: p, user, side, amount });
  return p;
}

export function oddsFor(p: Prediction): Record<PredictionSide, number> {
  const total = p.pools.yes + p.pools.no;
  if (total === 0) return { yes: 50, no: 50 };
  const yes = Math.round((p.pools.yes / total) * 100);
  return { yes, no: 100 - yes };
}

export function settlePrediction(id: string, outcome: PredictionSide): Prediction {
  const p = store.predictions.get(id);
  if (!p) throw new Error(`unknown prediction ${id}`);
  p.status = "settled";
  p.outcome = outcome;
  publishAssistant("assistant.prediction.settled", p);
  return p;
}

export function createBet(
  user: string,
  wager: number,
  condition: string,
  durationMs: number,
  now: number,
): ActionBet {
  const bet: ActionBet = {
    id: randomUUID(),
    user,
    wager,
    condition,
    createdAt: now,
    deadline: now + durationMs,
    status: "open",
  };
  store.bets.set(bet.id, bet);
  publishAssistant("assistant.bet.created", bet);
  return bet;
}

export type BetAction = "accept" | "decline" | "watch" | "validate" | "pay";

const TRANSITIONS: Record<BetAction, { from: BetStatus; to: BetStatus }> = {
  accept: { from: "open", to: "accepted" },
  decline: { from: "open", to: "declined" },
  watch: { from: "accepted", to: "watching" },
  validate: { from: "watching", to: "validated" },
  pay: { from: "validated", to: "paid" },
};

export function advanceBet(id: string, action: BetAction): ActionBet {
  const bet = store.bets.get(id);
  if (!bet) throw new Error(`unknown bet ${id}`);
  const t = TRANSITIONS[action];
  if (bet.status !== t.from) {
    throw new Error(`cannot ${action} a bet that is ${bet.status}, needs ${t.from}`);
  }
  bet.status = t.to;
  const payload: Record<string, unknown> = { ...bet };
  if (action === "pay") payload.payout = bet.wager * 2;
  publishAssistant(`assistant.bet.${t.to}`, payload);
  return bet;
}

/** Attach the hype engine's verdict to a bet; returns the updated bet. */
export function recordBetImpact(id: string, impact: BetImpact): ActionBet | null {
  const bet = store.bets.get(id);
  if (!bet) return null;
  bet.impact = impact;
  return bet;
}

export function listPredictions(): Prediction[] {
  return [...store.predictions.values()];
}

export function listBets(): ActionBet[] {
  return [...store.bets.values()];
}

export function resetAssistantStore(): void {
  store.predictions.clear();
  store.bets.clear();
}
