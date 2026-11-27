import assert from 'node:assert/strict';
import { createProgressStore, legacyProgressKey, readProgress } from '../progress-store.js';

const entries = new Map();
const storage = {
  get length() { return entries.size; },
  key(index) { return [...entries.keys()][index] ?? null; },
  getItem(key) { return entries.get(key) ?? null; },
  setItem(key, value) { entries.set(key, value); }
};
const newTab = () => createProgressStore(() => storage, () => {});
const draft = (tab, field, value) => tab.write({ type: 'capstone-draft', field, value });
const watershed = JSON.stringify(['B19.1', 25, 175]);
const filter = JSON.stringify(['C10.1', 20, 9]);

const tabA = newTab();
const tabB = newTab();
tabA.refresh();
tabB.refresh();
draft(tabA, 'watershedFirst', watershed);
draft(tabB, 'filterFirst', filter);
draft(tabA, 'capacity', '0.24');
draft(tabA, 'capacity', '0.25');
draft(tabB, 'capacityUnit', 'kWh');

const agreedDraft = { watershedFirst: watershed, filterFirst: filter, capacity: '0.25', capacityUnit: 'kWh' };
assert.deepEqual(tabA.refresh().capstoneDraft, agreedDraft);
assert.deepEqual(tabB.refresh().capstoneDraft, agreedDraft);
assert.equal(readProgress(storage).capstone, false);

tabA.write({ type: 'capstone' });
const completedLength = entries.size;
tabB.write({ type: 'capstone' });
assert.equal(entries.size, completedLength, 'Duplicate approvals share the same completion key');
assert.deepEqual(JSON.parse(storage.getItem(`${legacyProgressKey}:capstone`)), { type: 'capstone' });
assert.equal(newTab().refresh().capstone, true);
assert.deepEqual(newTab().refresh().capstoneDraft, agreedDraft);

entries.clear();
const legacy = { capstone: true, done: { 'B19.1': true, 'C10.1': true, 'P4.2.5': true }, trials: { 'B19.1': [{ input: 25, output: 175 }] } };
storage.setItem(legacyProgressKey, JSON.stringify(legacy));
const returning = newTab();
assert.equal(returning.refresh().capstone, true);
assert.equal(returning.refresh().capstoneDraft, undefined);
draft(returning, 'watershedFirst', watershed);
draft(returning, 'capacity', '');
const reopened = readProgress(storage);
assert.equal(reopened.capstone, true);
assert.deepEqual(reopened.done, legacy.done);
assert.deepEqual(reopened.trials, legacy.trials);
assert.deepEqual(reopened.capstoneDraft, { watershedFirst: watershed, capacity: '' });
assert.equal(storage.getItem(`${legacyProgressKey}:capstone`), null, 'Saving an old plan draft does not award completion again');

console.log('Round 3 progress checks passed for independent draft edits, refresh, legacy completion, and duplicate approvals.');
