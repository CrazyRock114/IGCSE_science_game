import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { objectiveCatalog } from '../objective-catalog.js';
import { objectiveXp } from '../objective-game.js';
import { checkTitration, readTitration, titrationPractical, titrationTrials } from '../practical-titration.js';
import { applyPracticalDraft, createProgressStore, legacyTitrationSnapshot } from '../progress-store.js';

const legacySource = execFileSync('git', ['show', 'c921a82281e00897d60f51082b8f2159ccb8f0f4:progress-store.js']);
const legacy = await import(`data:text/javascript;base64,${legacySource.toString('base64')}`);
const key = 'C12.2/2';
const objective = objectiveCatalog.get(key);
const guided = 'guided';
const tiedTime = 1_700_000_000_100;
const earliestTab = 1;
const laterTab = 9;
const rawDraft = (state, mode = guided) => state.objectiveProgress[key]?.practical?.drafts[mode];
const xp = state => state.objectiveProgress[key]?.done ? objectiveXp : 0;
const initialDraft = () => titrationPractical.createState(objective);

function makeTab(create, storage, id) {
  const original = crypto.getRandomValues;
  crypto.getRandomValues = values => values.fill(id);
  try {
    return create(() => storage, () => {});
  } finally {
    crypto.getRandomValues = original;
  }
}

function fixture() {
  const entries = new Map();
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][index] ?? null; },
    getItem(id) { return entries.get(id) ?? null; },
    setItem(id, value) { entries.set(id, value); }
  };
  const old = makeTab(legacy.createProgressStore, storage, earliestTab);
  const candidate = makeTab(createProgressStore, storage, laterTab);
  const oldDrafts = {
    guided: { ...initialDraft(), included: [] },
    independent: { ...initialDraft(), included: [] }
  };

  function oldEdit(patch, mode = guided) {
    const current = oldDrafts[mode];
    const next = { ...current, feedback: null, ...patch };
    const draft = legacy.practicalDraftChanges(current, next);
    old.write({ type: 'objective', key, progress: { done: false, practical: { mode, draft } } });
    oldDrafts[mode] = next;
    return [...entries.keys()].at(-1);
  }

  const observations = [[0, '0.10', '25.50', 1], [1, '0.35', '25.40', 3], [2, '0.85', '26.10', 3],
    [3, '0.45', '25.80', 0], [4, '2.15', '27.95', 3]];
  for (const [index, initial, final, drops] of observations) {
    const trial = titrationTrials.guided[index];
    const dose = trial.equivalence + (trial.kind === 'replay' ? 35 : -10 + drops * (trial.kind === 'rough' ? 50 : 5));
    const run = { dose, swirled: true, initial, final };
    const { status, record } = readTitration(trial, run);
    assert.equal(status, 'recorded');
    oldEdit({ active: index, runs: { ...oldDrafts.guided.runs, [index]: { ...run, record } } });
  }
  oldEdit({ active: 1, included: [1, 2], mean: '25.15' });

  function oldRefill(index, mode = guided) {
    const prior = oldDrafts[mode];
    const run = { ...initialDraft().runs[index], initial: prior.runs[index].initial };
    return oldEdit({ runs: { ...prior.runs, [index]: run }, included: prior.included.filter(value => value !== index) }, mode);
  }

  return { entries, storage, candidate, oldEdit, oldRefill };
}

function visibleDraft(raw) {
  return titrationPractical.restoreState(applyPracticalDraft(initialDraft(), raw), objective, true);
}

function submit(tab, raw) {
  const draft = visibleDraft(raw);
  const selections = Object.entries(draft.runs).flatMap(([index, run]) => run.selected ? [Number(index)] : []);
  const feedback = checkTitration(Object.values(draft.runs).map(run => run.record), selections, draft.mean);
  assert.deepEqual(feedback, { status: 'complete', titres: [2505, 2525], mean: 2515 });
  const expectedRuns = Object.fromEntries(Object.entries(draft.runs).map(([index, run]) => [index, run.revision ?? legacyTitrationSnapshot(raw, index)]));
  const adoptRuns = Object.fromEntries(Object.entries(draft.runs).filter(([, run]) => !run.revision));
  return tab.writeChecked({ type: 'objective', key, progress: { done: true, practical: {
    mode: guided, expectedRuns, ...(Object.keys(adoptRuns).length ? { adoptRuns } : {}),
    draft: { feedback, mean: draft.mean }, titrationProtocol: true
  } } });
}

const systemTime = Date.now;
let now;
Date.now = () => now;
try {
  now = tiedTime - 100;
  const { entries, storage, candidate, oldRefill } = fixture();
  const returning = rawDraft(candidate.refresh());
  assert.equal(xp(candidate.refresh()), 0);
  assert.equal(visibleDraft(returning).runs[1].record.final, 2540);
  now = tiedTime;
  const accepted = submit(candidate, returning);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.alreadyComplete, false);
  assert.equal(xp(accepted.state), 20);
  const receipt = [...entries.keys()].at(-1);
  const adopted = rawDraft(accepted.state).runs[1];
  assert.equal(adopted.revision, receipt);
  const refill = oldRefill(1);
  assert.equal(refill.split(':')[2], receipt.split(':')[2], 'Expected the writes in the same millisecond');
  assert.ok(refill < receipt, 'The later legacy refill key must sort first');
  const replayedTab = makeTab(createProgressStore, storage, 8);
  const replayed = replayedTab.refresh();
  assert.deepEqual({ run: rawDraft(replayed).runs[1], xp: xp(replayed) }, { run: adopted, xp: 20 },
    'Replaying the later legacy refill lost the accepted trial or its credit');
  assert.equal(visibleDraft(rawDraft(replayed)).runs[1].selected, true);
  assert.equal(visibleDraft(rawDraft(replayed)).runs[1].record.appearance, 'pale');
  const repeated = submit(replayedTab, rawDraft(replayed));
  assert.equal(repeated.accepted, true);
  assert.equal(repeated.alreadyComplete, true);
  assert.equal(xp(replayedTab.refresh()), 20);

  now = tiedTime - 100;
  const reversed = fixture();
  const stale = rawDraft(reversed.candidate.refresh());
  now = tiedTime;
  reversed.oldRefill(1);
  const blocked = submit(reversed.candidate, stale);
  assert.equal(blocked.accepted, false, 'A refill already in storage must invalidate stale evidence before credit');
  assert.equal(xp(blocked.state), 0);
  assert.equal(xp(reversed.candidate.refresh()), 0);
  assert.equal(visibleDraft(rawDraft(blocked.state)).runs[1].record, null);

  now = tiedTime - 100;
  const parallel = fixture();
  const observed = rawDraft(parallel.candidate.refresh());
  now = tiedTime;
  const locked = parallel.candidate.writeChecked({ type: 'objective', key, progress: { practical: {
    mode: guided, expectedRuns: { 1: legacyTitrationSnapshot(observed, 1) },
    replaceRun: { index: 1, run: visibleDraft(observed).runs[1] }
  } } });
  assert.equal(locked.accepted, true);
  parallel.oldRefill(1);
  parallel.oldRefill(2);
  parallel.oldEdit({ mean: '23.00' }, 'independent');
  const merged = parallel.candidate.refresh();
  assert.deepEqual(rawDraft(merged).runs[1], rawDraft(locked.state).runs[1]);
  assert.equal(visibleDraft(rawDraft(merged)).runs[2].record, null, 'Independent Trial 2 refill was lost');
  assert.equal(rawDraft(merged, 'independent').mean, '23.00');
} finally {
  Date.now = systemTime;
}

console.log('Mixed-version titration ordering passed using actual c921a82 and current storage modules.');
