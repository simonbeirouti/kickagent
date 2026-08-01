/**
 * HighlightTracker — hype highlights / clip markers.
 *
 * Watches the sampled hype score and captures a timestamp window whenever
 * the stream "pops off":
 *
 *   - Hype crossing ≥ enterAt OPENS a highlight. The window starts a
 *     lead-in (~10s) BEFORE the crossing, so the clip includes the moment
 *     that caused the spike, not just the reaction to it.
 *   - While open we track the peak hype (and the top chat topic at the
 *     peak — the "what was it about").
 *   - The highlight CLOSES when hype falls back below exitAt (hysteresis:
 *     exitAt < enterAt so the score wobbling around the threshold doesn't
 *     chop one moment into confetti) or after maxDurationMs.
 *   - A re-crossing within mergeGapMs of the previous close EXTENDS that
 *     same highlight instead of spawning a near-duplicate. (Timeout-closed
 *     highlights are exempt — otherwise a long sustained plateau would
 *     merge itself back open forever.)
 *
 * Notable events (kicks gifts, subs) fed via onEvent() title the highlight:
 * biggest kicks gift > sub > top topic, e.g. "500 Kicks gifted — peak 92"
 * or "Chat erupted over poker — peak 89".
 *
 * The records are timestamp MARKERS for clipping: in a real integration
 * startTs/endTs map onto KICK VOD timestamps (or the clip-creation API) —
 * here they're ms on the same clock the engine is sampled with.
 *
 * Zero dependencies. Subscribe with `.on('highlight', fn)` for closes;
 * `reel()` returns every captured highlight for the recap.
 */

const DEFAULTS = {
  enterAt: 75,           // hype level that opens a highlight
  exitAt: 65,            // hysteresis: close only when hype falls below this
  leadInMs: 10_000,      // window starts this long before the crossing
  maxDurationMs: 40_000, // hard cap on a single highlight window
  mergeGapMs: 20_000,    // re-crossing this soon after a close extends it
  eventMemoryMs: 60_000, // how long notable events are kept for headlines
};

export class HighlightTracker {
  constructor(opts = {}) {
    const { topics = null, ...rest } = opts;
    this.o = { ...DEFAULTS, ...rest };
    this.topics = topics;      // optional TopicTracker for "top topic at peak"

    this.open = null;          // the in-flight highlight, if any
    this.closed = [];          // captured highlights, oldest first
    this.notable = [];         // rolling buffer of kicks/sub events
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;
  }

  emit(event, payload) {
    for (const fn of this.listeners.get(event) || []) fn(payload);
  }

  /** Feed notable events (kicks/subs) so highlights can be titled by them. */
  onEvent(ev, w = 1) {
    if (ev.type !== 'kicks' && ev.type !== 'sub') return;
    this.notable.push({ type: ev.type, username: ev.username, raw: ev.raw || 1, ts: ev.ts });
    while (this.notable.length && ev.ts - this.notable[0].ts > this.o.eventMemoryMs)
      this.notable.shift();
  }

  /** Call once per engine sample, after engine.sample(). */
  onSample(state, now) {
    if (this.open) {
      if (state.hype > this.open.peakHype) {
        this.open.peakHype = state.hype;
        this.open.peakTs = now;
        this.open.topTopic = this.topics?.top(1, now)[0]?.topic ?? this.open.topTopic;
      }
      if (state.hype < this.o.exitAt) this.close(now, 'fell');
      else if (now - this.open.crossTs >= this.o.maxDurationMs) this.close(now, 'timeout');
      return;
    }

    if (!state.ready || state.hype < this.o.enterAt) return;

    // Re-crossing shortly after a close = the same moment; extend it.
    const last = this.closed.at(-1);
    if (last && last.closeReason === 'fell' && now - last.endTs <= this.o.mergeGapMs) {
      this.closed.pop();
      this.open = { ...last, endTs: null, closeReason: null };
      if (state.hype > this.open.peakHype) {
        this.open.peakHype = state.hype;
        this.open.peakTs = now;
      }
      return;
    }

    this.open = {
      startTs: Math.max(0, now - this.o.leadInMs),
      crossTs: now,           // when hype actually crossed enterAt
      endTs: null,
      peakHype: state.hype,
      peakTs: now,
      topTopic: this.topics?.top(1, now)[0]?.topic ?? null,
      closeReason: null,
    };
  }

  close(now, reason) {
    const h = this.open;
    this.open = null;
    h.endTs = now;
    h.closeReason = reason;
    h.headline = this.headline(h);
    this.closed.push(h);
    this.emit('highlight', h);
  }

  /** Biggest kicks gift in the window > sub > top topic > generic. */
  headline(h) {
    const inWindow = this.notable.filter((e) => e.ts >= h.startTs && e.ts <= h.endTs);
    const gifts = inWindow.filter((e) => e.type === 'kicks').sort((a, b) => b.raw - a.raw);
    if (gifts.length)
      return `${gifts[0].raw} Kicks gifted by ${gifts[0].username} — peak ${h.peakHype}`;
    const subs = inWindow.filter((e) => e.type === 'sub');
    if (subs.length)
      return `${subs.length > 1 ? `${subs.length} new subs` : `${subs[0].username} subscribed`} — peak ${h.peakHype}`;
    if (h.topTopic) return `Chat erupted over ${h.topTopic} — peak ${h.peakHype}`;
    return `Hype spike — peak ${h.peakHype}`;
  }

  /** All captured (closed) highlights, oldest first. */
  reel() {
    return [...this.closed];
  }
}
