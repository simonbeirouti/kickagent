import { HypeEngine } from "@/hype-engine/src/engine.js";
import { TopicTracker } from "@/hype-engine/src/topics.js";

export type HypeTrend = "falling" | "rising" | "steady";

export interface HypeChatRow {
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

const TOP_TOPIC_COUNT = 5;

/**
 * Replays a trailing window of chat through a fresh HypeEngine/TopicTracker to get
 * the same self-calibrating "unusually busy for this channel, right now" signal the
 * standalone hype-engine demo produces (see hype-engine/README.md and
 * docs/ARCHITECTURE.md §L3). The workflow step this runs in is stateless between
 * ticks, so there's no long-lived engine instance to sample incrementally — the
 * caller must pass enough trailing history for the baseline to warm up
 * (HypeEngine's default warmupMs is 45s; rows must be ordered oldest-first).
 */
export function computeHypeSnapshot(rows: readonly HypeChatRow[], asOf: number): HypeSnapshot {
  const engine = new HypeEngine();
  const topics = new TopicTracker();

  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const event = {
      badges: [] as string[],
      id: row.message_id,
      text: row.content,
      ts,
      type: "chat" as const,
      userId: row.sender_user_id ?? row.sender_username,
      username: row.sender_username,
    };
    const weight = engine.ingest(event);
    if (!engine.isFlagged(event.userId)) topics.ingest(event, weight);
  }

  const state = engine.sample(asOf);
  return {
    ready: state.ready,
    score: state.hype,
    topTopics: topics.top(TOP_TOPIC_COUNT, asOf).map((topic) => ({
      mentions: topic.mentions,
      topic: topic.topic,
      trend: topic.trend,
    })),
    trend: state.trend,
  };
}
