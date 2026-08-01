import type { HypeSource } from "@/lib/assistant/types";
import { toEngineEvents } from "@/lib/assistant/hype-adapter";

// The hype brain: the shared zero-dependency engine package (one repo copy,
// imported straight from ../hype-engine/src — see tsconfig "@engine/*").
import { HypeEngine } from "@engine/engine.js";
import { TopicTracker } from "@engine/topics.js";
import { TrendingTopics } from "@engine/trending.js";
import { KickAssistant } from "@engine/assistant.js";
import { HighlightTracker } from "@engine/highlights.js";

export const MEME_COOLDOWN_MS = 30_000;

const VELOCITY_WINDOW_MS = 60_000;
const BREAKDOWN_WINDOW_MS = 60_000;
const SPAM_WINDOW_MS = 15_000;
const SPAM_LOOKBACK = 10;
const SPAM_MIN_MESSAGES = 6;
const HYPE_EMIT_THROTTLE_MS = 1_000;
const TOPICS_SHOWN = 5;

const SOURCE_LABELS: Record<string, string> = {
  "chat.message.sent": "High chat activity",
  "channel.followed": "New follows",
  "channel.subscription.new": "New subs",
  "channel.subscription.gifts": "Gift subs",
  "kicks.gifted": "KICKs gifted",
  "assistant.prediction.wager": "Predictions placed",
  "assistant.bet.created": "Bets & participation",
  "assistant.bet.accepted": "Bets & participation",
};

const BANDS = [
  { min: 80, name: "very-hyped", label: "Very Hyped!" },
  { min: 50, name: "hyped", label: "Hyped" },
  { min: 20, name: "warm", label: "Warming up" },
  { min: 0, name: "quiet", label: "Quiet" },
] as const;

const bandFor = (score: number) => BANDS.find((b) => score >= b.min)!;

const COACH_TIPS: Record<string, string[]> = {
  "very-hyped": [
    "Chat energy is high! 🔥 Keep the momentum!",
    "Play another intense match — viewers love the competition",
  ],
  hyped: [
    "Chat is heating up — call out your top supporters by name",
    "Good time to remind viewers about the live predictions",
  ],
  warm: [
    "Momentum building — react to chat messages out loud",
    "Tease what's coming next to keep viewers around",
  ],
  quiet: [
    "Consider talking to chat — engagement might dip soon",
    "Ask chat a question to wake them up",
  ],
};

const SUMMARY_FOR_KIND: Record<string, (p: any) => string> = {
  "assistant.bet.created": (p) => `@${p?.user} bet ${p?.wager} KICKs: ${p?.condition}`,
  "assistant.bet.accepted": (p) => `Streamer accepted @${p?.user}'s bet 👀`,
  "assistant.bet.watching": () => "AI agent is watching the stream…",
  "assistant.bet.validated": (p) => `Event detected — @${p?.user}'s bet validated ✅`,
  "assistant.bet.paid": (p) => `Payout sent: ${p?.payout} KICKs to @${p?.user} 💸`,
  "assistant.prediction.wager": (p) =>
    `@${p?.user} wagered ${p?.amount} KICKs on ${String(p?.side).toUpperCase()}`,
  "assistant.meme": (p) => `Meme "${p?.token}" detected in chat`,
};

type Message = { content: string; at: number };
type Publish = (type: string, payload: unknown) => void;

export type TopicView = { topic: string; score: number; trend: string; mentions: number };

type EngineState = {
  hype: number;
  trend: "rising" | "steady" | "falling";
  ready: boolean;
  baseline: number;
  flaggedUsers: { userId: string; username: string; ts: number }[];
};

/**
 * Server-side assistant brain. Event ingestion and 1 Hz ticks both come from
 * the runtime; scoring is delegated to the shared hype engine:
 *
 *   - HypeEngine: self-calibrating z-score 0–100 (per-user saturation,
 *     duplicate discounting, spam flagging) replaces the old decayed counter.
 *   - TopicTracker: what chat is hyped about (fast/slow momentum).
 *   - KickAssistant: pivot + trending-gap suggestions (→ coach card) and
 *     bet hype-impact verdicts via trackAction (→ bet cards).
 *   - HighlightTracker: clip markers with hysteresis (→ Hype Replay).
 *
 * Meme detection (token flooding → meme drop) and chat velocity stay here —
 * they're presentation features, not scoring.
 */
export class AssistantAgent {
  #engine = new HypeEngine();
  #topics = new TopicTracker();
  #assistant: KickAssistant;
  #highlights: HighlightTracker;

  #sources: HypeSource[] = [];
  #messages: Message[] = [];
  #lastMemeAt = -Infinity;
  #lastHypeEmitAt = -Infinity;
  #band = bandFor(0);
  #now = 0;
  #state: EngineState = { hype: 0, trend: "steady", ready: false, baseline: 0, flaggedUsers: [] };
  /** engine impact id → bet context, so verdicts land on the right card */
  #impactBets = new Map<number, { betId: string; user: string }>();

  constructor(private publish: Publish) {
    this.#assistant = new KickAssistant(this.#engine, this.#topics, {
      trending: new TrendingTopics(),
    });
    this.#highlights = new HighlightTracker({ topics: this.#topics });

    this.#assistant.on("ready", (r: any) => {
      this.publish("assistant.summary", {
        text: "Baseline locked — hype readings are calibrated, bets can open 🎯",
        at: r.ts,
        source: "heuristic",
      });
    });

    // Pivot + trending-gap suggestions become coach lines (LLM-polished by
    // the runtime like every other coach tip).
    this.#assistant.on("suggestion", (s: any) => {
      this.publish("assistant.coach", {
        text: s.text,
        band: this.#band.name,
        kind: s.kind,
        topic: s.topic ?? null,
        at: s.ts,
        source: "heuristic",
      });
    });

    this.#assistant.on("impact", (im: any) => {
      const bet = this.#impactBets.get(im.id);
      const impact = {
        delta: im.delta,
        verdict: im.verdict as "up" | "flat" | "down",
        preHype: Math.round(im.preHype),
        postHype: im.postHype,
      };
      if (bet) {
        this.#impactBets.delete(im.id);
        // The runtime attaches this to the stored bet and re-publishes it.
        this.publish("assistant.bet.impact", { id: bet.betId, impact });
      }
      const arrow = im.verdict === "up" ? "📈" : im.verdict === "down" ? "📉" : "➖";
      this.publish("assistant.summary", {
        text: `${arrow} "${im.label}" moved hype ${impact.preHype}→${impact.postHype} (${im.delta >= 0 ? "+" : ""}${im.delta})`,
        at: im.ts,
        source: "heuristic",
      });
    });

    this.#highlights.on("highlight", (h: any) => {
      this.publish("assistant.highlight", h);
    });
  }

  get score(): number {
    return this.#state.hype;
  }

  get trend(): "rising" | "steady" | "falling" {
    return this.#state.trend;
  }

  get ready(): boolean {
    return this.#state.ready;
  }

  get topTopics(): TopicView[] {
    return this.#topics.top(TOPICS_SHOWN, this.#now);
  }

  get highlights(): any[] {
    return this.#highlights.reel();
  }

  get flaggedUsers(): { userId: string; username: string; ts: number }[] {
    return this.#state.flaggedUsers;
  }

  /** Aggregated by label over the last 60s, newest first. */
  get breakdown(): HypeSource[] {
    const cutoff = this.#now - BREAKDOWN_WINDOW_MS;
    const byLabel = new Map<string, HypeSource>();
    for (const s of this.#sources) {
      if (s.at < cutoff) continue;
      const existing = byLabel.get(s.label);
      if (existing) {
        existing.points += s.points;
        existing.at = Math.max(existing.at, s.at);
      } else {
        byLabel.set(s.label, { ...s });
      }
    }
    return [...byLabel.values()].sort((a, b) => b.points - a.points);
  }

  /** Messages per minute over the rolling 60s window. */
  get velocity(): number {
    const cutoff = this.#now - VELOCITY_WINDOW_MS;
    return this.#messages.filter((m) => m.at >= cutoff).length;
  }

  ingest(kind: string, payload: unknown, now: number): void {
    this.#advanceClock(now);
    const p = payload as Record<string, any>;

    const summarize = SUMMARY_FOR_KIND[kind];
    if (summarize) {
      this.publish("assistant.summary", { text: summarize(p), at: now, source: "heuristic" });
    }

    // Feed the engine: effective (saturation-adjusted) weights come back so
    // topics can't be forced by spammers and the breakdown reflects reality.
    for (const ev of toEngineEvents(kind, payload, now)) {
      const weight = this.#engine.ingest(ev);
      if (ev.type === "chat" && !this.#engine.isFlagged(ev.userId)) {
        this.#topics.ingest(ev, weight);
      }
      this.#highlights.onEvent(ev, weight);
      this.#addSource(SOURCE_LABELS[kind] ?? kind, weight, now);
    }

    // A bet the streamer just accepted is a real-world action: measure its
    // hype impact (verdict lands ~15s later via the 'impact' event).
    if (kind === "assistant.bet.accepted" && p?.id) {
      const impactId = this.#assistant.trackAction(String(p?.condition ?? "streamer action"), now);
      this.#impactBets.set(impactId, { betId: String(p.id), user: String(p?.user ?? "viewer") });
      this.publish("assistant.summary", {
        text: `AI measuring hype impact of @${p?.user}'s dare…`,
        at: now,
        source: "heuristic",
      });
    }

    if (kind === "chat.message.sent") {
      this.#messages.push({ content: String(p?.content ?? ""), at: now });
      if (this.#messages.length > 50) this.#messages.shift();
      this.#detectSpam(now);
    }
  }

  tick(now: number): void {
    this.#advanceClock(now);
    const state = this.#engine.sample(now) as EngineState;
    this.#state = state;
    this.#assistant.onSample(state, now);
    this.#highlights.onSample(state, now);
    const bandChanged = this.#checkBand(now);
    if (bandChanged || now - this.#lastHypeEmitAt >= HYPE_EMIT_THROTTLE_MS) {
      this.#emitHype(now);
    }
  }

  #advanceClock(now: number) {
    this.#now = Math.max(this.#now, now);
  }

  #addSource(label: string, weight: number, at: number) {
    const points = Math.round(weight * 10) / 10;
    if (points <= 0) return;
    this.#sources.push({ label, points, at });
    if (this.#sources.length > 200) this.#sources.shift();
  }

  /** A token flooding ≥6 of the last 10 messages within 15s is a meme moment. */
  #detectSpam(now: number) {
    if (now - this.#lastMemeAt < MEME_COOLDOWN_MS) return;
    const recent = this.#messages
      .slice(-SPAM_LOOKBACK)
      .filter((m) => now - m.at <= SPAM_WINDOW_MS);
    if (recent.length < SPAM_MIN_MESSAGES) return;

    const latest = recent[recent.length - 1];
    const candidates = new Set(latest.content.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
    for (const token of candidates) {
      const count = recent.filter((m) => m.content.toLowerCase().includes(token)).length;
      if (count >= SPAM_MIN_MESSAGES) {
        this.#lastMemeAt = now;
        this.publish("assistant.meme", { token, score: this.#state.hype, at: now });
        return;
      }
    }
  }

  #checkBand(now: number): boolean {
    const band = bandFor(this.#state.hype);
    if (band.name === this.#band.name) return false;
    this.#band = band;
    const tips = COACH_TIPS[band.name];
    this.publish("assistant.coach", {
      text: tips[Math.floor(Math.random() * tips.length)],
      band: band.name,
      at: now,
      source: "heuristic",
    });
    this.publish("assistant.summary", {
      text: `Hype is ${band.label.toLowerCase().replace("!", "")} (${Math.round(this.#state.hype)})`,
      at: now,
      source: "heuristic",
    });
    return true;
  }

  #emitHype(now: number) {
    this.#lastHypeEmitAt = now;
    this.publish("assistant.hype", {
      score: Math.round(this.#state.hype),
      label: this.#band.label,
      velocity: this.velocity,
      breakdown: this.breakdown,
      trend: this.#state.trend,
      ready: this.#state.ready,
      topics: this.topTopics,
      flagged: this.#state.flaggedUsers.slice(-3),
      at: now,
    });
  }
}
