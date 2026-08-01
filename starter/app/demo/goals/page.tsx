"use client";

import { useEffect, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";

type GoalKey = "follows" | "subs" | "kicks";

const GOAL_META: Record<GoalKey, { label: string; emoji: string }> = {
  follows: { label: "New follows", emoji: "➕" },
  subs: { label: "New subs", emoji: "⭐" },
  kicks: { label: "KICKs gifted", emoji: "🚀" },
};

const DEFAULT_TARGETS: Record<GoalKey, number> = { follows: 10, subs: 5, kicks: 500 };
const STORAGE_KEY = "kick-goal-targets";

export default function GoalsPage() {
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [progress, setProgress] = useState<Record<GoalKey, number>>({ follows: 0, subs: 0, kicks: 0 });
  const [celebrating, setCelebrating] = useState<GoalKey | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setTargets({ ...DEFAULT_TARGETS, ...JSON.parse(saved) });
  }, []);

  const { connected } = useKickEvents((e) => {
    const p = e.payload as Record<string, any>;
    setProgress((prev) => {
      switch (e.kind) {
        case "channel.followed":
          return { ...prev, follows: prev.follows + 1 };
        case "channel.subscription.new":
          return { ...prev, subs: prev.subs + 1 };
        case "channel.subscription.gifts":
          return { ...prev, subs: prev.subs + (p?.giftees?.length ?? 1) };
        case "kicks.gifted":
          return { ...prev, kicks: prev.kicks + (Number(p?.gift?.amount) || 0) };
        default:
          return prev;
      }
    });
  });

  // Celebrate the first goal that crosses its target, once per crossing.
  const [celebrated, setCelebrated] = useState<Record<GoalKey, boolean>>({ follows: false, subs: false, kicks: false });
  useEffect(() => {
    for (const key of Object.keys(GOAL_META) as GoalKey[]) {
      if (!celebrated[key] && progress[key] >= targets[key]) {
        setCelebrated((prev) => ({ ...prev, [key]: true }));
        setCelebrating(key);
        setTimeout(() => setCelebrating(null), 5_000);
      }
    }
  }, [progress, targets, celebrated]);

  function updateTarget(key: GoalKey, value: number) {
    const next = { ...targets, [key]: Math.max(1, value) };
    setTargets(next);
    setCelebrated((prev) => ({ ...prev, [key]: progress[key] >= next[key] }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <PageChrome
      title="Goal Tracker"
      subtitle="Set stream goals for follows, subs and KICKs — progress fills live and completed goals throw a celebration."
      connected={connected}
    >
      {celebrating && (
        <div className="goal-celebration">
          <div className="confetti" aria-hidden>
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
          🎉 {GOAL_META[celebrating].label} goal reached! 🎉
        </div>
      )}
      <section className="goal-list">
        {(Object.keys(GOAL_META) as GoalKey[]).map((key) => {
          const pct = Math.min(100, Math.round((progress[key] / targets[key]) * 100));
          const done = progress[key] >= targets[key];
          return (
            <div key={key} className={`goal-row ${done ? "goal-done" : ""}`}>
              <div className="goal-label">
                <span>{GOAL_META[key].emoji} {GOAL_META[key].label}</span>
                <span className="goal-count">
                  {progress[key]} / {" "}
                  <input
                    className="goal-target"
                    type="number"
                    min={1}
                    value={targets[key]}
                    onChange={(e) => updateTarget(key, Number(e.target.value))}
                  />
                </span>
              </div>
              <div className="goal-track">
                <div className="goal-fill" style={{ width: `${pct}%` }} />
                <span className="goal-pct">{pct}%</span>
              </div>
            </div>
          );
        })}
      </section>
    </PageChrome>
  );
}
