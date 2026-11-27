import { subjects } from './game.js';
import { apparatusPosition, atReferenceMark, referenceMark, sampleControl } from './apparatus-control.js';
import { clean } from './html.js';
import { icon } from './icons.js';
import { checkEvidence, objectiveCaseOrder, objectiveHref, objectiveXp, recordObjective, restoreObjective } from './objective-game.js';
import { practicals, showPractical } from './practical-view.js';

const messages = {
  compare: 'Run at least two different setups to compare the observations.',
  choose: 'Select the recorded evidence that fits the assignment.',
  unrecorded: 'Run the setup before using its observation as evidence.',
  retry: 'That evidence does not support the assignment yet. Compare the observations and try again.'
};

export function showObjective(main, objective, saved, { onProgress, isCurrent, motionReduced }) {
  const practical = practicals.get(objective.key);
  if (practical) return showPractical(main, objective, saved, practical, { onProgress, isCurrent, motionReduced });
  const { mission, number, tier, apparatus, action, description, cases, answer, insight } = objective;
  const subject = subjects.find(entry => entry.id === mission.subject);
  const position = mission.objectives.findIndex(([id]) => id === number);
  const previous = mission.objectives[position - 1];
  const next = mission.objectives[position + 1];
  const order = objectiveCaseOrder(objective);
  let progress = restoreObjective(objective, saved);
  let active = progress.runs.at(-1) ?? order[0];
  let positionValue = progress.runs.includes(active) ? referenceMark : 0;
  let equipment = sampleControl;
  let liveReading = () => null;
  let evidence = new Set(progress.done ? answer : []);
  let scene;

  main.innerHTML = `
    <a class="back-link" href="#lab/${mission.id}/objectives">${icon('back')} ${clean(mission.quest)}</a>
    <header class="page-intro lab-heading objective-heading ${mission.subject}">
      <div class="lab-meta">
        <span class="eyebrow">${mission.id} · Objective ${number} · ${subject.name}</span>
        <span class="tier ${tier === 'Supplement' ? 'supplement' : ''}">${tier}</span>
        <span class="location">${icon('pin')}${clean(mission.location)}</span>
      </div>
      <h1>${clean(apparatus)}</h1>
      <p>${clean(action)}</p>
    </header>
    <div class="lab-layout objective-layout ${mission.subject}" data-objective="${objective.key}">
      <div>
        <section class="panel" aria-label="Experiment">
          <div class="viewer objective-viewer" id="objective-viewer">
            <div class="viewer-top">
              <span class="viewer-tag">${icon('cube')} Interactive workbench</span>
              <button class="icon-btn" id="objective-reset" aria-label="Reset camera" title="Reset camera">${icon('reset')}</button>
            </div>
            <p class="viewer-message" id="objective-model-message">Loading apparatus…</p>
            <span class="viewer-bottom" id="objective-viewer-tip">Drag the marked handle · Drag empty space to orbit</span>
          </div>
          <div class="objective-controls">
            <div class="objective-setup-picker">
              <label for="objective-setup">Test setup</label>
              <select class="objective-select" id="objective-setup">
                ${order.map(index => `<option value="${index}">${clean(cases[index].condition)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="apparatus-control">
            <label for="apparatus-position"><span id="apparatus-label">Sample carriage</span><output id="apparatus-value" for="apparatus-position"></output></label>
            <input id="apparatus-position" type="range" min="0" max="100" step="1" aria-describedby="apparatus-instructions">
            <div class="apparatus-scale"><span>Start</span><span>Reference mark</span></div>
            <p id="apparatus-instructions"></p>
          </div>
          <div class="apparatus-result">
            <div id="apparatus-live" class="apparatus-live" hidden><span class="data-label">Live instrument</span><output id="apparatus-reading" for="apparatus-position objective-setup"></output></div>
            <button type="button" class="button primary" id="run-objective">${icon('play')} Run trial</button>
          </div>
          <p id="apparatus-feedback" class="apparatus-feedback" role="status"></p>
          <div class="objective-reading" id="objective-reading" aria-live="polite"></div>
        </section>
        <details class="panel panel-body context-panel objective-standard">
          <summary>Syllabus objective ${number} · ${tier}</summary>
          <p>${clean(description)}</p>
        </details>
      </div>
      <aside class="lab-sidebar" aria-label="Field notebook">
        <section class="panel panel-body">
          <div class="panel-heading">${icon('chart')}<h2>Evidence log</h2></div>
          <p id="objective-instructions">${answer.length > 1 ? `Select the ${answer.length} observations` : 'Select the observation'} that support${answer.length === 1 ? 's' : ''} your decision after comparing at least two setups.</p>
          <fieldset class="objective-evidence" aria-describedby="objective-instructions">
            <legend class="sr-only">Recorded observations</legend>
            <div id="objective-trials"></div>
          </fieldset>
          <div class="button-row"><button type="button" class="button" id="submit-evidence">${icon('flag')} Submit evidence</button></div>
          <div id="objective-feedback" aria-live="polite"></div>
        </section>
        <nav class="objective-nav panel panel-body" aria-label="More objective experiments">
          ${previous ? `<a class="small-link" href="${objectiveHref(mission.id, previous[0])}">Previous objective</a>` : ''}
          <a class="small-link" href="#lab/${mission.id}/objectives">Assignment objectives</a>
          ${next ? `<a class="small-link" href="${objectiveHref(mission.id, next[0])}">Next objective</a>` : ''}
        </nav>
      </aside>
    </div>`;

  const find = id => main.querySelector('#' + id);
  const viewer = find('objective-viewer');
  const message = find('objective-model-message');
  const tip = find('objective-viewer-tip');
  const reset = find('objective-reset');
  const picker = find('objective-setup');
  const reading = find('objective-reading');
  const positionControl = find('apparatus-position');
  const apparatusValue = find('apparatus-value');
  const apparatusReading = find('apparatus-reading');
  const apparatusFeedback = find('apparatus-feedback');
  const log = find('objective-trials');
  const run = find('run-objective');
  const submit = find('submit-evidence');
  const feedback = find('objective-feedback');
  picker.value = String(active);

  function displayReading(recorded) {
    reading.innerHTML = recorded
      ? `<span class="data-label">Recorded observation</span><strong>${clean(cases[active].observation)}</strong>`
      : '<span class="data-label">Recorded observation</span><p>Set the apparatus to the reference mark, then run the trial.</p>';
  }

  function displayLog() {
    log.innerHTML = progress.runs.length ? progress.runs.map(index => `
      <label class="evidence-choice ${progress.done && answer.includes(index) ? 'confirmed-evidence' : ''}">
        <input type="${answer.length === 1 ? 'radio' : 'checkbox'}" name="evidence" value="${index}"
          ${evidence.has(index) ? 'checked' : ''} ${progress.done ? 'disabled' : ''}>
        <span><strong>${clean(cases[index].condition)}</strong><span>${clean(cases[index].observation)}</span></span>
      </label>`).join('') : '<p class="empty">Your observations will appear here after you run a trial.</p>';
  }

  function displayComplete() {
    submit.disabled = true;
    feedback.innerHTML = `<div class="feedback objective-complete"><strong>Objective complete · ${objectiveXp} XP</strong><p>${clean(insight)}</p></div>`;
  }

  function adjustApparatus(value) {
    positionValue = apparatusPosition(value);
    positionControl.value = String(Math.round(positionValue * 100));
    const setting = equipment.format?.(positionValue, active) ?? `${positionControl.value}%`;
    apparatusValue.value = setting;
    positionControl.setAttribute('aria-valuetext', setting);
    apparatusFeedback.textContent = '';
    viewer.dataset.apparatusReady = String(atReferenceMark(positionValue));
    const observation = liveReading(objective, active, positionValue);
    find('apparatus-live').hidden = !observation;
    apparatusReading.value = observation ?? '';
    scene?.adjust(positionValue);
  }

  function selectSetup(index) {
    if (!cases[index]) return;
    active = index;
    picker.value = String(index);
    const recorded = progress.runs.includes(index);
    scene?.select(index, recorded);
    adjustApparatus(recorded ? referenceMark : 0);
    displayReading(recorded);
  }

  picker.addEventListener('change', () => selectSetup(Number(picker.value)));
  positionControl.addEventListener('input', () => adjustApparatus(Number(positionControl.value) / 100));

  run.addEventListener('click', () => {
    if (!atReferenceMark(positionValue)) {
      apparatusFeedback.textContent = 'Bring the apparatus to the reference mark to record this setup.';
      return;
    }
    progress = recordObjective(objective, progress, active);
    scene?.select(active, true);
    onProgress(progress);
    displayReading(true);
    displayLog();
  });

  log.addEventListener('change', () => {
    evidence = new Set([...log.querySelectorAll('input:checked')].map(input => Number(input.value)));
    feedback.replaceChildren();
  });

  submit.addEventListener('click', () => {
    const result = checkEvidence(objective, progress, [...evidence]);
    if (result !== 'complete') {
      feedback.innerHTML = `<p class="feedback error">${messages[result]}</p>`;
      return;
    }
    progress = { ...progress, done: true };
    onProgress(progress, true);
    displayLog();
    displayComplete();
  });

  reset.addEventListener('click', () => scene?.resetCamera());
  find('apparatus-instructions').textContent = equipment.hint;
  adjustApparatus(positionValue);
  displayReading(progress.runs.includes(active));
  displayLog();
  if (progress.done) displayComplete();

  import('./objective-scene.js').then(({ createObjectiveScene, objectiveSimulationControl, objectiveLiveReading }) => {
    if (!isCurrent()) return;
    equipment = objectiveSimulationControl(objective);
    liveReading = objectiveLiveReading;
    find('apparatus-label').textContent = equipment.label;
    find('apparatus-instructions').textContent = equipment.hint ?? 'Move the control to the reference mark to record the selected setup.';
    adjustApparatus(positionValue);
    scene = createObjectiveScene(viewer, objective, motionReduced, {
      onSelect: selectSetup, onAdjust: adjustApparatus
    });
    scene.select(active, progress.runs.includes(active));
    scene.adjust(positionValue);
    message.hidden = true;
  }).catch(() => {
    if (!isCurrent()) return;
    viewer.dataset.sceneState = 'unavailable';
    message.textContent = 'The model needs WebGL 2. You can still run the setups and compare their recorded observations.';
    reset.hidden = true;
    tip.hidden = true;
  });

  return () => scene?.dispose();
}
