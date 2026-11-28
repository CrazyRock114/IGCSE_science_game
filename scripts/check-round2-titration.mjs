import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { objectiveCatalog } from '../objective-catalog.js';
import { createObjectiveModel } from '../objective-model.js';
import { checkTitration, readTitration, titrationAppearance, titrationPractical, titrationTrials } from '../practical-titration.js';
import { createProgressStore, legacyProgressKey, legacyTitrationSnapshot, readProgress } from '../progress-store.js';

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

const key = 'C12.2/2';
const objective = objectiveCatalog.get(key);
const recorded = { ...run, record: records[1], selected: true };
const bulk = { dose: 2490, swirled: false, initial: '', final: '', record: null, selected: false };
const legacy = {
  ...endpoint,
  runs: {
    ...endpoint.runs,
    1: { ...run, record: records[1] },
    2: { ...observe(guided[2], 2510), record: records[2] }
  },
  included: [1, 2],
  feedback: { status: 'complete', mean: 2515 }
};

const restored = titrationPractical.restoreState(legacy, objective, true);
assert.deepEqual(restored.runs[1], { ...recorded, needsRecord: false });
assert.equal(restored.runs[2].dose, 2510);
assert.equal(titrationAppearance(guided[2], restored.runs[2]), 'clear');
assert.equal(restored.runs[2].record, null);
assert.equal(restored.runs[2].selected, false);
assert.equal(restored.runs[2].needsRecord, true);
assert.equal(restored.feedback, null);
const mistyped = { ...legacy, runs: { ...legacy.runs, 1: { ...legacy.runs[1], final: '25.39' } } };
assert.equal(titrationPractical.restoreState(mistyped, objective, true).runs[1].record, null);

const stored = new Map();
const failures = [];
let blocked = false;
let otherWrite;
const storage = {
  get length() { return stored.size; },
  key(index) { return [...stored.keys()][index] ?? null; },
  getItem(id) { return stored.get(id) ?? null; },
  setItem(id, value) {
    if (blocked) throw new Error('Storage unavailable');
    const interleaved = otherWrite;
    otherWrite = null;
    interleaved?.();
    stored.set(id, value);
  }
};
const tabA = createProgressStore(() => storage, failed => failures.push(failed));
const tabB = createProgressStore(() => storage, () => {});
const draft = (state, mode) => state.objectiveProgress[key]?.practical?.drafts?.[mode];
const trialAt = (tab, mode, index) => draft(tab.refresh(), mode)?.runs?.[index];
function replace(tab, mode, index, revision, snapshot) {
  return tab.writeChecked({ type: 'objective', key, progress: { practical: {
    mode, expectedRuns: { [index]: revision ?? null }, replaceRun: { index, run: snapshot }
  } } });
}

const systemTime = Date.now;
Date.now = () => 100;
try {
  storage.setItem(legacyProgressKey, JSON.stringify({ objectiveProgress: {
    [key]: { done: false, practical: { mode: 'guided', drafts: { guided: legacy } } }
  } }));
  assert.equal(trialAt(tabA, 'guided', 1).record.final, 2540);
  assert.equal(trialAt(tabB, 'guided', 1).revision, undefined);
  assert.equal(replace(tabA, 'guided', 1, null, recorded).accepted, true);
  const original = trialAt(tabA, 'guided', 1);
  const stale = replace(tabB, 'guided', 1, null, bulk);
  assert.equal(stale.accepted, false);
  assert.deepEqual(draft(stale.state, 'guided').runs[1], original);

  // Same tick, different tabs: B observes A's revision before making its own edit.
  const fresh = replace(tabB, 'guided', 1, original.revision, bulk);
  assert.equal(fresh.accepted, true);
  const updated = trialAt(tabA, 'guided', 1);
  assert.deepEqual(updated, { ...bulk, revision: draft(fresh.state, 'guided').runs[1].revision });
  assert.equal(tabB.writeChecked({ type: 'objective', key, progress: { done: true, practical: {
    mode: 'guided', expectedRuns: { 1: original.revision }, draft: { feedback: { status: 'complete' } }
  } } }).accepted, false);
  assert.equal(tabA.refresh().objectiveProgress[key].done, false);

  const otherRecord = { ...observe(guided[2]), record: records[2], selected: true };
  assert.equal(replace(tabA, 'guided', 2, null, otherRecord).accepted, true);
  assert.equal(replace(tabB, 'independent', 1, null, { ...bulk, dose: 2480 }).accepted, true);
  assert.equal(trialAt(tabA, 'guided', 2).record.final, 2610);
  assert.equal(trialAt(tabA, 'independent', 1).dose, 2480);

  const nextRevision = trialAt(tabA, 'guided', 1).revision;
  const firstEdit = { ...bulk, dose: 2495 };
  const secondEdit = { ...bulk, initial: '0.35' };
  otherWrite = () => replace(tabB, 'guided', 1, nextRevision, secondEdit);
  replace(tabA, 'guided', 1, nextRevision, firstEdit);
  const { revision: raced, ...latest } = trialAt(tabA, 'guided', 1);
  assert.ok([firstEdit, secondEdit].some(edit => JSON.stringify(edit) === JSON.stringify(latest)), 'one coherent snapshot wins');
  assert.deepEqual(trialAt(tabB, 'guided', 1), { ...latest, revision: raced });

  blocked = true;
  const pending = replace(tabA, 'guided', 1, raced, recorded);
  assert.equal(pending.accepted, true);
  assert.equal(failures.at(-1), true);
  assert.equal(trialAt(tabB, 'guided', 1).record, null);
  blocked = false;
  assert.equal(replace(tabA, 'guided', 1, draft(pending.state, 'guided').runs[1].revision, { ...recorded, selected: false }).accepted, true);
  assert.equal(failures.at(-1), false);
  assert.deepEqual(trialAt(tabB, 'guided', 1).record, recorded.record);
  assert.equal(trialAt(tabB, 'guided', 1).selected, false);
} finally {
  Date.now = systemTime;
}

console.log('Round 3.1 titration checks passed for atomic trials, stale grading, concurrent trials and modes, clock ties, older saves and storage recovery.');

function legacyEvent(time, changes, { mode = 'guided', done = false } = {}) {
  const eventKey = `${legacyProgressKey}:event:${String(time).padStart(13, '0')}:old:00000000`;
  storage.setItem(eventKey, JSON.stringify({ type: 'objective', key, progress: { done, practical: { mode, draft: changes } } }));
}

stored.clear();
const mixed = createProgressStore(() => storage, () => {});
const validLegacyRun = { ...run, record: records[1] };
legacyEvent(1, { runs: { 1: validLegacyRun }, included: [1], mean: '25.15' });
const returning = draft(mixed.refresh(), 'guided');
assert.deepEqual(titrationPractical.restoreState({ ...endpoint, ...returning, runs: { ...endpoint.runs, ...returning.runs } }, objective, true).runs[1].record, records[1]);

Date.now = () => 2;
try {
  const guarded = replace(mixed, 'guided', 1, null, recorded);
  assert.equal(guarded.accepted, true);
  const protectedRun = draft(guarded.state, 'guided').runs[1];
  legacyEvent(3, { runs: { 1: { dose: 2490, swirled: false, record: null }, 2: { dose: 2510 } }, included: [2], mean: '0.00', feedback: { status: 'complete' } }, { done: true });
  legacyEvent(4, { runs: { 1: { dose: 2480 } } }, { mode: 'independent', done: true });
  const replayed = readProgress(storage);
  assert.deepEqual(draft(replayed, 'guided').runs[1], protectedRun);
  assert.equal(draft(replayed, 'guided').runs[2].dose, 2510);
  assert.deepEqual(draft(replayed, 'guided').included, [2]);
  assert.equal(draft(replayed, 'guided').mean, '25.15');
  assert.equal(draft(replayed, 'guided').feedback, undefined);
  assert.equal(draft(replayed, 'independent').runs[1].dose, 2480);
  assert.equal(replayed.objectiveProgress[key].done, false);
} finally {
  Date.now = systemTime;
}

stored.clear();
const returningStore = createProgressStore(() => storage, () => {});
legacyEvent(1, { runs: { 1: validLegacyRun }, included: [1] }, { done: true });
const submitLegacy = savedDraft => returningStore.writeChecked({ type: 'objective', key, progress: { done: true, practical: {
  mode: 'guided', expectedRuns: { 1: legacyTitrationSnapshot(savedDraft, 1) }, adoptRuns: { 1: recorded }
} } });
const observed = draft(returningStore.refresh(), 'guided');
legacyEvent(2, { included: [] });
assert.equal(submitLegacy(observed).accepted, false, 'A changed unrevisioned selection invalidates the candidate’s submission');
legacyEvent(3, { included: [1] });
const adopted = submitLegacy(draft(returningStore.refresh(), 'guided'));
assert.equal(adopted.accepted, true);
assert.equal(adopted.alreadyComplete, true, 'The historic legacy completion stays credited');
const adoptedRun = draft(adopted.state, 'guided').runs[1];
legacyEvent(Date.now() + 100, { runs: { 1: { dose: 2490 } }, included: [] });
assert.deepEqual(draft(readProgress(storage), 'guided').runs[1], adoptedRun);
console.log('Mixed-version titration checks passed for legacy replay, protected grading, independent rows and historic completion.');
