"use client";

import { useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents, type FeedEvent } from "@/lib/use-kick-events";
import { pointsFor } from "@/lib/hype-score";

const ROUND_TARGET = 100;

type Team = "fire" | "water";

const TEAM_META: Record<Team, { emoji: string; name: string; keywords: RegExp }> = {
  fire: { emoji: "🔥", name: "Team Fire", keywords: /🔥|fire|flame/i },
  water: { emoji: "💧", name: "Team Water", keywords: /💧|water|wave/i },
};

function teamFor(e: FeedEvent): Team {
  const p = e.payload as Record<string, any>;
  const content = String(p?.content ?? p?.gift?.message ?? "");
  if (TEAM_META.fire.keywords.test(content)) return "fire";
  if (TEAM_META.water.keywords.test(content)) return "water";
  // no keyword: username hash keeps every viewer on a stable team
  const username: string =
    p?.sender?.username ?? p?.follower?.username ?? p?.subscriber?.username ?? p?.gifter?.username ?? "";
  const hash = [...username].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return hash % 2 === 0 ? "fire" : "water";
}

export default function BattlePage() {
  const [scores, setScores] = useState<Record<Team, number>>({ fire: 0, water: 0 });
  const [wins, setWins] = useState<Record<Team, number>>({ fire: 0, water: 0 });
  const [roundWinner, setRoundWinner] = useState<Team | null>(null);

  const { connected } = useKickEvents((e) => {
    const pts = Math.round(pointsFor(e.kind, e.payload));
    if (pts <= 0) return;
    const team = teamFor(e);

    setScores((prev) => {
      if (roundWinner) return prev;
      const next = { ...prev, [team]: prev[team] + pts };
      if (next[team] >= ROUND_TARGET) {
        setRoundWinner(team);
        setWins((w) => ({ ...w, [team]: w[team] + 1 }));
        setTimeout(() => {
          setRoundWinner(null);
          setScores({ fire: 0, water: 0 });
        }, 4_000);
      }
      return next;
    });
  });

  const total = scores.fire + scores.water;
  const firePct = total === 0 ? 50 : Math.round((scores.fire / total) * 100);

  return (
    <PageChrome
      title="Hype Battle"
      subtitle="Chat splits into two factions — say 🔥 or 💧 to pick a side (otherwise your username decides). First to 100 hype takes the round."
      connected={connected}
    >
      <section className="battle-stage">
        <div className="battle-series">
          {TEAM_META.fire.emoji} {wins.fire} <span className="muted">series</span> {wins.water} {TEAM_META.water.emoji}
        </div>
        {roundWinner && (
          <div className="battle-winner">
            {TEAM_META[roundWinner].emoji} {TEAM_META[roundWinner].name} takes the round! {TEAM_META[roundWinner].emoji}
          </div>
        )}
        <div className="battle-row">
          <div className="battle-side">
            <span className="battle-emoji">🔥</span>
            <span className="battle-score">{scores.fire}</span>
          </div>
          <div className="battle-track">
            <div className="battle-fill-fire" style={{ width: `${firePct}%` }} />
            <div className="battle-fill-water" style={{ width: `${100 - firePct}%` }} />
            <span className="battle-marker" style={{ left: `${firePct}%` }}>⚔️</span>
          </div>
          <div className="battle-side">
            <span className="battle-emoji">💧</span>
            <span className="battle-score">{scores.water}</span>
          </div>
        </div>
        <p className="muted battle-hint">
          First to {ROUND_TARGET}. Subs and KICKs are worth big damage — gift for your team!
        </p>
      </section>
    </PageChrome>
  );
}
