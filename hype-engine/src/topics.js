/**
 * TopicTracker — qualitative hype: WHAT is chat hyped about?
 *
 * Every chat message is tokenised into candidate topic terms (keywords +
 * emote names). Each term keeps two exponentially-decayed scores:
 *
 *   fast (half-life ~20s)  — "how hot is this topic right now"
 *   slow (half-life ~90s)  — "how hot has it been lately"
 *
 * For a term mentioned at a constant rate, fast/slow settles at
 * halfFast/halfSlow (≈0.22). A ratio well above that means the topic is
 * accelerating (rising); well below means it's dying (falling). That gives
 * per-topic momentum with no history buffers — same O(1) trick as the engine.
 */

import { HypeEngine } from './engine.js';

const STOPWORDS = new Set(
  (
    'the a an and or but if then else for to of in on at is are was were be been am ' +
    'i you he she it we they me him her us them my your his its our their this that ' +
    'these those with as by from up down out not no yes so too very just do does did ' +
    'have has had what when where who why how all any some can will would should im ' +
    'ur u r ya lol lmao omg wtf its dont cant wont didnt isnt thats gonna wanna got get'
  ).split(/\s+/)
);

const DEFAULTS = {
  halfFastMs: 20_000,
  halfSlowMs: 90_000,
  minTermLength: 3,
  risingRatio: 0.35,   // steady-state ratio is halfFast/halfSlow ≈ 0.22
  fallingRatio: 0.12,
  maxTerms: 3000,
};

export class TopicTracker {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.terms = new Map(); // term -> { fast, slow, tLast, mentions }
  }

  /** Extract candidate topic terms from a chat message. */
  tokenize(text) {
    if (!text) return [];
    const out = [];

    // KICK emote format [emote:id:name] — the name is a strong topic signal.
    for (const m of text.matchAll(/\[emote:\d+:([^\]]+)\]/g)) out.push(m[1].toLowerCase());
    const stripped = text.replace(/\[emote:\d+:[^\]]+\]/g, ' ');

    for (const raw of stripped.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < this.o.minTermLength) continue;
      if (STOPWORDS.has(raw)) continue;
      if (/^\d+$/.test(raw)) continue;
      out.push(raw);
    }
    return out;
  }

  /**
   * Feed a chat event. `weight` should be the effective (spam-saturated)
   * weight returned by HypeEngine.ingest, so spammers can't force a topic.
   */
  ingest(ev, weight = 1) {
    if (ev.type !== 'chat' || weight <= 0) return;
    const tokens = new Set(this.tokenize(ev.text)); // dedupe within a message
    for (const term of tokens) {
      let t = this.terms.get(term);
      if (!t) {
        t = { fast: 0, slow: 0, tLast: ev.ts, mentions: 0, lastUser: null, lastUserTs: 0 };
        this.terms.set(term, t);
      }
      // A topic is a CROWD phenomenon: the same user repeating a term within
      // 30s doesn't count again. One enthusiast (or spammer) can't push a topic.
      if (t.lastUser === ev.userId && ev.ts - t.lastUserTs < 30_000) continue;
      t.lastUser = ev.userId;
      t.lastUserTs = ev.ts;
      const dt = ev.ts - t.tLast;
      t.fast = HypeEngine.decay(t.fast, dt, this.o.halfFastMs);
      t.slow = HypeEngine.decay(t.slow, dt, this.o.halfSlowMs);
      t.tLast = ev.ts;
      t.fast += weight;
      t.slow += weight;
      t.mentions++;
    }
    if (this.terms.size > this.o.maxTerms) this.gc(ev.ts);
  }

  gc(now) {
    for (const [term, t] of this.terms) {
      if (HypeEngine.decay(t.fast, now - t.tLast, this.o.halfFastMs) < 0.05) this.terms.delete(term);
    }
  }

  /** Current fast (decayed) score for a single term, 0 if unknown. */
  score(term, now) {
    const t = this.terms.get(term.toLowerCase());
    if (!t) return 0;
    return HypeEngine.decay(t.fast, now - t.tLast, this.o.halfFastMs);
  }

  /**
   * Top topics right now: [{ topic, score, trend, mentions }].
   * `score` is the fast decayed value; `trend` is rising | steady | falling.
   */
  top(n, now) {
    const rows = [];
    for (const [term, t] of this.terms) {
      const fast = HypeEngine.decay(t.fast, now - t.tLast, this.o.halfFastMs);
      const slow = HypeEngine.decay(t.slow, now - t.tLast, this.o.halfSlowMs);
      if (fast < 0.2) continue;
      const ratio = slow > 0 ? fast / slow : 1;
      const trend =
        ratio > this.o.risingRatio ? 'rising' : ratio < this.o.fallingRatio ? 'falling' : 'steady';
      rows.push({ topic: term, score: fast, trend, mentions: t.mentions });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, n);
  }
}
