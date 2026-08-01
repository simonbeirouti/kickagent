import Link from "next/link";
import ChannelLookup from "@/components/channel-lookup";
import LiveFeed from "@/components/live-feed";
import SubscriptionsPanel from "@/components/subscriptions-panel";

export default function Home() {
  return (
    <main>
      <h1>Kick Hype Starter</h1>
      <p className="muted">
        Pre-hackathon test rig: app-token REST reads, webhook ingestion, live SSE feed.
      </p>
      <section>
        <h2>Overlay demos</h2>
        <p className="muted">
          Twelve overlay concepts built on this starter live under{" "}
          <Link href="/demo" className="back-link">/demo</Link> — hype meter, AI replay
          timeline, stream boss, emote wall and more.
        </p>
        <div className="overlay-nav" style={{ maxWidth: 600 }}>
          <Link href="/demo" className="overlay-card">
            <span className="overlay-emoji">🎛️</span>
            <strong>Browse the demos →</strong>
            <span className="muted">12 overlay pages, one event stream</span>
          </Link>
          <Link href="/mentor" className="overlay-card">
            <span className="overlay-emoji">📋</span>
            <strong>Day-of run sheet →</strong>
            <span className="muted">Hour-0 actions, checkpoint countdown, gotchas</span>
          </Link>
        </div>
      </section>
      <div className="grid">
        <div>
          <ChannelLookup />
          <SubscriptionsPanel />
        </div>
        <LiveFeed />
      </div>
    </main>
  );
}
