# Glasses HUD

Standalone "glasses" overlay for the Kick stream — a prediction market card,
an active-bet lifecycle card, a top-predictions leaderboard, live topbar
stats, and toast alerts. This is a sibling to [`app/overlay/page.tsx`](../app/overlay/page.tsx)
(the hype meter / topics / assistant-toast overlay already wired to
`hype-engine`) — that one covers the chat/hype layer, this one adds a
prediction-market layer on top.

## Status: standalone simulator, not yet wired to real data

Everything in `hype-glasses-hud.html` right now is self-generated in the
browser — no backend call, no SSE/websocket, no `hype-engine` import. Open the
file directly (or point an OBS Browser Source at it) and it runs a
deterministic-if-seeded simulation: markets drift via a pool-implied-odds
model, a bet card cycles PENDING → LOCKED IN → WON/LOST, and toasts fire on a
random cadence. This was intentional for the first pass — it let the whole
UI/animation/OBS-compositing surface get built and tested without blocking on
the signal layer.

## Running it

Open the HTML file directly in a browser, or add it to OBS as a Browser
Source pointed at the local file path. It's a static file with no build step,
independent of the Next.js app for now.

### URL params

- `?transparent` — drops the background so it composites over camera/game
  capture in OBS (keeps a bit of vignette/scanline for the glasses look)
- `?speed=2` — multiplies the pace of every simulated event (0.1–10)
- `?seed=abc` — deterministic run, same sequence every reload (useful for demos)
- `?rows=2..4` — rows in the Top Predictions panel (auto-compacts layout at 3–4)
- `?chrome=0` — hides the keyboard-hint line

### Layout edit mode

Press **L** to enter edit mode, drag any panel to a new position, press **L**
again to exit. Positions save to `localStorage` (key `hypeHudLayoutV1`) and
persist across reloads — set it up once per OBS machine/profile. Press **R**
while in edit mode to reset to the default layout.

Other keys (disabled while in edit mode): **N** new prediction, **B** new bet,
**T** toast, **H** hide the hint line, double-click for fullscreen.

## Wiring in real data

The simulator's surface area is small and centralized — swap these entry
points for real event-driven calls and the rest (DOM rendering, animations,
layout persistence) doesn't need to change. This repo already has most of the
real plumbing built for the *other* overlay, which is the natural thing to
reuse rather than inventing a second pipeline:

| Simulated today | Replace with |
|---|---|
| `feature(m)` picks a random market and starts its lifecycle | Real Kick prediction/poll events via `lib/kick/hype-adapter.ts`, or `KickAssistant`'s `ready` event (`hype-engine/src/assistant.js`) if this becomes a hype-driven pivot suggestion instead of a literal betting market |
| `newBet()` / `advanceBet()` bet lifecycle | The **Hit Me, Kick Me** dare round already modeled in `app/overlay/page.tsx` (`DARE_AT_MS`, the "Hit Me, Kick Me" phase) — `assistant.on('impact', (p) => ...)` fires an up/flat/down verdict after a tracked dare, which maps directly onto the WON/LOST states |
| `tickMarket()` pool-implied odds walk | Real stake/position data, if a real betting/prediction backend exists; otherwise fine to keep simulated indefinitely if the market isn't real money |
| Topbar `hype` counter (`state.hype`, `state.hypeDelta`) | `lib/hype.ts` / `HypeEngine.sample(Date.now())` — this is a direct swap, same `{ hype, trend }` shape `app/overlay/page.tsx` already consumes |
| Topbar `viewers` counter | Whatever live viewer-count source `lib/kick/hype-adapter.ts` ends up exposing, once that's more than chat-webhook-only |
| `showToast()` random pool | Real events: `kicks.gifted`, `channel.subscription.new`, `hype-engine` `suggestion`/`impact` events (same ones already driving toasts in `app/overlay/page.tsx`), big single-stake bets, etc. |

See `docs/ARCHITECTURE.md` and `docs/PITCH.md` for the full layer breakdown
(L1–L6) this overlay slots into, and `app/overlay/page.tsx` for a working
example of consuming `hype-engine` output in this repo.

None of this is wired up yet — this table is meant to save the next person
the archaeology, not to claim the integration is done.
