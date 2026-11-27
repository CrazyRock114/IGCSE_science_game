import { isProgressKey, readProgress } from '/progress-store.js';

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
  game.click('#titration-bulk');
  for (let i = 0; i < drops; i += 1) game.click('#titration-drop');
  game.click('#titration-swirl');
  game.change('#titration-initial', initial, 'input');
  game.change('#titration-final', final, 'input');
  game.click('#titration-record');
}

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
  Object.keys(localStorage).filter(isProgressKey).forEach(key => localStorage.removeItem(key));
  const host = document.querySelector('#test-host');

  async function open(width, height, webgl) {
    const frame = document.createElement('iframe');
    frame.title = `FIELDWORK ${width} × ${height}`;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.src = `${webgl ? '/' : '/__qa/no-webgl'}#journal`;
    await load(frame, () => host.replaceChildren(frame));
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
  summary.textContent = `Passed · ${passed}/${practicalKeys.length * 3} browser checks`;
  results.dataset.pass = 'true';
}

const start = document.querySelector('[data-round2]');
start?.addEventListener('click', () => {
  start.disabled = true;
  run().catch(error => {
    document.querySelector('#summary').textContent = 'Round 2 verification failed';
    const results = document.querySelector('#results');
    results.textContent += '\n' + error.message;
    results.dataset.pass = 'false';
  });
});
