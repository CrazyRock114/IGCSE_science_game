import assert from 'node:assert/strict';
import { createProgressStore, legacyProgressKey, readProgress } from '../progress-store.js';

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
