"use client";

import { useEffect, useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";

const SAMPLE_MS = 1_000;
const HISTORY_LEN = 300; // 5 minutes of 1s samples

/**
 * Backed by the hype engine's HighlightTracker (server-side): highlights
 * open when the engine score crosses 75, track their peak and hottest chat
 * topic, close below 65 (hysteresis) and merge near-back-to-back spikes.
 * The page renders the reel and has the AI name each captured clip.
 */

type EngineHighlight = {
  startTs: number;
  endTs: number;
  peakHype: number;
  topTopic: string | null;
  headline: string;
  closeReason: string;
};

type NamedMoment = {
  id: number;
  title: string;
  tagline: string;
  source: "ai" | "heuristic" | "naming";
  peak: number;
  at: string;
  seconds: number;
  headline: string;
};

let momentSeq = 0;

function topKindFor(h: EngineHighlight): string {
  if (/kicks gifted/i.test(h.headline)) return "kicks.gifted";
  if (/sub/i.test(h.headline)) return "channel.subscription.new";
  return "chat.message.sent";
}

export default function ReplayPage() {
  const target = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const [history, setHistory] = useState<number[]>(Array(HISTORY_LEN).fill(0));
  const [moments, setMoments] = useState<NamedMoment[]>([]);
  const [score, setScore] = useState(0);

  async function addMoment(h: EngineHighlight, name: boolean) {
    const key = `${h.startTs}-${h.endTs}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);

    const id = momentSeq++;
    const base = {
      id,
      peak: Math.round(h.peakHype),
      at: new Date(h.startTs).toLocaleTimeString(),
      seconds: Math.max(1, Math.round((h.endTs - h.startTs) / 1000)),
      headline: h.headline,
    };
    setMoments((prev) => [
      { ...base, title: name ? "Naming this moment…" : h.headline, tagline: "", source: name ? ("naming" as const) : ("heuristic" as const) },
      ...prev,
    ]);
    if (!name) return;

    const summary = h.topTopic ? `${h.headline}; chat was all about "${h.topTopic}"` : h.headline;
    const res = await fetch("/api/name-moment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, topKind: topKindFor(h) }),
    }).then((r) => r.json()).catch(() => null);
    setMoments((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              title: res?.title ?? h.headline,
              tagline: res?.tagline ?? "",
              source: res?.source ?? "heuristic",
            }
          : m
      )
    );
  }

  // Seed past highlights (captured before this page opened) from the brain.
  useEffect(() => {
    fetch("/api/assistant/state")
      .then((r) => r.json())
      .then((s) => {
        for (const h of (s.highlights ?? []) as EngineHighlight[]) void addMoment(h, false);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { connected } = useKickEvents((e) => {
    const p = e.payload as Record<string, any>;
    if (e.kind === "assistant.hype") {
      target.current = Number(p.score) || 0;
      return;
    }
    if (e.kind === "assistant.highlight") {
      void addMoment(p as EngineHighlight, true);
    }
  });

  useEffect(() => {
    const sample = setInterval(() => {
      setScore(target.current);
      setHistory((prev) => [...prev.slice(1), target.current]);
    }, SAMPLE_MS);
    return () => clearInterval(sample);
  }, []);

  return (
    <PageChrome
      title="Hype Replay"
      subtitle="The hype engine records every spike as a clip-worthy moment — lead-in included, near-back-to-back spikes merged — and AI names each one."
      connected={connected}
    >
      <section className="replay-chart-panel">
        <h2>
          Hype over the last 5 minutes{" "}
          <span className="pulse-big">{Math.round(score)}</span>
        </h2>
        <div className="pulse-chart replay-chart">
          {history.map((v, i) => (
            <div
              key={i}
              className={`pulse-bar ${v >= 75 ? "replay-bar-hot" : ""}`}
              style={{ height: `${Math.max(2, v)}%` }}
            />
          ))}
        </div>
        <p className="muted">
          Highlights open at hype ≥75 and close below 65 (hysteresis, so one moment doesn&apos;t
          get chopped into confetti).
        </p>
      </section>
      <section className="pulse-panel">
        <h2>🎞️ Clip-worthy moments</h2>
        {moments.length === 0 && (
          <p className="muted">
            No moments yet — hit 🔥 hype burst twice in a row to force a spike.
          </p>
        )}
        <ul className="replay-list">
          {moments.map((m) => (
            <li key={m.id} className={m.source === "naming" ? "replay-naming" : ""}>
              <div className="replay-title">
                {m.source === "naming" ? "✨ " : "🎬 "}
                {m.title}
                {m.source === "ai" && <span className="replay-badge">AI</span>}
              </div>
              {m.tagline && <div className="muted">{m.tagline}</div>}
              <div className="muted replay-meta">
                {m.at} · {m.seconds}s · peak {m.peak}/100 · {m.headline}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageChrome>
  );
}
