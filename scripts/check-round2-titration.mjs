import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { objectiveCatalog } from '../objective-catalog.js';
import { createObjectiveModel } from '../objective-model.js';
import { checkTitration, readTitration, titrationAppearance, titrationPractical, titrationTrials } from '../practical-titration.js';

const guided = titrationTrials.guided;
const independent = titrationTrials.independent;

function observe(trial, dose = trial.equivalence + 5) {
  return {
    dose,
    swirled: true,
    initial: (trial.initial / 100).toFixed(2),
    final: ((trial.initial + dose) / 100).toFixed(2)
  };
}

function recordsFor(trials) {
  return trials.map(trial => {
    const dose = trial.equivalence + (trial.kind === 'rough' ? 40 : trial.kind === 'replay' ? 35 : 5);
    const { status, record } = readTitration(trial, observe(trial, dose));
    assert.equal(status, 'recorded');
    return record;
  });
}

const practice = guided[1];
const run = observe(practice);
assert.equal(titrationAppearance(practice, { dose: 0, swirled: false }), 'start');
assert.equal(titrationAppearance(practice, observe(practice, practice.equivalence)), 'clear');
assert.equal(titrationAppearance(practice, run), 'pale');
assert.equal(titrationAppearance(practice, observe(practice, practice.equivalence + 10)), 'deep');
assert.equal(readTitration(practice, { ...run, swirled: false }).status, 'unmixed');
assert.equal(readTitration(practice, { ...run, initial: '' }).status, 'missing-reading');
assert.equal(readTitration(practice, { ...run, initial: '0.36' }).status, 'initial');
assert.equal(readTitration(practice, { ...run, final: '25.35' }).status, 'final');
assert.equal(readTitration(practice, { ...run, final: '25.40001' }).status, 'missing-reading');
assert.deepEqual(readTitration(practice, { ...run, initial: '.35', final: '25.4' }), {
  status: 'recorded', record: { initial: 35, final: 2540, rough: false, appearance: 'pale' }
});

const records = recordsFor(guided);
assert.deepEqual(records.map(record => [record.initial, record.final, record.appearance]), [
  [10, 2550, 'deep'], [35, 2540, 'pale'], [85, 2610, 'pale'], [45, 2580, 'deep'], [215, 2795, 'pale']
]);
assert.deepEqual(checkTitration(records, [1, 2], '25.15'), { status: 'complete', titres: [2505, 2525], mean: 2515 });
assert.equal(checkTitration([null, ...records.slice(1)], [1, 2], '25.15').status, 'missing-trials');
assert.equal(checkTitration(records, [1, 1], '25.05').status, 'too-few');
assert.equal(checkTitration(records, [0, 1, 2], '25.23').status, 'rough');
assert.equal(checkTitration(records, [1, 2, 3], '25.22').status, 'overshoot');
assert.deepEqual(checkTitration(records, [1, 2, 4], '25.15'), { status: 'outlier', spread: 75 });
const early = records.map((record, index) => index === 1 ? { ...record, appearance: 'clear' } : record);
assert.equal(checkTitration(early, [1, 2], '25.15').status, 'early');
assert.deepEqual(checkTitration(records, [1, 2], '25.30'), { status: 'mean', titres: [2505, 2525] });

const changedReading = records.map((record, index) => index === 2 ? { ...record, final: 2605 } : record);
assert.deepEqual(checkTitration(changedReading, [1, 2], '25.13'), { status: 'complete', titres: [2505, 2520], mean: 2513 });
assert.deepEqual(checkTitration(recordsFor(independent), [1, 2], '25.03'), { status: 'complete', titres: [2495, 2510], mean: 2503 });

const preparation = titrationPractical.createState(objectiveCatalog.get('C12.2/1'));
const endpoint = titrationPractical.createState(objectiveCatalog.get('C12.2/2'));
assert.equal(preparation.ready, false);
assert.deepEqual(Object.keys(preparation.runs), ['0']);
assert.equal(endpoint.ready, true);
assert.deepEqual(Object.keys(endpoint.runs), ['0', '1', '2', '3', '4']);
const limit = { ...endpoint, runs: { ...endpoint.runs, 0: { ...endpoint.runs[0], dose: 5000 - guided[0].initial } } };
const scale = { innerHTML: '', querySelector: () => null };
titrationPractical.render(scale, { state: limit, objective: objectiveCatalog.get('C12.2/2'), guided: true, scene: { present() {} } });
assert.match(scale.innerHTML, /On the 50\.00 mL mark/);
assert.doesNotMatch(scale.innerHTML, /50\.(10|20)/);
const completedRuns = Object.fromEntries(Object.entries(endpoint.runs).map(([index, run]) => [index, { ...run, record: records[index] }]));
const resumed = JSON.parse(JSON.stringify({ ...endpoint, active: 2, runs: completedRuns, included: [1, 2], mean: '25.15' }));
assert.equal(checkTitration(Object.values(resumed.runs).map(run => run.record), resumed.included, resumed.mean).status, 'complete');

for (const objective of ['C12.2/1', 'C12.2/2'].map(id => objectiveCatalog.get(id))) {
  const bounds = new Box3();
  const rig = createObjectiveModel(objective);
  for (const [index, trial] of guided.entries()) {
    for (const [step, dose] of [0, trial.equivalence - 10, trial.equivalence + 5, trial.equivalence + 35].entries()) {
      rig.present({
        index: 0, condition: trial.name, recorded: Boolean(step), position: dose / 5000,
        settings: { titration: { initial: trial.initial / 100, delivered: dose / 100, acidM: .01 * trial.equivalence / 2500, baseM: .01, swirled: step >= 2 } }
      });
      rig.update(index + step / 10);
      bounds.setFromObject(rig.model);
      assert.ok([...bounds.min, ...bounds.max].every(Number.isFinite), `${objective.key} finite rig at ${trial.name}, dose ${dose}`);
    }
  }
  rig.model.traverse(object => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
}

console.log('Round 2 titration checks passed for scale readings, endpoint colour, rough and overshot trials, concordance, derived mean, draft restoration, and finite 3D states.');
