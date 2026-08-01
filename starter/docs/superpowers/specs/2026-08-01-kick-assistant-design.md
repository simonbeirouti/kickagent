# Kick-Ass(istant) — AI agent + full loop (design)

Date: 2026-08-01
Status: approved

## Story

One-stop shop for the one-person streamer. An AI agent ("kick-assistant") is the
bridge between streamer and viewers: it analyzes chat, keeps a hype score,
coaches the streamer through a Meta-glasses-style HUD, drops memes on the
stream overlay when chat pops off, and — the centerpiece — lets viewers bet on
streamer actions ("bet 50 KICKs you talk to the girls on the left"), with the
agent watching the stream and validating outcomes automatically. The audience
controls the streamer; the agent settles the score.

Backend is mocked where the real thing doesn't exist (bet validation, wallets).
LLM touches are real when `ANTHROPIC_API_KEY` is set, canned otherwise.

## Architecture

Server-side agent module subscribed to the existing in-memory event bus
(`lib/event-bus.ts`). It keeps rolling state and emits synthetic events back
onto the same bus; all pages consume them via the existing SSE route
(`/api/events/stream`) + `use-kick-events` hook, so every open window stays in
sync.

### New modules (lib/assistant/)

- `agent.ts` — rolling state: hype score with source breakdown, chat velocity
  (msgs/min), recent-message window. Reuses `lib/hype-score.ts` decay/points and
  adds new hype sources: prediction placed +20, bet placed/accepted +18, meme
  detected +14. Emits `assistant.hype` ticks (throttled), detects chat-spam
  patterns (repeated token across N recent messages at high velocity) and emits
  `assistant.meme`. Emits `assistant.coach` tips and `assistant.summary`
  timeline lines on notable state changes (LLM w/ fallback).
- `bets-store.ts` — in-memory predictions/bets: predictions with YES/NO pools,
  odds from pool ratio, participant counts; direct bets on streamer actions
  (wager, condition, deadline) with accept/ignore by streamer and
  AI-validation lifecycle: `open → accepted → watching → validated → paid`
  (or `declined` / `expired`). Emits `assistant.bet.*` events on transitions.
- `demo-script.ts` — the scripted story mode. Ordered steps with delays,
  driven through the same store/agent APIs a real client would hit:
  viewer creates bet → HUD shows it → accept → chat burst spams "67" →
  hype spikes → meme drops → AI watching → event detected → validated →
  payout → summary/coach react. Play/stop; each step also individually fireable.
- `llm.ts` — Claude helper (same pattern as `/api/name-moment`): coach tips,
  meme captions, summary lines. Canned pools as fallback when no key/error.

### New synthetic event kinds

`assistant.hype`, `assistant.meme`, `assistant.coach`, `assistant.summary`,
`assistant.bet.created`, `.accepted`, `.declined`, `.watching`, `.validated`,
`.paid`. All flow through the existing bus/SSE untouched (kind + payload).

### API routes (app/api/assistant/)

- `POST /api/assistant/predictions` — create prediction (question, duration)
- `POST /api/assistant/predictions/:id/wager` — place YES/NO wager
- `POST /api/assistant/bets` — create action bet (user, wager, condition)
- `POST /api/assistant/bets/:id/accept` | `/decline` — streamer response
- `POST /api/assistant/bets/:id/validate` — trigger mock AI validation sequence
- `GET  /api/assistant/state` — snapshot (hype, predictions, bets, summary)
  for initial page render
- `POST /api/assistant/demo` — `{action: "play" | "stop" | "step", step?}`

Next.js route handlers; ids in path via dynamic segments.

## Routes / surfaces

| Route | Surface |
| --- | --- |
| `/demo/assistant` | Composite showcase: glasses HUD panel, stream overlay panel, live chat, predictions panel, validation ticker, phone frame — the whole story on one screen, plus demo controls |
| `/demo/assistant/hud` | Streamer glasses HUD standalone: notification card stack (new prediction, incoming bet w/ Accept/Ignore, hype alert, coach tip), validation ticker; `?overlay=1` hides chrome |
| `/demo/assistant/overlay` | Viewer stream overlay for OBS: hype gauge + breakdown, live prediction card, top bet card, meme drops, summary toasts; `?overlay=1` |
| `/demo/assistant/bets` | Viewer predictions & bets panel: Predictions / My Bets tabs, odds bars, pools, Bet Now, Create Prediction form |
| `/demo/assistant/phone` | Companion app in a phone frame: hype score, predictions, summary timeline, push-style notification cards |

Shared React components live in `components/assistant/` and are composed by
all five routes (composite embeds the same components the standalone routes
use). Styling follows the existing demo pages (dark, Kick-green accents) and
the two reference mocks.

## AI integration (hybrid)

Deterministic: hype scoring, chat velocity, meme trigger (threshold +
hysteresis), odds math, validation timing. LLM: coach tips, meme captions,
summary lines — every call has a canned fallback so the demo never breaks
offline. Bet outcome "validation" is simulated (scripted or manual trigger)
but presented as the multimodal-agent step: `watching → event detected →
validated → payout`.

## Mock data

Currency is KICKs. Seeded state on boot: one long-running prediction
("Will Neon hit 13,000 trophies this stream?" YES 72% / NO 28%), fake
chatters for bursts, canned coach/summary/meme pools referencing the "67"
meme story beat.

## Testing

Vitest, matching repo style:

- `tests/assistant-bets-store.test.ts` — prediction pools/odds, wagers, bet
  lifecycle transitions, invalid-transition guards, payout math
- `tests/assistant-agent.test.ts` — hype breakdown sources, decay, spam/meme
  detection trigger + hysteresis, summary/coach emission on state changes
- `tests/assistant-demo-script.test.ts` — step ordering, play/stop, events
  emitted per step

UI verified via dev server.

## Out of scope

- Real payouts/wallets, real Kick channel rewards
- Real multimodal stream analysis (validation is simulated)
- Persistence (in-memory only, single instance — same as the rest of the repo)
- Auth: viewer identity is a typed-in/fake username
