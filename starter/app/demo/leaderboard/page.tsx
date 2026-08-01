"use client";

import { useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";

type Supporter = { kicks: number; giftedSubs: number };

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [supporters, setSupporters] = useState<Map<string, Supporter>>(new Map());
  const [followers, setFollowers] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [totals, setTotals] = useState({ kicks: 0, follows: 0, subs: 0, messages: 0 });

  const { connected } = useKickEvents((e) => {
    const p = e.payload as Record<string, any>;
    switch (e.kind) {
      case "kicks.gifted": {
        const name = p?.gifter?.username ?? "?";
        const amount = Number(p?.gift?.amount) || 0;
        setSupporters((prev) => {
          const next = new Map(prev);
          const cur = next.get(name) ?? { kicks: 0, giftedSubs: 0 };
          next.set(name, { ...cur, kicks: cur.kicks + amount });
          return next;
        });
        setTotals((t) => ({ ...t, kicks: t.kicks + amount }));
        break;
      }
      case "channel.subscription.gifts": {
        const name = p?.gifter?.username ?? "?";
        const count = p?.giftees?.length ?? 1;
        setSupporters((prev) => {
          const next = new Map(prev);
          const cur = next.get(name) ?? { kicks: 0, giftedSubs: 0 };
          next.set(name, { ...cur, giftedSubs: cur.giftedSubs + count });
          return next;
        });
        setTotals((t) => ({ ...t, subs: t.subs + count }));
        break;
      }
      case "channel.followed":
        setFollowers((prev) => [p?.follower?.username ?? "?", ...prev].slice(0, 8));
        setTotals((t) => ({ ...t, follows: t.follows + 1 }));
        break;
      case "channel.subscription.new":
        setSubs((prev) => [p?.subscriber?.username ?? "?", ...prev].slice(0, 8));
        setTotals((t) => ({ ...t, subs: t.subs + 1 }));
        break;
      case "chat.message.sent":
        setTotals((t) => ({ ...t, messages: t.messages + 1 }));
        break;
    }
  });

  // Rank by kicks first, gifted subs as tiebreaker worth 100 kicks each.
  const ranked = [...supporters.entries()]
    .map(([name, s]) => ({ name, ...s, score: s.kicks + s.giftedSubs * 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <PageChrome
      title="Top Supporters"
      subtitle="Session leaderboard — biggest KICKs gifters up top, fresh follows and subs on the side."
      connected={connected}
    >
      <section className="board-totals">
        <div><span className="pulse-big">{totals.kicks}</span><span className="muted">KICKs</span></div>
        <div><span className="pulse-big">{totals.subs}</span><span className="muted">subs</span></div>
        <div><span className="pulse-big">{totals.follows}</span><span className="muted">follows</span></div>
        <div><span className="pulse-big">{totals.messages}</span><span className="muted">messages</span></div>
      </section>
      <section className="board-grid">
        <div className="pulse-panel pulse-wide">
          <h2>💎 Supporters</h2>
          {ranked.length === 0 && <p className="muted">No gifts yet this session</p>}
          <ol className="board-list">
            {ranked.map((s, i) => (
              <li key={s.name} className={i < 3 ? "board-podium" : ""}>
                <span className="board-rank">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span className="board-name">{s.name}</span>
                <span className="muted">
                  {s.kicks > 0 && `${s.kicks} KICKs`}
                  {s.kicks > 0 && s.giftedSubs > 0 && " · "}
                  {s.giftedSubs > 0 && `${s.giftedSubs} gifted subs`}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="pulse-panel">
          <h2>➕ New follows</h2>
          {followers.length === 0 && <p className="muted">None yet</p>}
          <ul className="compact-list">
            {followers.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}
          </ul>
        </div>
        <div className="pulse-panel">
          <h2>⭐ New subs</h2>
          {subs.length === 0 && <p className="muted">None yet</p>}
          <ul className="compact-list">
            {subs.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}
          </ul>
        </div>
      </section>
    </PageChrome>
  );
}
