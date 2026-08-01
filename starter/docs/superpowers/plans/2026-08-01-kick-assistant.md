# Kick-Ass(istant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI agent that watches the event stream and drives a full loop: streamer glasses HUD, viewer stream overlay, predictions & action-bets with mock AI validation, meme drops, coach tips, live summary, companion-phone view — one composite showcase page plus standalone routes.

**Architecture:** Server-side agent module subscribed to the existing in-memory event bus emits synthetic `assistant.*` events consumed by all pages via the existing SSE route. In-memory bets store publishes lifecycle events. Scripted demo director drives the story through the same APIs. LLM (Claude) used for coach tips / meme captions / summary lines with canned fallbacks.

**Tech Stack:** Next.js 15 app router, TypeScript, vitest, @anthropic-ai/sdk (already a dependency), existing `lib/event-bus.ts` + `/api/events/stream` + `use-kick-events`.

## Global Constraints

- Currency label is **KICKs** everywhere (no `$`).
- Every LLM call must have a canned fallback; no key ⇒ demo still works (pattern: `app/api/name-moment/route.ts`).
- Singletons use the `globalThis.__x ??=` pattern (dev-reload safety, see `lib/event-bus.ts:22`).
- All synthetic events publish through `eventBus.publish({id, type, receivedAt, payload})` with `type` = `assistant.<...>` (no `fake:` prefix; `normalizeEvent` passes them through).
- Pages follow existing demo styling: `PageChrome`, `?overlay=1`, CSS classes in `app/globals.css`, Kick-green `#53fc18` accents, dark background.
- Pure logic modules take `now: number` params — no `Date.now()` inside logic, so tests need no fake timers (store/agent); demo script uses injectable scheduler.

---

### Task 1: Types + bets store

**Files:**
- Create: `lib/assistant/types.ts`, `lib/assistant/publish.ts`, `lib/assistant/bets-store.ts`
- Test: `tests/assistant-bets-store.test.ts`

**Interfaces (Produces):**

```ts
// types.ts
export type PredictionSide = "yes" | "no";
export type Prediction = {
  id: string; question: string; createdAt: number; endsAt: number;
  pools: Record<PredictionSide, number>;                    // KICKs per side
  wagers: { user: string; side: PredictionSide; amount: number }[];
  status: "open" | "settled"; outcome?: PredictionSide;
};
export type BetStatus = "open" | "accepted" | "declined" | "watching" | "validated" | "paid" | "expired";
export type ActionBet = {
  id: string; user: string; wager: number; condition: string;
  createdAt: number; deadline: number; status: BetStatus;
};
export type HypeSource = { label: string; points: number; at: number };

// publish.ts
export function publishAssistant(type: string, payload: unknown): void; // wraps eventBus.publish

// bets-store.ts (module singleton via globalThis)
export function createPrediction(question: string, durationMs: number, now: number): Prediction; // → assistant.prediction.created
export function placeWager(id: string, user: string, side: PredictionSide, amount: number, now: number): Prediction; // → assistant.prediction.wager; throws on unknown/settled/ended
export function oddsFor(p: Prediction): Record<PredictionSide, number>;  // integer %, 50/50 when both pools empty, sums to 100
export function settlePrediction(id: string, outcome: PredictionSide): Prediction; // → assistant.prediction.settled
export function createBet(user: string, wager: number, condition: string, durationMs: number, now: number): ActionBet; // → assistant.bet.created
export type BetAction = "accept" | "decline" | "watch" | "validate" | "pay";
export function advanceBet(id: string, action: BetAction): ActionBet;    // guarded transitions, throws otherwise
// open→accepted|declined, accepted→watching, watching→validated, validated→paid
// events: assistant.bet.accepted/.declined/.watching/.validated/.paid (paid payload includes payout = 2×wager to user)
export function listPredictions(): Prediction[];
export function listBets(): ActionBet[];
export function resetAssistantStore(): void; // tests + demo restart
```

- [ ] Write failing tests: create/wager/odds math (empty pools → 50/50; 1250 vs 480 → 72/28), wager on settled/expired throws, full bet lifecycle open→…→paid, invalid transition throws (e.g. open→watch), payout math in `.paid` event payload, events published on each transition (subscribe to `eventBus`).
- [ ] Run `npx vitest run tests/assistant-bets-store.test.ts` → FAIL (module missing)
- [ ] Implement types.ts, publish.ts, bets-store.ts
- [ ] Tests pass; commit `feat: assistant bets store with prediction pools and bet lifecycle`

### Task 2: Agent (hype breakdown, velocity, spam→meme detection)

**Files:**
- Create: `lib/assistant/agent.ts`
- Test: `tests/assistant-agent.test.ts`

**Interfaces (Produces):**

```ts
export const MEME_COOLDOWN_MS = 30_000;
export class AssistantAgent {
  constructor(publish: (type: string, payload: unknown) => void);
  ingest(kind: string, payload: unknown, now: number): void;
  tick(now: number): void;   // decay + throttled assistant.hype emission (≥1/s or band change)
  get score(): number;
  get breakdown(): HypeSource[];       // last 60s, newest first
  get velocity(): number;              // msgs/min over rolling 60s
}
```

Behavior:
- Chat/follow/sub/kicks kinds score via existing `pointsFor`; new sources: `assistant.prediction.wager` +20 "Predictions placed", `assistant.bet.created`/`assistant.bet.accepted` +18 "Bets & participation", `assistant.meme` +14 "Memes detected".
- Spam detection on each chat ingest: a token (word ≥2 chars, case-insensitive) appearing in ≥6 of the last 10 messages within 15s triggers `assistant.meme {token, hype}` — subject to 30s cooldown.
- Band transitions (bands: 0–19 quiet, 20–49 warm, 50–79 hyped, 80–100 very hyped) emit `assistant.coach {text, source:"heuristic"}` (canned per-band tips) and `assistant.summary {text, at}` lines; meme + bet lifecycle events also append summary lines.
- `assistant.hype` payload: `{score, label, velocity, breakdown}`.

- [ ] Failing tests: chat msgs raise score & velocity; breakdown labels aggregate; spam trigger fires exactly once within cooldown (7× "67 67 67" messages → one `assistant.meme` with token "67"); no trigger when token spread over >15s; decay via tick; band-cross emits coach+summary; wager/bet kinds add 20/18.
- [ ] FAIL run → implement → PASS
- [ ] Commit `feat: assistant agent with hype breakdown, velocity and meme detection`

### Task 3: LLM helper + agent runtime wiring

**Files:**
- Create: `lib/assistant/llm.ts`, `lib/assistant/runtime.ts`

**Interfaces (Produces):**

```ts
// llm.ts — each returns instantly-canned when no ANTHROPIC_API_KEY; pattern of app/api/name-moment/route.ts
export function coachTip(ctx: {score: number; velocity: number; lastEvents: string[]}): Promise<{text: string; source: "ai" | "heuristic"}>;
export function memeCaption(token: string): Promise<{text: string; source: "ai" | "heuristic"}>;
export function summaryLine(eventDesc: string): Promise<{text: string; source: "ai" | "heuristic"}>;

// runtime.ts — server singleton (globalThis.__assistantRuntime)
export function ensureAssistantRuntime(): void;
// subscribes AssistantAgent to eventBus, 1s setInterval tick, seeds the
// "Will Neon hit 13,000 trophies this stream?" prediction (pools 1250/480) once
```

- Canned pools reference the story: coach ("Chat energy is high! Keep the momentum!", "Acknowledge the '67' hype — chat is responding well to it", "Consider talking to chat — engagement might dip soon"), meme captions ("Chat is spamming \"67\"!"), summary templates.
- Agent's coach/summary emissions upgrade to LLM text when key present: runtime intercepts heuristic coach/summary emissions? No — keep simple: runtime passes a `publish` wrapper that fire-and-forgets `coachTip`/`summaryLine` rewrites only for `assistant.coach`/`assistant.summary`, publishing the final text once resolved.
- No unit tests (thin IO wiring; fallbacks exercised implicitly) — verified via dev server.
- [ ] Implement, typecheck (`npx tsc --noEmit`), commit `feat: assistant LLM helpers with canned fallbacks and runtime wiring`

### Task 4: Demo script (scripted story mode)

**Files:**
- Create: `lib/assistant/demo-script.ts`
- Test: `tests/assistant-demo-script.test.ts`

**Interfaces (Produces):**

```ts
export type DemoStep = { id: string; delayMs: number; label: string; run: (now: number) => void };
export const DEMO_STEPS: DemoStep[]; // ordered story
export function playDemo(schedule?: (fn: () => void, ms: number) => unknown): void; // default setTimeout; publishes assistant.demo {status:"playing"|"done", step}
export function stopDemo(): void;
export function demoStatus(): { playing: boolean; step: string | null };
```

Story steps (cumulative delays ~45s total): ① @HypeKing creates 50-KICKs action bet "talk to the girls on the left" ② streamer accepts ③ 14-message chat burst spamming "67" (staggered 250ms; agent organically spikes hype + fires meme) ④ wagers land on the seeded prediction ⑤ bet → watching ("AI analyzing stream…") ⑥ → validated ("Event detected: you talked to the girls") ⑦ → paid (payout 100 KICKs to @HypeKing) ⑧ closing summary line.

- [ ] Failing tests with injected synchronous scheduler: step order, statuses transition correctly in store, stopDemo halts pending steps, playDemo while playing is a no-op.
- [ ] FAIL → implement → PASS
- [ ] Commit `feat: scripted demo story mode for the assistant loop`

### Task 5: API routes

**Files:**
- Create: `app/api/assistant/state/route.ts` (GET snapshot: `{hype:{score,label,velocity,breakdown}, predictions, bets, demo}`)
- Create: `app/api/assistant/predictions/route.ts` (POST `{question, durationMinutes}`)
- Create: `app/api/assistant/predictions/[id]/wager/route.ts` (POST `{user, side, amount}`)
- Create: `app/api/assistant/bets/route.ts` (POST `{user, wager, condition, durationMinutes}`)
- Create: `app/api/assistant/bets/[id]/route.ts` (POST `{action: "accept"|"decline"|"validate"}`; `validate` runs watch→validate→pay with 1.5s pauses)
- Create: `app/api/assistant/demo/route.ts` (POST `{action: "play"|"stop"}`)
- Test: `tests/assistant-routes.test.ts` (route-handler unit tests like `tests/webhook-route.test.ts`: wager route 400 on bad side, bets action route 409 on invalid transition, state shape)

All routes call `ensureAssistantRuntime()` first; errors → `Response.json({error}, {status})`.

- [ ] Failing tests → implement → PASS → commit `feat: assistant API routes`

### Task 6: Shared client hook + components

**Files:**
- Create: `lib/assistant/use-assistant.ts` — client hook: fetch `/api/assistant/state` once, then reduce `assistant.*` SSE events via `useKickEvents`; returns `{connected, hype, breakdown, velocity, predictions, bets, memes, coach, summary, chat, demo}` (chat = last 12 chat messages from raw kinds; memes = active meme w/ 6s TTL).
- Create in `components/assistant/`: `hype-gauge.tsx` (big score + label + boost list), `prediction-card.tsx` (`variant: "overlay"|"panel"` — odds bars, pools, Bet Now buttons wired to wager API), `bet-card.tsx` (`variant: "hud"|"overlay"` — status pill; hud variant has Accept/Ignore buttons), `hud-stack.tsx` (stacked glasses notification cards: predictions, incoming bets, hype alerts, coach tips), `meme-overlay.tsx` (giant token + 🐸 + caption + flame hype level, pop-in animation), `summary-timeline.tsx`, `coach-panel.tsx` (AI COACH · LIVE, tip list, engagement meter), `validation-ticker.tsx` (analyzing→detected→paid step lights driven by top bet status), `assistant-demo-controls.tsx` (▶ play story, ⏹ stop, individual inject buttons incl. "spam 67 burst", "new bet", "wager").
- Modify: `app/globals.css` — `.assistant-*` classes (HUD card glow, gauge, odds bars, meme pop, phone frame, composite grid).
- [ ] Implement (visual components; no unit tests — verified in Task 7 via dev server), typecheck, commit `feat: assistant shared hook and UI components`

### Task 7: Pages + README

**Files:**
- Create: `app/demo/assistant/page.tsx` (composite showcase grid per mock 1: HUD panel, overlay stage w/ meme + gauge + chat, predictions panel, validation ticker, phone frame, "how it works" strip, demo controls)
- Create: `app/demo/assistant/hud/page.tsx` (dark POV backdrop, `HudStack`, validation ticker; `?overlay=1`)
- Create: `app/demo/assistant/overlay/page.tsx` (gauge, prediction card, top bet, meme overlay, summary toasts; `?overlay=1`)
- Create: `app/demo/assistant/bets/page.tsx` (Predictions/My Bets tabs, Create Prediction + Create Bet forms)
- Create: `app/demo/assistant/phone/page.tsx` (phone frame: hype, predictions, summary, push cards)
- Modify: `app/demo/page.tsx` (add links), `README.md` (routes table + narrative blurb)
- [ ] Implement; `npm test` all green; `npx tsc --noEmit`; dev-server walkthrough: play story mode on `/demo/assistant`, confirm the full beat sequence lands; commit `feat: kick-assistant pages — composite showcase, HUD, overlay, bets, phone`

## Self-review notes

- Spec coverage: agent ✓(T2/T3) store ✓(T1) script ✓(T4) routes ✓(T5) 5 pages ✓(T7) LLM hybrid ✓(T3) tests ✓(T1/T2/T4/T5). Companion app = phone page ✓.
- Type names consistent across tasks (Prediction/ActionBet/BetAction/HypeSource).
- UI tasks carry component contracts instead of full JSX by design; logic tasks are code-complete.
