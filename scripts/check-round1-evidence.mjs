import assert from 'node:assert/strict';
import { biology } from '../curriculum/biology.js';
import { checkMissionConclusion, getMission, sampleAt } from '../game.js';

const greenhouse = getMission(biology, 'B6.1');
const enzyme = getMission(biology, 'B5.1');
const trials = (mission, ...inputs) => inputs.map(input => ({ input, output: sampleAt(mission, input) }));

const lower = 'Record a lower setting that gives a lower output.';
const start = 'Record a reading at the start of the plateau.';
const higher = 'Record a higher setting with the same output to confirm the plateau.';

for (const [inputs, message] of [
  [[50, 51], `${start} ${higher}`],
  [[50, 100], start],
  [[75, 100], lower],
  [[50, 75], higher]
]) {
  assert.deepEqual(checkMissionConclusion(greenhouse, trials(greenhouse, ...inputs), 1), {
    status: 'needs-evidence', message
  });
}

const complete = trials(greenhouse, 50, 75, 100);
assert.deepEqual(complete.map(trial => trial.output), [12, 18, 18]);
assert.equal(checkMissionConclusion(greenhouse, complete, 1).status, 'correct');
assert.equal(checkMissionConclusion(greenhouse, complete, 0).status, 'incorrect');
assert.equal(checkMissionConclusion(greenhouse, complete, 2).status, 'incorrect');
assert.equal(checkMissionConclusion(greenhouse, complete, null).status, 'needs-choice');

for (const [index, output, message] of [[0, 18, lower], [1, 17, start], [2, 17, higher]]) {
  const readings = complete.map((trial, i) => i === index ? { ...trial, output } : trial);
  assert.deepEqual(checkMissionConclusion(greenhouse, readings, 1), { status: 'needs-evidence', message });
}
assert.deepEqual(checkMissionConclusion(greenhouse, [...complete.slice(0, 2), { input: 101, output: 18 }], 1), {
  status: 'needs-evidence', message: higher
});
assert.doesNotMatch(greenhouse.insight, /75\s*%/);
assert.match(greenhouse.challenge.explanation, /75% and 100% both yield 18 bubbles\/min/);

assert.equal(checkMissionConclusion(enzyme, trials(enzyme, 20, 20), enzyme.challenge.answer).status, 'needs-evidence');
assert.equal(checkMissionConclusion(enzyme, trials(enzyme, 20, 40), enzyme.challenge.answer).status, 'correct');
assert.equal(checkMissionConclusion(enzyme, trials(enzyme, 20, 40), (enzyme.challenge.answer + 1) % enzyme.challenge.options.length).status, 'incorrect');

console.log('Round 1 evidence checks passed for greenhouse comparisons, incorrect answers and the ordinary mission workflow.');
