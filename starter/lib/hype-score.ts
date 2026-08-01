/**
 * Per-event point weights, used by the demo GAME pages (boss damage,
 * logo-builder bricks, battle hits). Hype SCORING itself lives in the shared
 * hype engine (../hype-engine/src/engine.js) — the old decayed-counter
 * meter (decay/addPoints/nextTrainState) was replaced by it.
 */

/** Score gained per event; kicks scale with the gifted amount instead. */
const BASE_POINTS: Record<string, number> = {
  "chat.message.sent": 2,
  "channel.followed": 10,
  "channel.subscription.new": 25,
  "livestream.status.updated": 0,
};

export function pointsFor(kind: string, payload: unknown): number {
  const p = payload as Record<string, any>;
  switch (kind) {
    case "kicks.gifted":
      return clamp((Number(p?.gift?.amount) || 0) * 0.3, 5, 60);
    case "channel.subscription.gifts": {
      const giftees = Array.isArray(p?.giftees) ? p.giftees.length : 1;
      return clamp(giftees * 15, 15, 60);
    }
    default:
      return BASE_POINTS[kind] ?? 0;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
