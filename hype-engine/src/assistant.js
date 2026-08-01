/**
 * KickAssistant — the decision layer on top of the two signals.
 *
 * Responsibilities:
 *   1. Announce when the baseline is locked (`ready`) — the signal for the
 *      "Hit Me, Kick Me" feature to open betting.
 *   2. Suggest a pivot topic for chat when hype is low and falling.
 *   3. Measure the hype impact of a streamer action (bet resolution support):
 *      snapshot hype before, average it after, verdict up/flat/down.
 *
 * Pure consumer of engine + topics. No DOM, no network — the overlay person
 * subscribes to `on(event, fn)` and renders.
 */

const DEFAULTS = {
  suggestBelow: 35,        // hype threshold for "chat is dying"
  suggestCooldownMs: 45_000,
  fallingSamplesNeeded: 4, // consecutive falling samples before we speak up
  impactWindowMs: 15_000,  // how long after an action we measure
  impactUpDelta: 8,        // hype points that count as "it worked"
};

const CANNED_PROMPTS = [
  (t) => `Chat's cooling off — ask them about "${t}", it's heating up`,
  (t) => `Pivot to "${t}" — chat is already drifting there`,
  () => `Energy dropping — run a quick poll or a hot take to wake chat up`,
  () => `Ask chat a would-you-rather — anything beats silence`,
];

export class KickAssistant {
  constructor(engine, topics, opts = {}) {
    this.engine = engine;
    this.topics = topics;
    this.o = { ...DEFAULTS, ...opts };

    this.listeners = new Map(); // event -> [fn]
    this.announcedReady = false;
    this.fallingStreak = 0;
    this.lastSuggestionTs = -Infinity;
    this.pendingImpacts = []; // { id, label, startTs, preHype }
    this.recentHype = [];     // small buffer for pre/post averaging
    this.nextImpactId = 1;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;
  }

  emit(event, payload) {
    for (const fn of this.listeners.get(event) || []) fn(payload);
  }

  /** Call once per engine sample. Drives ready/suggestion/impact events. */
  onSample(state, now) {
    this.recentHype.push({ ts: now, hype: state.hype });
    while (this.recentHype.length > 2 && now - this.recentHype[0].ts > 20_000)
      this.recentHype.shift();

    // 1. Baseline locked → Hit Me, Kick Me can open.
    if (state.ready && !this.announcedReady) {
      this.announcedReady = true;
      this.emit('ready', {
        ts: now,
        message: 'Baseline locked — Hit Me, Kick Me can open',
        baseline: state.baseline,
      });
    }

    // 2. Suggestions when hype is low and falling.
    if (state.ready) {
      this.fallingStreak = state.trend === 'falling' ? this.fallingStreak + 1 : 0;
      const due =
        state.hype < this.o.suggestBelow &&
        this.fallingStreak >= this.o.fallingSamplesNeeded &&
        now - this.lastSuggestionTs > this.o.suggestCooldownMs;
      if (due) {
        this.lastSuggestionTs = now;
        this.fallingStreak = 0;
        this.emit('suggestion', this.buildSuggestion(now, state));
      }
    }

    // 3. Resolve any impact measurements whose window elapsed.
    for (let i = this.pendingImpacts.length - 1; i >= 0; i--) {
      const p = this.pendingImpacts[i];
      if (now - p.startTs >= this.o.impactWindowMs) {
        this.pendingImpacts.splice(i, 1);
        const postHype = this.meanHypeSince(p.startTs);
        const delta = Math.round(postHype - p.preHype);
        const verdict =
          delta >= this.o.impactUpDelta ? 'up' : delta <= -this.o.impactUpDelta ? 'down' : 'flat';
        this.emit('impact', { id: p.id, label: p.label, preHype: p.preHype, postHype: Math.round(postHype), delta, verdict, ts: now });
      }
    }
  }

  buildSuggestion(now, state) {
    // Prefer a topic that's rising but not already #1 — a genuine pivot.
    const top = this.topics.top(6, now);
    const pivot = top.find((t, i) => i > 0 && t.trend === 'rising') || top.find((t) => t.trend === 'rising');
    const template = pivot
      ? CANNED_PROMPTS[Math.random() < 0.5 ? 0 : 1]
      : CANNED_PROMPTS[2 + Math.floor(Math.random() * 2)];
    return {
      ts: now,
      hype: state.hype,
      topic: pivot ? pivot.topic : null,
      text: template(pivot ? pivot.topic : undefined),
    };
  }

  /**
   * The Hit Me, Kick Me hook. Call when the streamer starts a dare
   * ("make me a robot: do X"). Emits an 'impact' event ~impactWindowMs later
   * with { delta, verdict: 'up'|'flat'|'down' }.
   */
  trackAction(label, now) {
    const id = this.nextImpactId++;
    this.pendingImpacts.push({ id, label, startTs: now, preHype: this.meanHypeSince(now - 8000) });
    return id;
  }

  meanHypeSince(ts) {
    const pts = this.recentHype.filter((p) => p.ts >= ts);
    if (!pts.length) return this.recentHype.at(-1)?.hype ?? 0;
    return pts.reduce((s, p) => s + p.hype, 0) / pts.length;
  }
}
