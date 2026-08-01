# Hype Engine

Quantitative + qualitative hype scoring for a KICK stream. Zero dependencies,
plain ES modules — runs in any browser and in Node. This is the signal layer
the overlay, **Hit Me, Kick Me**, and glasses features build on.

## Run it

```bash
npm test    # simulation harness: 14 behaviour checks against the scripted replay
npm run demo    # serves the live dashboard at http://localhost:8420/demo/
```

## What's in the box

| File | What it does |
|---|---|
| `src/engine.js` | **Hype Score 0–100.** Exponentially-decayed activity vs a rolling baseline → z-score → sigmoid. Self-calibrating: "unusually busy for *this* channel, right now" — behaves identically at 200 and 50,000 viewers. Per-user saturation gives spam resistance and flags spammers. O(1) memory and O(1) per event. |
| `src/topics.js` | **What chat is hyped about.** Per-term fast (20s) + slow (90s) decayed scores; their ratio gives per-topic momentum (rising/steady/falling). A topic needs multiple distinct users — one enthusiast or spammer can't push one. |
| `src/assistant.js` | **Decision layer.** Emits `ready` when the baseline locks (the signal for **Hit Me, Kick Me** to open), `suggestion` when hype is low & falling (`kind: 'pivot'` — a rising pivot topic) or when a platform-trending topic is missing from chat (`kind: 'trending'`), and `impact` after a tracked **Hit Me, Kick Me** round (hype up/flat/down verdict). |
| `src/trending.js` | **Mocked platform trending source.** Ordered list of KICK-wide trending keywords (stands in for the real categories/trending API). The assistant diffs it against chat's live topics and suggests the gaps to pull new viewers in. |
| `src/mock.js` | Scripted ~4.5-min replay (warm-up → ramp → spam attack → lull → bet burst → cooldown) mirroring real KICK webhook payload fields, plus a synthetic generator for scale testing. Deterministic PRNG: identical every run — stage insurance. |
| `demo/index.html` | Live dashboard: hype meter, hot-topics leaderboard, chat feed, assistant feed. Buttons to inject a hype burst, inject a spammer, and run a **Hit Me, Kick Me** impact measurement. |
| `test/sim.js` | Behaviour checks: baseline locks, ramp registers, spam is flagged & doesn't spike the score, suggestion fires in the lull, **Hit Me, Kick Me** measures "up", "poker" tops topics, a trending-gap suggestion names a topic absent from chat, and the same relative burst scores similarly at 1 and 40 msg/s. |

## Wiring it up (for the overlay / Hit Me, Kick Me people)

```js
import { HypeEngine } from './src/engine.js';
import { TopicTracker } from './src/topics.js';
import { KickAssistant } from './src/assistant.js';
import { TrendingTopics } from './src/trending.js';

const engine = new HypeEngine();
const topics = new TopicTracker();
const assistant = new KickAssistant(engine, topics, { trending: new TrendingTopics() });

// 1. Feed events (from webhooks, replay, or anything shaped like one):
const w = engine.ingest(event);                    // returns effective weight
if (!engine.isFlagged(event.userId)) topics.ingest(event, w);

// 2. Sample at 1–4 Hz with your clock:
const state = engine.sample(Date.now());           // { hype, trend, ready, ... }
assistant.onSample(state, Date.now());

// 3. Subscribe:
assistant.on('ready',      (p) => openBetting(p));         // baseline locked
assistant.on('suggestion', (p) => showToStreamer(p.text)); // p.kind: 'pivot' | 'trending'
assistant.on('impact',     (p) => resolveBet(p.verdict));  // 'up'|'flat'|'down'

// 4. When the streamer starts a Hit Me, Kick Me round:
assistant.trackAction('do a backflip', Date.now()); // 'impact' fires ~15s later
```

Event shape (mirrors KICK webhook payloads — `chat.message.sent`,
`kicks.gifted`, `channel.subscription.*`):

```js
{ id, type: 'chat'|'kicks'|'sub'|'follow'|'ban',
  userId, username, badges: ['subscriber', ...], text?, raw?, ts }
```

## The two-sentence judge explanation

> Hype means "unusually busy for this channel, right now" — a z-score against
> a self-calibrating rolling baseline, so it works identically at 200 viewers
> and 50,000. On top of it, every topic in chat gets the same treatment, so the
> assistant knows not just *how* hyped chat is, but *what about* — and can
> suggest the pivot when energy drops.
