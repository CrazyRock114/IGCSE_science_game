import { isProgressKey, legacyProgressKey, readProgress } from '/progress-store.js';

const start = document.querySelector('#start');
const keyboardCheck = document.querySelector('#open-keyboard-check');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');
const host = document.querySelector('#test-host');
const missions = [['B19.1', 1], ['C10.1', 0], ['P4.2.5', 1]];
const parts = ['watershed', 'filter', 'power', 'evaluation'];
const first = { 'B19.1': [[0, 240], [50, 114]], 'C10.1': [[0, 48], [20, 9]], 'P4.2.5': [[3, .75], [4, 1]] };
const second = { 'B19.1': [[25, 175], [75, 62]], 'C10.1': [[10, 21], [30, 4]], 'P4.2.5': [[2, .5], [3, .75]] };

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(predicate, description) {
  const deadline = performance.now() + 8000;
  return new Promise((resolve, reject) => {
    function poll() {
      try {
        if (predicate()) resolve();
        else if (performance.now() >= deadline) reject(new Error('Timed out waiting for ' + description));
        else requestAnimationFrame(poll);
      } catch (error) {
        reject(error);
      }
    }
    poll();
  });
}

function load(frame, action) {
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  action();
  return loaded;
}

async function open(hash, width = 1024, height = 768) {
  const frame = document.createElement('iframe');
  frame.title = `FIELDWORK test player ${width} × ${height}`;
  frame.style.width = width + 'px';
  frame.style.height = height + 'px';
  frame.src = '/' + hash;
  await load(frame, () => host.append(frame));
  return { frame, win: frame.contentWindow, find: selector => frame.contentDocument.querySelector(selector) };
}

function click(game, selector) {
  const control = game.find(selector);
  check(control && !control.disabled, 'Control unavailable ' + selector);
  control.click();
}

function xp(game, value) {
  check(game.find('.rank span')?.textContent === value + ' XP', `Expected ${value} XP, got ${game.find('.rank span')?.textContent}`);
}

function state(game) {
  return readProgress(game.win.localStorage);
}

async function unlock(game, sample) {
  await waitFor(() => game.find('.capstone-evidence') && game.win.location.hash === '#connections', 'locked plan redirect');
  for (const [index, [id, answer]] of missions.entries()) {
    check(!game.find('a[href="#capstone"]'), 'Recovery plan unlocked before all three missions');
    click(game, `.capstone-evidence a[href="#lab/${id}"]`);
    await waitFor(() => game.find('#condition') && game.win.location.hash === '#lab/' + id, id);
    for (const [input, output] of sample[id]) {
      const slider = game.find('#condition');
      slider.valueAsNumber = input;
      slider.dispatchEvent(new game.win.Event('input', { bubbles: true }));
      check(slider.valueAsNumber === input, `Cannot reach ${input} in ${id}`);
      click(game, '#record');
      const trial = state(game).trials[id]?.at(-1);
      check(trial?.input === input && Math.abs(trial.output - output) < 1e-9, `Unexpected stored reading in ${id}`);
    }
    click(game, `.choice[data-choice="${answer}"]`);
    click(game, '#submit');
    check(game.find('#submit').disabled && state(game).done[id], 'Mission did not complete ' + id);
    xp(game, (index + 1) * 100);
    click(game, '#feedback a[href="#connections"]');
    await waitFor(() => game.find('.capstone-evidence'), 'Connections after ' + id);
  }
  click(game, 'a[href="#capstone"]');
  await waitFor(() => game.find('#recovery'), 'unlocked plan');
}

const field = (game, name) => game.find(`#recovery [name="${name}"]`);

function edit(game, name, value) {
  const control = field(game, name);
  check(control && !control.disabled, 'Field unavailable ' + name);
  control.value = value;
  check(control.value === value, `Field ${name} does not offer ${value}`);
  for (const type of ['input', 'change']) control.dispatchEvent(new game.win.Event(type, { bubbles: true }));
}

function readingRef(id, [input, output]) {
  return JSON.stringify([id, input, output]);
}

function answersFor(sample, alternate = false) {
  return {
    watershedA: readingRef('B19.1', sample['B19.1'][alternate ? 1 : 0]),
    watershedB: readingRef('B19.1', sample['B19.1'][alternate ? 0 : 1]),
    watershedAction: 'retain',
    filterA: readingRef('C10.1', sample['C10.1'][alternate ? 1 : 0]),
    filterB: readingRef('C10.1', sample['C10.1'][alternate ? 0 : 1]),
    filterTreatment: alternate ? 'a' : 'b',
    filterClaim: 'clarity',
    powerReading: readingRef('P4.2.5', sample['P4.2.5'][alternate ? 0 : 1]),
    capacity: alternate ? '250' : '0.25',
    capacityUnit: alternate ? 'Wh' : 'kWh',
    evaluation: alternate ? 'storms' : 'microbes'
  };
}

function fill(game, answers) {
  for (const [name, value] of Object.entries(answers)) edit(game, name, value);
}

function report(game, part, expected, explanation) {
  const node = game.find(`#recovery-${part}-feedback`);
  check(node?.dataset.result === expected, `${part} did not report ${expected}: ${node?.textContent}`);
  if (explanation) check(explanation.test(node.textContent), `${part} lacked actionable feedback: ${node.textContent}`);
}

function submit(game) {
  click(game, '#recovery button[type="submit"]');
}

function approved(game) {
  check(/Recovery plan approved/i.test(game.find('#recovery-feedback')?.textContent), 'Recovery plan approval was not visible');
  check(state(game).capstone, 'Recovery plan completion was not saved');
  xp(game, 600);
}

function seed({ complete = false, readings } = {}) {
  localStorage.setItem(legacyProgressKey, JSON.stringify({
    done: Object.fromEntries(missions.map(([id]) => [id, true])),
    capstone: complete,
    trials: Object.fromEntries(Object.entries(readings ?? {}).map(([id, trials]) => [
      id, trials.map(([input, output]) => ({ input, output }))
    ]))
  }));
}

function layout(game, form) {
  const doc = game.frame.contentDocument;
  check(game.win.innerWidth === 390 && game.win.innerHeight === 844, 'Expected the 390 × 844 browser viewport');
  const width = doc.documentElement.clientWidth;
  const overflow = [...doc.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > width + 1).slice(0, 5);
  check(doc.documentElement.scrollWidth <= width, `Recovery plan has horizontal overflow (${doc.documentElement.scrollWidth}px in ${width}px): ${overflow.map(node => node.id || String(node.className) || node.tagName).join(', ')}`);
  for (const control of form.querySelectorAll('input, select, button[type="submit"]')) {
    if (control.disabled) continue;
    if (control.tagName !== 'BUTTON') check(control.labels.length > 0, `Missing label for ${control.name}`);
    const bounds = control.getBoundingClientRect();
    check(bounds.width > 0 && bounds.left >= 0 && bounds.right <= doc.documentElement.clientWidth, `${control.name || control.textContent} overflows the viewport`);
    control.focus();
    check(doc.activeElement === control, `Cannot focus ${control.name || control.textContent}`);
  }
}

const cases = [
  ['Prerequisites unlock with saved trials and a valid plan earns the 300 XP reward once', async () => {
    const game = await open('#capstone');
    await unlock(game, first);
    const answers = answersFor(first);
    fill(game, answers);
    await load(game.frame, () => game.win.location.reload());
    await waitFor(() => game.find('#recovery'), 'draft after refresh');
    for (const [name, value] of Object.entries(answers)) check(field(game, name)?.value === value, 'Draft did not restore ' + name);
    xp(game, 300);
    submit(game);
    for (const part of parts) report(game, part, 'pass');
    report(game, 'watershed', 'pass', /50% tree cover gave 114 mg\/L.*240 mg\/L at 0%/);
    report(game, 'filter', 'pass', /20 cm setting gave 9 NTU compared with 48 NTU at 0 cm/);
    approved(game);
    const button = game.find('#recovery button[type="submit"]');
    if (button && !button.disabled) submit(game);
    approved(game);
    await load(game.frame, () => game.win.location.reload());
    await waitFor(() => game.find('#recovery-feedback'), 'approval after refresh');
    approved(game);
  }],
  ['Missing readings in an unlocked save fail the relevant sections', async () => {
    seed();
    const game = await open('#capstone');
    await waitFor(() => game.find('#recovery'), 'unlocked legacy plan');
    submit(game);
    for (const part of ['watershed', 'filter', 'power']) report(game, part, 'fail', /record|reading|select|choose/i);
    report(game, 'evaluation', 'fail');
    check(!state(game).capstone, 'Plan without evidence completed');
    xp(game, 300);
  }],
  ['Insufficient, unrelated, incorrect, and unsupported choices are graded separately', async () => {
    seed({ readings: first });
    const game = await open('#capstone');
    await waitFor(() => game.find('#recovery'), 'evidence grading');
    const valid = answersFor(first);
    const unknown = (name, accepted) => [...field(game, name).options].find(option => option.value && !accepted.includes(option.value))?.value;
    const invalidClaim = unknown('filterClaim', ['clarity']);
    const invalidEvaluation = unknown('evaluation', ['microbes', 'storms']);
    check(invalidClaim && invalidEvaluation, 'Missing alternative claim or evaluation choice');
    const cases = [
      ['watershed', 'watershedB', valid.watershedA, /different|distinct|two|compar/i],
      ['filter', 'filterTreatment', 'a', /lower|turbid/i],
      ['filter', 'filterClaim', invalidClaim, /turbid|microb|suspended|cloud/i],
      ['power', 'capacityUnit', 'W', /unit|Wh|energy|power/i],
      ['power', 'capacity', '1', /capacity|available|subtract|need|kWh/i],
      ['evaluation', 'evaluation', invalidEvaluation, /limit|test|evidence|measure/i]
    ];
    for (const [part, name, value, explanation] of cases) {
      fill(game, { ...valid, [name]: value });
      submit(game);
      for (const section of parts) report(game, section, section === part ? 'fail' : 'pass', section === part ? explanation : null);
      check(!state(game).capstone, 'Invalid entry completed the plan: ' + name);
      xp(game, 300);
    }
    fill(game, valid);
    const option = game.frame.contentDocument.createElement('option');
    option.value = valid.filterA;
    option.textContent = 'Unrelated waterworks reading';
    field(game, 'watershedA').append(option);
    edit(game, 'watershedA', option.value);
    submit(game);
    report(game, 'watershed', 'fail', /watershed|reading|record|sediment/i);
    check(!state(game).capstone, 'A reading from another mission passed');
  }],
  ['Another set of real readings and Wh complete the plan at 390 × 844', async () => {
    const game = await open('#capstone', 390, 844);
    await unlock(game, second);
    layout(game, game.find('#recovery'));
    fill(game, answersFor(second, true));
    submit(game);
    for (const part of parts) report(game, part, 'pass');
    report(game, 'watershed', 'pass', /75% tree cover gave 62 mg\/L.*175 mg\/L at 25%/);
    report(game, 'filter', 'pass', /30 cm setting gave 4 NTU compared with 21 NTU at 10 cm/);
    report(game, 'power', 'pass', /recorded 2 h run used 0\.5 kWh/);
    approved(game);
    layout(game, game.find('#recovery'));
  }],
  ['Completed legacy capstones keep their reward without earning a second one', async () => {
    seed({ complete: true, readings: first });
    const game = await open('#capstone');
    await waitFor(() => game.find('#recovery-feedback'), 'legacy recovery plan');
    approved(game);
    const button = game.find('#recovery button[type="submit"]');
    if (button && !button.disabled) {
      fill(game, answersFor(first));
      submit(game);
      approved(game);
    }
    await load(game.frame, () => game.win.location.reload());
    await waitFor(() => game.find('#recovery-feedback'), 'legacy approval after refresh');
    approved(game);
  }]
];

keyboardCheck.addEventListener('click', () => {
  if (start.disabled) return;
  host.replaceChildren();
  void open('#capstone', 390, 844);
});

start.addEventListener('click', async () => {
  if (location.port !== '4174') {
    summary.textContent = 'Run verification on the isolated QA origin.';
    return;
  }
  const keys = () => Object.keys(localStorage).filter(isProgressKey);
  const existing = keys().map(key => [key, localStorage.getItem(key)]);
  const reset = () => {
    host.replaceChildren();
    keys().forEach(key => localStorage.removeItem(key));
  };
  start.disabled = true;
  keyboardCheck.disabled = true;
  results.textContent = '';
  delete results.dataset.pass;
  let passed = 0;
  try {
    for (const [name, run] of cases) {
      summary.textContent = 'Checking ' + name + '…';
      reset();
      try {
        await run();
        passed += 1;
        results.textContent += 'PASS ' + name + '\n';
      } catch (error) {
        results.textContent += 'FAIL ' + name + '\n' + error.message + '\n';
      }
    }
    results.dataset.pass = String(passed === cases.length);
    summary.textContent = `${passed === cases.length ? 'Passed' : 'Failed'} · ${passed}/${cases.length} Round 3 browser checks`;
  } finally {
    reset();
    existing.forEach(([key, value]) => localStorage.setItem(key, value));
    keyboardCheck.disabled = false;
    start.disabled = false;
  }
});
