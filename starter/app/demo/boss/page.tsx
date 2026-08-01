"use client";

import { useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents, type FeedEvent } from "@/lib/use-kick-events";
import { pointsFor } from "@/lib/hype-score";

const BOSSES = ["👹", "🐉", "👾", "🤖", "💀", "🦑"];
const BASE_HP = 500;
const HP_GROWTH = 1.5;

type Hit = { id: string; damage: number; username: string; x: number };

function bossHp(level: number): number {
  return Math.round(BASE_HP * Math.pow(HP_GROWTH, level - 1));
}

function attacker(e: FeedEvent): string | null {
  const p = e.payload as Record<string, any>;
  return (
    p?.sender?.username ??
    p?.follower?.username ??
    p?.subscriber?.username ??
    p?.gifter?.username ??
    null
  );
}

export default function BossPage() {
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(BASE_HP);
  const [hits, setHits] = useState<Hit[]>([]);
  const [defeated, setDefeated] = useState(false);
  const damageByUser = useRef<Map<string, number>>(new Map());
  const [, bump] = useState(0);

  const { connected } = useKickEvents((e) => {
    const damage = Math.round(pointsFor(e.kind, e.payload));
    const username = attacker(e);
    if (damage <= 0 || !username) return;

    damageByUser.current.set(username, (damageByUser.current.get(username) ?? 0) + damage);
    bump((n) => n + 1);

    const hit: Hit = { id: e.id, damage, username, x: 20 + Math.random() * 60 };
    setHits((prev) => [...prev.slice(-8), hit]);
    setTimeout(() => setHits((prev) => prev.filter((h) => h.id !== hit.id)), 1_500);

    setHp((prev) => {
      const next = prev - damage;
      if (next > 0) return next;
      // boss down: brief defeat state, then a tougher one spawns
      setDefeated(true);
      setTimeout(() => {
        setDefeated(false);
        setLevel((l) => l + 1);
      }, 2_500);
      return 0;
    });
  });

  // spawn full HP for the new level once the defeat animation ends
  const maxHp = bossHp(level);
  if (!defeated && hp === 0) setHp(maxHp);

  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  const topDealers = [...damageByUser.current.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <PageChrome
      title="Stream Boss"
      subtitle="Chat attacks the boss: messages chip away, follows sting, subs and KICKs hit hard. Defeat it and a stronger one spawns."
      connected={connected}
    >
      <section className="boss-stage">
        <div className="boss-level">Level {level}</div>
        <div className={`boss-sprite ${defeated ? "boss-defeated" : hits.length ? "boss-hurt" : ""}`}>
          {defeated ? "💥" : BOSSES[(level - 1) % BOSSES.length]}
        </div>
        {defeated && <div className="boss-victory">CHAT WINS! Level {level + 1} boss incoming…</div>}
        <div className="boss-hpbar">
          <div className="boss-hpfill" style={{ width: `${pct}%` }} />
          <span className="boss-hptext">{hp} / {maxHp} HP</span>
        </div>
        {hits.map((h) => (
          <div key={h.id} className="boss-hit" style={{ left: `${h.x}%` }}>
            -{h.damage}
            <span className="boss-hit-user">{h.username}</span>
          </div>
        ))}
      </section>
      <section className="pulse-panel">
        <h2>⚔️ Top damage dealers</h2>
        {topDealers.length === 0 && <p className="muted">No damage yet — say something in chat!</p>}
        <ol className="compact-list">
          {topDealers.map(([name, dmg]) => (
            <li key={name}>{name} <span className="muted">{dmg} dmg</span></li>
          ))}
        </ol>
      </section>
    </PageChrome>
  );
}
