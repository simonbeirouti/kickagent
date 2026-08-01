import assert from 'node:assert/strict';
import { Prediction } from '../src/prediction.js';

const now = 1_000_000;
const prediction = new Prediction({}, now);
assert.equal(prediction.opensAt, now);
assert.equal(prediction.locksAt, now + 60_000);
assert.deepEqual(prediction.options.map((option) => option.points), [0, 0]);

assert.equal(prediction.vote('yes', { voterId: 'viewer', points: 100, now }).changed, true);
assert.equal(prediction.vote('yes', { voterId: 'viewer', points: 50, now }).changed, true);
assert.equal(prediction.viewerPoints('yes', 'viewer'), 150);
assert.equal(prediction.participantCount, 1);
assert.deepEqual(prediction.snapshot(now).options.map((option) => option.percentage), [100, 0]);

const removed = prediction.vote('yes', { voterId: 'viewer', points: 60, action: 'remove', now });
assert.equal(removed.points, 60);
assert.equal(prediction.viewerPoints('yes', 'viewer'), 90);
assert.equal(prediction.participantCount, 1);
assert.equal(prediction.vote('no', { voterId: 'late', now: prediction.locksAt }).reason, 'locked');

console.log('PASS  prediction defaults, variable stakes, repeat votes, and locking');
