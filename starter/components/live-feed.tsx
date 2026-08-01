"use client";

import { useEffect, useState } from "react";
import type { KickEvent } from "@/lib/event-bus";

const MAX_SHOWN = 50;

function summarize(e: KickEvent): string {
  const p = e.payload as Record<string, any>;
  switch (e.type.replace(/^fake:/, "")) {
    case "chat.message.sent":
      return `${p?.sender?.username ?? "?"}: ${p?.content ?? ""}`;
    case "channel.followed":
      return `${p?.follower?.username ?? "?"} followed`;
    case "kicks.gifted":
      return `${p?.gifter?.username ?? "?"} gifted ${p?.gift?.amount ?? "?"} KICKs (${p?.gift?.name ?? ""})`;
    case "channel.subscription.new":
      return `new sub`;
    case "channel.subscription.gifts":
      return `gifted subs`;
    case "livestream.status.updated":
      return p?.is_live ? "stream went LIVE" : "stream ended";
    default:
      return JSON.stringify(p).slice(0, 120);
  }
}

export default function LiveFeed() {
  const [events, setEvents] = useState<KickEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      const event: KickEvent = JSON.parse(msg.data);
      setEvents((prev) => [event, ...prev].slice(0, MAX_SHOWN));
    };
    return () => source.close();
  }, []);

  async function inject(type: string) {
    await fetch("/api/fake-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
  }

  return (
    <section>
      <h2>Live feed {connected ? "🟢" : "🔴 (reconnecting…)"}</h2>
      <div className="row">
        <span className="muted">Inject fake:</span>
        <button onClick={() => inject("chat.message.sent")}>chat</button>
        <button onClick={() => inject("channel.followed")}>follow</button>
        <button onClick={() => inject("kicks.gifted")}>kicks gift</button>
      </div>
      <ul className="feed">
        {events.length === 0 && <li className="muted">No events yet — inject a fake one or subscribe to a live channel.</li>}
        {events.map((e) => (
          <li key={e.id}>
            <code>{e.type}</code> {summarize(e)}
            <span className="muted"> · {new Date(e.receivedAt).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
