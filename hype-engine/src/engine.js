/**
 * HypeEngine — quantitative hype score.
 *
 * Model (see ../../ARCHITECTURE.md §L3):
 *   - Every event adds weight to a single exponentially-decayed activity value S.
 *     O(1) memory, O(1) per event: S ← S·e^(−λΔt) + w
 *   - S is sampled (~1–4 Hz) against a slow rolling baseline B and variance V (EMAs).
 *   - Hype = squashed z-score: "unusually busy for THIS channel, right now".
 *     Self-calibrating, so it behaves identically at 200 viewers and 50,000.
 *   - Per-user decayed contribution saturates repeat senders (spam resistance):
 *     one keyboard-masher stops mattering; a hundred real viewers don't.
 *
 * Event shape (mirrors real KICK webhook payloads — chat.message.sent,
 * kicks.gifted, channel.subscription.*):
 *   { id, type: 'chat'|'kicks'|'sub'|'follow'|'ban',
 *     userId, username, badges: string[], text?, raw?: number, ts: number }
 */

const LN2 = Math.LN2;

const BADGE_MULT = {
  subscriber: 1.5,
  verified: 1.4,
  og: 1.3,
  moderator: 1.2,
  founder: 1.3,
};

const DEFAULTS = {
  halfLifeMs: 10_000,        // decay half-life of the activity value
  userHalfLifeMs: 30_000,    // decay of per-user contribution (spam memory)
  baselineTauMs: 120_000,    // rolling baseline time constant
  warmupTauMs: 20_000,       // faster baseline during warm-up so it locks quickly
  warmupMs: 45_000,          // until then, `ready` is false (no triggers, no bets)
  k: 2,                      // sigmoid softness
  z0: 0.8,                   // z offset: steady baseline chat reads ~27, not 50
  kappa: 3,                  // per-user saturation constant
  spamFlagDupes: 12,         // decayed count of DUPLICATE messages that flags a spammer
  spamUnflagBelow: 2,        // flag expires when the decayed dupe count falls back here
  noveltyWindowMs: 60_000,   // duplicate texts within this window are discounted
  trendWindowMs: 12_000,     // slope window for rising/falling
};

export class HypeEngine {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };

    this.S = 0;               // decayed activity
    this.tLast = null;

    this.B = 0;               // baseline EMA
    this.V = 1e-6;            // variance EMA
    this.seeded = false;
    this.startTs = null;
    this.tSample = null;

    this.users = new Map();   // userId -> { c, tLast, username, flagged }
    this.recentTexts = new Map(); // textHash -> lastSeenTs
    this.trendBuf = [];       // [{ts, H}]
    this.flaggedUsers = [];   // [{userId, username, ts}]
  }

  static decay(value, dtMs, halfLifeMs) {
    if (dtMs <= 0) return value;
    return value * Math.exp((-LN2 * dtMs) / halfLifeMs);
  }

  /** Base weight for an event before user saturation. */
  weigh(ev) {
    switch (ev.type) {
      case 'kicks':
        return { weight: 5 + 2 * Math.log10(1 + (ev.raw || 1)), duplicate: false };
      case 'sub':
        return { weight: 10, duplicate: false };
      case 'follow':
        return { weight: 2, duplicate: false };
      case 'ban':
        return { weight: -5, duplicate: false };
      case 'chat': {
        let w = 1.0;
        for (const b of ev.badges || []) w *= BADGE_MULT[b] || 1.0;

        // Anti-copypasta: duplicate text within the novelty window counts 0.3×.
        let duplicate = false;
        const key = (ev.text || '').trim().toLowerCase();
        if (key) {
          const seen = this.recentTexts.get(key);
          duplicate = seen != null && ev.ts - seen < this.o.noveltyWindowMs;
          if (duplicate) w *= 0.3;
          this.recentTexts.set(key, ev.ts);
        }

        // Emotes add energy, capped. Matches KICK's [emote:id:name] format.
        const emotes = (ev.text || '').match(/\[emote:\d+:[^\]]+\]/g) || [];
        w *= Math.min(1.5, 1 + 0.1 * emotes.length);
        return { weight: w, duplicate };
      }
      default:
        return { weight: 0, duplicate: false };
    }
  }

  /** Feed one event. Returns the effective weight it contributed. */
  ingest(ev) {
    const now = ev.ts;
    if (this.tLast == null) this.tLast = now;
    if (this.startTs == null) this.startTs = now;

    this.S = HypeEngine.decay(this.S, now - this.tLast, this.o.halfLifeMs);
    this.tLast = now;

    const { weight: base, duplicate } = this.weigh(ev);

    // Per-user saturation: w_eff = w / (1 + c_u/κ)
    let u = this.users.get(ev.userId);
    if (!u) {
      u = { c: 0, dupes: 0, tLast: now, username: ev.username, flagged: false };
      this.users.set(ev.userId, u);
    }
    const dt = now - u.tLast;
    u.c = HypeEngine.decay(u.c, dt, this.o.userHalfLifeMs);
    u.dupes = HypeEngine.decay(u.dupes, dt, this.o.userHalfLifeMs);
    u.tLast = now;

    const wEff = base / (1 + u.c / this.o.kappa);
    u.c += Math.abs(base);
    if (duplicate) u.dupes += 1;

    // Spam = sustained REPETITION, not volume. A hyped regular typing fast
    // stays saturated (harmless) but never flagged; the flag expires as the
    // duplicate count decays away.
    if (!u.flagged && u.dupes >= this.o.spamFlagDupes) {
      u.flagged = true;
      this.flaggedUsers.push({ userId: ev.userId, username: ev.username, ts: now });
    } else if (u.flagged && u.dupes < this.o.spamUnflagBelow) {
      u.flagged = false;
    }

    this.S += wEff;
    this.gc(now);
    return wEff;
  }

  /** Flagged spammers should be excluded from topic tracking by the caller. */
  isFlagged(userId) {
    return this.users.get(userId)?.flagged ?? false;
  }

  /** Occasional cleanup so long streams don't grow memory unbounded. */
  gc(now) {
    if (this.recentTexts.size > 2000) {
      for (const [k, ts] of this.recentTexts)
        if (now - ts > this.o.noveltyWindowMs) this.recentTexts.delete(k);
    }
    if (this.users.size > 5000) {
      for (const [id, u] of this.users)
        if (now - u.tLast > 10 * this.o.userHalfLifeMs && !u.flagged) this.users.delete(id);
    }
  }

  /**
   * Sample the hype state. Call at ~1–4 Hz with the current clock.
   * Returns { hype, raw, baseline, sigma, z, ready, trend, flaggedUsers }.
   */
  sample(now) {
    if (this.startTs == null) this.startTs = now;
    const sNow = HypeEngine.decay(this.S, now - (this.tLast ?? now), this.o.halfLifeMs);

    const dt = this.tSample == null ? 1000 : Math.max(1, now - this.tSample);
    this.tSample = now;

    const warmingUp = now - this.startTs < this.o.warmupMs;
    const tau = warmingUp ? this.o.warmupTauMs : this.o.baselineTauMs;
    const a = 1 - Math.exp(-dt / tau);

    if (!this.seeded) {
      this.B = sNow;
      this.seeded = true;
    } else {
      this.B = a * sNow + (1 - a) * this.B;
    }
    const D = sNow - this.B;
    this.V = a * D * D + (1 - a) * this.V;
    const sigma = Math.sqrt(this.V);

    const z = (sNow - this.B) / (sigma + 1e-6);
    const H = 100 / (1 + Math.exp(-(z - this.o.z0) / this.o.k));

    // Trend: H slope over the trend window (per second).
    this.trendBuf.push({ ts: now, H });
    while (this.trendBuf.length > 2 && now - this.trendBuf[0].ts > this.o.trendWindowMs)
      this.trendBuf.shift();
    let slope = 0;
    if (this.trendBuf.length >= 2) {
      const first = this.trendBuf[0];
      const span = (now - first.ts) / 1000;
      if (span > 0) slope = (H - first.H) / span;
    }
    const trend = slope > 0.6 ? 'rising' : slope < -0.6 ? 'falling' : 'steady';

    return {
      hype: Math.round(H),
      raw: sNow,
      baseline: this.B,
      sigma,
      z,
      ready: !warmingUp,
      trend,
      slope,
      flaggedUsers: this.flaggedUsers,
    };
  }
}
