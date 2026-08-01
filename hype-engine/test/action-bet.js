import assert from 'node:assert/strict';
import { ActionBet } from '../src/action-bet.js';

const now = 2_000_000;
const action = new ActionBet({ idea: 'Play a random character' }, now);
assert.equal(action.status(now), 'backing');
assert.equal(action.locksAt - action.opensAt, 60_000);
action.back({ viewerId: 'a', points: 50, now });
action.back({ viewerId: 'a', points: 25, now });
action.back({ viewerId: 'b', points: 100, now });
assert.equal(action.snapshot(now).totalPoints, 175);
assert.equal(action.snapshot(now).backerCount, 2);
assert.equal(action.accept(now), false);
assert.equal(action.status(action.locksAt), 'review');
assert.equal(action.accept(action.locksAt), true);
assert.equal(action.status(action.locksAt), 'accepted');
assert.equal(action.modify('Play using inverted controls', { now: now + 70_000 }), true);
assert.equal(action.status(now + 70_000), 'backing');
assert.equal(action.snapshot(now + 70_000).totalPoints, 0);
assert.equal(action.snapshot(now + 70_000).backerCount, 0);

console.log('PASS  action bet proposal, backing, review, decisions, and modification');
