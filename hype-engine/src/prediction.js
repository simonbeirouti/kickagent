const DEFAULT_OPTIONS = [
  { id: 'yes', label: 'Yes', points: 0 },
  { id: 'no', label: 'No', points: 0 },
];

export class Prediction {
  constructor(values = {}, now = Date.now()) {
    this.id = values.id ?? `prediction-${now}`;
    this.question = values.question ?? 'Will Neon hit 13,000 trophies this stream?';
    this.opensAt = values.opensAt ?? now;
    this.locksAt = values.locksAt ?? now + 10_000;
    this.participantCount = values.participantCount ?? 0;
    this.options = (values.options ?? DEFAULT_OPTIONS).map((option) => ({ ...option }));
    this.votes = new Map();
  }

  status(now = Date.now()) {
    return now < this.opensAt ? 'scheduled' : now < this.locksAt ? 'open' : 'locked';
  }

  vote(optionId, { voterId = 'demo-viewer', points = 50, action = 'add', now = Date.now() } = {}) {
    if (this.status(now) !== 'open') return { changed: false, reason: this.status(now) };
    const option = this.options.find((candidate) => candidate.id === optionId);
    if (!option) return { changed: false, reason: 'unknown-option' };

    const amount = Math.max(1, Math.round(Number(points) || 0));
    const ledger = this.votes.get(voterId) ?? new Map();
    const beforeTotal = [...ledger.values()].reduce((sum, value) => sum + value, 0);
    const existing = ledger.get(optionId) ?? 0;
    let changedPoints = amount;

    if (action === 'remove') {
      changedPoints = Math.min(existing, amount);
      if (changedPoints === 0) return { changed: false, reason: 'no-vote' };
      option.points = Math.max(0, option.points - changedPoints);
      const remaining = existing - changedPoints;
      if (remaining === 0) ledger.delete(optionId);
      else ledger.set(optionId, remaining);
    } else {
      option.points += amount;
      ledger.set(optionId, existing + amount);
    }

    const afterTotal = [...ledger.values()].reduce((sum, value) => sum + value, 0);
    if (beforeTotal === 0 && afterTotal > 0) this.participantCount += 1;
    if (beforeTotal > 0 && afterTotal === 0) this.participantCount = Math.max(0, this.participantCount - 1);
    if (afterTotal === 0) this.votes.delete(voterId);
    else this.votes.set(voterId, ledger);

    return { changed: true, reason: action === 'remove' ? 'removed' : 'added', points: changedPoints };
  }

  viewerPoints(optionId, voterId = 'demo-viewer') {
    return this.votes.get(voterId)?.get(optionId) ?? 0;
  }

  snapshot(now = Date.now()) {
    const totalPoints = this.options.reduce((sum, option) => sum + option.points, 0);
    const options = this.options.map((option) => ({
      ...option,
      percentage: totalPoints === 0 ? 0 : Math.round((option.points / totalPoints) * 100),
    }));
    return { status: this.status(now), totalPoints, participantCount: this.participantCount, options };
  }

  settle(now = Date.now()) {
    if (this.status(now) !== 'locked') return null;
    const snapshot = this.snapshot(now);
    const winningPoints = Math.max(...snapshot.options.map((option) => option.points));
    const winners = snapshot.options.filter((option) => option.points === winningPoints);
    const winningIds = new Set(winners.map((option) => option.id));
    const winningViewers = [];

    for (const [viewerId, ledger] of this.votes) {
      const points = [...ledger]
        .filter(([optionId]) => winningIds.has(optionId))
        .reduce((sum, [, amount]) => sum + amount, 0);
      if (points > 0) winningViewers.push({ viewerId, points });
    }

    return { settledAt: now, winners, winningViewers, isTie: winners.length > 1 };
  }
}
