import { randomUUID } from "crypto";
import { eventBus } from "@/lib/event-bus";
import {
  advanceBet,
  createBet,
  createPrediction,
  listPredictions,
  placeWager,
} from "@/lib/assistant/bets-store";
import { publishAssistant } from "@/lib/assistant/publish";

/**
 * Scripted story mode: viewer bets the streamer talks to the girls on the
 * left → streamer accepts → chat spams "67" → hype spikes and the meme drops
 * → the AI agent watches, validates and pays out. Drives the same store and
 * bus a real client would.
 */

type Scheduler = (fn: () => void, ms: number) => unknown;

type DemoContext = { now: () => number; schedule: Scheduler; state: { betId?: string } };

export type DemoStep = {
  id: string;
  label: string;
  /** Delay after the previous step. */
  delayMs: number;
  run: (ctx: DemoContext) => void;
};

const BURST_LINES = [
  "67", "67 67 67", "SIXTY SEVEN 67", "67 🔥🔥", "tung tung sahur 67",
  "67 67", "LMAOOO 67", "67 is the answer", "67 forever", "67 67 67 67",
  "chat said 67", "67 💀", "everyone type 67", "67!!!",
];

const CHATTERS = [
  "KICK_lord", "zaza_w", "HypeKing", "sammyy", "botnextdoor", "meme_master",
  "BigPapi", "ghostface", "vibezonly", "toxicsaint",
];

function publishChat(content: string, username: string) {
  eventBus.publish({
    id: randomUUID(),
    type: "fake:chat.message.sent",
    receivedAt: new Date().toISOString(),
    payload: {
      message_id: randomUUID(),
      content,
      sender: { user_id: 1000, username, identity: { username_color: "#53fc18" } },
    },
  });
}

/** Manual injector: flood chat with "67" so the meme detector fires. */
export function burst67(schedule: Scheduler = (fn, ms) => setTimeout(fn, ms)): void {
  BURST_LINES.forEach((line, i) =>
    schedule(() => publishChat(line, CHATTERS[i % CHATTERS.length]), i * 250),
  );
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "bet-created",
    label: "@HypeKing bets 50 KICKs",
    delayMs: 0,
    run: (ctx) => {
      const bet = createBet(
        "HypeKing",
        50,
        "If you talk to the girls on the left",
        45 * 60_000,
        ctx.now(),
      );
      ctx.state.betId = bet.id;
    },
  },
  {
    id: "bet-accepted",
    label: "Streamer accepts the bet",
    delayMs: 3_000,
    run: (ctx) => advanceBet(ctx.state.betId!, "accept"),
  },
  {
    id: "chat-burst",
    label: 'Chat starts spamming "67"',
    delayMs: 2_500,
    run: (ctx) => {
      BURST_LINES.forEach((line, i) =>
        ctx.schedule(() => publishChat(line, CHATTERS[i % CHATTERS.length]), i * 250),
      );
    },
  },
  {
    id: "wagers",
    label: "Wagers pour into the prediction",
    delayMs: 5_000,
    run: (ctx) => {
      const open =
        listPredictions().find((p) => p.status === "open") ??
        createPrediction("Will Neon talk to the girls on the left?", 45 * 60_000, ctx.now());
      placeWager(open.id, "sammyy", "yes", 230, ctx.now());
      placeWager(open.id, "ghostface", "no", 50, ctx.now());
    },
  },
  {
    id: "bet-watching",
    label: "AI agent analyzing the stream…",
    delayMs: 3_000,
    run: (ctx) => advanceBet(ctx.state.betId!, "watch"),
  },
  {
    id: "bet-validated",
    label: "Event detected — bet validated",
    delayMs: 4_000,
    run: (ctx) => advanceBet(ctx.state.betId!, "validate"),
  },
  {
    id: "bet-paid",
    label: "Payout sent to @HypeKing",
    delayMs: 2_500,
    run: (ctx) => advanceBet(ctx.state.betId!, "pay"),
  },
  {
    id: "finale",
    label: "The loop is complete",
    delayMs: 2_000,
    run: (ctx) =>
      publishAssistant("assistant.summary", {
        text: "Full loop complete: bet → hype → meme → AI validation → payout 🎬",
        at: ctx.now(),
        source: "heuristic",
      }),
  },
];

type DemoState = { runId: number; playing: boolean; step: string | null };

declare global {
  // survives Next.js dev-mode module reloads
  var __assistantDemo: DemoState | undefined;
}

const demo: DemoState = (globalThis.__assistantDemo ??= {
  runId: 0,
  playing: false,
  step: null,
});

export function playDemo(opts?: { schedule?: Scheduler; now?: () => number }): void {
  if (demo.playing) return;
  const schedule = opts?.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const now = opts?.now ?? Date.now;
  const runId = ++demo.runId;
  demo.playing = true;
  demo.step = null;

  const ctx: DemoContext = {
    now,
    // guard every scheduled callback so stopDemo() cancels the run
    schedule: (fn, ms) =>
      schedule(() => {
        if (demo.runId === runId) fn();
      }, ms),
    state: {},
  };

  let at = 0;
  for (const [i, step] of DEMO_STEPS.entries()) {
    at += step.delayMs;
    ctx.schedule(() => {
      demo.step = step.id;
      publishAssistant("assistant.demo", { status: "playing", step: step.id, label: step.label });
      try {
        step.run(ctx);
      } catch (e) {
        console.error(`demo step ${step.id} failed`, e);
      }
      if (i === DEMO_STEPS.length - 1) {
        demo.playing = false;
        demo.step = null;
        publishAssistant("assistant.demo", { status: "done" });
      }
    }, at);
  }
}

export function stopDemo(): void {
  demo.runId++;
  demo.playing = false;
  demo.step = null;
}

export function demoStatus(): { playing: boolean; step: string | null } {
  return { playing: demo.playing, step: demo.step };
}
