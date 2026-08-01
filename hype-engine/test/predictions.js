import assert from 'node:assert/strict';
import { createMockPredictions, Prediction, summarizePrediction } from '../src/predictions.js';

const now = Date.parse('2026-08-01T00:00:00.000Z');
const prediction = {
  id: 'test', question: 'Will this work?', participantCount: 3,
  opensAt: '2026-08-01T00:00:00.000Z', locksAt: '2026-08-01T01:00:00.000Z',
  options: [
    { id: 'yes', label: 'Yes', points: 75 },
    { id: 'no', label: 'No', points: 25 },
  ],
};

const open = summarizePrediction(prediction, now);
assert.equal(open.status, 'open');
assert.equal(open.totalPoints, 100);
assert.deepEqual(open.options.map((option) => option.percentage), [75, 25]);
assert.equal(summarizePrediction(prediction, now - 1).status, 'scheduled');
assert.equal(summarizePrediction(prediction, Date.parse(prediction.locksAt)).status, 'locked');

const empty = summarizePrediction(
  { ...prediction, options: [{ id: 'yes', label: 'Yes', points: 0 }] }, now
);
assert.equal(empty.options[0].percentage, 0);

const defaults = new Prediction({}, now);
assert.equal(defaults.options.length, 2);
assert.deepEqual(defaults.options.map((option) => option.label), ['Yes', 'No']);
assert.equal(defaults.participantCount, 0);

const pool = new Prediction(prediction, now);
assert.equal(pool.vote('yes', { voterId: 'viewer', now }).reason, 'added');
assert.equal(pool.participantCount, 4);
assert.deepEqual(pool.options.map((option) => option.points), [125, 25]);
assert.equal(pool.vote('yes', { voterId: 'viewer', points: 25, now }).reason, 'added');
assert.equal(pool.participantCount, 4);
assert.deepEqual(pool.options.map((option) => option.points), [150, 25]);
assert.equal(pool.viewerPoints('yes', 'viewer'), 75);
assert.equal(pool.vote('yes', { voterId: 'viewer', points: 25, action: 'remove', now }).reason, 'removed');
assert.equal(pool.participantCount, 4);
assert.deepEqual(pool.options.map((option) => option.points), [125, 25]);
assert.equal(pool.vote('yes', { voterId: 'viewer', points: 100, action: 'remove', now }).reason, 'removed');
assert.equal(pool.participantCount, 3);
assert.deepEqual(pool.options.map((option) => option.points), [75, 25]);
const lockedVote = pool.vote('yes', { voterId: 'late-viewer', now: Date.parse(pool.locksAt) });
assert.equal(lockedVote.changed, false);
assert.equal(lockedVote.reason, 'locked');
assert.deepEqual(pool.options.map((option) => option.points), [75, 25]);

const mocks = createMockPredictions(now);
assert.equal(mocks.length, 1);
assert.equal(Date.parse(mocks[0].locksAt) - Date.parse(mocks[0].opensAt), 60_000);
assert.equal(mocks[0].participantCount, 0);
assert.deepEqual(mocks[0].options.map((option) => option.points), [0, 0]);

console.log('PASS  prediction class handles defaults, status, pools, and viewer votes');
