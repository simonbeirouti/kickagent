"use client";

import { useCallback, useEffect, useState } from "react";
import type { KickSubscription } from "@/lib/kick-api";

export default function SubscriptionsPanel() {
  const [subs, setSubs] = useState<KickSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSubs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load subscriptions");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function unsubscribe(id: string) {
    await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    refresh();
  }

  return (
    <section>
      <div className="row">
        <h2>Event subscriptions</h2>
        <button onClick={refresh}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {subs.length === 0 && !error && <p className="muted">No active subscriptions.</p>}
      <ul className="feed">
        {subs.map((s) => (
          <li key={s.id}>
            <code>{s.event}</code> · broadcaster {s.broadcaster_user_id}{" "}
            <button onClick={() => unsubscribe(s.id)}>Unsubscribe</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
