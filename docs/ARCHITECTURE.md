# Hype Tracker — System Architecture & Study Guide

Personal deep-dive for Anantyash. Written 26 Jul 2026, six days out from the hackathon.

> **⛔ RE-SUPERSEDED 31 Jul evening — the ruling changed twice today. Current state:**
> Gui at 13:37: *"My take: do as much work as you can, and tomorrow we see if it's allowed to use or not."*
> Gui at 18:58 (final): *"The main focus is the idea and we need to nail the presentation. The data and implementation side don't need to be fully connected, so **mock everything**, create the data we need and focus on getting the best idea out."*
>
> **What this means:** pre-work is no longer forbidden, but it's also no longer the point. The judges are buying the *idea and the story*. This doc survives as the maths and engineering backbone (L3 especially — the hype engine is still the intellectual centrepiece), but the product framing has moved on: see **`PITCH.md`** for the Kick-Assistant narrative, feature map, demo script and presentation plan. Read that first; come back here when you build the hype engine.
>
> The webhook/DOM/tunnel anxiety in §1–§5 is now mostly moot — **mocked data is officially sanctioned**, so the replay/synthetic paths (previously fallbacks 4–5) are the primary demo path. The real ingest paths become talking points, not requirements.
>
> Also note: the real deadline is **4pm**, not 6:30pm, which means ~4.5 hours of build. See the revised timeline in `~/.claude/plans/i-am-participating-in-vivid-squirrel.md`.

---

## 1. Design goals

In priority order. When two conflict, the higher one wins.

1. **The demo must never fail.** Reliability beats features. Every layer degrades to something that still runs.
2. **Feel instant.** Sub-300ms from cause to effect. Past ~500ms the audience stops connecting the two.
3. **Scale-invariant.** Must produce interesting behaviour at 200 viewers *and* 50,000. This is the thing that separates you from every other team.
4. **Parallelisable across 5 people.** Layers must have clean seams so nobody blocks anybody.
5. **Explicable in 30 seconds.** If you can't explain the signal model to an engineering manager in two sentences, it's too clever.

### Constraints you can't negotiate

| Constraint | Consequence |
|---|---|
| ~4–5 hours of actual build time | Two layers can be sophisticated. The rest must be boring. |
| Venue wifi, 130 people, loud arcade | No hard dependency on inbound network or on audio |
| No chat polling API on KICK | Chat comes from the DOM, a socket, or webhooks — all three are awkward |
| kick.com is Cloudflare-protected (403 to servers) | Chat ingest must happen **in a browser**, not on a server |
| Judges are KICK engineers | Must visibly use KICK data, and be honest about how |

---

## 2. The architecture

Six layers. Each one has a primary, at least one alternate, and a fallback.

```
┌─────────────────────────────────────────────────────────────┐
│  L1  INGEST          chat events from a real KICK channel   │
├─────────────────────────────────────────────────────────────┤
│  L2  NORMALISE       → one event shape, deduped, idempotent │
├─────────────────────────────────────────────────────────────┤
│  L3  SIGNAL          → decay + rolling baseline → hype 0-100│
├─────────────────────────────────────────────────────────────┤
│  L4  TRIGGER         gesture (MediaPipe) → intent           │
├─────────────────────────────────────────────────────────────┤
│  L5  DIRECTOR        hype × intent → which effect, what tier│
├─────────────────────────────────────────────────────────────┤
│  L6  RENDER          overlay: meter, effects, dare card     │
└─────────────────────────────────────────────────────────────┘

           L1 ──▶ L2 ──▶ L3 ──┐
                              ├──▶ L5 ──▶ L6
                       L4 ────┘
```

**The seam that matters most is L2.** Everything upstream is messy and platform-specific; everything downstream is clean and testable. Get that boundary right and the other four people can work against a fake event stream all day without touching KICK at all.

### The critical design decision: the overlay must run standalone

**L1–L6 should all be able to run in a single browser tab with no backend.** The FastAPI server exists to *share* state between the streamer overlay and viewer extensions — it is not on the critical path for the core demo.

If the server dies at 5:25pm, the overlay keeps reading chat, keeps detecting gestures, keeps firing effects. You lose multi-client sync and nothing else. Design this in from the first commit; you cannot retrofit it.

---

## 3. Layer by layer

### L1 — Ingest

> **⚠️ Revised 28 Jul after Gui's email.** He set homework pointing specifically at *Getting Started → Events → **Webhook Payloads*** "so the event model isn't brand new on the day," and called out the **webhooks toggle** in the developer dashboard. When the KICK mentor tells you to learn the webhook event model before Saturday, that is a strong signal about what the day-of challenge expects. **Webhooks are now the primary ingest path; the DOM observer drops to fallback and party trick.**

**Primary: official webhooks.** `POST /public/v1/events/subscriptions` for `chat.message.sent`, `kicks.gifted`, `channel.subscription.*`. Scope `events:subscribe`. RSA-verify every delivery against `GET /public/v1/public-key`, using `Kick-Event-Message-Id` as your idempotency key.

This is strictly better data than the DOM: you get `kicks.gifted` (real money — your strongest hype signal), subscription events, and clean typed JSON with no parsing. The costs are a public HTTPS tunnel and broadcaster consent, which is why it can't be your *only* path.

**Fallback: DOM MutationObserver on `[data-testid="chatroom-messages"]`**

Verified working on a live 7.1K-viewer channel. KICK ships stable `data-testid` hooks, including per-message role badges (`identity-badge-subscriber`, `-moderator`, `-og`, `-founder`, `-verified`) which give you free contributor weighting.

Keep this for two reasons, both real:
1. **Tunnel insurance.** If venue wifi blocks inbound traffic, the DOM path keeps the demo alive with zero code changes.
2. **It works on channels you don't own.** Webhooks require broadcaster consent, so you can only demo on `sammyg14`. The DOM path lets you walk up to whatever channel a judge names and turn it on. That's a strong closing moment — but it's a bonus, not the foundation.

**⚠️ The chat list is virtualised.** Real markup:

```html
<div class="no-scrollbar relative" style="height: 2891px;">
  <div data-index="0" class="absolute inset-x-0 top-0" style="transform: translateY(5px);">
```

Fixed-height container, absolutely positioned rows, recycled `data-index`. Rows are added **and removed** as they scroll. A naive observer double-counts, and worse, it double-counts *more* during high traffic — precisely when your signal matters. **This is the single highest-value bug to understand before Saturday.**

**Remaining alternates:**

| Approach | When to use | Cost |
|---|---|---|
| **WebSocket frame interception** ⭐ | If DOM dedup proves painful — **and as a deliberate talking point** | Inject a page-context script that wraps `window.WebSocket`, read Pusher frames. Clean JSON, no virtualisation. How BTTV/7TV work. `window.Pusher` is confirmed loaded on kick.com but `Pusher.instances` is empty, so you must wrap the constructor *before* the page connects — timing matters. |
| **Replay from fixtures** | Development and demo insurance | Free once you've captured a log. |
| **Synthetic generator** | Tuning L3 at 200 vs 50k viewers | Free, and necessary — real logs won't cover both ends. |

**Fallback ladder:** webhooks → DOM → WS interception → replay → synthetic. Wire the switch as a config flag on day one, not as an afterthought.

**What this changes for your week:** the webhook dry run is now the highest-value thing you do, not a nice-to-have. Gui's homework gets you the app and credentials; the remaining unknown is whether a tunnel survives the venue. Ask him directly.

#### ⭐ Why the WebSocket path is now a feature, not a hack

KICK's public roadmap has **exactly one item in its Planned column: [issue #20, "Websocket-based events"](https://github.com/KickEngineering/KickDevDocs/issues/20)** — ~58 reactions, the most-requested thing in their tracker by roughly 3.6×. The stated rationale is developers wanting real-time event delivery **without being forced to run webhooks, specifically for desktop apps.**

That is precisely the constraint that makes L1 awkward for you: webhooks need a public HTTPS endpoint, and you're a local app on venue wifi.

So the honest architecture is also the impressive one:

- **Primary: official webhooks.** The respectful default, what Gui steered you toward, and the only source of `kicks.gifted` and subscription events.
- **Local-first WS client: framed as prototyping their roadmap**, not as routing around their API. You are building the thing their #1 issue asks for.

The framing genuinely matters. *"We built against the event model you have planned"* lands very differently to *"webhooks were annoying so we scraped."* Same code, opposite impression. Get the sentence right before you say it to a judge.

---

### L2 — Normalise

One shape. Everything upstream converges here.

```ts
type HypeEvent = {
  id: string;          // stable dedup key
  type: 'chat' | 'kicks' | 'sub' | 'follow' | 'ban';
  userId: string;
  username: string;
  badges: string[];    // ['subscriber','moderator']
  text?: string;
  raw: number;         // pre-weight magnitude (kicks amount, sub months)
  ts: number;          // epoch ms
  source: 'dom' | 'ws' | 'webhook' | 'replay' | 'synthetic';
};
```

**Dedup strategy** — you need this because of virtualisation:

- Webhooks give you `Kick-Event-Message-Id` (a ULID) — use it directly.
- DOM gives you nothing stable, so synthesise: `hash(username + text + domTimestamp)`.
- Keep a `Set` of seen IDs with a time-bounded eviction (drop anything older than ~60s) so it doesn't grow unbounded over a long stream.

**Test it deliberately:** scroll the chat up and down hard while the observer runs. If your score inflates, you have the bug. Do this on day one.

---

### L3 — Signal (the interesting part)

This is your intellectual centrepiece and the thing to be able to explain in two sentences.

#### Why the naive version fails

"Count messages in the last 10 seconds" breaks immediately: a 200-viewer stream never crosses any fixed threshold, and a 50,000-viewer stream sits permanently maxed. Whatever constant you pick is wrong for every channel except the one you tuned it on.

#### Exponential decay, computed incrementally

Rather than keeping a window buffer, keep one number:

```
on event (weight w, time t):
    S ← S · e^(−λ(t − t_last)) + w
    t_last ← t

on read (time t):
    S_now = S · e^(−λ(t − t_last))
```

λ = ln(2) / half_life. A half-life of ~10s feels right for chat.

**O(1) memory, O(1) per event, no buffer, no windowing bugs.** That property is worth stating out loud in the demo — at 46M chats/day it's the difference between a toy and something that could actually run.

#### Rolling baseline — this is what makes it scale-invariant

Sample `S_now` at ~1 Hz and maintain a slow EMA plus its variance:

```
α = 1 − e^(−Δt/τ)            τ ≈ 120s
B ← α·S_now + (1−α)·B        # baseline
D  = S_now − B
V ← α·D² + (1−α)·V           # EMA of squared deviation
σ  = √V
```

Then the hype value is a **z-score**, squashed to 0–100:

```
z = (S_now − B) / (σ + ε)
H = 100 · sigmoid(z / k)      k ≈ 2
```

Now "hype" means *"unusually busy for this channel, right now"* — which is the actual thing you care about, and it works identically at 200 and 50,000 viewers. **That sentence is your demo line.**

**⚠️ Warm-up problem.** For the first ~60s, `B` and `σ` are garbage and everything looks like a spike. Either suppress firing during warm-up, or seed `B` from the first few samples. Every team that skips this has an overlay that explodes the moment it loads. Handle it explicitly.

#### Event weighting

```
chat:   1.0 × badgeMult × noveltyMult × emoteBonus
kicks:  5.0 + 2·log₁₀(1 + amount)      ← real money, weight it
sub:    10.0     follow: 2.0     ban: −5.0

badgeMult:   subscriber 1.5 · og 1.3 · verified 1.4 · moderator 1.2 · none 1.0
noveltyMult: 1.0 unique text in window · 0.3 duplicate   ← anti-copypasta
emoteBonus:  1 + 0.1·emoteCount, capped at 1.5
```

#### Spam resistance

Track a per-user decayed contribution `c_u` with the same incremental trick, then:

```
w_effective = w / (1 + c_u/κ)        κ ≈ 3
```

One person hammering the keyboard saturates and stops mattering. A hundred people each sending one message doesn't. That's the property you want, and it's three lines of code.

**This layer is a pure function over an event stream — no DOM, no network.** Which means it's unit-testable against your fixture file, and Taha can build it in complete isolation. Best seam in the system.

---

### L4 — Trigger (gesture)

**Primary: MediaPipe Tasks Vision `GestureRecognizer`.** Ships seven pre-trained gestures — `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`. No training, runs on-device at ~30fps, no network.

**Alternate: rule-based landmark geometry.** MediaPipe Hands gives 21 landmarks per hand; a finger is "extended" if its tip is further from the wrist than its PIP joint. Ten lines of vector math, fully debuggable, and lets you define custom gestures the canned model doesn't have. Use this if you want a gesture outside the seven.

**Debounce and cooldown — non-negotiable:**

```
fire when: same category for N≥5 consecutive frames (~166ms @30fps)
           AND confidence > 0.7
           AND now − lastFire[effect] > cooldown (≈5s)
```

Without this you get strobing effects every time someone talks with their hands. It will look broken and it will look broken *specifically during the demo*, because that's when people gesture most.

**Fallback ladder:**
1. MediaPipe gesture recognition
2. Rule-based landmarks
3. **Keyboard hotkey** ← keep this permanently, it's your stage insurance
4. Auto-fire when hype crosses a threshold (no human needed at all)

Fallback 3 matters more than it sounds. If Fortress's lighting defeats the webcam at 5pm, a hotkey looks identical to the audience. Nobody can tell.

---

### L5 — Director

Where the two signals meet. This is the product.

```ts
tier = H < 30 ? 0 : H < 70 ? 1 : 2;
effect = EFFECT_MAP[gesture][tier];
// Open_Palm → tier0: small 🔥  ·  tier1: flame burst  ·  tier2: FULL RAVE
```

Keep it a **pure function of (hype, gesture) → effect**, with cooldowns held outside. That makes it trivially testable and trivially explainable, and it's the thing you demo: same gesture, low charge vs peak charge, visibly different.

Also owns: the **Hit Me, Kick Me** state machine (unlocked → countdown → completed/expired), and the "who charged it" contributor list — the top-N users by recent weighted contribution, which you get almost free from the per-user decay map in L3.

---

### L6 — Render

**Perf budget is real.** MediaPipe eats a chunk of frame time. Everything else must be cheap:

- Effects on **CSS transforms and opacity** (compositor-only) or a single canvas. Never animate layout properties.
- One `requestAnimationFrame` loop for the meter; don't set React state at 60fps.
- Chat parsing throttled — batch DOM mutations, process at ~10Hz, not per-mutation.
- Meter value should be **interpolated toward** the target, not snapped. Smooth motion reads as "live"; snapping reads as "broken".

Transparent background, fixed 1920×1080, no scrollbars — so it can be an OBS source later even if you demo in plain Chrome.

---

## 4. Transport

Events flow **up** via POST; state flows **down** via SSE.

```
extension ──POST /events──▶ FastAPI ──SSE /stream──▶ overlay + all extensions
```

**Why SSE over WebSocket:** unidirectional is all you need downstream, auto-reconnect is built into `EventSource`, it survives proxies, and there's no ping/pong keepalive to get wrong. One less failure mode on venue wifi. Use WebSocket only if you find you need client→server streaming, which you won't.

Throttle broadcasts to ~10 Hz. The meter interpolates between updates, so nobody can tell.

---

## 5. Failure modes — the degradation ladder

Rehearse each of these. The one you don't rehearse is the one that happens.

| # | Failure | Degrades to | Audience notices? |
|---|---|---|---|
| 1 | Venue wifi drops | Replay fixtures drive the meter | No |
| 2 | kick.com DOM changed overnight | WS interception, then replay | No |
| 3 | Backend dies | Overlay runs standalone, loses multi-client sync | Barely |
| 4 | Webcam/lighting fails | Keyboard hotkey fires effects | **No** |
| 5 | MediaPipe won't load | Hotkey, or auto-fire on threshold | No |
| 6 | Chat too quiet to charge | Synthetic generator seeds baseline traffic | No |
| 7 | Everything is broken | Screen recording | Yes — but you still have a demo |

**Rule: every fallback must be reachable by a keystroke or a URL param, not a code change.** `?source=replay&trigger=hotkey` should give you a working demo from a cold start. Build that flag plumbing in the first hour on Saturday.

---

## 6. What to build this week

Five sessions, each self-contained, each teaching you something you'd otherwise learn the expensive way on Saturday. Roughly 2–3 hours each.

### Session 0 — Webhook dry run *(new priority, per Gui's steer)*
Gui's homework gets you the app, client ID/secret and dashboard. Finish the chain: `cloudflared tunnel --url http://localhost:3000`, complete the OAuth flow, `POST /public/v1/events/subscriptions` for `chat.message.sent` + `kicks.gifted`, then have the group spam `sammyg14`'s chat. Verify the RSA signature actually passes.

**You'll learn:** the whole official path end to end, and whether tunnelling is as fragile as feared.
**Deliverable:** a working webhook receiver you throw away, and confidence in the primary ingest path.

### Session 1 — Chat reader *(still do it — this produces the fixtures)*
Console script on a live KICK channel. MutationObserver on `[data-testid="chatroom-messages"]`, parse username + text + badges, dedup, log.

**You'll learn:** how bad the virtualisation problem actually is, what the DOM really looks like under load, whether badges parse cleanly.
**Deliverable:** a 10-minute captured event log → **this becomes the team's fixture file**, and it works on busy channels where `sammyg14` won't generate enough traffic to tune against.

### Session 2 — Hype engine
Pure TypeScript, no browser. Feed it Session 1's log. Implement decay, baseline, z-score, per-user saturation. Plot the output.

**You'll learn:** whether the math actually produces interesting curves on real data, and how to tune half-life and τ. Try it against both a quiet and a busy channel's log.
**Deliverable:** a tuned parameter set, and an honest answer to "does the z-score approach hold up?"

### Session 3 — MediaPipe hello-world
Webcam → landmarks on a canvas → gesture category printed. Nothing else.

**You'll learn:** real frame rate on your laptop, how twitchy the confidence scores are, how many debounce frames you actually need.
**Deliverable:** empirical debounce and cooldown values.

### Session 4 — Overlay render
Meter + one effect. Interpolated, transparent background, driven by fake hype values from a slider.

**You'll learn:** the perf budget, and how much the smooth interpolation matters to how "live" it feels.

### Session 5 — Wire it together
Sessions 1→2→4 end to end, then add 3. Add the `?source=` flag plumbing.

**You'll learn:** where the seams leak. This is the session that makes Saturday fast.

**Do 1 and 2 even if you do nothing else.** They're the two layers with real intellectual content, they're independent of every unresolved team decision, and Session 1's output is the artifact the whole team depends on.

---

## 7. Open questions

Carry these into Thursday.

1. **Will the venue network pass inbound webhook traffic to a tunnel?** Now the single most important unknown, because webhooks are the primary path. Ask Gui directly — he's the one person who can find out.
2. **Does the WS interception path actually work on KICK?** ⭐ Upgraded from Plan C to *worth a deliberate spike*, now that we know it's their #1 roadmap item. I confirmed `window.Pusher` is loaded but couldn't verify frame format live. If it works, it's both your resilience layer and your best talking point. Wrap `window.WebSocket` before the page connects — timing is the whole trick.
3. **Streamer-side vs viewer-side** — the gesture trigger pushes hard toward streamer-side. Confirm before building two frontends.
4. **Does `kicks.gifted` fire often enough to matter in a demo?** Nobody will be gifting Kicks on `sammyg14`. You may need to trigger one manually or mock it — worth knowing before you weight the signal around it.
5. **What's the actual half-life that feels right?** Session 2 answers this empirically. Don't guess on the day.
6. ~~Will Gui object to DOM reading?~~ **Effectively answered.** His homework points at the webhook event model, so lead with webhooks and present the DOM path as resilience — not as your main approach.

---

## 8. Things I'd get wrong if I were you

Written down so you don't have to discover them.

- **Building the backend first.** It's the least important layer and the most satisfying to build. The overlay standalone is the product; the server is sync.
- **Tuning the signal on synthetic data.** Real chat is burstier and more repetitive than anything you'd generate. Capture real logs in Session 1 or the parameters will be wrong.
- **Skipping warm-up handling.** Ships a demo that explodes at t=0 in front of judges.
- **Making the meter snap.** Interpolation is ten lines and it's most of the perceived quality.
- **Letting the gesture layer own cooldown state.** Put it in the director; you'll want to reason about it globally.
- **Treating the fixture file as a test fixture.** It's demo infrastructure. Capture it properly, commit it, and never lose it.
