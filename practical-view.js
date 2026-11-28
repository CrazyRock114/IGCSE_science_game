import { subjects } from './game.js';
import { clean } from './html.js';
import { icon } from './icons.js';
import { objectiveHref } from './objective-game.js';
import { applyPracticalDraft, legacyTitrationSnapshot, practicalDraftChanges } from './progress-store.js';
import { motionPractical } from './practical-motion.js';
import { photosynthesisPractical } from './practical-photosynthesis.js';
import { titrationPractical } from './practical-titration.js';

export const practicals = new Map([
  ['B6.1/4', photosynthesisPractical],
  ['P1.2/6', motionPractical],
  ['P1.2/7', motionPractical],
  ['C12.2/1', titrationPractical],
  ['C12.2/2', titrationPractical]
]);

export function showPractical(main, objective, saved, practical, { onProgress, isCurrent, motionReduced }) {
  const { mission, number, tier, apparatus, description } = objective;
  const subject = subjects.find(entry => entry.id === mission.subject);
  const index = mission.objectives.findIndex(([id]) => id === number);
  const previous = mission.objectives[index - 1];
  const next = mission.objectives[index + 1];
  const drafts = {};
  const titrationProtocol = practical === titrationPractical;
  let storedDraft;
  let mode = saved?.practical?.mode === 'independent' ? 'independent' : 'guided';
  let done = Boolean(saved?.done);
  let scene;
  let adjust;
  let currentDraft;
  let presentation = { index: 0, position: 0, recorded: false };

  main.innerHTML = `
    <a class="back-link" href="#lab/${mission.id}/objectives">${icon('back')} ${clean(mission.quest)}</a>
    <header class="page-intro lab-heading objective-heading ${mission.subject}">
      <div class="lab-meta">
        <span class="eyebrow">${mission.id} · Objective ${number} · ${subject.name}</span>
        <span class="tier ${tier === 'Supplement' ? 'supplement' : ''}">${tier}</span>
        <span class="location">${icon('pin')}${clean(mission.location)}</span>
      </div>
      <h1>${clean(apparatus)}</h1>
    </header>
    <div class="lab-layout objective-layout practical-layout ${mission.subject}" data-objective="${objective.key}">
      <div class="practical-bench">
        <section class="panel" aria-label="3D workbench">
          <div class="viewer objective-viewer" id="objective-viewer">
            <div class="viewer-top">
              <span class="viewer-tag">${icon('cube')} Interactive workbench</span>
              <button class="icon-btn" id="objective-reset" aria-label="Reset camera" title="Reset camera">${icon('reset')}</button>
            </div>
            <p class="viewer-message" id="objective-model-message">Loading apparatus…</p>
            <span class="viewer-bottom" id="objective-viewer-tip"></span>
          </div>
        </section>
        <details class="panel panel-body context-panel objective-standard">
          <summary>Syllabus objective ${number} · ${tier}</summary>
          <p>${clean(description)}</p>
        </details>
      </div>
      <div class="practical-workflow">
        <section class="panel panel-body practical-controls" aria-label="Practice mode">
          <label for="practical-mode">Practice mode</label>
          <select id="practical-mode" class="objective-select">
            <option value="guided">Guided first attempt</option>
            <option value="independent">Independent attempt</option>
          </select>
          <span id="practical-completion" class="practical-status" role="status"></span>
        </section>
        <p class="feedback error" id="practical-conflict" role="status" tabindex="-1" hidden></p>
        <div id="practical-activity"></div>
        <nav class="objective-nav panel panel-body" aria-label="More objective experiments">
          ${previous ? `<a class="small-link" href="${objectiveHref(mission.id, previous[0])}">Previous objective</a>` : ''}
          <a class="small-link" href="#lab/${mission.id}/objectives">Assignment objectives</a>
          ${next ? `<a class="small-link" href="${objectiveHref(mission.id, next[0])}">Next objective</a>` : ''}
        </nav>
      </div>
    </div>`;

  const viewer = main.querySelector('#objective-viewer');
  const message = main.querySelector('#objective-model-message');
  const reset = main.querySelector('#objective-reset');
  const tip = main.querySelector('#objective-viewer-tip');
  const picker = main.querySelector('#practical-mode');
  const completion = main.querySelector('#practical-completion');
  const conflict = main.querySelector('#practical-conflict');
  const activity = main.querySelector('#practical-activity');

  const workbench = {
    present({ index = 0, recorded = false, condition, observation, settings, position = 0 } = {}) {
      presentation = { index, recorded, condition, observation, settings, position };
      scene?.present(presentation);
    },
    onAdjust(callback) {
      adjust = callback;
    }
  };

  function restore(progress) {
    storedDraft = progress?.practical?.drafts?.[mode];
    const draft = applyPracticalDraft(practical.createState(objective), storedDraft ?? {});
    return practical.restoreState?.(draft, objective, mode === 'guided') ?? draft;
  }

  function draw() {
    adjust = null;
    currentDraft = drafts[mode] ?? restore(saved);
    practical.render(activity, { objective, state: currentDraft, guided: mode === 'guided', update, scene: workbench });
    tip.textContent = adjust ? 'Drag the marked handle · Drag empty space to orbit' : 'Drag to orbit';
  }

  function update(draft, { complete = false, focus = null, redraw = true, trialIndex = null, checkTrials = false } = {}) {
    const credited = complete && !done;
    const changes = practicalDraftChanges(currentDraft, draft);
    const guarded = trialIndex !== null || checkTrials;
    const practicalProgress = { mode, draft: changes, ...(titrationProtocol ? { titrationProtocol } : {}) };
    let adoptsLegacyRuns = false;
    if (guarded) {
      const indices = checkTrials ? Object.keys(currentDraft.runs) : [trialIndex];
      practicalProgress.expectedRuns = Object.fromEntries(indices.map(index => [index,
        currentDraft.runs[index].revision ?? legacyTitrationSnapshot(storedDraft, index)]));
      if (checkTrials) {
        Object.assign(changes, { mean: draft.mean, feedback: draft.feedback });
        if (complete) {
          const legacyRuns = Object.entries(draft.runs).filter(([, run]) => !run.revision);
          adoptsLegacyRuns = legacyRuns.length > 0;
          if (adoptsLegacyRuns) practicalProgress.adoptRuns = Object.fromEntries(legacyRuns);
        }
      }
      if (trialIndex !== null) {
        delete changes.runs;
        changes.feedback = null;
        changes.active = draft.active;
        practicalProgress.replaceRun = { index: trialIndex, run: draft.runs[trialIndex] };
      }
    }
    let outcome;
    if (guarded || credited || Object.keys(changes).length) {
      outcome = onProgress({ done: done || complete, practical: practicalProgress }, credited);
    }
    const rejected = outcome?.accepted === false;
    done = outcome ? Boolean(outcome.progress?.done) : done || complete;
    if (guarded && (redraw || rejected || adoptsLegacyRuns)) draft = { ...restore(outcome.progress), active: draft.active };
    else if (trialIndex !== null) {
      // Typing keeps the form mounted. Update only the trial visible to this edit
      // so grading cannot silently pick up unseen changes to other trials.
      const savedRun = outcome.progress.practical.drafts[mode].runs[trialIndex];
      draft = { ...draft, runs: { ...draft.runs, [trialIndex]: savedRun } };
    }
    drafts[mode] = currentDraft = draft;
    if (done) completion.textContent = 'Objective complete';
    conflict.hidden = !rejected;
    if (rejected) conflict.textContent = 'This trial changed in another tab. The latest saved state is shown. Check the trial before trying again.';
    if (redraw || rejected) {
      const target = focus ?? document.activeElement?.id;
      draw();
      if (rejected) conflict.focus();
      else if (target) document.getElementById(target)?.focus({ preventScroll: !focus });
    }
    return { draft: currentDraft, accepted: !rejected };
  }

  picker.value = mode;
  if (done) completion.textContent = 'Objective complete';
  picker.addEventListener('change', () => {
    mode = picker.value;
    const outcome = onProgress({ done, practical: { mode, ...(titrationProtocol ? { titrationProtocol } : {}) } });
    if (practical.restoreState && outcome) drafts[mode] = restore(outcome.progress);
    conflict.hidden = true;
    draw();
  });
  reset.addEventListener('click', () => scene?.resetCamera());
  draw();

  import('./objective-scene.js').then(({ createObjectiveScene }) => {
    if (!isCurrent()) return;
    scene = createObjectiveScene(viewer, objective, motionReduced, {
      presentation, canAdjust: () => Boolean(adjust), onAdjust: value => adjust?.(value)
    });
    message.hidden = true;
  }).catch(() => {
    if (!isCurrent()) return;
    viewer.dataset.sceneState = 'unavailable';
    message.textContent = 'The 3D workbench needs WebGL 2. All observations and controls are available below or beside the workbench.';
    reset.hidden = true;
    tip.hidden = true;
  });

  return () => scene?.dispose();
}
