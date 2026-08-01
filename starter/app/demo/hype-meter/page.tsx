"use client";

import { useEffect, useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents, type FeedEvent } from "@/lib/use-kick-events";

const TICK_MS = 100;

// Hype train hysteresis on the engine score: starts at 80, rolls until 40.
const TRAIN_START = 80;
const TRAIN_END = 40;

type Topic = { topic: string; trend: string };

function tickerLine(e: FeedEvent): string | null {
  const p = e.payload as Record<string, any>;
  switch (e.kind) {
    case "chat.message.sent":
      return `💬 ${p?.sender?.username}`;
    case "channel.followed":
      return `➕ ${p?.follower?.username} followed`;
    case "channel.subscription.new":
      return `⭐ ${p?.subscriber?.username ?? "someone"} subscribed`;
    case "channel.subscription.gifts":
      return `🎁 ${p?.gifter?.username} gifted ${p?.giftees?.length ?? "?"} subs`;
    case "kicks.gifted":
      return `🚀 ${p?.gifter?.username} sent ${p?.gift?.amount} KICKs`;
    default:
      return null;
  }
}

/**
 * The meter is driven by the server-side hype engine (assistant.hype events):
 * a self-calibrating z-score — "unusually busy for THIS channel right now" —
 * with per-user saturation and duplicate discounting, not a raw event counter.
 */
export default function HypeMeterPage() {
  const target = useRef(0);
  const [score, setScore] = useState(0);
  const [train, setTrain] = useState(false);
  const [trend, setTrend] = useState<string>("steady");
  const [ready, setReady] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [flagged, setFlagged] = useState(0);
  const [ticker, setTicker] = useState<string[]>([]);

  const { connected } = useKickEvents((e) => {
    if (e.kind === "assistant.hype") {
      const p = e.payload as Record<string, any>;
      target.current = Number(p.score) || 0;
      setTrend(p.trend ?? "steady");
      setReady(Boolean(p.ready));
      setTopics((p.topics ?? []).slice(0, 4));
      setFlagged(Array.isArray(p.flagged) ? p.flagged.length : 0);
      return;
    }
    const line = tickerLine(e);
    if (line) setTicker((prev) => [line, ...prev].slice(0, 6));
  });

  useEffect(() => {
    // Engine samples arrive ~1 Hz; ease the needle between them.
    const id = setInterval(() => {
      setScore((s) => {
        const next = s + (target.current - s) * 0.18;
        setTrain((active) => (active ? next > TRAIN_END : next >= TRAIN_START));
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const pct = Math.round(score);
  const level = pct >= 80 ? "🔥🔥🔥" : pct >= 50 ? "🔥🔥" : pct >= 20 ? "🔥" : "💤";
  const trendArrow = trend === "rising" ? "📈 rising" : trend === "falling" ? "📉 falling" : "steady";

  return (
    <PageChrome
      title="Hype Meter"
      subtitle="Powered by the hype engine: a self-calibrating z-score of chat, follows, subs and KICKs — spam-resistant, and 80 starts the hype train."
      connected={connected}
    >
      <section className={`hype-stage ${train ? "train-active" : ""}`}>
        {train && <div className="hype-train-banner">🚂 HYPE TRAIN 🚂</div>}
        <div className="hype-readout">
          <span className="hype-level">{level}</span>
          <span className="hype-number">
            {pct}
            <span className="hype-trend">{trendArrow}</span>
          </span>
        </div>
        <div className="hype-track">
          <div className="hype-fill" style={{ width: `${pct}%` }} />
          <div className="hype-threshold" title="hype train threshold" />
        </div>
        {topics.length > 0 && (
          <div className="hype-topic-row">
            {topics.map((t) => (
              <span key={t.topic} className={`asst-topic-chip asst-topic-${t.trend}`}>
                {t.trend === "rising" ? "↑ " : ""}
                {t.topic}
              </span>
            ))}
          </div>
        )}
        <ul className="hype-ticker">
          {ticker.map((line, i) => (
            <li key={`${line}-${i}`} style={{ opacity: 1 - i * 0.15 }}>{line}</li>
          ))}
        </ul>
        <div className="hype-flags">
          {ready ? "baseline locked" : "calibrating baseline…"}
          {flagged > 0 && ` · 🛡 ${flagged} spammer${flagged > 1 ? "s" : ""} filtered`}
        </div>
      </section>
    </PageChrome>
  );
}
