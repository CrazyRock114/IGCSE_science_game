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

function applyChange(progress, change) {
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
      progress.objectiveProgress[change.key] = {
        runs: [...new Set([...(old?.runs ?? []), ...change.progress.runs])],
        done: Boolean(old?.done || change.progress.done)
      };
      progress.lastObjective = change.key;
      break;
    }
    case 'capstone':
      progress.capstone = true;
      break;
  }
}

export function readProgress(storage, pending = []) {
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
  for (const key of [...changes.keys()].sort()) applyChange(state, changes.get(key));
  return state;
}

export function createProgressStore(getStorage, setSaveFailed) {
  const pending = new Map();
  const tab = crypto.getRandomValues(new Uint32Array(3)).join('-');
  let state = emptyProgress();
  let lastTime = 0;
  let serial = 0;

  function refresh() {
    try {
      state = readProgress(getStorage(), pending);
    } catch {
      // Storage can be denied or become unavailable after the page loads.
      // Keep the most recent in-memory progress until the next successful read.
    }
    return state;
  }

  function write(change) {
    // Each reading is a single atomic insertion. Settings and resume positions
    // also replay in action order, so retrying an older failed write is safe.
    // Completions have their own idempotent keys.
    lastTime = Math.max(lastTime, Date.now());
    const key = prefix + ({
      complete: 'completion:' + change.mission,
      capstone: 'capstone'
    }[change.type] ?? `event:${String(lastTime).padStart(13, '0')}:${tab}:${String(serial++).padStart(8, '0')}`);
    applyChange(state, change);
    pending.set(key, change);
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
    return state;
  }

  return { refresh, write };
}
