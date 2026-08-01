"use client";

import { useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents } from "@/lib/use-kick-events";

type Session = {
  gifters: Map<string, number>; // kicks amounts
  subGifters: Map<string, number>;
  subs: Set<string>;
  followers: Set<string>;
  chatters: Map<string, number>;
};

function emptySession(): Session {
  return {
    gifters: new Map(),
    subGifters: new Map(),
    subs: new Set(),
    followers: new Set(),
    chatters: new Map(),
  };
}

function sortedNames(m: Map<string, number>): string[] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

export default function CreditsPage() {
  const session = useRef<Session>(emptySession());
  const [tracked, setTracked] = useState(0);
  const [rolling, setRolling] = useState(false);

  const { connected } = useKickEvents((e) => {
    const s = session.current;
    const p = e.payload as Record<string, any>;
    switch (e.kind) {
      case "kicks.gifted":
        s.gifters.set(
          p?.gifter?.username ?? "?",
          (s.gifters.get(p?.gifter?.username ?? "?") ?? 0) + (Number(p?.gift?.amount) || 0)
        );
        break;
      case "channel.subscription.gifts":
        s.subGifters.set(
          p?.gifter?.username ?? "?",
          (s.subGifters.get(p?.gifter?.username ?? "?") ?? 0) + (p?.giftees?.length ?? 1)
        );
        break;
      case "channel.subscription.new":
        s.subs.add(p?.subscriber?.username ?? "?");
        break;
      case "channel.followed":
        s.followers.add(p?.follower?.username ?? "?");
        break;
      case "chat.message.sent":
        s.chatters.set(
          p?.sender?.username ?? "?",
          (s.chatters.get(p?.sender?.username ?? "?") ?? 0) + 1
        );
        break;
      default:
        return;
    }
    setTracked((n) => n + 1);
  });

  const s = session.current;
  const sections: [title: string, names: string[]][] = [
    ["Executive Producers", sortedNames(s.gifters)],
    ["Gift Sub Patrons", sortedNames(s.subGifters)],
    ["Starring (New Subscribers)", [...s.subs]],
    ["Loudest Voices", sortedNames(s.chatters).slice(0, 10)],
    ["New Friends (Followers)", [...s.followers]],
  ];
  const nonEmpty = sections.filter(([, names]) => names.length > 0);

  return (
    <PageChrome
      title="End Credits"
      subtitle="The page quietly collects everyone who supported the stream, then rolls movie-style credits when you end."
      connected={connected}
    >
      {!rolling ? (
        <section className="credits-lobby">
          <p>
            Tracking <strong>{tracked}</strong> supporter moments this session
            {tracked === 0 && " — leave this page open while you stream (or inject a burst)"}
            .
          </p>
          <button className="primary" onClick={() => setRolling(true)} disabled={nonEmpty.length === 0}>
            🎬 Roll credits
          </button>
        </section>
      ) : (
        <section className="credits-stage" onClick={() => setRolling(false)} title="click to stop">
          <div className="credits-roll">
            <h2 className="credits-title">Tonight&apos;s Stream</h2>
            <p className="credits-sub">was brought to you by</p>
            {nonEmpty.map(([title, names]) => (
              <div key={title} className="credits-section">
                <h3>{title}</h3>
                {names.map((name) => <p key={name}>{name}</p>)}
              </div>
            ))}
            <h2 className="credits-title">Thank you. 💚</h2>
            <p className="credits-sub">See you next stream.</p>
          </div>
        </section>
      )}
    </PageChrome>
  );
}
