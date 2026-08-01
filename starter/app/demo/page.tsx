import Link from "next/link";

const ASSISTANT = [
  { href: "/demo/assistant", emoji: "🕶️", name: "Kick-Ass(istant) Showcase", blurb: "The full loop on one screen: glasses HUD, overlay, bets, AI validation" },
  { href: "/demo/assistant/hud", emoji: "👓", name: "Glasses HUD", blurb: "Streamer-only view: bets to accept, hype alerts, AI coach tips" },
  { href: "/demo/assistant/overlay", emoji: "📺", name: "Assistant Overlay", blurb: "Viewer overlay: hype score, predictions, AI meme drops" },
  { href: "/demo/assistant/bets", emoji: "💰", name: "Predictions & Bets", blurb: "Viewers wager KICKs on predictions and streamer actions" },
  { href: "/demo/assistant/phone", emoji: "📱", name: "Companion App", blurb: "Mobile view with AI push updates for viewers who can't watch" },
];

const OVERLAYS = [
  { href: "/demo/hype-meter", emoji: "🔥", name: "Hype Meter", blurb: "Live hype gauge with decay and a hype-train mode" },
  { href: "/demo/replay", emoji: "🎞️", name: "Hype Replay", blurb: "Timeline of hype spikes with AI-named clip-worthy moments" },
  { href: "/demo/alerts", emoji: "🚨", name: "Alert Overlay", blurb: "Animated pop-up alerts for follows, subs and kicks" },
  { href: "/demo/goals", emoji: "🎯", name: "Goal Tracker", blurb: "Stream goals with live progress bars and celebrations" },
  { href: "/demo/chat-pulse", emoji: "📈", name: "Chat Pulse", blurb: "Message velocity, trending words, top chatters" },
  { href: "/demo/leaderboard", emoji: "🏆", name: "Top Supporters", blurb: "Session leaderboard for gifters, subs and follows" },
  { href: "/demo/boss", emoji: "👹", name: "Stream Boss", blurb: "Chat fights a boss — subs and KICKs hit hardest, defeats level it up" },
  { href: "/demo/emote-wall", emoji: "😂", name: "Emote Wall", blurb: "Chat emotes and emoji float across the screen" },
  { href: "/demo/jar", emoji: "🫙", name: "Support Jar", blurb: "Follows, subs and KICKs drop into a jar toward a session target" },
  { href: "/demo/credits", emoji: "🎬", name: "End Credits", blurb: "Movie-style rolling credits thanking everyone who supported" },
  { href: "/demo/logo-builder", emoji: "🧱", name: "Logo Builder", blurb: "KICK logo builds brick-by-brick as hype milestones hit (from the brief)" },
  { href: "/demo/battle", emoji: "⚔️", name: "Hype Battle", blurb: "Team Fire vs Team Water — chat picks sides, first to 100 wins the round" },
];

export default function DemoIndex() {
  return (
    <main>
      <Link href="/" className="back-link">← starter kit</Link>
      <h1>Overlay demos</h1>
      <p className="muted">
        Twelve takes on the Hype Tracker challenge, all driven by the same live event
        stream. Every page has a fake-event injector and supports <code>?overlay=1</code>{" "}
        to strip the chrome for an OBS browser source.
      </p>
      <h2>Kick-Ass(istant) — the AI agent loop</h2>
      <p className="muted">
        An AI agent bridges streamer and viewers: it reads chat, coaches the streamer
        through a glasses HUD, drops memes when chat pops off, and validates viewer
        bets on real-world streamer actions. Hit &ldquo;play the story&rdquo; on any page.
      </p>
      <div className="overlay-nav">
        {ASSISTANT.map((o) => (
          <Link key={o.href} href={o.href} className="overlay-card">
            <span className="overlay-emoji">{o.emoji}</span>
            <strong>{o.name}</strong>
            <span className="muted">{o.blurb}</span>
          </Link>
        ))}
      </div>
      <h2>Overlay widgets</h2>
      <div className="overlay-nav">
        {OVERLAYS.map((o) => (
          <Link key={o.href} href={o.href} className="overlay-card">
            <span className="overlay-emoji">{o.emoji}</span>
            <strong>{o.name}</strong>
            <span className="muted">{o.blurb}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
