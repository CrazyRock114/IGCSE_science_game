import { isProgressKey, legacyProgressKey, readProgress } from '/progress-store.js';

export const practicalKeys = ['B6.1/4', 'P1.2/6', 'P1.2/7', 'C12.2/1', 'C12.2/2'];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(predicate, description) {
  const deadline = performance.now() + 8000;
  return new Promise((resolve, reject) => {
    function poll() {
      const result = predicate();
      if (result) resolve(result);
      else if (performance.now() > deadline) reject(new Error('Timed out waiting for ' + description));
      else requestAnimationFrame(poll);
    }
    poll();
  });
}

function player(frame) {
  const win = frame.contentWindow;
  const find = selector => frame.contentDocument.querySelector(selector);
  function change(selector, value, type = 'change') {
    const control = find(selector);
    check(control, `Missing control ${selector}`);
    control.value = String(value);
    check(control.value === String(value), `Control ${selector} does not offer ${value}`);
    control.dispatchEvent(new win.Event(type, { bubbles: true }));
  }
  return {
    frame, win, find, change,
    click(selector) {
      const button = find(selector);
      check(button && !button.disabled, `Cannot use ${selector}`);
      button.click();
    },
    async reload(key) {
      await load(frame, () => win.location.reload());
      await waitFor(() => find(`[data-objective="${key}"]`), key + ' after refresh');
    },
    text(selector, expected) {
      const element = find(selector);
      check(element && element.textContent.includes(expected), `Expected ${selector} to show “${expected}”, got “${element?.textContent.trim()}”`);
    },
    completed(key, expected = true) {
      check(Boolean(readProgress(win.localStorage).objectiveProgress[key]?.done) === expected, `Unexpected completion for ${key}`);
    }
  };
}

function load(frame, action) {
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  action();
  return loaded;
}

function recordLeaf(game, id) {
  ['light', 'chlorophyll', 'carbonDioxide'].forEach((factor, bit) => game.change(`#photo-${factor}`, (id >> bit) & 1));
  game.click('#photo-run');
  game.click('#photo-record');
}

function compareLeaf(game, factor, second, conclusion = 'first') {
  game.change('#photo-variable', factor);
  game.change('#photo-first', 7);
  game.change('#photo-second', second);
  game.change('#photo-conclusion', conclusion);
  game.click('#photo-submit');
}

async function photosynthesis(game, full) {
  const key = 'B6.1/4';
  game.change('#photo-variable', 'light');
  recordLeaf(game, 7);
  if (full) {
    check(!game.find('#photo-conclusion'), 'A conclusion was offered with only one observation');
    game.click('#photo-submit');
    game.text('#photo-feedback', 'two distinct');
    game.completed(key, false);
    await game.reload(key);
    game.text('#photo-observations', 'Blue-black');
    check(game.find('#photo-variable').value === 'light', 'Independent variable did not resume');
    recordLeaf(game, 4);
    compareLeaf(game, 'light', 4);
    game.text('#photo-feedback', 'light and chlorophyll');
    game.completed(key, false);
  }
  for (const [factor, trial] of [['light', 6], ['chlorophyll', 5], ['carbonDioxide', 3]]) {
    recordLeaf(game, trial);
    compareLeaf(game, factor, trial);
  }
  game.text('#photo-verified', '(3 of 3)');
  game.completed(key);
  if (full) {
    game.change('#practical-mode', 'independent');
    check(!game.find('#photo-observations tbody'), 'Guided leaf observations appeared in independent mode');
    game.change('#practical-mode', 'guided');
    game.text('#photo-verified', '(3 of 3)');
  }
}

function motionAnswer(game, first, second, gradient, unit, distance) {
  game.change('#motion-point-a', first);
  game.change('#motion-point-b', second);
  game.change('#motion-gradient', gradient, 'input');
  game.change('#motion-gradient-unit', unit);
  if (distance !== undefined) {
    game.change('#motion-distance', distance, 'input');
    game.change('#motion-distance-unit', 'm');
  }
  game.click('#motion-submit');
}

async function motion(game, key, full) {
  const speedTime = key.endsWith('/7');
  const unit = speedTime ? 'm/s²' : 'm/s';
  const distance = speedTime ? 8 : undefined;
  const guided = speedTime ? 0.5 : 2.5;
  if (full) {
    game.change('#practical-mode', 'independent');
    game.change('#motion-point-a', 'B');
    game.change('#motion-point-b', 'D');
    check(!game.find('#motion-feedback').textContent.trim(), 'Worked answers appeared before the attempt');
    check(game.find('.motion-chart') && game.find('table').textContent.includes('Time (s)'), 'Graph or accessible time-axis data missing');
    await game.reload(key);
    check(game.find('#practical-mode').value === 'independent' && game.find('#motion-point-b').value === 'D', 'Motion draft did not resume');
    check(!game.find('#motion-feedback').textContent.trim(), 'Reload leaked the worked answer');
    const value = speedTime ? 0.75 : 1.75;
    const independentDistance = speedTime ? 12 : undefined;
    motionAnswer(game, 'B', 'B', value, unit, independentDistance);
    game.text('#motion-feedback', 'different times');
    motionAnswer(game, 'B', 'D', value, 's', independentDistance);
    game.text('#motion-feedback', 'gradient unit');
    motionAnswer(game, 'B', 'D', 2, unit, independentDistance);
    game.text('#motion-feedback', 'Check the gradient.');
    game.text('#motion-feedback', 'Gradient =');
    game.completed(key, false);
    motionAnswer(game, 'B', 'D', value, unit, independentDistance);
    game.text('#motion-feedback', 'Calculations verified');
    game.completed(key);
    game.change('#practical-mode', 'guided');
  }
  motionAnswer(game, 'B', 'D', guided, unit, distance);
  game.text('#motion-feedback', 'Calculations verified');
  game.completed(key);
  if (full) {
    motionAnswer(game, 'A', 'E', guided, unit, speedTime ? 16 : undefined);
    game.text('#motion-feedback', 'Calculations verified');
  }
}

function readTrial(game, trial, initial, final, drops = 0) {
  game.change('#titration-trial', trial);
  readCurrentTrial(game, initial, final, drops);
}

function readCurrentTrial(game, initial, final, drops) {
  game.click('#titration-bulk');
  for (let i = 0; i < drops; i += 1) game.click('#titration-drop');
  game.click('#titration-swirl');
  game.change('#titration-initial', initial, 'input');
  game.change('#titration-final', final, 'input');
  game.click('#titration-record');
}

const titrationKey = 'C12.2/2';

function checkRun(game, trial, { scale, appearance, cells, included = false }) {
  if (game.find('#titration-trial').value !== String(trial)) game.change('#titration-trial', trial);
  game.text('.titration-scales figure:nth-child(2) p', scale);
  game.text('.titration-appearance', appearance);
  const use = game.find(`#titration-use-${trial}`);
  const row = use.closest('tr');
  const actual = [...row.cells].slice(1, 4).map(cell => cell.textContent);
  check(actual.join(', ') === (cells ?? ['—', '—', '—']).join(', '), `Trial ${trial} has the wrong saved readings: ${actual.join(', ')}`);
  check(use.disabled === !cells && use.checked === included, `Trial ${trial} has the wrong grading eligibility`);
  if (cells) game.text('#titration-reading-feedback', 'recorded');
  else check(!row.querySelector('small'), 'An unfinished run kept an endpoint in the results table');
}

function checkConflict(game) {
  const status = game.find('#practical-conflict');
  check(status?.getBoundingClientRect().height > 0 && /another tab/i.test(status.textContent), 'A stale change did not show a visible recovery message');
}

function checkTitrationXp(game) {
  game.completed(titrationKey);
  game.text('#practical-completion', 'Objective complete');
  check(game.find('.rank span').textContent === '20 XP', 'Titration must award 20 XP exactly once');
}

const guidedRepeat = { scale: 'On the 25.40 mL mark', appearance: 'pale pink tint', cells: ['0.35', '25.40', '25.05'] };
const selectedGuidedRepeat = { ...guidedRepeat, included: true };

function prepareGuidedAnalysis(game) {
  for (const readings of [[0, '0.10', '25.50', 1], [1, '0.35', '25.40', 3], [2, '0.85', '26.10', 3],
    [3, '0.45', '25.80', 0], [4, '2.15', '27.95', 3]]) readTrial(game, ...readings);
  game.click('#titration-use-1');
  game.click('#titration-use-2');
  game.change('#titration-mean', '25.15', 'input');
  checkRun(game, 1, selectedGuidedRepeat);
}

function guidedRun(game) {
  return readProgress(game.win.localStorage).objectiveProgress[titrationKey].practical.drafts.guided.runs[1];
}

async function checkMixedSubmission(game) {
  game.click('#titration-submit');
  checkTitrationXp(game);
  game.text('#titration-feedback', '25.15 mL');
  checkRun(game, 1, selectedGuidedRepeat);
  await game.reload(titrationKey);
  checkTitrationXp(game);
  game.text('#titration-feedback', '25.15 mL');
  checkRun(game, 1, selectedGuidedRepeat);
  game.click('#titration-submit');
  checkTitrationXp(game);
}

const titrationPersistence = [
  ['Titration rejects a stale tab’s bulk dose and retains the recorded endpoint', async ({ pair }) => {
    const games = await pair();
    const [a, b] = games;
    for (const game of games) game.change('#titration-trial', 1);
    readTrial(a, 1, '0.35', '25.40', 3);
    b.click('#titration-bulk');
    checkConflict(b);
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) checkRun(game, 1, guidedRepeat);
  }],
  ['Near-simultaneous same-trial edits cannot leave a recorded titre on an unfinished run', async ({ pair }) => {
    const games = await pair();
    const [a, b] = games;
    readTrial(a, 1, '0.35', '25.40', 3);
    a.click('#titration-use-1');
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) checkRun(game, 1, { ...guidedRepeat, included: true });
    // Fire both actions before the other document processes its storage event.
    a.click('#titration-drop');
    b.change('#titration-final', '25.39', 'input');
    checkConflict(b);
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) {
      checkRun(game, 1, { scale: 'Halfway between 25.40 and 25.50 mL', appearance: 'latest addition is unmixed' });
      check(game.find('#titration-final').value === '', 'Restarted run retained an old final reading');
      game.click('#titration-submit');
      game.text('#titration-feedback', 'Record the initial and final readings for each run');
      game.completed(titrationKey, false);
    }
  }],
  ['Different independent trials merge across tabs, guided trials stay separate, and repeat completion earns XP once', async ({ pair }) => {
    const games = await pair();
    const [a, b] = games;
    for (const game of games) game.change('#practical-mode', 'independent');
    a.change('#titration-trial', 1);
    b.change('#titration-trial', 2);
    readCurrentTrial(a, '1.35', '26.30', 3);
    check(a.find('#titration-trial').value === '1', 'A changed to the trial opened in B');
    a.click('#titration-use-1');
    readCurrentTrial(b, '0.60', '25.70', 3);
    check(b.find('#titration-trial').value === '2', 'B changed to the trial updated in A');
    b.click('#titration-use-2');
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) {
      check(game.find('#practical-mode').value === 'independent', 'Independent attempt did not resume');
      checkRun(game, 1, { scale: 'On the 26.30 mL mark', appearance: 'pale pink tint', cells: ['1.35', '26.30', '24.95'], included: true });
      checkRun(game, 2, { scale: 'On the 25.70 mL mark', appearance: 'pale pink tint', cells: ['0.60', '25.70', '25.10'], included: true });
    }

    readTrial(a, 0, '0.25', '25.55', 1);
    readTrial(a, 3, '1.85', '27.80', 3);
    readTrial(a, 4, '0.55', '25.85');
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) game.change('#titration-mean', '25.03', 'input');
    for (const game of games) game.click('#titration-submit');
    await Promise.all(games.map(game => game.reload(titrationKey)));
    for (const game of games) {
      checkTitrationXp(game);
      game.text('#titration-feedback', '25.03 mL');
    }

    a.change('#practical-mode', 'guided');
    checkRun(a, 1, { scale: 'Halfway between 0.30 and 0.40 mL', appearance: 'colourless before any titrant' });
    readTrial(a, 1, '0.35', '25.40', 3);
    await b.reload(titrationKey);
    checkRun(b, 1, guidedRepeat);
    b.change('#practical-mode', 'independent');
    checkRun(b, 1, { scale: 'On the 26.30 mL mark', appearance: 'pale pink tint', cells: ['1.35', '26.30', '24.95'], included: true });
    checkTitrationXp(b);
  }],
  ['An older titration save preserves a coherent record and old XP without reviving a stale endpoint', async ({ open }) => {
    const run1 = { dose: 2505, swirled: true, initial: '0.35', final: '25.40', record: { initial: 35, final: 2540, rough: false, appearance: 'pale' } };
    const run2 = { dose: 2525, swirled: true, initial: '0.85', final: '26.10', record: { initial: 85, final: 2610, rough: false, appearance: 'pale' } };
    const practical = { mode: 'guided', drafts: { guided: { active: 1, runs: { 1: run1, 2: run2 }, included: [1, 2] } } };
    localStorage.setItem(legacyProgressKey, JSON.stringify({ objectiveProgress: { [titrationKey]: { done: true, runs: [], practical } } }));
    // Replay the kind of partial event produced by the older stale tab.
    localStorage.setItem(`${legacyProgressKey}:event:0000000000001:older-tab:00000000`, JSON.stringify({
      type: 'objective', key: titrationKey, progress: { practical: { mode: 'guided', draft: { runs: { 2: { dose: 2510, swirled: false } } } } }
    }));
    const game = await open();
    checkTitrationXp(game);
    checkRun(game, 1, { ...guidedRepeat, included: true });
    checkRun(game, 2, { scale: 'Halfway between 25.90 and 26.00 mL', appearance: 'latest addition is unmixed' });
    game.click('#titration-refill');
    readTrial(game, 2, '0.85', '26.10', 3);
    await game.reload(titrationKey);
    checkRun(game, 2, { scale: 'On the 26.10 mL mark', appearance: 'pale pink tint', cells: ['0.85', '26.10', '25.25'] });
    checkTitrationXp(game);
  }],
  ['Actual c921a82 stale bulk dose leaves the new endpoint usable before and after grading', async ({ open }) => {
    const old = await open('c921a82');
    old.change('#titration-trial', 1);
    const newer = await open('candidate');
    prepareGuidedAnalysis(newer);
    newer.completed(titrationKey, false);
    check(newer.find('.rank span').textContent === '0 XP', 'The fresh candidate already had XP');
    const before = guidedRun(newer);
    check(before.revision && before.record.final === 2540, 'Candidate did not save a revised Trial 1');
    // The guard advances its logical clock across synchronous browser actions.
    // Let the old wall-clock key sort after the revised observation.
    await waitFor(() => Date.now() > Number(before.revision.split(':')[2]), 'legacy write after the candidate revision');
    const existing = new Set(progressKeys());
    old.click('#titration-bulk');
    old.text('.titration-scales figure:nth-child(2) p', 'Halfway between 25.20 and 25.30 mL');
    const [eventKey] = progressKeys().filter(key => !existing.has(key));
    const practical = JSON.parse(localStorage.getItem(eventKey))?.progress?.practical;
    check(eventKey > before.revision && practical?.draft?.runs?.[1]?.dose === 2490 && !practical.expectedRuns, 'The old build did not write its partial bulk-dose event');
    await checkMixedSubmission(newer);
    check(JSON.stringify(guidedRun(newer)) === JSON.stringify(before), 'Stale bulk dose changed the newer record or its version');
  }],
  ['Returning c921a82 records and earned XP survive regrading and a later old refill', async ({ open }) => {
    const old = await open('c921a82');
    prepareGuidedAnalysis(old);
    old.click('#titration-submit');
    checkTitrationXp(old);
    const newer = await open('candidate');
    checkTitrationXp(newer);
    checkRun(newer, 1, selectedGuidedRepeat);
    check(!guidedRun(newer).revision, 'Expected a returning unrevisioned record');
    await checkMixedSubmission(newer);
    const adopted = guidedRun(newer);
    check(adopted.revision && adopted.record.final === 2540, 'Valid historical records were not protected during regrading');
    await waitFor(() => Date.now() > Number(adopted.revision.split(':')[2]), 'old refill after returning record was protected');
    old.click('#titration-refill');
    await newer.reload(titrationKey);
    checkRun(newer, 1, selectedGuidedRepeat);
    checkTitrationXp(newer);
    check(JSON.stringify(guidedRun(newer)) === JSON.stringify(adopted), 'Old refill changed an adopted record');
  }]
];

async function titration(game, key, full) {
  if (key.endsWith('/1')) {
    if (full) {
      game.click('#titration-prepare');
      game.text('#titration-setup-feedback', 'fixed, accurate aliquot');
    }
    ['Volumetric pipette', 'Burette', 'Phenolphthalein'].forEach((value, i) => game.change(`#titration-kit-${i}`, value));
    game.click('#titration-prepare');
    game.click('#titration-bulk');
    for (let i = 0; i < 3; i += 1) game.click('#titration-drop');
    game.click('#titration-swirl');
    game.change('#titration-initial', '0.35', 'input');
    game.change('#titration-final', '25.40', 'input');
    game.click('#titration-record');
    game.completed(key);
    return;
  }
  readTrial(game, 0, '0.10', '25.50', 1);
  readTrial(game, 1, '0.35', '25.40', 3);
  if (full) {
    await game.reload(key);
    game.text('table', '25.40');
    game.text('table', '25.05');
    game.change('#titration-trial', 1);
    game.change('#titration-final', '25.39', 'input');
    checkRun(game, 1, { scale: guidedRepeat.scale, appearance: guidedRepeat.appearance });
    game.change('#titration-final', '25.40', 'input');
    game.click('#titration-record');
    checkRun(game, 1, guidedRepeat);
  }
  readTrial(game, 2, '0.85', '26.10', 3);
  readTrial(game, 3, '0.45', '25.80');
  readTrial(game, 4, '2.15', '27.95', 3);
  game.text('table', '25.25');
  game.click('#titration-use-1');
  game.click('#titration-use-2');
  if (full) {
    for (const [trial, feedback] of [[0, 'Exclude the rough run'], [3, 'strong pink colour'], [4, 'exclude the outlier']]) {
      game.click(`#titration-use-${trial}`);
      game.click('#titration-submit');
      game.text('#titration-feedback', feedback);
      game.completed(key, false);
      game.click(`#titration-use-${trial}`);
    }
    game.change('#titration-mean', '25.16', 'input');
    game.click('#titration-submit');
    game.text('#titration-feedback', '25.05, 25.25');
    game.completed(key, false);
  }
  game.change('#titration-mean', '25.15', 'input');
  game.click('#titration-submit');
  game.text('#titration-feedback', '25.15 mL');
  game.completed(key);
}

export async function playPractical(frame, key, full = false) {
  const game = player(frame);
  if (key.startsWith('B')) await photosynthesis(game, full);
  else if (key.startsWith('P')) await motion(game, key, full);
  else await titration(game, key, full);
}

async function run() {
  const summary = document.querySelector('#summary');
  const results = document.querySelector('#results');
  const host = document.querySelector('#test-host');

  async function open(width, height, webgl, { hash = '#journal', append = false, build } = {}) {
    const frame = document.createElement('iframe');
    frame.title = `FIELDWORK ${width} × ${height}`;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.src = `${build ? `/__qa/builds/${build}/` : webgl ? '/' : '/__qa/no-webgl'}${hash}`;
    await load(frame, () => append ? host.append(frame) : host.replaceChildren(frame));
    return player(frame);
  }

  async function openFromJournal(game, key) {
    game.win.location.hash = 'journal';
    await waitFor(() => game.find('.journal-list'), 'Journal');
    game.change('input[type="search"]', key.split('/')[0], 'input');
    game.click(`.journal-list a[href="#objective/${key}"]`);
    await waitFor(() => game.find(`[data-objective="${key}"]`), key + ' Journal deep link');
  }

  let passed = 0;
  for (const [width, height, webgl] of [[1180, 900, true], [390, 844, true], [390, 844, false]]) {
    const game = await open(width, height, webgl);
    for (const key of practicalKeys) {
      summary.textContent = `Testing ${key} at ${width} × ${height}…`;
      await openFromJournal(game, key);
      const scene = await waitFor(() => game.find('#objective-viewer').dataset.sceneState, key + ' workbench');
      check(scene === (webgl ? 'ready' : 'unavailable'), 'Unexpected WebGL state for ' + key);
      check(game.win.innerWidth === width && game.win.innerHeight === height, 'Viewport did not match requested dimensions');
      const page = game.frame.contentDocument.documentElement;
      check(page.scrollWidth <= width, `Page overflows horizontally at ${key}: ${page.scrollWidth}px`);
      if (width === 1180) await playPractical(game.frame, key, true);
      else {
        game.change('#practical-mode', 'independent');
        check(page.scrollWidth <= width && game.find('#practical-mode').value === 'independent', 'Independent mode overflows or failed to load');
        if (!webgl && key === 'C12.2/2') {
          readTrial(game, 0, '0.25', '25.55', 1);
          game.text('table', '25.55');
          check(page.scrollWidth <= width, 'Recording a trial caused horizontal overflow');
        }
      }
      passed += 1;
      results.textContent += `PASS ${key} · ${width} × ${height} · ${webgl ? 'WebGL' : 'text controls'}\n`;
    }
  }
  const state = readProgress(localStorage);
  check(Object.values(state.objectiveProgress).filter(progress => progress.done).length === 5, 'Practical completions were duplicated or attached to the wrong ID');

  async function openTitration(build) {
    const game = await open(1180, 900, true, { hash: `#objective/${titrationKey}`, append: true, build });
    await waitFor(() => game.find('#titration-trial') && game.find('#objective-viewer')?.dataset.sceneState === 'ready',
      build === 'candidate' ? 'candidate workbench (run npm run build first)' : `${build ?? 'current'} titration workbench`);
    return game;
  }

  for (const [name, verify] of titrationPersistence) {
    summary.textContent = `Testing ${name}…`;
    resetProgress();
    await verify({ open: openTitration, pair: () => Promise.all([openTitration(), openTitration()]) });
    passed += 1;
    results.textContent += `PASS ${name}\n`;
  }
  summary.textContent = `Passed · ${passed}/${practicalKeys.length * 3 + titrationPersistence.length} browser checks`;
  results.dataset.pass = 'true';
}

function progressKeys() {
  return Object.keys(localStorage).filter(isProgressKey);
}

function resetProgress() {
  document.querySelector('#test-host').replaceChildren();
  progressKeys().forEach(key => localStorage.removeItem(key));
}

const start = document.querySelector('[data-round2]');
start?.addEventListener('click', () => {
  const summary = document.querySelector('#summary');
  const results = document.querySelector('#results');
  if (location.port !== '4174') {
    summary.textContent = 'Run verification on the isolated QA origin.';
    return;
  }
  start.disabled = true;
  results.textContent = '';
  delete results.dataset.pass;
  const existing = progressKeys().map(key => [key, localStorage.getItem(key)]);
  resetProgress();
  run().catch(error => {
    summary.textContent = 'Round 2 verification failed';
    results.textContent += '\n' + error.message;
    results.dataset.pass = 'false';
  }).finally(() => {
    resetProgress();
    existing.forEach(([key, value]) => localStorage.setItem(key, value));
    start.disabled = false;
  });
});
