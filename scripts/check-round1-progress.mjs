import assert from 'node:assert/strict';
import { createProgressStore, legacyProgressKey, practicalDraftChanges, readProgress } from '../progress-store.js';

const data = new Map();
let fail = false;
const storage = {
  get length() { return data.size; },
  key(index) { return [...data.keys()][index] ?? null; },
  getItem(key) { return data.get(key) ?? null; },
  setItem(key, value) {
    if (fail) throw new Error('Storage unavailable');
    data.set(key, value);
  }
};

const old = {
  trials: { 'B6.1': [{ input: 50, output: 12 }] },
  done: { 'P1.1': true }, prefs: { sound: false },
  objectiveProgress: { 'B6.1/1': { runs: [0], done: false } },
  capstone: true, last: 'P1.1', lastObjective: 'B6.1/1'
};
storage.setItem(legacyProgressKey, JSON.stringify(old));
const tabA = createProgressStore(() => storage, () => {});
const notifications = [];
const tabB = createProgressStore(() => storage, failed => notifications.push(failed));
assert.deepEqual(tabA.refresh(), old);
assert.deepEqual(tabB.refresh(), old);

tabA.write({ type: 'reading', mission: 'B6.1', reading: { input: 75, output: 18 } });
tabB.write({ type: 'reading', mission: 'B6.1', reading: { input: 100, output: 18 } });
tabA.write({ type: 'complete', mission: 'B6.1' });
tabB.write({ type: 'complete', mission: 'B5.1' });
tabB.write({ type: 'complete', mission: 'B6.1' });
tabA.write({ type: 'objective', key: 'B6.1/1', progress: { runs: [0, 1], done: true } });
tabB.write({ type: 'objective', key: 'B6.1/1', progress: { runs: [0, 2], done: false } });
tabA.write({ type: 'preference', name: 'sound', value: true });
tabB.write({ type: 'preference', name: 'motion', value: true });

const shared = tabA.refresh();
assert.deepEqual(shared, tabB.refresh());
assert.deepEqual(shared.trials['B6.1'].map(trial => trial.input).sort((a, b) => a - b), [50, 75, 100]);
assert.deepEqual(shared.done, { 'P1.1': true, 'B5.1': true, 'B6.1': true });
assert.deepEqual(shared.prefs, { sound: true, motion: true });
assert.deepEqual(shared.objectiveProgress['B6.1/1'].runs.slice().sort(), [0, 1, 2]);
assert.equal(shared.objectiveProgress['B6.1/1'].done, true);
assert.equal(shared.capstone, true);
assert.equal(shared.last, 'P1.1');
assert.deepEqual(JSON.parse(storage.getItem(legacyProgressKey)), old);

fail = true;
assert.equal(tabB.write({ type: 'reading', mission: 'B5.1', reading: { input: 40, output: 100 } }).trials['B5.1'].length, 1);
assert.equal(notifications.at(-1), true);
assert.equal(readProgress(storage).trials['B5.1'], undefined);
assert.equal(tabB.refresh().trials['B5.1'].length, 1);
fail = false;
tabB.write({ type: 'reading', mission: 'B5.1', reading: { input: 70, output: 6 } });
assert.equal(notifications.at(-1), false);
assert.equal(readProgress(storage).trials['B5.1'].length, 2);
const systemTime = Date.now;
let time = systemTime() + 1000;
Date.now = () => ++time;
try {
  fail = true;
  tabA.write({ type: 'preference', name: 'sound', value: true });
  tabA.write({ type: 'visit', mission: 'B6.1' });
  fail = false;
  tabB.write({ type: 'preference', name: 'sound', value: false });
  tabB.write({ type: 'visit', mission: 'B5.1' });
  tabA.write({ type: 'complete', mission: 'P1.6.1' });
  assert.equal(tabA.refresh().prefs.sound, false);
  assert.equal(tabB.refresh().last, 'B5.1');
} finally {
  Date.now = systemTime;
}
console.log('Round 1 progress checks passed for independent writes, legacy state, and failed-save recovery.');

const practicalKey = 'B6.1/4';
const setObjective = (tab, key, progress) => tab.write({ type: 'objective', key, progress });
setObjective(tabA, practicalKey, { runs: [0, 1], done: true });
const blank = { trials: {}, variable: '', conclusion: '' };
setObjective(tabA, practicalKey, { practical: { mode: 'guided', draft: practicalDraftChanges(blank, {
  ...blank, variable: 'light', trials: { 'trial-7': { starch: true } }
}) } });
setObjective(tabB, practicalKey, { practical: { mode: 'guided', draft: practicalDraftChanges(blank, {
  ...blank, trials: { 'trial-6': { starch: false } }
}) } });
setObjective(tabB, practicalKey, { practical: { mode: 'independent', draft: { trials: [6] } } });
setObjective(tabB, 'P1.2/6', { done: true, practical: { mode: 'guided', draft: { start: 'B' } } });
setObjective(tabA, practicalKey, { practical: { mode: 'guided' } });
const resumed = readProgress(storage);
assert.deepEqual(resumed.objectiveProgress[practicalKey], {
  runs: [0, 1], done: true,
  practical: { mode: 'guided', drafts: {
    guided: { variable: 'light', trials: { 'trial-7': { starch: true }, 'trial-6': { starch: false } } },
    independent: { trials: [6] }
  } }
});
assert.equal(resumed.objectiveProgress['P1.2/6'].practical.drafts.guided.start, 'B');
assert.equal(resumed.lastObjective, practicalKey);
console.log('Round 2 progress checks passed for separate modes, concurrent observations, legacy records and stable objective IDs.');
