/**
 * Simulation harness — run with `node test/sim.js`.
 *
 * Feeds the scripted replay through engine + topics + assistant at 1 Hz
 * sampling and asserts the behaviours the demo depends on:
 *
 *   1. baseline locks (ready) after warm-up
 *   2. hype climbs in the ramp phase
 *   3. spam flood barely moves the score and flags the spammer
 *   4. a suggestion fires during the lull (ideally pivoting to "food")
 *   5. tracked Hit Me, Kick Me round during the burst measures "up"
 *   6. scale invariance: same relative burst → similar hype at 1 and 40 msg/s
 *   7. a trending-gap suggestion fires, naming a topic absent from chat
 *   8. highlights: clip markers captured in ramp + burst, none from spam
 */

import { HypeEngine } from '../src/engine.js';
import { TopicTracker } from '../src/topics.js';
import { KickAssistant } from '../src/assistant.js';
import { TrendingTopics } from '../src/trending.js';
import { HighlightTracker } from '../src/highlights.js';
import { createScriptedReplay, synthetic } from '../src/mock.js';

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
}

function run(events, { sampleMs = 1000, hooks = {} } = {}) {
  const engine = new HypeEngine();
  const topicsT = new TopicTracker();
  const assistant = new KickAssistant(engine, topicsT, { trending: new TrendingTopics() });
  const highlightsT = new HighlightTracker({ topics: topicsT });
  const out = { samples: [], suggestions: [], impacts: [], ready: null };

  assistant.on('ready', (p) => (out.ready = p));
  assistant.on('suggestion', (p) => out.suggestions.push(p));
  assistant.on('impact', (p) => out.impacts.push(p));

  const end = events.at(-1).ts + 20_000;
  let ei = 0;
  for (let now = 0; now <= end; now += sampleMs) {
    while (ei < events.length && events[ei].ts <= now) {
      const ev = events[ei++];
      const w = engine.ingest(ev);
      // Flagged spammers can inflate neither the score nor the topics.
      if (!engine.isFlagged(ev.userId)) topicsT.ingest(ev, w);
      highlightsT.onEvent(ev, w);
    }
    const s = engine.sample(now);
    assistant.onSample(s, now);
    highlightsT.onSample(s, now);
    out.samples.push({ now, ...s, topTopics: topicsT.top(3, now) });
    hooks.onSample?.(now, s, assistant);
  }
  out.engine = engine;
  out.topics = topicsT;
  out.highlights = highlightsT.reel();
  return out;
}

const spark = (vals) => {
  const blocks = ' ▁▂▃▄▅▆▇█';
  return vals.map((v) => blocks[Math.min(8, Math.floor((v / 100) * 8.99))]).join('');
};
const meanHype = (samples, t0, t1) => {
  const xs = samples.filter((s) => s.now >= t0 && s.now < t1).map((s) => s.hype);
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
};

// ---------- scripted replay ----------
console.log('=== Scripted replay (~4.5 min stream) ===');
let trackedAt = null;
const replayEvents = createScriptedReplay();
const r = run(replayEvents, {
  hooks: {
    onSample(now, state, assistant) {
      // The Hit Me, Kick Me moment: dare starts at the burst.
      if (now === 170_000) trackedAt = assistant.trackAction('do the dare', now);
    },
  },
});

console.log('hype 0→end: ' + spark(r.samples.filter((_, i) => i % 4 === 0).map((s) => s.hype)));
console.log(
  'phase means — warmup: %d  ramp: %d  spam: %d  lull: %d  burst: %d  cooldown: %d',
  ...[[0, 50], [50, 100], [100, 120], [120, 170], [170, 220], [220, 270]].map(([a, b]) =>
    Math.round(meanHype(r.samples, a * 1000, b * 1000))
  )
);

check('1. baseline locks after warm-up', r.ready && r.ready.ts <= 50_000, `ready at ${r.ready?.ts}ms`);

const rampPeak = Math.max(...r.samples.filter((s) => s.now >= 50_000 && s.now < 100_000).map((s) => s.hype));
check('2. hype climbs in ramp phase', rampPeak >= 70, `ramp peak ${rampPeak}`);

const spamMean = meanHype(r.samples, 100_000, 120_000);
const spammerFlagged = r.engine.flaggedUsers.some((f) => f.userId === 'xX_botlord_Xx');
check('3a. spammer got flagged', spammerFlagged);
check('3b. spam flood does not spike hype', spamMean <= rampPeak, `spam mean ${Math.round(spamMean)} vs ramp peak ${rampPeak}`);
const falsePositives = [...new Set(r.engine.flaggedUsers.map((f) => f.userId))].filter((id) => id !== 'xX_botlord_Xx');
check('3c. no legitimate user gets flagged', falsePositives.length === 0, falsePositives.length ? `false flags: ${falsePositives.join(', ')}` : 'clean');

const lullSuggestion = r.suggestions.find((s) => s.kind === 'pivot' && s.ts >= 120_000 && s.ts <= 175_000);
check('4. pivot suggestion fires during the lull', !!lullSuggestion, lullSuggestion ? `"${lullSuggestion.text}"` : 'none fired');

const impact = r.impacts.find((i) => i.id === trackedAt);
check('5. Hit Me, Kick Me measured as hype UP', impact?.verdict === 'up', impact ? `Δ${impact.delta} (${impact.preHype}→${impact.postHype})` : 'no impact event');

const topicsDuringRamp = r.samples.find((s) => s.now === 90_000)?.topTopics.map((t) => t.topic) || [];
check('6. "poker" is a top topic during ramp', topicsDuringRamp.includes('poker'), `top: ${topicsDuringRamp.join(', ')}`);

const trendingSug = r.suggestions.find((s) => s.kind === 'trending');
check('7a. trending-gap suggestion fires', !!trendingSug, trendingSug ? `"${trendingSug.text}"` : 'none fired');
const mentionedInChat =
  trendingSug &&
  replayEvents.some((e) => (e.text || '').toLowerCase().includes(trendingSug.topic));
check(
  '7b. suggested trending topic is genuinely absent from chat',
  !!trendingSug && !mentionedInChat,
  trendingSug ? `topic: ${trendingSug.topic}` : ''
);
check('7c. trending never fires during warm-up', r.suggestions.every((s) => s.kind !== 'trending' || s.ts > 50_000));

const fmtHl = (h) => `${Math.round(h.startTs / 1000)}s–${Math.round(h.endTs / 1000)}s peak ${h.peakHype} "${h.headline}"`;
console.log('highlights: ' + (r.highlights.map(fmtHl).join(' | ') || 'none'));
const rampHl = r.highlights.find((h) => h.crossTs >= 50_000 && h.crossTs < 100_000);
check('8a. highlight captured during ramp', !!rampHl, rampHl ? fmtHl(rampHl) : 'none');
const burstHl = r.highlights.find((h) => h.crossTs >= 170_000 && h.crossTs < 220_000);
check('8b. highlight captured during bet burst', !!burstHl, burstHl ? fmtHl(burstHl) : 'none');
check(
  '8c. highlight windows are sensible',
  r.highlights.every((h) => h.startTs < h.peakTs && h.peakTs < h.endTs && h.peakHype >= 75),
  r.highlights.map((h) => `${h.startTs}<${h.peakTs}<${h.endTs} peak ${h.peakHype}`).join(' | ')
);
const spamHl = r.highlights.find((h) => h.crossTs >= 100_000 && h.crossTs < 120_000);
check('8d. spam attack does not trigger a highlight', !spamHl, spamHl ? fmtHl(spamHl) : 'clean');

// ---------- scale invariance ----------
console.log('\n=== Scale invariance (same 5× burst at both scales) ===');
const small = run(synthetic({ rate: 1, seconds: 180, users: 20, burst: { atMs: 120_000, forMs: 20_000, mult: 5 } }));
const large = run(synthetic({ rate: 40, seconds: 180, users: 500, burst: { atMs: 120_000, forMs: 20_000, mult: 5 } }));
const peakSmall = Math.max(...small.samples.filter((s) => s.now >= 120_000 && s.now <= 145_000).map((s) => s.hype));
const peakLarge = Math.max(...large.samples.filter((s) => s.now >= 120_000 && s.now <= 145_000).map((s) => s.hype));
console.log(`peak hype — 1 msg/s channel: ${peakSmall}   40 msg/s channel: ${peakLarge}`);
check('9a. small channel burst registers', peakSmall >= 75);
check('9b. large channel burst registers', peakLarge >= 75);
check('9c. scales agree within 20 points', Math.abs(peakSmall - peakLarge) <= 20);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
