const DEFAULT_OPTIONS = [
  { id: 'yes', label: 'Yes', points: 0 },
  { id: 'no', label: 'No', points: 0 },
];

export class Prediction {
  constructor(values = {}, now = Date.now()) {
    this.id = values.id ?? `prediction-${now}`;
    this.question = values.question ?? 'Will the streamer win the next match?';
    this.opensAt = values.opensAt ?? new Date(now).toISOString();
    this.locksAt = values.locksAt ?? new Date(now + 30 * 60_000).toISOString();
    this.participantCount = values.participantCount ?? 0;
    this.options = (values.options ?? DEFAULT_OPTIONS).map((option) => ({ ...option }));
    this.votes = new Map();
  }

  /** Add or remove a viewer's points on an option. */
  vote(optionId, { voterId = 'demo-viewer', points = 50, action = 'add', now = Date.now() } = {}) {
    const state = summarizePrediction(this, now);
    if (state.status !== 'open') return { changed: false, reason: state.status, prediction: state };

    const option = this.options.find((candidate) => candidate.id === optionId);
    if (!option) return { changed: false, reason: 'unknown-option', prediction: state };

    const amount = Math.max(1, Math.round(Number(points) || 0));
    const ledger = this.votes.get(voterId) ?? new Map();
    const beforeTotal = [...ledger.values()].reduce((sum, value) => sum + value, 0);
    const existing = ledger.get(optionId) ?? 0;
    let changedPoints = amount;

    if (action === 'remove') {
      changedPoints = Math.min(existing, amount);
      if (changedPoints === 0) return { changed: false, reason: 'no-vote', prediction: state };
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

    return { changed: true, reason: action === 'remove' ? 'removed' : 'added', points: changedPoints, prediction: summarizePrediction(this, now) };
  }

  viewerPoints(optionId, voterId = 'demo-viewer') {
    return this.votes.get(voterId)?.get(optionId) ?? 0;
  }
}

/** Build display-ready values, deriving percentages from option points. */
export function summarizePrediction(prediction, now = Date.now()) {
  const opensAt = Date.parse(prediction.opensAt);
  const locksAt = Date.parse(prediction.locksAt);
  const totalPoints = prediction.options.reduce((sum, option) => sum + option.points, 0);
  const status = now < opensAt ? 'scheduled' : now < locksAt ? 'open' : 'locked';
  const options = prediction.options.map((option) => ({
    ...option,
    percentage: totalPoints === 0 ? 0 : Math.round((option.points / totalPoints) * 100),
  }));

  return { ...prediction, status, totalPoints, options };
}

export function createMockPredictions(now = Date.now()) {
  const isoAfter = (milliseconds) => new Date(now + milliseconds).toISOString();

  return [
    new Prediction({
      id: 'trophies-13000',
      question: 'Will Neon hit 13,000 trophies this stream?',
      opensAt: isoAfter(0),
      locksAt: isoAfter(60_000),
      participantCount: 0,
      options: [
        { id: 'yes', label: 'Yes', points: 0 },
        { id: 'no', label: 'No', points: 0 },
      ],
    }, now),
  ];
}
