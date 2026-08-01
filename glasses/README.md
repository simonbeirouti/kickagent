# Glasses HUD

Standalone "glasses" overlay for the Kick stream — a prediction market card,
an active-bet lifecycle card, a top-predictions leaderboard, live topbar
stats, and toast alerts. This is a sibling to [`app/overlay/page.tsx`](../app/overlay/page.tsx)
(the hype meter / topics / assistant-toast overlay already wired to
`hype-engine`) — that one covers the chat/hype layer, this one adds a
prediction-market layer on top.

## Status: live mode wired to hype-engine (simulator still the default)

Two modes now:

- **Default (no params, or file://):** the original standalone simulation —
  markets drift via a pool-implied-odds model, a bet card cycles
  PENDING → LOCKED IN → WON/LOST, toasts fire on a random cadence. Still
  zero-dependency, still works as a plain file for OBS.
- **`?source=live`:** real data. A module script at the bottom of the HTML
  imports `hype-engine/src` (HypeEngine, TopicTracker, KickAssistant,
  HighlightTracker), consumes a kick-hype-starter SSE feed, and drives the
  HUD: topbar hype/trend from `engine.sample()`, viewers = unique chatters
  in the last 10 min, the featured prediction card from assistant
  `suggestion` events (pivot/trending gap), the dare card resolves from
  `trackAction` → `impact` up/flat/down verdicts (up = WON, down = LOST,
  flat = PUSH), and toasts from `ready`/suggestions/impacts/highlight
  closes/kicks gifts/subs/spam flags. Market pool dollar figures remain
  simulated (no real betting backend exists).

## Running it

Simulator: open the HTML file directly in a browser, or add it to OBS as a
Browser Source pointed at the local file path. No build step.

Live mode (needs a server for ES module imports + the CORS-free SSE proxy):

```
node hype-engine/serve.js
# → http://localhost:8420/glasses/hype-glasses-hud.html?source=live
```

Extra live params: `&sse=<url>` overrides the feed (defaults to the deployed
kick-hype-starter stream via serve.js's `/sse-proxy`), `&channel=<broadcaster
user id>` filters to one channel. `?transparent`, `?rows`, layout edit mode
(**L**) etc. all work in live mode too; the N/B/T injection keys are disabled
while real data drives.

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

Done — `?source=live` implements the table below via a `window.__hud` bridge
(the simulator IIFE owns the DOM; the module script owns the signal). The
original mapping is kept for reference; ✅ marks what's now real:

| Simulated today | Replace with |
|---|---|
| ✅ `feature(m)` picks a random market and starts its lifecycle | Live: assistant `suggestion` events feature a real card — pivot → *Will chat pivot to "topic"?*, trending gap → *Will "topic" take over chat?* |
| ✅ `newBet()` / `advanceBet()` bet lifecycle | Live: the **Hit Me, Kick Me** dare round — `assistant.trackAction(label)` on lock, `assistant.on('impact')` up/flat/down verdict resolves WON / LOST / PUSH |
| `tickMarket()` pool-implied odds walk | Still simulated — no real betting/prediction backend exists; the dollar pools aren't real money |
| ✅ Topbar `hype` counter (`state.hype`, `state.hypeDelta`) | Live: `HypeEngine.sample()` `{ hype, trend }` every 250ms |
| ✅ Topbar `viewers` counter | Live: unique chatters over the last 10 min (the real audience signal the chat feed carries; swap for a true viewer count when a source exists) |
| ✅ `showToast()` random pool | Live: `ready`, `suggestion`, `impact`, highlight closes, `kicks.gifted`, `channel.subscription.*`, spam-shield flags |

See `docs/ARCHITECTURE.md` and `docs/PITCH.md` for the full layer breakdown
(L1–L6) this overlay slots into, and `app/overlay/page.tsx` for the Next.js
overlay's version of the same hype-engine consumption.
