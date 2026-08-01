# Kick Hype Starter

Pre-hackathon test rig for the Kick public API: app-token REST reads,
signed webhook ingestion, and a live SSE event feed — the same pipeline a
"Hype Tracker" stream overlay needs.

## Hype brain: the shared engine

Scoring is delegated to the repo's zero-dependency **hype engine**
(`../hype-engine/src`, imported via the `@engine/*` alias — one copy, no
divergent math). The old decayed event counter in `lib/hype-score.ts` was
replaced by:

- **HypeEngine** — self-calibrating z-score 0–100 ("unusually busy for THIS
  channel right now"), per-user saturation, duplicate discounting and
  spam flagging. Drives `assistant.hype` (score/trend/ready), the
  `/demo/hype-meter` gauge and the assistant hype gauge.
- **TopicTracker + TrendingTopics** — what chat is hyped about, with
  fast/slow momentum; pivot and trending-gap suggestions land in the AI
  Coach card (badged PIVOT / TRENDING GAP), LLM-polished like other tips.
- **KickAssistant.trackAction** — when the streamer accepts an action bet,
  the engine measures the room for ~15s and the bet card gets a real
  hype-impact verdict: ▲ up / ▬ flat / ▼ down with before→after numbers.
- **HighlightTracker** — `/demo/replay` clip moments now come from the
  engine (open ≥75, close <65 hysteresis, lead-in, spike merging), with
  AI naming on top.

The server-side brain lives in `lib/assistant/agent.ts` (fed by the event
bus, sampled at 1 Hz by `lib/assistant/runtime.ts`); event mapping is
`lib/assistant/hype-adapter.ts`. `pointsFor` in `lib/hype-score.ts` remains
only as point weights for the game pages (boss, logo-builder, battle).

## Kick-Ass(istant) — the AI agent loop

The headline feature: an AI agent that bridges the one-person streamer and
their viewers. It analyzes chat (hype score + velocity + spam detection),
coaches the streamer through a Meta-glasses-style HUD, drops memes on the
overlay when chat pops off, and — the centerpiece — lets viewers **bet KICKs
on real-world streamer actions** ("50 KICKs you talk to the girls on the
left"), with the agent watching the stream and validating outcomes
automatically. Backend is mocked where the real thing doesn't exist (bet
validation, wallets); coach tips / meme captions / summary lines are
LLM-written when `ANTHROPIC_API_KEY` is set, canned otherwise.

| Route | Surface |
| --- | --- |
| `/demo/assistant` | Composite showcase — the whole loop on one screen (best for presenting) |
| `/demo/assistant/hud` | Streamer glasses HUD: bets to accept, hype alerts, coach tips |
| `/demo/assistant/overlay` | Viewer overlay for OBS: hype gauge, predictions, meme drops |
| `/demo/assistant/bets` | Viewer panel: wager on predictions, dare the streamer with action bets |
| `/demo/assistant/phone` | Companion app: AI push updates for viewers who can't watch |

Every page has a **🎬 play the story** button that runs the choreographed
demo: viewer bets → streamer accepts → chat spams "67" → hype spikes → meme
drops → AI validates → payout. Server pieces live in `lib/assistant/`
(agent, bets store, demo script — all unit-tested), synced across windows via
the same SSE bus as everything else.

## Overlay demos (Challenge 1: Hype Tracker)

Twelve takes on the "real-time overlay / companion UI" challenge live under
**`/demo`**, all driven by the same live event stream. The starter kit itself
(home page: channel lookup, subscriptions, live feed) stays separate so the
two can be split apart cleanly. Every demo has a fake-event injector for
offline demos and supports `?overlay=1` to hide the chrome for an OBS browser
source.

| Route | Idea |
| --- | --- |
| `/demo/hype-meter` | Hype gauge: events add points, silence decays it; ≥80 starts a hype train (with hysteresis) |
| `/demo/replay` | **Hype Replay**: records hype spikes as clip-worthy moments; an LLM names each one ("The KICKs Rain") — needs `ANTHROPIC_API_KEY`, falls back to canned names without it |
| `/demo/alerts` | StreamElements-style alert box: queued animated cards for follows, subs, gift subs and KICKs |
| `/demo/goals` | Stream goal tracker: editable follow/sub/KICKs targets (persisted), live progress, confetti on completion |
| `/demo/chat-pulse` | Chat analytics: messages-per-minute chart, trending words, top chatters, live chat |
| `/demo/leaderboard` | Session leaderboard: top KICKs gifters and sub gifters, newest follows/subs, session totals |
| `/demo/boss` | Stream Boss: chat damages a boss (damage = hype-score weights), floating hit numbers, levels scale HP ×1.5 |
| `/demo/emote-wall` | Emote wall: parses Kick's `[emote:id:name]` chat syntax + unicode emoji and floats them across the screen |
| `/demo/jar` | Support jar: follows drop coins, subs gems, KICKs rockets — fills toward a session target |
| `/demo/credits` | End credits: auto-collected supporter roll (producers/cast/loudest voices), one click to roll |
| `/demo/logo-builder` | KICK logo builds brick-by-brick as hype points accumulate; letters are milestones, levels raise the cost (idea straight from the official brief) |
| `/demo/battle` | Hype battle: chat splits into 🔥 vs 💧 by keyword (or username hash), subs/KICKs hit hard, first to 100 takes the round |

Hype scoring lives in `lib/hype-score.ts` (unit-tested); the shared SSE client
hook is `lib/use-kick-events.ts`. The `/api/fake-event` route now generates
randomized payloads and supports `{"burst": N}` for a chat-spike simulation.

## Local setup

1. `npm install`
2. `cp .env.example .env.local` and fill in the client ID/secret from
   https://kick.com/settings/developer (the Kick account needs 2FA enabled).
3. `npm run dev` → http://localhost:3000
4. Click an "Inject fake" button — the live feed should update instantly.
   Look up a channel slug to verify the credentials against the real API.

Real webhooks cannot reach localhost. Either deploy (below) or tunnel with
`ngrok http 3000` and use the ngrok URL in the Kick dashboard.

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: New Project → Deploy from GitHub repo. Railway auto-detects
   Next.js (`npm run build` / `npm run start`).
3. Service → Variables: add `KICK_CLIENT_ID` and `KICK_CLIENT_SECRET`.
4. Service → Settings → Networking → Generate Domain. Note the URL,
   e.g. `https://kick-hype-starter-production.up.railway.app`.
5. In https://kick.com/settings/developer → your app → set the webhook URL to
   `https://<railway-domain>/api/kick/webhook` (webhooks toggle ON).

## Receiving real events

1. Open the deployed site, look up a **live** channel, click
   "Watch this channel".
2. Real chat/follow/gift events for that channel stream into the live feed.
3. Unsubscribe from the subscriptions panel when done — subscriptions
   outlive page reloads (they live on Kick's side, per app).

## Notes & limitations

- App access token (client credentials) only — no user OAuth needed for this.
- Events are held in memory (last 100). One instance only; a restart clears the feed.
- Webhook signatures are verified against Kick's published RSA key
  (`GET /public/v1/public-key`).
- If the endpoint keeps failing for >1 day Kick auto-drops subscriptions;
  re-subscribe from the UI.
- `npm test` runs the unit suite (token cache, signature verification,
  event bus, webhook route).
