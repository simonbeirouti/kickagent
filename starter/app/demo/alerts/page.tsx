"use client";

import { useEffect, useRef, useState } from "react";
import PageChrome from "@/components/page-chrome";
import { useKickEvents, type FeedEvent } from "@/lib/use-kick-events";

const SHOW_MS = 4_000;

type Alert = {
  id: string;
  emoji: string;
  headline: string;
  detail: string;
  variant: "follow" | "sub" | "gift" | "kicks" | "live";
};

function toAlert(e: FeedEvent): Alert | null {
  const p = e.payload as Record<string, any>;
  switch (e.kind) {
    case "channel.followed":
      return {
        id: e.id, variant: "follow", emoji: "➕",
        headline: `${p?.follower?.username ?? "Someone"} followed!`,
        detail: "Welcome to the community",
      };
    case "channel.subscription.new":
      return {
        id: e.id, variant: "sub", emoji: "⭐",
        headline: `${p?.subscriber?.username ?? "Someone"} subscribed!`,
        detail: p?.duration > 1 ? `${p.duration} months strong` : "Brand new sub",
      };
    case "channel.subscription.gifts":
      return {
        id: e.id, variant: "gift", emoji: "🎁",
        headline: `${p?.gifter?.username ?? "Someone"} gifted ${p?.giftees?.length ?? "some"} subs!`,
        detail: "Spreading the love",
      };
    case "kicks.gifted":
      return {
        id: e.id, variant: "kicks", emoji: "🚀",
        headline: `${p?.gifter?.username ?? "Someone"} sent ${p?.gift?.amount ?? "?"} KICKs!`,
        detail: p?.gift?.message || p?.gift?.name || "",
      };
    case "livestream.status.updated":
      return {
        id: e.id, variant: "live", emoji: p?.is_live ? "🟢" : "⚫",
        headline: p?.is_live ? "Stream is LIVE" : "Stream ended",
        detail: p?.title ?? "",
      };
    default:
      return null; // chat doesn't deserve a full-screen alert
  }
}

export default function AlertsPage() {
  const queueRef = useRef<Alert[]>([]);
  const [current, setCurrent] = useState<Alert | null>(null);
  const currentRef = useRef<Alert | null>(null);
  const [queued, setQueued] = useState(0);

  const { connected } = useKickEvents((e) => {
    const alert = toAlert(e);
    if (!alert) return;
    queueRef.current.push(alert);
    setQueued(queueRef.current.length);
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (currentRef.current || queueRef.current.length === 0) return;
      const next = queueRef.current.shift()!;
      setQueued(queueRef.current.length);
      currentRef.current = next;
      setCurrent(next);
      setTimeout(() => {
        currentRef.current = null;
        setCurrent(null);
      }, SHOW_MS);
    }, 300);
    return () => clearInterval(id);
  }, []);

  return (
    <PageChrome
      title="Alert Overlay"
      subtitle="Follows, subs and kicks pop as animated alert cards, one at a time — drop it over your stream like a StreamElements alert box."
      connected={connected}
    >
      <section className="alert-stage">
        {current ? (
          <div key={current.id} className={`alert-card alert-${current.variant}`}>
            <span className="alert-emoji">{current.emoji}</span>
            <div>
              <div className="alert-headline">{current.headline}</div>
              {current.detail && <div className="alert-detail">{current.detail}</div>}
            </div>
          </div>
        ) : (
          <p className="muted alert-idle">Waiting for the next alert…</p>
        )}
        {queued > 0 && <div className="alert-queue muted">+{queued} queued</div>}
      </section>
    </PageChrome>
  );
}
