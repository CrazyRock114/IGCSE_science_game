const start = document.querySelector('#start');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');
const host = document.querySelector('#test-host');
const legacyKey = 'fieldwork-expedition-v1';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(predicate, description) {
  const deadline = performance.now() + 8000;
  return new Promise((resolve, reject) => {
    function poll() {
      const result = predicate();
      if (result) resolve(result);
      else if (performance.now() > deadline) reject(new Error(`Timed out waiting for ${description}`));
      else requestAnimationFrame(poll);
    }
    poll();
  });
}

function progressKeys() {
  return Object.keys(localStorage).filter(key => key === legacyKey || key.startsWith(`${legacyKey}:`));
}

function resetProgress() {
  host.replaceChildren();
  progressKeys().forEach(key => localStorage.removeItem(key));
}

async function open(hash, { width = 1024, height = 768, webgl = true } = {}) {
  const frame = document.createElement('iframe');
  frame.title = `FIELDWORK test ${hash}`;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.src = `${webgl ? '/' : '/__qa/no-webgl'}${hash}`;
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  host.append(frame);
  await loaded;
  const find = selector => frame.contentDocument.querySelector(selector);
  await waitFor(() => find('.rank'), 'game to load');
  return { frame, win: frame.contentWindow, find };
}

async function reload(game) {
  const loaded = new Promise(resolve => game.frame.addEventListener('load', resolve, { once: true }));
  game.win.location.reload();
  await loaded;
  await waitFor(() => game.find('.rank'), 'reloaded game');
}

async function route(game, hash, selector) {
  game.win.location.hash = hash;
  await waitFor(() => game.find(selector), hash);
}

function record(game, setting) {
  const slider = game.find('#condition');
  slider.valueAsNumber = setting;
  slider.dispatchEvent(new game.win.Event('input', { bubbles: true }));
  check(Math.abs(slider.valueAsNumber - setting) < 1e-8, `Slider cannot reach ${setting}`);
  const live = game.find('#metric-value').textContent.trim();
  game.find('#record').click();
  return live;
}

function select(game, answer = 1) {
  game.find(`.choice[data-choice="${answer}"]`).click();
}

function submit(game, answer = 1) {
  select(game, answer);
  game.find('#submit').click();
}

function readings(game) {
  return [...game.frame.contentDocument.querySelectorAll('.trials tbody tr')].map(row =>
    [...row.cells].map(cell => Number(cell.textContent.replaceAll(',', '')))
  );
}

function checkReadings(game, expected) {
  const actual = readings(game);
  check(actual.length === expected.length && expected.every(([input, output]) =>
    actual.some(([recorded, measured]) => recorded === input && Math.abs(measured - output) < .005)
  ), `Unexpected recorded readings ${JSON.stringify(actual)}`);
}

function checkXp(game, expected) {
  check(game.find('.rank span')?.textContent === `${expected} XP`, `Expected ${expected} XP, saw ${game.find('.rank')?.textContent}`);
}

function checkCompletion(game, expected) {
  check(Boolean(game.find('#submit').disabled) === expected, `Expected mission completion ${expected}`);
}

function greenhouseReadings(game) {
  [50, 75, 100].forEach(setting => record(game, setting));
}

function enzymeReadings(game) {
  [25, 40].forEach(setting => record(game, setting));
}

const cases = [
  ['Physics live reading, recorded value, plotted point and refresh', async () => {
    const game = await open('#lab/P1.6.1');
    const points = [];
    const context = game.win.CanvasRenderingContext2D.prototype;
    const arc = context.arc;
    context.arc = function (x, y, ...arguments_) {
      if (this.canvas.matches('#readings canvas')) points.push({ x, y });
      return arc.call(this, x, y, ...arguments_);
    };
    record(game, 0);
    const live = record(game, 1.04);
    check(Math.abs(parseFloat(live) - 32.448) < .005 && /\bJ$/.test(live), `Expected about 32.45 J at 1.04 m/s, saw ${live}`);
    checkReadings(game, [[0, 0], [1.04, 32.448]]);
    check(readings(game)[1][1] === parseFloat(live), 'Live display and recorded display differ');
    check(game.find('.trials thead').textContent.includes('(J)'), 'Recorded table has no joule unit');
    const chart = game.find('#readings canvas');
    check(chart && points.length === 2, 'The plot did not draw both measured values');
    const expectedX = 46 + (chart.width - 62) * 1.04 / 8;
    const expectedY = chart.height - 25 - (chart.height - 38) * 32.448 / 1920;
    check(points.some(point => Math.abs(point.x - expectedX) < 1e-6 && Math.abs(point.y - expectedY) < 1e-6), 'Plotted point did not use the unrounded energy');
    await reload(game);
    checkReadings(game, [[0, 0], [1.04, 32.448]]);
    check(game.find('#condition').valueAsNumber === 1.04 && game.find('#metric-value').textContent.trim() === live, 'Refresh did not restore the same slider reading');
  }],
  ...[
    [[50, 51], [/start of the plateau/i, /higher setting/i]],
    [[50, 100], [/start of the plateau/i]],
    [[75, 100], [/lower setting/i]]
  ].map(([inputs, issues]) => [`Greenhouse rejects ${inputs.join('% + ')}%`, async () => {
    const game = await open('#lab/B6.1');
    check(!/75\s*%/.test(game.find('#lab-context').textContent), 'Default field briefing revealed the answer');
    inputs.forEach(setting => record(game, setting));
    submit(game);
    checkCompletion(game, false);
    checkXp(game, 0);
    for (const issue of issues) check(issue.test(game.find('#feedback').textContent), `Missing actionable evidence feedback matching ${issue}`);
  }]),
  ['Greenhouse grades the evidence and awards one 100 XP completion', async () => {
    const game = await open('#lab/B6.1');
    greenhouseReadings(game);
    checkReadings(game, [[50, 12], [75, 18], [100, 18]]);
    submit(game, 0);
    checkCompletion(game, false);
    checkXp(game, 0);
    check(game.find('.choice[data-choice="0"]').classList.contains('incorrect'), 'Wrong conclusion was not identified');
    submit(game);
    checkCompletion(game, true);
    checkXp(game, 100);
    check(/75% and 100% both yield 18/.test(game.find('#feedback').textContent), 'The correct feedback did not explain the plateau');
    game.find('#submit').click();
    await reload(game);
    checkCompletion(game, true);
    checkXp(game, 100);
  }],
  ['Ordinary enzyme mission still requires two distinct readings', async () => {
    const game = await open('#lab/B5.1');
    [25, 25].forEach(setting => record(game, setting));
    submit(game);
    checkCompletion(game, false);
    check(/two different settings/i.test(game.find('#feedback').textContent), 'Ordinary mission lost its comparison feedback');
    record(game, 40);
    submit(game);
    checkCompletion(game, true);
    checkXp(game, 100);
  }],
  ['A later write from a stale document preserves the greenhouse completion', async () => {
    const games = await Promise.all([open('#lab/B6.1'), open('#lab/B5.1')]);
    const [greenhouse, enzyme] = games;
    greenhouseReadings(greenhouse);
    submit(greenhouse);
    checkCompletion(greenhouse, true);
    record(enzyme, 40);
    await Promise.all(games.map(reload));
    games.forEach(game => checkXp(game, 100));
    checkCompletion(greenhouse, true);
    checkReadings(greenhouse, [[50, 12], [75, 18], [100, 18]]);
    checkReadings(enzyme, [[40, 100]]);
  }],
  ['Separate missions completed in the same task survive both refreshes', async () => {
    const games = await Promise.all([open('#lab/B6.1'), open('#lab/B5.1')]);
    const [greenhouse, enzyme] = games;
    greenhouseReadings(greenhouse);
    enzymeReadings(enzyme);
    games.forEach(game => select(game));
    games.forEach(game => game.find('#submit').click());
    await Promise.all(games.map(reload));
    games.forEach(game => {
      checkXp(game, 200);
      checkCompletion(game, true);
    });
    checkReadings(greenhouse, [[50, 12], [75, 18], [100, 18]]);
    checkReadings(enzyme, [[25, 46], [40, 100]]);
  }],
  ['Different readings in the same mission survive both refreshes', async () => {
    const games = await Promise.all([open('#lab/B5.1'), open('#lab/B5.1')]);
    record(games[0], 25);
    record(games[1], 40);
    await Promise.all(games.map(reload));
    games.forEach(game => checkReadings(game, [[25, 46], [40, 100]]));
  }],
  ['Duplicate completion from two loaded documents awards 100 XP total', async () => {
    localStorage.setItem(legacyKey, JSON.stringify({ trials: { 'B5.1': [{ input: 25, output: 46 }, { input: 40, output: 100 }] } }));
    const games = await Promise.all([open('#lab/B5.1'), open('#lab/B5.1')]);
    games.forEach(game => select(game));
    games.forEach(game => game.find('#submit').click());
    await Promise.all(games.map(reload));
    games.forEach(game => {
      checkCompletion(game, true);
      checkXp(game, 100);
      checkReadings(game, [[25, 46], [40, 100]]);
    });
  }],
  ['Existing save opens, updates and reopens with legacy progress and settings', async () => {
    localStorage.setItem(legacyKey, JSON.stringify({
      trials: { 'B6.1': [{ input: 75, output: 18 }, { input: 100, output: 18 }] },
      done: { 'B6.1': true, 'B19.1': true, 'C10.1': true, 'P4.2.5': true },
      objectiveProgress: { 'B6.1/1': { runs: [0, 1], done: true } },
      prefs: { motion: true, sound: true }, capstone: true, last: 'B6.1', lastObjective: 'B6.1/1'
    }));
    const game = await open('#lab/B6.1');
    checkReadings(game, [[75, 18], [100, 18]]);
    checkCompletion(game, true);
    checkXp(game, 720);
    record(game, 50);
    game.find('#open-settings').click();
    const motion = game.find('#settings input[name="motion"]');
    check(motion.checked && game.find('#settings input[name="sound"]').checked, 'Existing preferences did not load');
    motion.click();
    game.find('#settings').close();
    await reload(game);
    checkCompletion(game, true);
    checkReadings(game, [[75, 18], [100, 18], [50, 12]]);
    checkXp(game, 720);
    game.find('#open-settings').click();
    check(!game.find('#settings input[name="motion"]').checked && game.find('#settings input[name="sound"]').checked, 'Preferences did not persist the update');
    game.find('#settings').close();
    await route(game, '#expedition', '.dispatch-actions a[href="#objective/B6.1/1"]');
    await route(game, '#objective/B6.1/1', '#objective-feedback .objective-complete');
    await route(game, '#capstone', '#recovery-feedback .feedback');
    check(/Recovery plan approved/.test(game.find('#recovery-feedback').textContent), 'Legacy capstone completion was lost');
  }],
  ['A save error is visibly reported while the new reading remains available', async () => {
    const game = await open('#lab/B5.1');
    const storage = game.win.Storage.prototype;
    const setItem = storage.setItem;
    storage.setItem = () => { throw new game.win.DOMException('Test storage write failure', 'QuotaExceededError'); };
    try {
      record(game, 40);
      const status = await waitFor(() => {
        const element = game.find('#save-status');
        return element && !element.hidden && element.getBoundingClientRect().height ? element : null;
      }, 'visible save error');
      check(/save|storage/i.test(status.textContent), 'Visible error did not explain the save failure');
      checkReadings(game, [[40, 100]]);
    } finally {
      storage.setItem = setItem;
    }
  }],
  ['Desktop and 390×844 viewport keep expedition, journal and lab controls usable', async () => {
    const desktop = await open('#expedition');
    check(desktop.win.innerWidth === 1024 && desktop.win.innerHeight === 768, 'Incorrect desktop viewport');
    check(desktop.find('.hero') && desktop.find('a[href="#missions"]'), 'Expedition or Mission Map is absent');
    await route(desktop, '#missions', '.mission-card');
    await route(desktop, '#journal', '.journal-list');
    check(desktop.find('a[href="#objective/B6.1/1"]'), 'Journal syllabus deep link is absent');
    const phone = await open('#lab/B6.1', { width: 390, height: 844 });
    const page = phone.frame.contentDocument.documentElement;
    check(phone.win.innerWidth === 390 && phone.win.innerHeight === 844, 'Incorrect 390×844 emulation');
    check(page.scrollWidth <= page.clientWidth, `Mobile layout overflows, ${page.scrollWidth}px > ${page.clientWidth}px`);
    const field = phone.find('#condition');
    const loop = phone.find('#record').getBoundingClientRect();
    check(field.getAttribute('aria-valuetext') && field.labels.length > 0 && loop.width > 0 && loop.left >= 0 && loop.right <= page.clientWidth, 'Mobile range or record control is unavailable');
    field.focus();
    check(phone.frame.contentDocument.activeElement === field, 'Range control cannot receive keyboard focus');
    record(phone, 50);
    checkReadings(phone, [[50, 12]]);
  }],
  ['Lab and objective evidence remain recordable when WebGL is disabled', async () => {
    const game = await open('#lab/B5.1', { webgl: false });
    await waitFor(() => /3D view is unavailable/.test(game.find('.viewer-message')?.textContent), 'lab text fallback');
    check(game.find('#reset-view').hidden && !game.find('#viewer canvas'), 'Lab did not enter WebGL fallback');
    enzymeReadings(game);
    submit(game);
    checkReadings(game, [[25, 46], [40, 100]]);
    checkCompletion(game, true);
    await route(game, '#objective/B6.1/1', '#objective-viewer[data-scene-state="unavailable"]');
    const apparatus = game.find('#apparatus-position');
    apparatus.value = apparatus.max;
    apparatus.dispatchEvent(new game.win.Event('input', { bubbles: true }));
    game.find('#run-objective').click();
    check(game.find('#objective-reading strong') && game.find('#objective-trials input'), 'Objective fallback did not record its observation');
  }]
];

start.addEventListener('click', async () => {
  if (location.port !== '4174') {
    summary.textContent = 'Run verification on the isolated QA origin.';
    return;
  }
  start.disabled = true;
  results.textContent = '';
  delete results.dataset.pass;
  let passed = 0;
  const existing = progressKeys().map(key => [key, localStorage.getItem(key)]);
  try {
    for (const [name, run] of cases) {
      summary.textContent = `Checking ${name}…`;
      resetProgress();
      try {
        await run();
        passed += 1;
        results.textContent += `PASS ${name}\n`;
      } catch (error) {
        results.textContent += `FAIL ${name}\n${error.message}\n`;
      }
    }
    results.dataset.pass = String(passed === cases.length);
    summary.textContent = `${passed === cases.length ? 'Passed' : 'Failed'} · ${passed}/${cases.length} Round 1 browser checks`;
  } finally {
    resetProgress();
    existing.forEach(([key, value]) => localStorage.setItem(key, value));
    start.disabled = false;
  }
});
