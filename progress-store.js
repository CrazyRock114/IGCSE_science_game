export const legacyProgressKey = 'fieldwork-expedition-v1';
const prefix = legacyProgressKey + ':';
const maxReadings = 100;

export function isProgressKey(key) {
  return key === null || key === legacyProgressKey || key.startsWith(prefix);
}

function emptyProgress() {
  return { trials: {}, done: {}, prefs: {}, objectiveProgress: {}, capstone: false, last: null, lastObjective: null };
}

function parse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const draftObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function practicalDraftChanges(previous, current) {
  return Object.fromEntries(Object.entries(current).flatMap(([key, value]) => {
    const old = previous?.[key];
    if (value === old) return [];
    if (draftObject(value) && draftObject(old)) {
      const changes = practicalDraftChanges(old, value);
      return Object.keys(changes).length ? [[key, changes]] : [];
    }
    return [[key, value]];
  }));
}

export function applyPracticalDraft(previous, changes) {
  const draft = { ...previous };
  for (const [key, value] of Object.entries(changes)) {
    draft[key] = draftObject(value) && draftObject(draft[key]) ? applyPracticalDraft(draft[key], value) : value;
  }
  return draft;
}

const isTitration = key => key === 'C12.2/1' || key === 'C12.2/2';
const hasRevisedRun = draft => Object.values(draft?.runs ?? {}).some(run => run?.revision);

export function legacyTitrationSnapshot(draft, index) {
  return { legacy: JSON.stringify([draft?.runs?.[index] ?? null, Boolean(draft?.included?.includes(Number(index)))]) };
}

function matchesRun(draft, index, expected) {
  const revision = draft?.runs?.[index]?.revision ?? null;
  return draftObject(expected)
    ? revision === null && expected.legacy === legacyTitrationSnapshot(draft, index).legacy
    : revision === expected;
}

function legacyTitrationDraft(draft, runs) {
  const { mean, feedback, runs: changes, included, ...rest } = draft;
  // Keep unlocked rows editable by older tabs. Revised rows own their selection
  // as well as the complete reading and instrument state.
  if (draftObject(changes)) rest.runs = Object.fromEntries(Object.entries(changes).filter(([index]) => !runs[index]?.revision));
  if (Array.isArray(included)) rest.included = included.filter(index => !runs[index]?.revision);
  return rest;
}

function checkedTitrationEvent(change) {
  const { replaceRun, adoptRuns, expectedRuns } = change.progress.practical;
  const snapshots = replaceRun ? { [replaceRun.index]: replaceRun.run } : adoptRuns;
  if (!snapshots) return change;
  // Preflight already checked the legacy fields against fresh storage. A legacy
  // write made later may sort earlier on replay. For a full snapshot we accepted,
  // replay only needs to check that a current-version write did not revise it.
  const replayChecks = Object.fromEntries(Object.entries(expectedRuns).map(([index, expected]) => [
    index, Object.hasOwn(snapshots, index) && draftObject(expected) ? null : expected
  ]));
  return { ...change, progress: { ...change.progress, practical: { ...change.progress.practical, expectedRuns: replayChecks } } };
}

function applyChange(progress, change, key) {
  switch (change?.type) {
    case 'reading': {
      const readings = progress.trials[change.mission] ??= [];
      readings.push(change.reading);
      if (readings.length > maxReadings) readings.splice(0, readings.length - maxReadings);
      break;
    }
    case 'complete':
      progress.done[change.mission] = true;
      break;
    case 'preference':
      progress.prefs[change.name] = change.value;
      break;
    case 'visit':
      progress.last = change.mission;
      break;
    case 'objective': {
      const old = progress.objectiveProgress[change.key];
      const practical = change.progress.practical;
      const titration = isTitration(change.key);
      const protectedObjective = titration && Object.values(old?.practical?.drafts ?? {}).some(hasRevisedRun);
      const next = {
        ...old,
        runs: [...new Set([...(old?.runs ?? []), ...(change.progress.runs ?? [])])],
        done: Boolean(old?.done || (change.progress.done && (!protectedObjective || practical?.expectedRuns)))
      };
      if (practical) {
        const { mode, draft, expectedRuns, replaceRun, adoptRuns, titrationProtocol } = practical;
        const drafts = { ...old?.practical?.drafts };
        const previousDraft = drafts[mode];
        if (expectedRuns && Object.entries(expectedRuns).some(([index, expected]) => !matchesRun(previousDraft, index, expected))) {
          return false;
        }
        if (draft !== undefined) {
          const changes = titration && !expectedRuns && !titrationProtocol && hasRevisedRun(previousDraft)
            ? legacyTitrationDraft(draft, previousDraft.runs) : draft;
          drafts[mode] = applyPracticalDraft(previousDraft, changes);
        }
        if (expectedRuns && (replaceRun || adoptRuns)) {
          const updates = replaceRun ? { [replaceRun.index]: replaceRun.run } : adoptRuns;
          const revised = Object.fromEntries(Object.entries(updates).map(([index, run]) => [index, { ...run, revision: key }]));
          drafts[mode] = { ...drafts[mode], runs: { ...drafts[mode]?.runs, ...revised } };
        }
        next.practical = { mode, drafts };
      }
      progress.objectiveProgress[change.key] = next;
      progress.lastObjective = change.key;
      break;
    }
    case 'capstone-draft':
      progress.capstoneDraft = { ...progress.capstoneDraft, [change.field]: change.value };
      break;
    case 'capstone':
      progress.capstone = true;
      break;
  }
}

export function readProgress(storage, pending = [], checkedWrite = null) {
  const legacy = parse(storage.getItem(legacyProgressKey));
  const state = {
    ...emptyProgress(), ...legacy,
    trials: legacy?.trials ?? {},
    done: legacy?.done ?? {},
    prefs: legacy?.prefs ?? {},
    objectiveProgress: legacy?.objectiveProgress ?? {}
  };
  const changes = new Map();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) changes.set(key, parse(storage.getItem(key)));
  }
  for (const [key, change] of pending) changes.set(key, change);
  for (const key of [...changes.keys()].sort()) {
    const accepted = applyChange(state, changes.get(key), key) !== false;
    if (key === checkedWrite?.key) checkedWrite.accepted = accepted;
  }
  return state;
}

export function createProgressStore(getStorage, setSaveFailed) {
  const pending = new Map();
  const tab = crypto.getRandomValues(new Uint32Array(3)).join('-');
  let state = emptyProgress();
  let lastTime = 0;
  let serial = 0;

  function refresh(checkedWrite) {
    try {
      state = readProgress(getStorage(), pending, checkedWrite);
    } catch {
      // Storage can be denied or become unavailable after the page loads.
      // Keep the most recent in-memory progress until the next successful read.
    }
    return state;
  }

  function write(change, checkedWrite = null) {
    if (checkedWrite) {
      refresh();
      checkedWrite.alreadyComplete = Boolean(state.objectiveProgress[change.key]?.done);
      // A tab can read an accepted run and edit it in the same clock tick.
      // Replay the dependent edit strictly after every run it observed.
      for (const revision of Object.values(change.progress.practical.expectedRuns)) {
        if (typeof revision === 'string') lastTime = Math.max(lastTime, Number(revision.split(':')[2]) + 1);
      }
    }
    // Each reading is a single atomic insertion. Settings and resume positions
    // also replay in action order, so retrying an older failed write is safe.
    // Completions have their own idempotent keys.
    lastTime = Math.max(lastTime, Date.now());
    const key = prefix + ({
      complete: 'completion:' + change.mission,
      capstone: 'capstone'
    }[change.type] ?? `event:${String(lastTime).padStart(13, '0')}:${tab}:${String(serial++).padStart(8, '0')}`);
    const accepted = applyChange(state, change, key) !== false;
    if (checkedWrite) Object.assign(checkedWrite, { key, accepted });
    if (!accepted) return state;
    pending.set(key, checkedWrite && isTitration(change.key) ? checkedTitrationEvent(change) : change);
    try {
      const storage = getStorage();
      for (const [entry, update] of pending) {
        storage.setItem(entry, JSON.stringify(update));
        pending.delete(entry);
      }
    } catch {
      // Retry pending changes on the next write. Their keys stay stable.
    }
    setSaveFailed(pending.size > 0);
    return checkedWrite ? refresh(checkedWrite) : state;
  }

  function writeChecked(change) {
    const result = {};
    write(change, result);
    return { state, accepted: result.accepted, alreadyComplete: result.alreadyComplete };
  }

  return { refresh, write, writeChecked };
}
