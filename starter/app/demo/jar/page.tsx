"use client";

import { useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents, type FeedEvent } from "@/lib/use-kick-events";

const JAR_TARGET = 1_000; // "support units" to fill the jar

type Drop = { id: string; emoji: string; x: number; units: number };

function dropFor(e: FeedEvent): { emoji: string; units: number } | null {
  const p = e.payload as Record<string, any>;
  switch (e.kind) {
    case "channel.followed":
      return { emoji: "🪙", units: 10 };
    case "channel.subscription.new":
      return { emoji: "💎", units: 50 };
    case "channel.subscription.gifts":
      return { emoji: "💎", units: 50 * (p?.giftees?.length ?? 1) };
    case "kicks.gifted":
      return { emoji: "🚀", units: Number(p?.gift?.amount) || 0 };
    default:
      return null;
  }
}

export default function JarPage() {
  const [units, setUnits] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [counts, setCounts] = useState({ coins: 0, gems: 0, rockets: 0 });

  const { connected } = useKickEvents((e) => {
    const drop = dropFor(e);
    if (!drop) return;

    const item: Drop = { id: e.id, ...drop, x: 25 + Math.random() * 50 };
    setDrops((prev) => [...prev.slice(-12), item]);
    setTimeout(() => setDrops((prev) => prev.filter((d) => d.id !== item.id)), 1_200);

    setUnits((prev) => prev + drop.units);
    setCounts((prev) => ({
      coins: prev.coins + (drop.emoji === "🪙" ? 1 : 0),
      gems: prev.gems + (drop.emoji === "💎" ? 1 : 0),
      rockets: prev.rockets + (drop.emoji === "🚀" ? 1 : 0),
    }));
  });

  const pct = Math.min(100, (units / JAR_TARGET) * 100);
  const full = units >= JAR_TARGET;

  return (
    <PageChrome
      title="The Support Jar"
      subtitle="Follows drop coins, subs drop gems, KICKs drop rockets — watch the jar fill toward today's support target."
      connected={connected}
    >
      <section className="jar-stage">
        <div className="jar-wrap">
          {drops.map((d) => (
            <span key={d.id} className="jar-drop" style={{ left: `${d.x}%` }}>
              {d.emoji}
            </span>
          ))}
          <div className={`jar ${full ? "jar-full" : ""}`}>
            <div className="jar-fill" style={{ height: `${pct}%` }} />
            <div className="jar-label">
              <span className="jar-units">{units}</span>
              <span className="muted">/ {JAR_TARGET}</span>
            </div>
          </div>
        </div>
        {full && <div className="jar-banner">🎉 JAR FULL — you did it, chat! 🎉</div>}
        <div className="jar-legend muted">
          🪙 ×{counts.coins} follows · 💎 ×{counts.gems} subs · 🚀 ×{counts.rockets} kicks drops
        </div>
      </section>
    </PageChrome>
  );
}
