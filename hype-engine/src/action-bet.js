export class ActionBet {
  constructor(values, now = Date.now()) {
    this.id = values.id ?? `action-${now}`;
    this.idea = values.idea;
    this.category = values.category ?? 'Performance';
    this.opensAt = values.opensAt ?? now;
    this.locksAt = values.locksAt ?? now + 60_000;
    this.decision = null;
    this.backers = new Map();
  }

  status(now = Date.now()) {
    if (this.decision) return this.decision;
    return now < this.locksAt ? 'backing' : 'review';
  }

  back({ viewerId, points, now = Date.now() }) {
    if (this.status(now) !== 'backing') return { changed: false, reason: this.status(now) };
    const amount = Math.max(1, Math.round(Number(points) || 0));
    this.backers.set(viewerId, (this.backers.get(viewerId) ?? 0) + amount);
    return { changed: true, points: amount };
  }

  accept(now = Date.now()) {
    if (this.status(now) !== 'review') return false;
    this.decision = 'accepted';
    return true;
  }

  reject(now = Date.now()) {
    if (this.status(now) !== 'review') return false;
    this.decision = 'rejected';
    return true;
  }

  modify(idea, { category = this.category, now = Date.now(), durationMs = 60_000 } = {}) {
    const nextIdea = String(idea).trim();
    if (!nextIdea) return false;
    this.idea = nextIdea;
    this.category = category;
    this.opensAt = now;
    this.locksAt = now + durationMs;
    this.decision = null;
    this.backers.clear();
    return true;
  }

  snapshot(now = Date.now()) {
    return {
      id: this.id,
      idea: this.idea,
      category: this.category,
      opensAt: this.opensAt,
      locksAt: this.locksAt,
      status: this.status(now),
      totalPoints: [...this.backers.values()].reduce((sum, points) => sum + points, 0),
      backerCount: this.backers.size,
    };
  }
}
