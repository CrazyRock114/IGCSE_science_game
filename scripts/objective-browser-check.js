import { objectiveCatalog } from '/objective-catalog.js';
import { objectiveHref } from '/objective-game.js';
import { isProgressKey, readProgress } from '/progress-store.js';

const summary = document.querySelector('#summary');
const results = document.querySelector('#results');
const start = document.querySelector('#start');

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(predicate, description) {
  const timeout = performance.now() + 7500;
  return new Promise((resolve, reject) => {
    function tick() {
      const result = predicate();
      if (result) resolve(result);
      else if (performance.now() > timeout) reject(new Error('Timed out waiting for ' + description));
      else requestAnimationFrame(tick);
    }
    tick();
  });
}

async function run(frame) {
  const { contentWindow: game } = frame;
  const doc = () => frame.contentDocument;
  const find = selector => doc().querySelector(selector);
  async function reload() {
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    game.location.reload();
    await loaded;
  }
  await waitFor(() => find('.journal-list'), 'field journal');
  const expected = [...objectiveCatalog.values()].map(entry => objectiveHref(entry.mission.id, entry.number));
  const links = Array.from(doc().querySelectorAll('a.objective-launch'), a => a.getAttribute('href'));
  check(links.length === 650 && new Set(links).size === 650 && expected.every(href => links.includes(href)), 'Journal has a unique launch link for every objective');

  let verified = 0;
  let testedSetups = 0;
  let runtimeError;
  const failures = [];
  for (const key of Object.keys(game.localStorage).filter(isProgressKey)) game.localStorage.removeItem(key);
  // Start with an empty in-memory save, on the separate QA server origin.
  await reload();
  await waitFor(() => find('.journal-list') && find('.journal-metrics').textContent.includes('0 / 650'), 'empty journal');
  game.addEventListener('error', event => { runtimeError = event.message; });

  for (const [key, objective] of objectiveCatalog) {
    summary.textContent = `${verified} of 650 verified · Testing ${key}`;
    try {
      runtimeError = null;
      game.location.hash = objectiveHref(objective.mission.id, objective.number);
      const root = await waitFor(() => {
        const candidate = find('.objective-layout');
        return candidate?.dataset.objective === key && candidate;
      }, key + ' route');
      const viewer = root.querySelector('#objective-viewer');
      const status = await waitFor(() => viewer.dataset.sceneState, key + ' WebGL first frame');
      check(status === 'ready', '3D viewer could not render');
      const canvas = viewer.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      check(canvas?.width > 0 && canvas.height > 0 && gl && !gl.isContextLost(), 'No live WebGL 2 canvas');
      check(gl.getError() === gl.NO_ERROR, 'WebGL error in first frame');

      const control = root.querySelector('#objective-setup');
      const apparatus = root.querySelector('#apparatus-position');
      const runTrial = root.querySelector('#run-objective');
      const log = root.querySelector('#objective-trials');
      const submit = root.querySelector('#submit-evidence');
      check(control.options.length === objective.cases.length, 'Setup selector mismatch');
      submit.click();
      check(root.querySelector('#objective-feedback').textContent.includes('two different setups'), 'Evidence gate did not activate');

      for (const [index, entry] of objective.cases.entries()) {
        control.value = String(index);
        control.dispatchEvent(new game.Event('change', { bubbles: true }));
        check(viewer.dataset.setup === String(index), '3D setup did not change');
        check(apparatus.value === '0', 'New setup did not start at the initial apparatus position');
        runTrial.click();
        check(root.querySelector('#apparatus-feedback').textContent.includes('reference mark'), 'An uncalibrated trial was recorded');
        check(log.querySelectorAll('input').length === index, 'Uncalibrated trial changed the evidence log');
        apparatus.value = '47';
        apparatus.dispatchEvent(new game.Event('input', { bubbles: true }));
        check(viewer.dataset.apparatusReady === 'false', 'Intermediate position enabled recording');
        check(apparatus.getAttribute('aria-valuetext'), 'Apparatus position has no accessible value');
        await new Promise(resolve => game.requestAnimationFrame(resolve));
        check(!runtimeError && !gl.isContextLost() && gl.getError() === gl.NO_ERROR, runtimeError || 'WebGL error during manipulation');
        apparatus.value = apparatus.max;
        apparatus.dispatchEvent(new game.Event('input', { bubbles: true }));
        check(viewer.dataset.apparatusReady === 'true', 'Reference mark did not enable recording');
        runTrial.click();
        const observation = root.querySelector('#objective-reading strong');
        check(observation?.textContent === entry.observation, 'Incorrect observation for setup ' + index);
        check(log.querySelectorAll('input').length === index + 1, 'Trial missing from evidence log');
        await new Promise(resolve => game.requestAnimationFrame(resolve));
        check(!runtimeError, runtimeError);
        check(!gl.isContextLost() && gl.getError() === gl.NO_ERROR, 'WebGL error in setup ' + index);
        testedSetups += 1;
      }
      const choice = index => log.querySelector(`input[value="${index}"]`);
      const incorrect = objective.cases.findIndex((_, index) => !objective.answer.includes(index));
      choice(incorrect).click();
      submit.click();
      check(root.querySelector('#objective-feedback .error'), 'Incorrect evidence was accepted');
      if (objective.answer.length > 1) choice(incorrect).click();
      objective.answer.forEach(index => choice(index).click());
      submit.click();
      check(submit.disabled && root.querySelector('#objective-feedback .objective-complete'), 'Correct evidence did not complete the objective');
      const save = readProgress(game.localStorage);
      check(save?.objectiveProgress?.[key]?.done && save.objectiveProgress[key].runs.length === objective.cases.length, 'Completion or readings were not saved');
      verified += 1;
    } catch (error) {
      failures.push(key + ' — ' + error.message);
      results.textContent = failures.join('\n');
    }
  }

  game.location.hash = '#journal';
  await waitFor(() => find('.journal-list'), 'journal after playthrough');
  await reload();
  await waitFor(() => find('.journal-metrics')?.textContent.includes(verified + ' / 650'), 'persisted completion total after reload');
  summary.textContent = failures.length
    ? `Failed · ${verified}/650 verified · ${failures.length} failures`
    : `Passed · 650/650 objective experiments verified and saved · ${testedSetups} setups tested`;
  results.dataset.pass = String(failures.length === 0);
}

start.addEventListener('click', () => {
  start.disabled = true;
  summary.textContent = 'Loading the game…';
  const frame = document.createElement('iframe');
  frame.title = 'FIELDWORK test player';
  frame.src = '/#journal';
  frame.addEventListener('load', () => run(frame).catch(error => {
    summary.textContent = 'Verification stopped';
    results.textContent += '\n' + error.message;
    results.dataset.pass = 'false';
  }), { once: true });
  document.querySelector('#test-host').append(frame);
});
