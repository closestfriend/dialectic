import test from 'node:test';
import assert from 'node:assert/strict';
import { measureBalance, rankCandidates } from './balance.mjs';

const candidate = (scores, affinity = .8) => ({ entity_id: 'result', query: { affinity,
  explainability: { 'signal.interests.entities': scores } } });
const scores = (a, b) => [{ entity_id: 'A', score: a }, { entity_id: 'B', score: b }];
test('uses seed IDs and preserves raw scores while normalizing the pair', () => {
  const result = measureBalance(candidate(scores(54,46).reverse()), ['A','B']);
  assert.equal(result.shareA,.54); assert.equal(result.shareB,.46);
  assert.equal(result.rawA,54); assert.ok(Math.abs(result.distance-.04)<1e-10);
});
test('missing, negative, zero, nonnumeric or duplicate seed scores are unverified', () => {
  for (const s of [[], scores(0,0), scores(-1,2), scores('1',2), scores(NaN,1),
    [{entity_id:'A',score:1}], [...scores(1,1),{entity_id:'A',score:1}],
    [null,...scores(1,1)], [{entity_id:42,score:1},...scores(1,1)]]) {
    assert.equal(measureBalance(candidate(s),['A','B']), null);
  }
  assert.equal(measureBalance({},['A','B']),null);
  assert.equal(measureBalance(candidate(scores(1,1)),['A','A']),null);
});
test('minimax ranking favors balance, then affinity, with unverified hits last', () => {
  const result = rankCandidates([candidate(scores(.92,.08)),candidate(scores(.5,.5),.7),
    candidate(scores(.5,.5),.9),{}],['A','B']);
  assert.equal(result[0].query.affinity,.9);
  assert.equal(result[1].balance.shareA,.5);
  assert.equal(result[3].balance,null);
});
test('a malformed candidate does not discard valid candidates in the same collision', () => {
  const result=rankCandidates([candidate([null]),candidate(scores(.5,.5))],['A','B']);
  assert.equal(result.length,2);assert.equal(result[0].balance.shareA,.5);assert.equal(result[1].balance,null);
});
