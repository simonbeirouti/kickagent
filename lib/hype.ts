import { KickAssistant } from "@/hype-engine/src/assistant.js";
import { HypeEngine } from "@/hype-engine/src/engine.js";
import { HighlightTracker } from "@/hype-engine/src/highlights.js";
import { TopicTracker } from "@/hype-engine/src/topics.js";
import { TrendingTopics } from "@/hype-engine/src/trending.js";

export type HypeTrend = "falling" | "rising" | "steady";

export interface HypeChatRow extends Record<string, unknown> {
  readonly content: string;
  readonly created_at: string;
  readonly message_id: string;
  readonly sender_user_id: string | null;
  readonly sender_username: string;
}

export interface HypeTopic {
  readonly mentions: number;
  readonly topic: string;
  readonly trend: HypeTrend;
}

export interface HypeSnapshot {
  readonly ready: boolean;
  readonly score: number;
  readonly topTopics: readonly HypeTopic[];
  readonly trend: HypeTrend;
}

export interface HypeHighlightInfo {
  /** Seconds between the highlight closing and `asOf`; 0 when still open. */
  readonly agoSeconds: number;
  readonly headline: string;
  readonly peak: number;
}

/**
 * Everything the suggestion agent needs to reason about the room in one struct:
 * the quantitative signal (score/trend), what chat is on (topics + momentum),
 * what it is missing (trending gap), what just happened (last highlight), and
 * whose lines to discount (flagged spammers, usernames only).
 */
export interface HypeContext extends HypeSnapshot {
  readonly flaggedSpammers: readonly string[];
  readonly lastHighlight: HypeHighlightInfo | null;
  readonly trendingGap: string | null;
}

export interface HypeContextOptions {
  /** Override the platform trending list (hottest first); defaults to the engine's mock. */
  readonly trendingTopics?: readonly string[];
}

const TOP_TOPIC_COUNT = 5;
const FLAGGED_SPAMMER_LIMIT = 5;
// The live overlay samples the engine at 1–4 Hz; the replay must do the same so
// the baseline/variance EMAs, the trend buffer, and highlight enter/exit
// crossings evolve exactly like they would have in real time.
const SAMPLE_INTERVAL_MS = 1_000;

interface HypeChatEvent {
  readonly badges: string[];
  readonly id: string;
  readonly text: string;
  readonly ts: number;
  readonly type: "chat";
  readonly userId: string;
  readonly username: string;
}

interface OpenHighlight {
  readonly crossTs: number;
  readonly peakHype: number;
  readonly startTs: number;
  readonly topTopic: string | null;
}

interface ClosedHighlight extends OpenHighlight {
  readonly endTs: number;
  readonly headline: string;
}

interface FlaggedUser {
  readonly ts: number;
  readonly userId: string;
  readonly username: string;
}

/** Back-compat subset used by the overlay state route. */
export function computeHypeSnapshot(rows: readonly HypeChatRow[], asOf: number): HypeSnapshot {
  const { ready, score, topTopics, trend } = computeHypeContext(rows, asOf);
  return { ready, score, topTopics, trend };
}

/**
 * Replays a trailing window of chat through a fresh HypeEngine/TopicTracker/
 * HighlightTracker stack to get the same self-calibrating "unusually busy for
 * this channel, right now" signal the standalone hype-engine demo produces
 * (see hype-engine/README.md and docs/ARCHITECTURE.md §L3). The workflow step
 * this runs in is stateless between ticks, so there's no long-lived engine
 * instance to sample incrementally — the caller must pass enough trailing
 * history for the baseline to warm up (HypeEngine's default warmupMs is 45s;
 * rows must be ordered oldest-first).
 *
 * The replay steps a virtual clock from the first row to `asOf`, sampling the
 * engine every SAMPLE_INTERVAL_MS between ingests, mirroring the live 1–4 Hz
 * loop. Trending-gap analysis reuses KickAssistant.trendingGap (TrendingTopics
 * vs the TopicTracker) rather than reimplementing the coverage rules.
 */
export function computeHypeContext(
  rows: readonly HypeChatRow[],
  asOf: number,
  options: HypeContextOptions = {},
): HypeContext {
  const engine = new HypeEngine();
  const topics = new TopicTracker();
  const highlights = new HighlightTracker({ topics });
  const trending = options.trendingTopics
    ? new TrendingTopics([...options.trendingTopics])
    : new TrendingTopics();
  const assistant = new KickAssistant(engine, topics, { trending });

  const events = toEvents(rows, asOf);
  const ingest = (event: HypeChatEvent) => {
    const weight = engine.ingest(event);
    if (!engine.isFlagged(event.userId)) topics.ingest(event, weight);
  };

  let index = 0;
  if (events.length > 0) {
    for (let now = events[0]!.ts; now < asOf; now += SAMPLE_INTERVAL_MS) {
      while (index < events.length && events[index]!.ts <= now) ingest(events[index++]!);
      highlights.onSample(engine.sample(now), now);
    }
  }
  while (index < events.length) ingest(events[index++]!);
  const state = engine.sample(asOf);
  highlights.onSample(state, asOf);

  return {
    flaggedSpammers: currentlyFlaggedUsernames(engine),
    lastHighlight: lastHighlightInfo(highlights, asOf),
    ready: state.ready,
    score: state.hype,
    topTopics: topics.top(TOP_TOPIC_COUNT, asOf).map((topic) => ({
      mentions: topic.mentions,
      topic: topic.topic,
      // hype-engine/src/*.js is untyped: TS's JS inference widens the ternary'd
      // trend field to `string` instead of the literal union it actually returns.
      trend: topic.trend as HypeTrend,
    })),
    trend: state.trend as HypeTrend,
    trendingGap: state.ready ? ((assistant.trendingGap(asOf) as string | null) ?? null) : null,
  };
}

function toEvents(rows: readonly HypeChatRow[], asOf: number): HypeChatEvent[] {
  const events: HypeChatEvent[] = [];
  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts) || ts > asOf) continue;
    events.push({
      badges: [],
      id: row.message_id,
      text: row.content,
      ts,
      type: "chat",
      userId: row.sender_user_id ?? row.sender_username,
      username: row.sender_username,
    });
  }
  return events;
}

/**
 * Usernames only — enough for the agent to discount those lines in the raw
 * chat records without leaking user ids into the prompt. The engine keeps a
 * log of flag events; filter it down to users still flagged right now.
 */
function currentlyFlaggedUsernames(engine: InstanceType<typeof HypeEngine>): string[] {
  const usernames: string[] = [];
  for (const flag of engine.flaggedUsers as readonly FlaggedUser[]) {
    if (!engine.isFlagged(flag.userId)) continue;
    if (usernames.includes(flag.username)) continue;
    usernames.push(flag.username);
    if (usernames.length >= FLAGGED_SPAMMER_LIMIT) break;
  }
  return usernames;
}

function lastHighlightInfo(
  highlights: InstanceType<typeof HighlightTracker>,
  asOf: number,
): HypeHighlightInfo | null {
  const open = highlights.open as OpenHighlight | null;
  if (open) {
    // Still riding the spike at asOf: reuse the tracker's own headline rules on
    // a snapshot of the open window (headline() is a pure formatter).
    const headline = highlights.headline({ ...open, endTs: asOf }) as string;
    return { agoSeconds: 0, headline, peak: Math.round(open.peakHype) };
  }
  const reel = highlights.reel() as readonly ClosedHighlight[];
  const last = reel[reel.length - 1];
  if (!last) return null;
  return {
    agoSeconds: Math.max(0, Math.round((asOf - last.endTs) / 1000)),
    headline: last.headline,
    peak: Math.round(last.peakHype),
  };
}
