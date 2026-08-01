/**
 * Behaviour test cases — run with `node test/cases.js`.
 *
 * Complements test/sim.js (the demo-arc harness) with small, labeled
 * scenarios that each pin down ONE behaviour of the hype stack:
 *
 *    1. dead chat          hype decays low, trend falling → steady
 *    2. whale vs crowd     log damping + saturation keep both sane
 *    3. copypasta wave     distinct users, same line: hype rises, nobody flagged
 *    4. single-user spam   flag trips, weight saturates, flag expires
 *    5. raid               follows + fresh chatters spike hype fast
 *    6. sustained plateau  baseline self-calibrates; highlights hit the 40s cap
 *    7. warm-up discipline nothing fires before 45s
 *    8. impact verdicts    engineered up / flat / down
 *    9. assistant cooldowns no suggestion spam under prolonged low hype
 *   10. topics             multi-user rule, momentum lifecycle, spam exclusion
 *   11. highlights         hysteresis, lead-in clamp, headline ranking
 *   12. determinism        scripted replay is bit-identical run-to-run
 *
 * Zero dependencies, same check style as sim.js.
 */

import { HypeEngine } from '../src/engine.js';
import { TopicTracker } from '../src/topics.js';
import { KickAssistant } from '../src/assistant.js';
import { TrendingTopics } from '../src/trending.js';
import { HighlightTracker } from '../src/highlights.js';
import { createScriptedReplay, synthetic } from '../src/mock.js';

let failures = 0;
let section = '';
function suite(name) {
  section = name;
  console.log(`\n=== ${name} ===`);
}
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
}

// ---------- tiny event builders ----------
let nextId = 1;
const chat = (ts, userId, text, badges = []) => ({
  id: `c${nextId++}`, type: 'chat', userId, username: userId, badges, text, ts,
});
const kicks = (ts, userId, amount) => ({
  id: `k${nextId++}`, type: 'kicks', userId, username: userId, badges: [], raw: amount, ts,
});
const follow = (ts, userId) => ({
  id: `f${nextId++}`, type: 'follow', userId, username: userId, badges: [], ts,
});

/**
 * Quiet-but-alive background chatter: one unique-text message every
 * `everyMs` from a rotating pool of users. Gives the engine a baseline to
 * calibrate against without ever spiking it.
 */
function background(t0, t1, everyMs = 1500, pool = 8, prefix = 'bg') {
  const ev = [];
  let i = 0;
  for (let t = t0; t < t1; t += everyMs) {
    ev.push(chat(t, `${prefix}_user${i % pool}`, `${prefix} message number ${i}`));
    i++;
  }
  return ev;
}

/** Same full wiring the overlay uses: engine + topics + assistant + highlights at 1 Hz. */
function run(events, { endMs = null, sampleMs = 1000, hooks = {} } = {}) {
  events = [...events].sort((a, b) => a.ts - b.ts);
  const engine = new HypeEngine();
  const topics = new TopicTracker();
  const assistant = new KickAssistant(engine, topics, { trending: new TrendingTopics() });
  const highlights = new HighlightTracker({ topics });
  const out = { samples: [], suggestions: [], impacts: [], ready: null };

  assistant.on('ready', (p) => (out.ready = p));
  assistant.on('suggestion', (p) => out.suggestions.push(p));
  assistant.on('impact', (p) => out.impacts.push(p));

  const end = endMs ?? events.at(-1).ts + 20_000;
  let ei = 0;
  for (let now = 0; now <= end; now += sampleMs) {
    while (ei < events.length && events[ei].ts <= now) {
      const ev = events[ei++];
      const w = engine.ingest(ev);
      if (!engine.isFlagged(ev.userId)) topics.ingest(ev, w);
      highlights.onEvent(ev, w);
    }
    const s = engine.sample(now);
    assistant.onSample(s, now);
    highlights.onSample(s, now);
    out.samples.push({ now, ...s });
    hooks.onSample?.(now, s, assistant);
  }
  out.engine = engine;
  out.topics = topics;
  out.assistant = assistant;
  out.highlights = highlights.reel();
  return out;
}

const between = (samples, t0, t1) => samples.filter((s) => s.now >= t0 && s.now < t1);
const meanHype = (samples, t0, t1) => {
  const xs = between(samples, t0, t1).map((s) => s.hype);
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
};
const peakHype = (samples, t0, t1) =>
  Math.max(...between(samples, t0, t1).map((s) => s.hype));

// =====================================================================
suite('1. Dead chat — hype decays low, trend falling → steady');
{
  // Alive for 90s, then total silence for 4 minutes.
  //
  // Regression guard: this case originally exposed a real bug — in a
  // long-dead chat the baseline AND variance both decay toward zero, but
  // variance decays slower, so z drifted back to 0 and the score crept up
  // to ~40 ("good energy") on a channel dead for 10 minutes. The engine's
  // silence floor now scales the score to 0 once raw activity is dead air.
  const r = run(background(0, 90_000, 800, 10), { endMs: 330_000 });
  const finalHype = r.samples.at(-1).hype;
  const activeMean = meanHype(r.samples, 45_000, 90_000);
  check('hype decays to ~0 after chat dies', finalHype <= 5, `final ${finalHype}`);
  check('dead hype sits far below the alive-phase mean', finalHype < activeMean - 20,
    `final ${finalHype} vs alive mean ${Math.round(activeMean)}`);
  const lateSlice = between(r.samples, 200_000, 330_000).map((s) => s.hype);
  check('no creep-back: hype never recovers during silence', Math.max(...lateSlice) <= 10,
    `max after 200s: ${Math.max(...lateSlice)}`);
  const sawFalling = between(r.samples, 90_000, 130_000).some((s) => s.trend === 'falling');
  check('trend reads falling while chat dies', sawFalling);
  const tail = between(r.samples, 280_000, 330_000);
  check('trend settles to steady once flatlined', tail.every((s) => s.trend === 'steady'),
    `tail trends: ${[...new Set(tail.map((s) => s.trend))].join(',')}`);
}

// =====================================================================
suite('2. Whale vs crowd — both register, neither dominates absurdly');
{
  const bg = () => background(0, 200_000, 1500, 8);
  // One user gifts 10,000 kicks at t=120s.
  const whale = run([...bg(), kicks(120_000, 'moneybags', 10_000)], { endMs: 200_000 });
  // 100 distinct users each chat once, spread across 120–130s.
  const crowdEvents = Array.from({ length: 100 }, (_, i) =>
    chat(120_000 + i * 100, `crowd_${i}`, `hyped viewer ${i} checking in`));
  const crowd = run([...bg(), ...crowdEvents], { endMs: 200_000 });

  const pre = meanHype(whale.samples, 100_000, 120_000);
  const whalePeak = peakHype(whale.samples, 120_000, 145_000);
  const crowdPeak = peakHype(crowd.samples, 120_000, 145_000);
  check('whale gift registers', whalePeak >= pre + 15, `pre ${Math.round(pre)} → peak ${whalePeak}`);
  check('crowd of 100 registers', crowdPeak >= pre + 15, `pre ${Math.round(pre)} → peak ${crowdPeak}`);
  check('log damping: one whale does not out-hype 100 humans', whalePeak <= crowdPeak,
    `whale ${whalePeak} vs crowd ${crowdPeak}`);
  // 5 + 2·log10(1 + 10000) ≈ 13: the gift is worth ~13 chat messages, not 10,000.
  const w = new HypeEngine().weigh({ type: 'kicks', raw: 10_000, ts: 0 }).weight;
  check('10,000-kick gift weight is log-damped to ~13', w > 12 && w < 14, `weight ${w.toFixed(2)}`);
}

// =====================================================================
suite('3. Copypasta wave — distinct users, same line');
{
  const bg = background(0, 200_000, 1500, 8);
  const wave = Array.from({ length: 60 }, (_, i) =>
    chat(120_000 + i * 250, `pasta_${i}`, 'GIGACHAD STREAMER TAKE MY ENERGY'));
  const r = run([...bg, ...wave], { endMs: 200_000 });

  const pre = meanHype(r.samples, 100_000, 120_000);
  const peak = peakHype(r.samples, 120_000, 145_000);
  check('crowd copypasta still raises hype (the crowd is real)', peak >= pre + 15,
    `pre ${Math.round(pre)} → peak ${peak}`);
  check('nobody gets flagged for a shared meme', r.engine.flaggedUsers.length === 0,
    r.engine.flaggedUsers.map((f) => f.userId).join(',') || 'clean');

  // Novelty damping: same crowd shouting UNIQUE lines should register higher.
  const unique = Array.from({ length: 60 }, (_, i) =>
    chat(120_000 + i * 250, `pasta_${i}`, `unique hype line number ${i}`));
  const r2 = run([...background(0, 200_000, 1500, 8), ...unique], { endMs: 200_000 });
  const uniquePeak = peakHype(r2.samples, 120_000, 145_000);
  check('duplicate lines are novelty-damped vs unique lines', peak <= uniquePeak,
    `copypasta ${peak} vs unique ${uniquePeak}`);
}

// =====================================================================
suite('4. Single-user spam — flag trips, weight saturates, flag expires');
{
  // Direct engine probe for the saturation curve.
  const e = new HypeEngine();
  const w0 = e.ingest(chat(0, 'spammer', 'BUY MY COINS'));
  let wLate = 0;
  for (let i = 1; i <= 100; i++) wLate = e.ingest(chat(i * 200, 'spammer', 'BUY MY COINS'));
  check('first message lands at full weight', w0 === 1, `w0=${w0}`);
  check('100th duplicate is saturated to a sliver', wLate < 0.05 * w0, `w100=${wLate.toFixed(4)}`);
  check('spammer is flagged mid-flood', e.isFlagged('spammer'));

  // Full pipeline: flood at 120s inside quiet chatter, then the spammer goes
  // quiet; their next (innocent) message 3 minutes later clears the flag.
  const flood = [];
  for (let t = 120_000; t < 140_000; t += 200) flood.push(chat(t, 'botlord', 'FREE KICKS CLICK HERE'));
  const later = chat(330_000, 'botlord', 'ok I will stop now sorry');
  const events = [...background(0, 340_000, 1500, 8), ...flood, later];

  let flaggedDuring = null;
  let flaggedAfter = null;
  const r = run(events, {
    endMs: 340_000,
    hooks: {
      onSample(now, _s, _a) {},
    },
  });
  // Re-derive flag timeline from the engine we kept.
  flaggedDuring = r.engine.flaggedUsers.some((f) => f.userId === 'botlord');
  flaggedAfter = r.engine.isFlagged('botlord');
  check('pipeline: spammer flagged during the flood', flaggedDuring);
  check('pipeline: flag expires after they stop (unflag on next ingest)', !flaggedAfter);
  const floodPeak = peakHype(r.samples, 120_000, 140_000);
  check('flood alone cannot pin hype at the ceiling', floodPeak < 90, `flood peak ${floodPeak}`);
}

// =====================================================================
suite('5. Raid — sudden follows + new chatters spike hype fast');
{
  const bg = background(0, 160_000, 1500, 8);
  const raid = [];
  for (let i = 0; i < 30; i++) raid.push(follow(120_000 + i * 150, `raider_${i}`));
  for (let i = 0; i < 20; i++)
    raid.push(chat(120_500 + i * 300, `raider_chat_${i}`, `raid incoming pog ${i}`));
  const r = run([...bg, ...raid], { endMs: 160_000 });

  const pre = meanHype(r.samples, 100_000, 120_000);
  const peak = peakHype(r.samples, 120_000, 135_000);
  check('raid spikes hype fast', peak >= 75, `pre ${Math.round(pre)} → peak ${peak} within 15s`);
  const rising = between(r.samples, 120_000, 135_000).some((s) => s.trend === 'rising');
  check('trend reads rising during the raid', rising);
}

// =====================================================================
suite('6. Sustained plateau — self-calibration + highlight cap');
{
  // Quiet 60s, then an escalating surge (8 → 24 msg/s) that holds hype above
  // the exit threshold past the 40s cap, then a long flat plateau at 24 msg/s.
  const quiet = background(0, 60_000, 1500, 8);
  const plateau = [];
  let i = 0;
  const rateAt = (t) => (t < 70_000 ? 8 : t < 80_000 ? 12 : t < 90_000 ? 16 : 24);
  for (let t = 60_000; t < 300_000; t += 1000 / rateAt(t)) {
    plateau.push(chat(Math.round(t), `plat_${i % 300}`, `plateau chatter line ${i}`));
    i++;
  }
  const r = run([...quiet, ...plateau], { endMs: 300_000 });

  const jumpPeak = peakHype(r.samples, 60_000, 90_000);
  const lateMean = meanHype(r.samples, 240_000, 300_000);
  check('the jump itself registers as a spike', jumpPeak >= 75, `jump peak ${jumpPeak}`);
  check('baseline adapts: sustained rate normalizes toward the middle',
    lateMean > 15 && lateMean < 65, `late mean ${Math.round(lateMean)}`);
  check('hype does not stay pinned at the ceiling', peakHype(r.samples, 240_000, 300_000) < 90,
    `late peak ${peakHype(r.samples, 240_000, 300_000)}`);

  const capped = r.highlights.filter((h) => h.closeReason === 'timeout');
  check('long plateau highlight closes at the 40s cap', capped.length >= 1,
    `${capped.length} timeout-closed`);
  check('every highlight respects the cap',
    r.highlights.every((h) => h.endTs - h.crossTs <= 41_000),
    r.highlights.map((h) => `${(h.endTs - h.crossTs) / 1000}s`).join(','));
  check('plateau does not re-merge into one endless highlight', r.highlights.length <= 6,
    `${r.highlights.length} highlights captured`);
}

// =====================================================================
suite('7. Warm-up discipline — nothing fires before 45s');
{
  // Big activity right from t=0: should still stay quiet until warm-up ends.
  const hot = [];
  let i = 0;
  for (let t = 0; t < 120_000; t += 200) hot.push(chat(t, `early_${i % 80}`, `wild opener ${i++}`));
  hot.push(kicks(10_000, 'earlybird', 5000));
  const r = run(hot, { endMs: 120_000 });

  check('no sample is ready before 45s', between(r.samples, 0, 45_000).every((s) => !s.ready));
  check('ready announced exactly when warm-up ends', r.ready && r.ready.ts === 45_000,
    `ready at ${r.ready?.ts}ms`);
  check('no suggestions during warm-up', r.suggestions.every((s) => s.ts >= 45_000),
    r.suggestions.length ? `first at ${r.suggestions[0].ts}ms` : 'none at all');
  check('no highlight opens during warm-up', r.highlights.every((h) => h.crossTs >= 45_000),
    r.highlights.length ? `first cross at ${r.highlights[0].crossTs}ms` : 'none at all');
}

// =====================================================================
suite('8. Impact verdicts — engineered up, flat, and down');
{
  // UP: quiet chat, action at 120s, immediate eruption.
  const upBurst = [];
  for (let i = 0; i < 80; i++) upBurst.push(chat(120_500 + i * 150, `up_${i}`, `IT WORKED ${i}`));
  upBurst.push(kicks(123_000, 'up_whale', 300));
  let upId = null;
  const up = run([...background(0, 160_000, 1500, 8), ...upBurst], {
    endMs: 160_000,
    hooks: { onSample: (now, _s, a) => { if (now === 120_000) upId = a.trackAction('dare', now); } },
  });
  const upImpact = up.impacts.find((x) => x.id === upId);
  check('eruption after the action reads UP', upImpact?.verdict === 'up',
    upImpact ? `Δ${upImpact.delta}` : 'no impact event');

  // FLAT: steady chat, action changes nothing.
  let flatId = null;
  const flat = run(background(0, 160_000, 1500, 8), {
    endMs: 160_000,
    hooks: { onSample: (now, _s, a) => { if (now === 120_000) flatId = a.trackAction('dud', now); } },
  });
  const flatImpact = flat.impacts.find((x) => x.id === flatId);
  check('no change after the action reads FLAT', flatImpact?.verdict === 'flat',
    flatImpact ? `Δ${flatImpact.delta}` : 'no impact event');

  // DOWN: hype is elevated going in (fresh burst), the action kills the room.
  const preBurst = [];
  for (let i = 0; i < 60; i++) preBurst.push(chat(105_000 + i * 250, `pre_${i}`, `warming up ${i}`));
  let downId = null;
  const down = run([...background(0, 120_000, 1500, 8), ...preBurst], {
    endMs: 160_000, // burst ends at 120s; afterwards: total silence
    hooks: { onSample: (now, _s, a) => { if (now === 120_000) downId = a.trackAction('bad bit', now); } },
  });
  const downImpact = down.impacts.find((x) => x.id === downId);
  check('room dying after the action reads DOWN', downImpact?.verdict === 'down',
    downImpact ? `Δ${downImpact.delta}` : 'no impact event');
}

// =====================================================================
suite('9. Assistant cooldowns — no suggestion spam under prolonged low hype');
{
  // 60s of life, then 6 minutes of sawtooth decline: tiny pulse, long fade —
  // hype sits low with recurring falling streaks, i.e. maximum temptation.
  const ev = [...background(0, 60_000, 900, 10)];
  let i = 0;
  for (let t0 = 70_000; t0 < 420_000; t0 += 30_000) {
    for (let t = t0; t < t0 + 6_000; t += 1500) ev.push(chat(t, `saw_${i % 6}`, `mild comment ${i++}`));
  }
  const r = run(ev, { endMs: 420_000 });

  const pivots = r.suggestions.filter((s) => s.kind === 'pivot').map((s) => s.ts);
  const trendings = r.suggestions.filter((s) => s.kind === 'trending').map((s) => s.ts);
  check('pivot suggestions actually fire in the doldrums', pivots.length >= 2, `${pivots.length} pivots`);
  check('trending suggestions actually fire in the doldrums', trendings.length >= 1, `${trendings.length} trending`);

  const gaps = pivots.slice(1).map((t, j) => t - pivots[j]);
  check('pivot cooldown respected (≥45s between pivots)', gaps.every((g) => g >= 45_000),
    `gaps: ${gaps.map((g) => Math.round(g / 1000) + 's').join(',')}`);
  const tGaps = trendings.slice(1).map((t, j) => t - trendings[j]);
  check('trending cooldown respected (≥60s between trending)', tGaps.every((g) => g >= 60_000),
    `gaps: ${tGaps.map((g) => Math.round(g / 1000) + 's').join(',')}`);
  const spaced = trendings.every((tt) => {
    const prevPivot = Math.max(-Infinity, ...pivots.filter((p) => p <= tt));
    return tt - prevPivot >= 20_000;
  });
  check('trending waits ≥20s after any pivot', spaced);
  // Hard ceiling: ~6 min of misery can produce at most ~8 pivots + ~6 trending.
  check('total suggestion volume is bounded', r.suggestions.length <= 14,
    `${r.suggestions.length} total`);
}

// =====================================================================
suite('10. Topics — multi-user rule, momentum lifecycle, spam exclusion');
{
  // Multi-user rule: one user repeating within 30s counts once.
  const t1 = new TopicTracker();
  t1.ingest(chat(0, 'alice', 'poker time'), 1);
  t1.ingest(chat(5_000, 'alice', 'poker again'), 1);
  t1.ingest(chat(10_000, 'alice', 'poker forever'), 1);
  const soloScore = t1.score('poker', 10_000);
  const t2 = new TopicTracker();
  t2.ingest(chat(0, 'alice', 'poker time'), 1);
  t2.ingest(chat(5_000, 'bob', 'poker again'), 1);
  t2.ingest(chat(10_000, 'carol', 'poker forever'), 1);
  const crowdScore = t2.score('poker', 10_000);
  check('same user re-mentioning within 30s counts once', soloScore < 1.01, `solo ${soloScore.toFixed(2)}`);
  check('three distinct users count three times', crowdScore > 2.5, `crowd ${crowdScore.toFixed(2)}`);
  t1.ingest(chat(41_000, 'alice', 'poker is back'), 1);
  check('same user counts again after 30s', t1.score('poker', 41_000) > soloScore,
    `after 30s: ${t1.score('poker', 41_000).toFixed(2)}`);

  // Momentum lifecycle: burst of mentions → rising; silence → falling.
  const t3 = new TopicTracker();
  for (let i = 0; i < 10; i++) t3.ingest(chat(i * 1000, `u${i}`, 'blackjack run'), 1);
  const atBurst = t3.top(3, 10_000).find((x) => x.topic === 'blackjack');
  check('fresh burst reads rising', atBurst?.trend === 'rising', `trend ${atBurst?.trend}`);
  const later = t3.top(3, 90_000).find((x) => x.topic === 'blackjack');
  check('abandoned topic reads falling before it fades out', later?.trend === 'falling',
    `trend ${later?.trend} score ${later?.score?.toFixed(2)}`);

  // Spam exclusion through the real pipeline: a flagged spammer pushing
  // "scamcoin" cannot make it a top topic.
  const bg = background(0, 200_000, 1200, 10);
  const spam = [];
  for (let t = 60_000; t < 120_000; t += 250) spam.push(chat(t, 'shill', 'buy scamcoin now'));
  const legit = [];
  for (let i = 0; i < 12; i++) legit.push(chat(60_000 + i * 4000, `fan_${i}`, 'this poker hand is nuts'));
  const r = run([...bg, ...spam, ...legit], { endMs: 200_000 });
  check('spammer got flagged', r.engine.flaggedUsers.some((f) => f.userId === 'shill'));
  const topAt = r.topics.top(3, 120_000).map((x) => x.topic);
  check('flagged spammer cannot own the topic board', !topAt.includes('scamcoin'),
    `top: ${topAt.join(', ')}`);
  const scam = r.topics.score('scamcoin', 120_000);
  const poker = r.topics.score('poker', 120_000);
  check('legit crowd topic outscores the spam term', poker > scam,
    `poker ${poker.toFixed(2)} vs scamcoin ${scam.toFixed(2)}`);
}

// =====================================================================
suite('11. Highlights — hysteresis, lead-in clamp, headline ranking');
{
  const S = (hype) => ({ hype, ready: true });

  // Hysteresis: oscillation between 70 and 82 (never below exitAt 65)
  // must stay ONE highlight, not confetti.
  const h1 = new HighlightTracker();
  let t = 100_000;
  h1.onSample(S(80), t);
  for (let j = 0; j < 10; j++) h1.onSample(S(j % 2 ? 82 : 70), (t += 1000));
  h1.onSample(S(50), (t += 1000)); // now it actually ends
  check('oscillation around 75 yields exactly one highlight', h1.reel().length === 1,
    `${h1.reel().length} highlights`);
  check('highlight closed as "fell"', h1.reel()[0]?.closeReason === 'fell');

  // Lead-in clamp: crossing at t=5s starts the window at 0, not −5s.
  const h2 = new HighlightTracker();
  h2.onSample(S(80), 5_000);
  h2.onSample(S(40), 8_000);
  check('lead-in clamps at t=0 for early crossings', h2.reel()[0]?.startTs === 0,
    `startTs ${h2.reel()[0]?.startTs}`);

  // Merge: re-crossing within 20s of a "fell" close extends the same highlight.
  const h3 = new HighlightTracker();
  h3.onSample(S(80), 100_000);
  h3.onSample(S(50), 105_000);   // closes (fell)
  h3.onSample(S(85), 115_000);   // re-crosses 10s later → merges
  h3.onSample(S(50), 120_000);   // closes again
  check('re-crossing within 20s merges into one highlight', h3.reel().length === 1,
    `${h3.reel().length} highlights, peak ${h3.reel()[0]?.peakHype}`);
  check('merged highlight keeps the higher peak', h3.reel()[0]?.peakHype === 85);

  // Headline ranking: kicks beat subs beat topics.
  const mk = (events) => {
    const topics = new TopicTracker();
    for (let i = 0; i < 5; i++) topics.ingest(chat(100_000 + i * 500, `u${i}`, 'poker pop off'), 1);
    const hl = new HighlightTracker({ topics });
    for (const e of events) hl.onEvent(e);
    hl.onSample(S(90), 102_000);
    hl.onSample(S(40), 110_000);
    return hl.reel()[0].headline;
  };
  const withKicks = mk([kicks(103_000, 'whale', 500), { id: 'x', type: 'sub', userId: 's', username: 'subbo', raw: 1, ts: 104_000 }]);
  check('kicks gift wins the headline over a sub', withKicks.includes('500 Kicks'), withKicks);
  const withSub = mk([{ id: 'x', type: 'sub', userId: 's', username: 'subbo', raw: 1, ts: 104_000 }]);
  check('sub wins the headline when no kicks', withSub.includes('subbo subscribed'), withSub);
  const topicOnly = mk([]);
  check('topic headline when nothing notable', topicOnly.includes('erupted over poker'), topicOnly);
}

// =====================================================================
suite('12. Determinism — scripted replay is identical run-to-run');
{
  const a = run(createScriptedReplay());
  const b = run(createScriptedReplay());
  const curveA = a.samples.map((s) => s.hype).join(',');
  const curveB = b.samples.map((s) => s.hype).join(',');
  check('hype curves are bit-identical across runs', curveA === curveB);
  check('suggestion timestamps identical across runs',
    JSON.stringify(a.suggestions.map((s) => [s.ts, s.kind])) ===
    JSON.stringify(b.suggestions.map((s) => [s.ts, s.kind])));
  check('highlight windows identical across runs',
    JSON.stringify(a.highlights.map((h) => [h.startTs, h.endTs, h.peakHype])) ===
    JSON.stringify(b.highlights.map((h) => [h.startTs, h.endTs, h.peakHype])));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CASES PASSED');
process.exit(failures ? 1 : 0);
