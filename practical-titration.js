import { titrationPH } from './chemistry-simulation.js';
import { clean } from './html.js';

// Store burette readings in hundredths of a millilitre to preserve scale divisions.
const concordance = 20;
const titrant = .010;
const volume = reading => (reading / 100).toFixed(2);
const repeat = (name, initial, equivalence) => ({ name, initial, equivalence, kind: 'repeat' });

export const titrationTrials = {
  guided: [
    { name: 'Rough run', initial: 10, equivalence: 2500, kind: 'rough' },
    repeat('Trial 1', 35, 2500),
    repeat('Trial 2', 85, 2520),
    { name: 'Trial 3', initial: 45, equivalence: 2500, kind: 'replay' },
    repeat('Trial 4', 215, 2575)
  ],
  independent: [
    { name: 'Rough run', initial: 25, equivalence: 2490, kind: 'rough' },
    repeat('Trial 1', 135, 2490),
    repeat('Trial 2', 60, 2505),
    repeat('Trial 3', 185, 2590),
    { name: 'Trial 4', initial: 55, equivalence: 2495, kind: 'replay' }
  ]
};

const emptyRun = () => ({ dose: 0, swirled: false, initial: '', final: '', record: null });

function acidConcentration(trial) {
  return titrant * trial.equivalence / 2500;
}

const appearances = {
  clear: { text: 'The whole flask is colourless after swirling.', label: 'Colourless', colour: '#d8e0e4' },
  pale: { text: 'A very pale pink tint stays throughout the flask after swirling.', label: 'Pale pink', colour: '#e8b6cf' },
  deep: { text: 'A strong pink colour stays throughout the flask after swirling.', label: 'Strong pink', colour: '#d65b9e' },
  unmixed: { text: 'The latest addition is unmixed. Swirl to check the colour throughout the flask.', label: 'Unmixed', colour: '#d8e0e4' },
  start: { text: 'The flask is colourless before any titrant is added.', label: 'Colourless', colour: '#d8e0e4' }
};

export function titrationAppearance(trial, { dose, swirled }) {
  if (!dose) return 'start';
  if (!swirled) return 'unmixed';
  const pH = titrationPH(25, dose / 100, acidConcentration(trial), titrant);
  if (pH < 8.2) return 'clear';
  return pH < 9.25 ? 'pale' : 'deep';
}

function enteredReading(text) {
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text.trim())) return null;
  const reading = Math.round(Number(text) * 100);
  return reading <= 5000 ? reading : null;
}

export function readTitration(trial, run) {
  if (!run.swirled) return { status: 'unmixed' };
  const initial = enteredReading(run.initial);
  const final = enteredReading(run.final);
  if (initial === null || final === null) return { status: 'missing-reading' };
  if (initial !== trial.initial) return { status: 'initial' };
  if (final !== trial.initial + run.dose) return { status: 'final' };
  return {
    status: 'recorded',
    record: { initial, final, rough: trial.kind === 'rough', appearance: titrationAppearance(trial, run) }
  };
}

export function checkTitration(records, included, answer) {
  if (records.some(record => !record)) return { status: 'missing-trials' };
  const selected = [...new Set(included)].map(index => records[index]).filter(Boolean);
  if (selected.length < 2) return { status: 'too-few' };
  if (selected.some(record => record.rough)) return { status: 'rough' };
  if (selected.some(record => record.appearance === 'deep')) return { status: 'overshoot' };
  if (selected.some(record => record.appearance !== 'pale')) return { status: 'early' };
  const titres = selected.map(({ initial, final }) => final - initial);
  const spread = Math.max(...titres) - Math.min(...titres);
  if (spread > concordance) return { status: 'outlier', spread };
  const mean = Math.round(titres.reduce((sum, titre) => sum + titre, 0) / titres.length);
  if (enteredReading(answer) !== mean) return { status: 'mean', titres };
  return { status: 'complete', titres, mean };
}

const response = {
  unmixed: 'Swirl the flask before recording this run.',
  'missing-reading': 'Enter both burette readings in mL. The scale runs from 0.00 to 50.00 mL.',
  initial: 'Check the initial scale. Read the lowest point of the meniscus and count down from the smaller number.',
  final: 'Check the current scale. Read the lowest point of the meniscus and count down from the smaller number.',
  'missing-trials': 'Record the initial and final readings for each run before choosing which titres to average.',
  'too-few': 'Select at least two repeat titres that reached the endpoint.',
  rough: 'Exclude the rough run. It locates the endpoint approximately so you can approach it more slowly in the repeats.',
  overshoot: 'Exclude the run with a strong pink colour. Extra alkali passed the first persistent pale pink endpoint and made its titre too large.',
  early: 'Exclude the colourless run. The flask must stay pale pink after swirling for you to accept the endpoint.',
  'outlier': ({ spread }) => `Your selected titres span ${volume(spread)} mL. Average the repeats within ${volume(concordance)} mL of each other and exclude the outlier so it cannot pull the mean away from the repeatable result.`,
  mean: ({ titres }) => `Recheck the mean of your ${titres.length} selected titres (${titres.map(volume).join(', ')} mL). Add them and divide by ${titres.length}, then round to 2 decimal places.`,
  complete: ({ mean }) => `Your selected repeats agree within ${volume(concordance)} mL. Their mean titre is ${volume(mean)} mL.`
};

function feedbackText(result) {
  const message = response[result.status];
  return typeof message === 'function' ? message(result) : message;
}

function feedbackMarkup(result) {
  return result ? `<p class="feedback ${result.status === 'complete' ? '' : 'error'}">${clean(feedbackText(result))}</p>` : '';
}

const apparatus = [
  { prompt: 'Measure the fixed 25.00 mL aliquot', options: ['Unmarked beaker', 'Volumetric pipette'], answer: 'Volumetric pipette' },
  { prompt: 'Dispense and measure titrant', options: ['Burette', 'Test tube'], answer: 'Burette' },
  { prompt: 'Detect the endpoint', options: ['Universal indicator', 'Phenolphthalein'], answer: 'Phenolphthalein' }
];

function setupMarkup(state) {
  return `<fieldset class="titration-setup" ${state.ready ? 'disabled' : ''}>
    <legend>Prepare the waterworks bench</legend>
    ${apparatus.map(({ prompt, options }, index) => `<label>${prompt}
      <select class="objective-select" id="titration-kit-${index}">
        <option value="">Choose equipment</option>
        ${options.map(option => `<option ${state.kit[index] === option ? 'selected' : ''}>${option}</option>`).join('')}
      </select></label>`).join('')}
    ${state.ready ? '<p>Apparatus ready</p>' : '<button type="button" class="button" id="titration-prepare">Prepare titration</button>'}
  </fieldset>`;
}

function scaleMarkup(caption, reading) {
  const start = Math.min(4960, Math.max(0, Math.floor(reading / 10) * 10 - 20));
  const marks = Array.from({ length: 5 }, (_, index) => start + index * 10);
  const smaller = Math.floor(reading / 10) * 10;
  const description = reading === smaller ? `On the ${volume(smaller)} mL mark.`
    : `Halfway between ${volume(smaller)} and ${volume(smaller + 10)} mL.`;
  return `<figure class="titration-scale">
    <figcaption>${caption}</figcaption>
    <div class="titration-scale-body" aria-hidden="true">
      <div class="titration-tube" style="--meniscus: ${(reading - start) * 2.5}%"><span></span></div>
      <ol class="titration-ticks">${marks.map(mark => `<li><span>${volume(mark)}</span></li>`).join('')}</ol>
    </div>
    <p>${description}</p>
  </figure>`;
}

function trialsMarkup(trials, state) {
  return `<table class="titration-table">
    <thead><tr><th scope="col">Run</th><th scope="col">Initial<br>mL</th><th scope="col">Final<br>mL</th><th scope="col">Titre<br>mL</th><th scope="col">Use</th></tr></thead>
    <tbody>${trials.map((trial, index) => {
      const record = state.runs[index].record;
      return `<tr><th scope="row">${trial.name}${record ? `<small>${appearances[record.appearance].label}</small>` : ''}</th>
        ${record ? `<td>${volume(record.initial)}</td><td>${volume(record.final)}</td><td>${volume(record.final - record.initial)}</td>` : '<td>—</td><td>—</td><td>—</td>'}
        <td><input type="checkbox" id="titration-use-${index}" aria-label="Include ${trial.name}" ${state.included.includes(index) ? 'checked' : ''} ${record ? '' : 'disabled'}></td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

export const titrationPractical = {
  createState(objective) {
    const setupActivity = objective.number === '1';
    const count = setupActivity ? 1 : titrationTrials.guided.length;
    const runs = Object.fromEntries(Array.from({ length: count }, (_, index) => [index, emptyRun()]));
    return { ready: !setupActivity, kit: ['', '', ''], active: 0, runs, included: [], mean: '', feedback: null };
  },
  render(root, { state, objective, guided, update, scene }) {
    const setupActivity = objective.number === '1';
    const allTrials = titrationTrials[guided ? 'guided' : 'independent'];
    const trials = setupActivity ? [allTrials[1]] : allTrials;
    const index = state.active;
    const trial = trials[index];
    const run = state.runs[index];
    const appearance = appearances[titrationAppearance(trial, run)];
    const drop = trial.kind === 'rough' ? 50 : 5;
    const replay = trial.kind === 'replay';
    const mark = trial.initial + run.dose;

    root.innerHTML = `<div class="panel panel-body practical-step titration-practical">
      <p>${setupActivity ? 'Prepare the waterworks training bench for a fixed 25.00 mL acid sample and record a titre with the equipment you choose.' : 'The waterworks team needs a reliable titre for a fixed 25.00 mL acid sample. Use standard alkali and compare the repeats before reporting a mean.'}</p>
      ${guided ? `<p class="titration-guide">Read the bottom of the meniscus at eye level. The burette scale increases downwards. Use the rough run to locate the transition, then add alkali one drop at a time. Swirl after each drop. A very pale pink colour that persists throughout the flask marks the endpoint.</p>` : ''}
      ${setupActivity ? `${setupMarkup(state)}<p id="titration-setup-feedback" role="status"></p>` : '<p>The bench is set up with a volumetric pipette, a burette and phenolphthalein.</p>'}
      ${state.ready ? `<section aria-labelledby="titration-workbench">
        <h2 id="titration-workbench" tabindex="-1">Read the burette</h2>
        ${setupActivity ? '' : `<label for="titration-trial">Run to inspect</label>
        <select class="objective-select" id="titration-trial">${trials.map((entry, i) => `<option value="${i}" ${index === i ? 'selected' : ''}>${entry.name}</option>`).join('')}</select>`}
        <div class="titration-scales">${scaleMarkup('Initial scale', trial.initial)}${scaleMarkup('Current scale', mark)}</div>
        <p class="titration-appearance"><span style="--flask-colour: ${appearance.colour}" aria-hidden="true"></span>${appearance.text}</p>
        <div class="titration-buttons">
          ${replay ? `<button class="button" type="button" id="titration-bulk" ${run.dose ? 'disabled' : ''}>Replay recorded additions</button>` : `
            <button class="button" type="button" id="titration-bulk" ${run.dose ? 'disabled' : ''}>Add bulk dose</button>
            <button class="button" type="button" id="titration-drop" ${!run.dose || mark + drop > 5000 ? 'disabled' : ''}>Add ${volume(drop)} mL</button>`}
          <button class="button" type="button" id="titration-swirl" ${!run.dose || run.swirled ? 'disabled' : ''}>Swirl flask</button>
          <button class="button" type="button" id="titration-refill" ${!run.dose ? 'disabled' : ''}>Refill this run</button>
        </div>
        <div class="titration-entries">
          <label>Initial burette reading (mL)<input class="objective-select" id="titration-initial" type="text" inputmode="decimal" value="${clean(run.initial)}" maxlength="5"></label>
          <label>Final burette reading (mL)<input class="objective-select" id="titration-final" type="text" inputmode="decimal" value="${clean(run.final)}" maxlength="5"></label>
        </div>
        <button class="button" type="button" id="titration-record">Record run</button>
        <p id="titration-reading-feedback" role="status" tabindex="-1">${run.record ? setupActivity ? `Burette readings recorded. Your titre is ${volume(run.record.final - run.record.initial)} mL.` : `${trial.name} recorded. Choose another run or analyse your records.` : ''}</p>
      </section>
      ${setupActivity ? '' : `<section aria-labelledby="titration-analysis">
        <h2 id="titration-analysis">Analyse your titres</h2>
        <p>Select at least two repeat titres from usable endpoints. The largest and smallest selected titres must differ by at most ${volume(concordance)} mL.</p>
        ${guided ? '<p class="titration-guide">Subtract initial from final for each titre. Add only your selected titres, divide by the number selected and give the mean to 2 decimal places.</p>' : ''}
        ${trialsMarkup(trials, state)}
        <label for="titration-mean">Mean of selected titres (mL, 2 decimal places)</label>
        <input class="objective-select" id="titration-mean" type="text" inputmode="decimal" value="${clean(state.mean)}" maxlength="5">
        <button type="button" class="button primary" id="titration-submit">Submit titre analysis</button>
        <div id="titration-feedback" role="status" tabindex="-1">${feedbackMarkup(state.feedback)}</div>
      </section>`}` : ''}
    </div>`;

    const find = id => root.querySelector(`#titration-${id}`);
    const listen = (id, type, handler) => find(id)?.addEventListener(type, handler);
    function save(patch, options) {
      state = { ...state, feedback: null, ...patch };
      update(state, options);
    }
    function changeRun(patch, options) {
      const runs = { ...state.runs, [index]: { ...state.runs[index], ...patch } };
      save({ runs }, options);
    }
    function changeDose(dose, focus) {
      const runs = { ...state.runs, [index]: { ...emptyRun(), dose, initial: state.runs[index].initial } };
      save({ runs, included: state.included.filter(value => value !== index) }, { focus: `titration-${focus}` });
    }

    if (!state.ready) {
      apparatus.forEach((_, i) => listen(`kit-${i}`, 'change', event => {
        const kit = [...state.kit];
        kit[i] = event.target.value;
        find('setup-feedback').textContent = '';
        save({ kit }, { redraw: false });
      }));
      listen('prepare', 'click', () => {
        const mismatch = apparatus.findIndex(({ answer }, i) => state.kit[i] !== answer);
        if (mismatch !== -1) {
          find('setup-feedback').textContent = [
            'Choose equipment designed to measure a fixed, accurate aliquot.',
            'Choose equipment that can dispense small controlled additions and measure how much was delivered.',
            'Choose the indicator that gives a distinct, persistent colour change near the endpoint.'
          ][mismatch];
          return;
        }
        save({ ready: true }, { focus: 'titration-workbench' });
      });
    }

    listen('trial', 'change', event => save({ active: Number(event.target.value) }));
    listen('bulk', 'click', () => changeDose(trial.equivalence + (replay ? 35 : -10), 'swirl'));
    listen('drop', 'click', () => changeDose(run.dose + drop, 'swirl'));
    listen('refill', 'click', () => changeDose(0, 'bulk'));
    listen('swirl', 'click', () => changeRun({ swirled: true }, { focus: titrationAppearance(trial, { ...run, swirled: true }) === 'clear' && !replay ? 'titration-drop' : 'titration-initial' }));
    for (const field of ['initial', 'final']) listen(field, 'input', event => changeRun({ [field]: event.target.value }, { redraw: false }));
    listen('record', 'click', () => {
      const result = readTitration(trial, state.runs[index]);
      if (result.status !== 'recorded') {
        find('reading-feedback').textContent = feedbackText(result);
        return;
      }
      if (setupActivity && result.record.appearance !== 'pale') {
        find('reading-feedback').textContent = feedbackText({ status: result.record.appearance === 'deep' ? 'overshoot' : 'early' });
        return;
      }
      const nextRun = trials.findIndex((_, i) => i !== index && !state.runs[i].record);
      changeRun({ record: result.record }, {
        complete: setupActivity,
        focus: setupActivity ? 'titration-reading-feedback' : nextRun === -1 ? 'titration-mean' : 'titration-trial'
      });
    });
    trials.forEach((_, i) => listen(`use-${i}`, 'change', event => {
      const included = event.target.checked ? [...state.included, i] : state.included.filter(value => value !== i);
      save({ included });
    }));
    listen('mean', 'input', event => {
      find('feedback').replaceChildren();
      save({ mean: event.target.value }, { redraw: false });
    });
    listen('submit', 'click', () => {
      const feedback = checkTitration(trials.map((_, i) => state.runs[i].record), state.included, state.mean);
      const status = find('feedback');
      status.innerHTML = feedbackMarkup(feedback);
      status.focus({ preventScroll: true });
      save({ feedback }, { complete: feedback.status === 'complete', redraw: false });
    });

    scene.present({
      condition: state.ready ? trial.name : 'Prepare the bench',
      observation: state.ready ? appearance.label : 'Read the equipment labels',
      recorded: Boolean(run.record),
      position: run.dose / (5000 - trial.initial),
      settings: { titration: { initial: trial.initial / 100, delivered: run.dose / 100, acidM: acidConcentration(trial), baseM: titrant, swirled: run.swirled } }
    });
  }
};
