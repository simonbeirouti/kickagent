/**
 * Live-replay harness — run with `node test/live-replay.js [fixture] [--broadcaster=ID] [--all-channels]`.
 *
 * Replays REAL KICK events (captured from the kick-hype-starter deployment's
 * SSE feed, see fixtures/live-capture.jsonl) through the full hype stack:
 * HypeEngine + TopicTracker + KickAssistant + HighlightTracker, on the real
 * event timestamps. This is the "does it work on real data?" harness — it
 * reports rather than asserts, because real chat has no scripted ground truth.
 *
 * Fixture format: one SSE message per line, exactly as received:
 *   { id, type, receivedAt, payload }
 * where type is a KICK webhook event ("chat.message.sent", "kicks.gifted",
 * "channel.subscription.new", "channel.subscription.gifts",
 * "channel.followed", "livestream.status.updated") or a service-local
 * synthetic type ("assistant.*", "fake:*") which the mapper skips.
 *
 * Mapping (mirrors kickagent/lib/kick/hype-adapter.ts, plus badges — the
 * live payloads DO carry sender.identity.badges, so we use them):
 *   chat.message.sent            → { type:'chat',  text: content, badges: identity.badges[].type }
 *   kicks.gifted                 → { type:'kicks', raw: gift.amount }
 *   channel.subscription.new     → { type:'sub',   raw: 1 }
 *   channel.subscription.renewal → { type:'sub',   raw: 1 }
 *   channel.subscription.gifts   → { type:'sub',   raw: giftees.length }
 *   channel.followed             → { type:'follow' }
 *
 * ts = created_at (KICK's own event time) when present, else the SSE
 * receivedAt. Events are sorted and normalised so t=0 is the first event —
 * inter-event timing is untouched (real timestamps, relative clock).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HypeEngine } from '../src/engine.js';
import { TopicTracker } from '../src/topics.js';
import { KickAssistant } from '../src/assistant.js';
import { TrendingTopics } from '../src/trending.js';
import { HighlightTracker } from '../src/highlights.js';

// ---------- args ----------
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith('--'));
const fixturePath = resolve(here, fileArg ?? '../fixtures/live-capture.jsonl');
const broadcasterArg = args.find((a) => a.startsWith('--broadcaster='))?.split('=')[1];
const allChannels = args.includes('--all-channels');

// ---------- load ----------
const lines = readFileSync(fixturePath, 'utf8').split('\n').filter((l) => l.trim());
const messages = [];
let parseErrors = 0;
for (const line of lines) {
  try {
    messages.push(JSON.parse(line));
  } catch {
    parseErrors++;
  }
}

// ---------- map SSE messages → engine events ----------
function broadcasterOf(p) {
  return p?.broadcaster?.user_id ?? null;
}

/** Map one SSE message to the HypeEngine event shape, or null to skip. */
function mapKickEvent(msg) {
  const p = msg.payload ?? {};
  const kind = String(msg.type ?? '').replace(/^fake:/, '');
  const created = p.created_at ? Date.parse(p.created_at) : NaN;
  const received = Date.parse(msg.receivedAt);
  const ts = Number.isFinite(created) ? created : received;
  const base = { id: msg.id, ts, broadcaster: broadcasterOf(p), skewMs: Number.isFinite(created) ? received - created : null };

  switch (kind) {
    case 'chat.message.sent': {
      const s = p.sender ?? {};
      return {
        ...base,
        id: p.message_id ?? msg.id,
        type: 'chat',
        userId: String(s.user_id ?? 'anonymous'),
        username: s.username ?? 'Anonymous',
        badges: (s.identity?.badges ?? []).map((b) => b.type),
        text: p.content ?? '',
      };
    }
    case 'kicks.gifted': {
      const g = p.gifter ?? {};
      return { ...base, type: 'kicks', userId: String(g.user_id ?? 'anonymous'), username: g.username ?? 'Anonymous', badges: [], raw: p.gift?.amount ?? 1 };
    }
    case 'channel.subscription.new':
    case 'channel.subscription.renewal': {
      const s = p.subscriber ?? {};
      return { ...base, type: 'sub', userId: String(s.user_id ?? 'anonymous'), username: s.username ?? 'Anonymous', badges: [], raw: 1 };
    }
    case 'channel.subscription.gifts': {
      const g = p.gifter ?? {};
      const n = Array.isArray(p.giftees) ? p.giftees.length : 1;
      return { ...base, type: 'sub', userId: String(g.user_id ?? 'anonymous'), username: g.username ?? 'Anonymous', badges: [], raw: Math.max(1, n) };
    }
    case 'channel.followed': {
      const f = p.follower ?? {};
      return { ...base, type: 'follow', userId: String(f.user_id ?? 'anonymous'), username: f.username ?? 'Anonymous', badges: [] };
    }
    default:
      return null; // assistant.*, livestream.status.updated, unknown
  }
}

const rawCounts = new Map();   // SSE type → count
const chanCounts = new Map();  // broadcaster id → { chat, kicks, sub, follow, slug }
let mapped = [];
for (const msg of messages) {
  rawCounts.set(msg.type, (rawCounts.get(msg.type) ?? 0) + 1);
  const ev = mapKickEvent(msg);
  if (!ev) continue;
  const b = ev.broadcaster ?? 'unknown';
  if (!chanCounts.has(b)) chanCounts.set(b, { chat: 0, kicks: 0, sub: 0, follow: 0, slug: msg.payload?.broadcaster?.channel_slug ?? '?' });
  chanCounts.get(b)[ev.type]++;
  mapped.push(ev);
}

// ---------- pick channel ----------
let broadcaster = broadcasterArg ? Number(broadcasterArg) : null;
if (!broadcaster && !allChannels) {
  let best = null;
  for (const [b, c] of chanCounts) if (!best || c.chat > chanCounts.get(best).chat) best = b;
  broadcaster = best;
}
const events = (allChannels ? mapped : mapped.filter((e) => e.broadcaster === broadcaster)).sort((a, b) => a.ts - b.ts);

if (!events.length) {
  console.error('No mappable events for the selected channel. Channels seen:', [...chanCounts.keys()].join(', '));
  process.exit(1);
}

// ---------- anomaly stats (before normalising) ----------
const skews = events.filter((e) => e.skewMs != null).map((e) => e.skewMs).sort((a, b) => a - b);
const pct = (p) => skews[Math.min(skews.length - 1, Math.floor((p / 100) * skews.length))];
let outOfOrder = 0;
{
  // arrival order vs created_at order, within the selected channel
  const arrival = mapped.filter((e) => allChannels || e.broadcaster === broadcaster);
  for (let i = 1; i < arrival.length; i++) if (arrival[i].ts < arrival[i - 1].ts) outOfOrder++;
}
const dupeIds = events.length - new Set(events.map((e) => e.id)).size;

// ---------- normalise clock ----------
const t0 = events[0].ts;
for (const e of events) e.ts -= t0;
const durationMs = events.at(-1).ts;

// ---------- run the full stack on real timestamps ----------
const engine = new HypeEngine();
const topics = new TopicTracker();
const assistant = new KickAssistant(engine, topics, { trending: new TrendingTopics() });
const highlights = new HighlightTracker({ topics });

const out = { samples: [], suggestions: [], impacts: [], ready: null };
assistant.on('ready', (p) => (out.ready = p));
assistant.on('suggestion', (p) => out.suggestions.push(p));
assistant.on('impact', (p) => out.impacts.push(p));

const SAMPLE_MS = 500;
let ei = 0;
const topicTimeline = []; // { now, top } every 15s, for "what was chat about"
for (let now = 0; now <= durationMs + 5000; now += SAMPLE_MS) {
  while (ei < events.length && events[ei].ts <= now) {
    const ev = events[ei++];
    const w = engine.ingest(ev);
    if (!engine.isFlagged(ev.userId)) topics.ingest(ev, w);
    highlights.onEvent(ev, w);
  }
  const s = engine.sample(now);
  assistant.onSample(s, now);
  highlights.onSample(s, now);
  out.samples.push({ now, hype: s.hype, raw: s.raw, trend: s.trend, ready: s.ready });
  if (now % 15_000 === 0) topicTimeline.push({ now, top: topics.top(3, now) });
}

// ---------- report ----------
const spark = (vals) => {
  const blocks = ' ▁▂▃▄▅▆▇█';
  return vals.map((v) => blocks[Math.min(8, Math.floor((v / 100) * 8.99))]).join('');
};
const fmtT = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log('=== Live capture replay ===');
console.log(`fixture: ${fixturePath}`);
console.log(`lines: ${lines.length} (${parseErrors} parse errors)`);
console.log('SSE message counts:', Object.fromEntries([...rawCounts.entries()].sort((a, b) => b[1] - a[1])));
console.log('channels seen:');
for (const [b, c] of chanCounts)
  console.log(`  ${b} (${c.slug}): chat=${c.chat} kicks=${c.kicks} sub=${c.sub} follow=${c.follow}`);
console.log(
  allChannels
    ? 'replaying: ALL channels mixed'
    : `replaying: broadcaster ${broadcaster} (${chanCounts.get(broadcaster)?.slug}) — ${events.length} events over ${fmtT(durationMs)}`
);
if (skews.length)
  console.log(
    `webhook→SSE clock skew (receivedAt − created_at): p10=${pct(10)}ms  median=${pct(50)}ms  p90=${pct(90)}ms  max=${pct(100)}ms`
  );
console.log(`anomalies: out-of-order arrivals=${outOfOrder}  duplicate ids=${dupeIds}`);

// hype curve, downsampled to ~90 chars
const stride = Math.max(1, Math.floor(out.samples.length / 90));
console.log('\nhype curve (0 → ' + fmtT(durationMs) + '):');
console.log(spark(out.samples.filter((_, i) => i % stride === 0).map((s) => s.hype)));

// 30s phase means
const buckets = [];
for (let t = 0; t < durationMs; t += 30_000) {
  const xs = out.samples.filter((s) => s.now >= t && s.now < t + 30_000).map((s) => s.hype);
  buckets.push(`${fmtT(t)}–${fmtT(Math.min(t + 30_000, durationMs))}: ${Math.round(mean(xs))}`);
}
console.log('mean hype per 30s: ' + buckets.join('  '));
const hypes = out.samples.map((s) => s.hype);
const peak = Math.max(...hypes);
const peakAt = out.samples[hypes.indexOf(peak)].now;
console.log(`overall: mean=${Math.round(mean(hypes))}  peak=${peak} at ${fmtT(peakAt)}  min=${Math.min(...hypes)}`);

console.log(
  '\nbaseline: ' + (out.ready ? `LOCKED at ${fmtT(out.ready.ts)} (baseline=${out.ready.baseline.toFixed(1)})` : 'NEVER LOCKED')
);

console.log('\ntop topics (end of capture):');
for (const t of topics.top(10, durationMs))
  console.log(`  ${t.topic}  score=${t.score.toFixed(1)}  ${t.trend}  mentions=${t.mentions}`);

console.log('\ntopic timeline (top-3 every 30s):');
for (const row of topicTimeline.filter((_, i) => i % 2 === 0))
  console.log(`  ${fmtT(row.now)}  ${row.top.map((t) => `${t.topic}(${t.score.toFixed(1)})`).join('  ') || '—'}`);

console.log('\nspam flags: ' + (engine.flaggedUsers.length
  ? engine.flaggedUsers.map((f) => `${f.username} at ${fmtT(f.ts)}`).join(', ')
  : 'none'));

console.log('suggestions fired: ' + (out.suggestions.length
  ? '\n' + out.suggestions.map((s) => `  [${fmtT(s.ts)}] (${s.kind}) ${s.text}`).join('\n')
  : 'none'));

const reel = highlights.reel();
console.log('highlights captured: ' + (reel.length
  ? '\n' + reel.map((h) => `  ${fmtT(h.startTs)}–${fmtT(h.endTs)} peak ${h.peakHype} — ${h.headline}`).join('\n')
  : 'none'));
