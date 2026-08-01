"use client";

import { useState } from "react";
import type { KickChannel } from "@/lib/kick-api";

export default function ChannelLookup() {
  const [slug, setSlug] = useState("");
  const [channel, setChannel] = useState<KickChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    setError(null);
    setStatus(null);
    setChannel(null);
    try {
      const res = await fetch(`/api/channel?slug=${encodeURIComponent(slug.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setChannel(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function watch() {
    if (!channel) return;
    setStatus(null);
    setError(null);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster_user_id: channel.broadcaster_user_id }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
    else setStatus(`Subscribed to events for ${channel.slug}. Events will appear in the live feed once Kick's webhook URL points at this deployment.`);
  }

  return (
    <section>
      <h2>Channel lookup</h2>
      <div className="row">
        <input
          placeholder="channel slug, e.g. xqc"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && slug.trim() && lookup()}
        />
        <button className="primary" onClick={lookup} disabled={loading || !slug.trim()}>
          {loading ? "Loading…" : "Look up"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {status && <p className="muted">{status}</p>}
      {channel && (
        <div>
          <h3>{channel.slug}</h3>
          <p>
            {channel.stream?.is_live ? (
              <>🟢 LIVE — {channel.stream.viewer_count} viewers</>
            ) : (
              <>⚫ Offline</>
            )}
          </p>
          <p>{channel.stream_title || <span className="muted">no title</span>}</p>
          <p className="muted">
            Category: {channel.category?.name || "—"} · Broadcaster ID: {channel.broadcaster_user_id}
          </p>
          <button className="primary" onClick={watch}>Watch this channel (subscribe to events)</button>
        </div>
      )}
    </section>
  );
}
