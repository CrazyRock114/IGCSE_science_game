import assert from 'node:assert/strict';
import { checkPhotosynthesisComparison, photosynthesisPractical, recordLeafObservation, testLeafForStarch } from '../practical-photosynthesis.js';
import { applyPracticalDraft, practicalDraftChanges } from '../progress-store.js';

const initial = photosynthesisPractical.createState();
const record = (state, id) => recordLeafObservation({ ...state, pending: id });
const attempt = (variable, trials, first, second, conclusion) =>
  checkPhotosynthesisComparison(variable, trials, { first, second, conclusion });

assert.equal(recordLeafObservation(initial), initial, 'the test must run before recording');
assert.equal(testLeafForStarch(initial.setup), true);
for (const factor of ['light', 'chlorophyll', 'carbonDioxide']) {
  assert.equal(testLeafForStarch({ ...initial.setup, [factor]: 0 }), false, `${factor} absent`);
}

let state = record(initial, 7);
assert.deepEqual(state.trials, { 'trial-7': { id: 7, starch: true } });
assert.equal(recordLeafObservation(state), state, 'repeating the same setup does not add false independent evidence');
assert.equal(attempt('light', state.trials, 7, 6, 'first').status, 'needs-observations', 'the correct inference still needs two recorded trials');
assert.equal(attempt('light', state.trials, 7, 7, 'first').status, 'needs-observations', 'a comparison cannot reuse the same observation');

state = [6, 5, 3, 4, 0].reduce(record, state);
assert.deepEqual(Object.values(state.trials).map(trial => trial.id), [7, 6, 5, 3, 4, 0]);
assert.deepEqual(Object.values(state.trials).map(trial => trial.starch), [true, false, false, false, false, false]);
for (const [variable, control] of [['light', 6], ['chlorophyll', 5], ['carbonDioxide', 3]]) {
  assert.equal(attempt(variable, state.trials, 7, control, 'first').status, 'correct');
  assert.equal(attempt(variable, state.trials, control, 7, 'second').status, 'correct', 'the same evidence works in the reverse order');
}
const confounded = attempt('light', state.trials, 7, 4, 'first');
assert.equal(confounded.status, 'confounded');
assert.match(confounded.message, /light and chlorophyll/);
assert.match(confounded.message, /only light/);
const threeChanges = attempt('light', state.trials, 7, 0, 'first');
assert.equal(threeChanges.status, 'confounded');
assert.match(threeChanges.message, /light, chlorophyll and carbon dioxide/);
assert.equal(attempt('', state.trials, 7, 6, 'first').status, 'needs-variable');
assert.equal(attempt('light', state.trials, 7, 5, 'first').status, 'wrong-variable');
assert.equal(attempt('light', state.trials, 7, 6, '').status, 'needs-conclusion');
assert.equal(attempt('light', state.trials, 7, 6, 'same').status, 'wrong-conclusion');
const inconclusive = attempt('light', state.trials, 5, 4, 'same');
assert.equal(inconclusive.status, 'inconclusive');
assert.match(inconclusive.message, /green tissue/);

const resumed = JSON.parse(JSON.stringify({ ...state, variable: 'light', first: 7, second: 6, conclusion: 'first' }));
assert.equal(checkPhotosynthesisComparison(resumed.variable, resumed.trials, resumed).status, 'correct');

const lit = practicalDraftChanges(initial, record(initial, 7));
const covered = practicalDraftChanges(initial, record(initial, 6));
const merged = applyPracticalDraft(applyPracticalDraft(initial, lit), covered);
assert.deepEqual(Object.values(merged.trials).map(trial => trial.id), [7, 6], 'independent recordings can merge in the same draft');
assert.equal(attempt('light', merged.trials, 7, 6, 'first').status, 'correct');

console.log('Round 2 photosynthesis checks passed for matched trials, confounding, insufficient observations, inferences and resumed drafts.');
