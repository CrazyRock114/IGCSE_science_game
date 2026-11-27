import { netPhotosynthesis } from './biology-simulation.js';
import { clean } from './html.js';

const factors = [
  { key: 'light', label: 'Light', control: 'Lamp exposure', options: ['Covered', 'Lit'], present: 'light' },
  { key: 'chlorophyll', label: 'Chlorophyll', control: 'Leaf region', options: ['Pale tissue', 'Green tissue'], present: 'green tissue' },
  { key: 'carbonDioxide', label: 'Carbon dioxide', control: 'Chamber air', options: ['CO₂ removed', 'Normal air'], present: 'normal air' }
];

function trialId(setup) {
  return factors.reduce((id, { key }, index) => id + (setup[key] << index), 0);
}

const trialKey = id => `trial-${id}`;

function trialSetup(id) {
  return Object.fromEntries(factors.map(({ key }, index) => [key, (id >> index) & 1]));
}

export function testLeafForStarch(setup) {
  const { light, chlorophyll, carbonDioxide } = setup;
  // The idealised, destarched leaf accumulates detectable starch over the fixed
  // exposure only when its modelled photosynthesis rate exceeds respiration.
  return netPhotosynthesis(light * chlorophyll, carbonDioxide, 24) > 0;
}

function iodineColour(starch) {
  return starch ? 'Blue-black' : 'Yellow-brown';
}

function describeSetup(setup) {
  return factors.map(({ key, options }) => options[setup[key]]).join(' · ');
}

export function recordLeafObservation(state) {
  const { pending, trials } = state;
  const key = trialKey(pending);
  if (pending === null || trials[key]) return state;
  const observation = { id: pending, starch: testLeafForStarch(trialSetup(pending)) };
  return { ...state, trials: { ...trials, [key]: observation } };
}

function list(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0];
}

export function checkPhotosynthesisComparison(variable, trials, { first, second, conclusion }) {
  const factor = factors.find(({ key }) => key === variable);
  if (!factor) return { status: 'needs-variable', message: 'Choose the independent variable you want to investigate.' };
  const a = trials[trialKey(first)];
  const b = trials[trialKey(second)];
  if (!a || !b || first === second) {
    return { status: 'needs-observations', message: 'Record and select two distinct iodine observations before drawing a conclusion.' };
  }

  const aSetup = trialSetup(a.id);
  const bSetup = trialSetup(b.id);
  const changes = factors.filter(({ key }) => aSetup[key] !== bSetup[key]);
  if (changes.length > 1) {
    const names = list(changes.map(({ label }) => label.toLowerCase()));
    return { status: 'confounded', message: `Your two trials differ in ${names}. Change only ${factor.label.toLowerCase()} to isolate its effect.` };
  }
  if (changes[0]?.key !== variable) {
    return { status: 'wrong-variable', message: `Select trials where only ${factor.label.toLowerCase()} differs.` };
  }
  if (a.starch === b.starch) {
    const missing = factors.filter(({ key }) => key !== variable && aSetup[key] === 0).map(({ present }) => present);
    return { status: 'inconclusive', message: `Both trials gave the same iodine colour. Repeat the comparison with ${list(missing)} in both trials.` };
  }
  if (!conclusion) return { status: 'needs-conclusion', message: 'Choose what the two iodine colours tell you about starch production.' };
  const correct = a.starch ? 'first' : 'second';
  if (conclusion !== correct) {
    return { status: 'wrong-conclusion', message: 'Check your readings. Blue-black iodine indicates starch, while yellow-brown iodine indicates no starch was detected.' };
  }
  return { status: 'correct', message: `Only ${factor.label.toLowerCase()} changed. The sample with ${factor.present} turned blue-black. This shows that ${factor.label.toLowerCase()} was needed for the leaf to make detectable starch in this comparison.` };
}

export const photosynthesisPractical = {
  createState() {
    return {
      variable: '', setup: { light: 1, chlorophyll: 1, carbonDioxide: 1 },
      pending: null, trials: {}, first: null, second: null, conclusion: '', comparisons: {}
    };
  },

  render(root, { state, guided, update, scene }) {
    const { variable, setup, first, second, conclusion, comparisons } = state;
    const trials = Object.values(state.trials);
    const observed = state.pending === trialId(setup);
    const recorded = observed && Boolean(state.trials[trialKey(state.pending)]);
    const starch = observed && testLeafForStarch(setup);
    const savedPair = comparisons[variable];
    const confirmed = savedPair?.first === first && savedPair?.second === second && savedPair?.conclusion === conclusion;
    const canChooseConclusion = trials.length >= 2;

    const find = id => root.querySelector(`#photo-${id}`);
    if (!find('feedback')) {
      root.innerHTML = `
        <section class="panel panel-body practical-step" aria-labelledby="photo-plan">
          <h2 id="photo-plan">Prepare the leaf test</h2>
          <div id="photo-setup-controls" style="display: contents"></div>
          <p id="photo-result" role="status"></p>
        </section>
        <section class="panel panel-body practical-step" aria-labelledby="photo-compare">
          <h2 id="photo-compare">Compare observations</h2>
          <div id="photo-comparison-controls" style="display: contents"></div>
          <div id="photo-feedback" role="status"></div>
          <p id="photo-verified"></p>
        </section>`;
    }

    find('setup-controls').innerHTML = `
        <p>The greenhouse team needs evidence about what affects starch production in its leaves.</p>
        <p>Use matched areas from the same destarched variegated plant. Water, temperature (24 °C), and exposure time stay constant. Iodine turns blue-black in the presence of starch and stays yellow-brown when no starch is detected.</p>
        <p>${guided
          ? 'Choose one factor to change. Start with a reference sample with all three tested factors present, then make a second sample that differs only in your chosen factor.'
          : 'Plan a fair comparison for each factor, run the leaf tests, and choose the observations that support your claims.'}</p>
        <div class="practical-fields">
          <label for="photo-variable">Independent variable
            <select class="objective-select" id="photo-variable">
              <option value="">Choose a factor</option>
              ${factors.map(({ key, label }) => `<option value="${key}" ${key === variable ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
          ${factors.map(({ key, control, options }) => `
            <label for="photo-${key}">${control}
              <select class="objective-select" id="photo-${key}">${options.map((option, index) => `<option value="${index}" ${setup[key] === index ? 'selected' : ''}>${option}</option>`).join('')}</select>
            </label>`).join('')}
        </div>
        <div class="button-row">
          <button class="button primary" type="button" id="photo-run" ${variable ? '' : 'disabled'}>Run iodine test</button>
          <button class="button" type="button" id="photo-record" aria-describedby="photo-result" ${!observed || recorded ? 'disabled' : ''}>Record observation</button>
        </div>`;
    const result = find('result');
    const reading = observed ? `Iodine colour: <strong>${iodineColour(starch)}</strong>.${recorded ? ' Observation recorded.' : ''}` : 'Run the test to observe the iodine colour.';
    if (result.innerHTML !== reading) result.innerHTML = reading;

    find('comparison-controls').innerHTML = `
        ${trials.length ? `<table class="practical-table" id="photo-observations">
          <caption class="sr-only">Recorded leaf tests</caption>
          <thead><tr><th scope="col">Trial</th><th scope="col">Conditions</th><th scope="col">Iodine colour</th></tr></thead>
          <tbody>${trials.map(({ id, starch }, index) => `
            <tr><th scope="row">${index + 1}</th><td>${clean(describeSetup(trialSetup(id)))}</td><td>${iodineColour(starch)}</td></tr>`).join('')}</tbody>
        </table>` : '<p id="photo-observations">Record a leaf test to start your observations.</p>'}
        <div class="practical-fields">
          ${[['first', 'Trial A', first], ['second', 'Trial B', second]].map(([key, label, current]) => `
            <label for="photo-${key}">${label}
              <select class="objective-select" id="photo-${key}">
                <option value="">Choose a recorded trial</option>
                ${trials.map(({ id }, index) => `<option value="${id}" ${id === current ? 'selected' : ''}>Trial ${index + 1} · ${clean(describeSetup(trialSetup(id)))}</option>`).join('')}
              </select>
            </label>`).join('')}
          ${canChooseConclusion ? `<label for="photo-conclusion">What did the pair show about your chosen factor?
            <select class="objective-select" id="photo-conclusion">
              <option value="">Choose a conclusion</option>
              <option value="first" ${conclusion === 'first' ? 'selected' : ''}>Only Trial A’s setting supported starch production</option>
              <option value="second" ${conclusion === 'second' ? 'selected' : ''}>Only Trial B’s setting supported starch production</option>
              <option value="same" ${conclusion === 'same' ? 'selected' : ''}>The factor made no detectable difference</option>
            </select>
          </label>` : ''}
        </div>
        <div class="button-row"><button class="button" type="button" id="photo-submit" aria-describedby="photo-feedback">Check comparison</button></div>`;
    const feedback = find('feedback');
    const message = confirmed ? savedPair.message : '';
    feedback.className = confirmed ? 'feedback' : '';
    if (feedback.textContent !== message) feedback.textContent = message;
    find('verified').textContent = `Comparisons verified: ${list(factors.filter(({ key }) => comparisons[key]).map(({ label }) => label)) ?? 'none'}. (${Object.keys(comparisons).length} of ${factors.length})`;

    const listen = (id, type, handler) => find(id)?.addEventListener(type, handler);
    listen('variable', 'change', ({ target }) => {
      const previous = comparisons[target.value];
      update({ ...state, variable: target.value, first: previous?.first ?? null, second: previous?.second ?? null, conclusion: previous?.conclusion ?? '' });
    });
    for (const { key } of factors) {
      listen(key, 'change', ({ target }) => update({ ...state, setup: { ...setup, [key]: Number(target.value) }, pending: null }));
    }
    listen('run', 'click', () => {
      const id = trialId(setup);
      update({ ...state, pending: id }, { focus: state.trials[trialKey(id)] ? 'photo-run' : 'photo-record' });
    });
    listen('record', 'click', () => update(recordLeafObservation(state), { focus: 'photo-run' }));
    for (const key of ['first', 'second']) {
      listen(key, 'change', ({ target }) => update({ ...state, [key]: target.value === '' ? null : Number(target.value), conclusion: '' }));
    }
    listen('conclusion', 'change', ({ target }) => update({ ...state, conclusion: target.value }));
    listen('submit', 'click', () => {
      const result = checkPhotosynthesisComparison(variable, state.trials, state);
      if (result.status !== 'correct') {
        feedback.className = 'feedback error';
        feedback.textContent = result.message;
        return;
      }
      const next = { ...comparisons, [variable]: { first, second, conclusion, message: result.message } };
      update({ ...state, comparisons: next }, { complete: factors.every(({ key }) => next[key]) });
    });

    scene.present({ condition: describeSetup(setup), observation: observed ? `Iodine colour: ${iodineColour(starch)}` : 'Ready for the iodine test',
      settings: { ...setup, starch }, recorded: observed, position: observed ? 1 : 0 });
  }
};
