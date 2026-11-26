import { missions as all, objectiveCatalog } from './objective-catalog.js';
import { getObjective, objectiveHref, objectiveXp } from './objective-game.js';
import { showObjective } from './objective-view.js';
import { clean } from './html.js';
import { icon } from './icons.js';
import { capstoneIds, capstoneQuestions, featuredId, fieldSkills, getMission, hasComparison, investigations, matches, sampleAt, subjects, syllabus } from './game.js';

const main = document.querySelector('#main');
const navigation = document.querySelector('#navigation');
const tools = document.querySelector('#header-tools');
const settings = document.querySelector('#settings');
const storeKey = 'fieldwork-expedition-v1';
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let store = loadStore();
let disposeScene;
let routeToken = 0;
let audioContext;

function loadStore() {
  const empty = { trials: {}, done: {}, prefs: {}, objectiveProgress: {}, capstone: false, last: null, lastObjective: null };
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return { ...empty, ...saved, trials: saved?.trials ?? {}, done: saved?.done ?? {}, prefs: saved?.prefs ?? {}, objectiveProgress: saved?.objectiveProgress ?? {} };
  } catch {
    return empty;
  }
}

function save() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(store));
  } catch {
    announce('Browser storage is unavailable. Progress is kept for this session.');
  }
}

function announce(message) {
  document.querySelector('#announcer').textContent = message;
}

function sName(id) {
  return subjects.find(subject => subject.id === id)?.name ?? '';
}

function stat() {
  const count = all.filter(mission => store.done[mission.id]).length;
  const completedObjectives = [...objectiveCatalog.keys()].filter(key => store.objectiveProgress[key]?.done).length;
  const earned = count * 100 + completedObjectives * objectiveXp;
  return { count, completedObjectives, xp: earned + (store.capstone ? 300 : 0),
    rank: earned >= 1200 ? 'Field Scientist' : earned >= 300 ? 'Investigator' : 'Cadet' };
}

function xpSound() {
  if (!store.prefs.sound) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    [440, 587.33, 739.99].forEach((frequency, index) => {
      const tone = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const start = audioContext.currentTime + index * 0.076;
      tone.type = 'sine';
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(.085, start + .015);
      volume.gain.exponentialRampToValueAtTime(.0005, start + .24);
      tone.connect(volume).connect(audioContext.destination);
      tone.start(start);
      tone.stop(start + .25);
    });
  } catch {
    // Sound is optional and depends on the browser's audio support.
  }
}

function header(page) {
  const tabs = [
    ['expedition', 'Expedition', 'compass'], ['missions', 'Missions', 'target'],
    ['journal', 'Journal', 'book'], ['connections', 'Connections', 'network']
  ];
  const current = page === 'lab' || page === 'objective' ? 'missions' : page;
  navigation.innerHTML = tabs.map(([id, title, symbol]) => `<a href="#${id}" ${current === id ? 'aria-current="page"' : ''}>${icon(symbol)}${title}</a>`).join('');
  updateRank();
  if (!tools.querySelector('#open-settings')) {
    tools.insertAdjacentHTML('beforeend', `<button class="icon-btn" id="open-settings" type="button" aria-label="Settings" title="Settings">${icon('settings')}</button>`);
    tools.querySelector('#open-settings').addEventListener('click', openSettings);
  }
}

function updateRank() {
  const { rank, xp } = stat();
  const text = `${icon('bolt')}${rank}<span>${number.format(xp)} XP</span>`;
  if (tools.querySelector('.rank')) tools.querySelector('.rank').innerHTML = text;
  else tools.insertAdjacentHTML('afterbegin', `<div class="rank">${text}</div>`);
}

function openSettings() {
  settings.innerHTML = `<form method="dialog">
    <div class="settings-heading"><h2 id="settings-heading">Settings</h2>
      <button class="icon-btn" value="close" aria-label="Close settings">${icon('close')}</button>
    </div>
    <label class="settings-option"><span>Sound effects<small>Play a chime when you complete a mission.</small></span>
      <input type="checkbox" name="sound" ${store.prefs.sound ? 'checked' : ''}></label>
    <label class="settings-option"><span>Reduce motion<small>Pause automatic motion in 3D models.</small></span>
      <input type="checkbox" name="motion" ${motionReduced() ? 'checked' : ''}></label>
  </form>`;
  settings.querySelector('form').addEventListener('change', event => {
    store.prefs[event.target.name] = event.target.checked;
    save();
  });
  settings.showModal();
}

function motionReduced() {
  return store.prefs.motion ?? systemMotion.matches;
}

function expedition() {
  const next = all.find(mission => mission.id === store.last && !store.done[mission.id])
    ?? all.find(mission => mission.id === featuredId && !store.done[mission.id])
    ?? all.find(mission => !store.done[mission.id])
    ?? all[0];
  const progress = stat().count;
  main.innerHTML = `
    <section class="hero" aria-labelledby="expedition-title">
      <div class="hero-copy">
        <div class="eyebrow hero-tag"><span class="status-dot"></span> Cambridge IGCSE 0654</div>
        <h1 id="expedition-title">The world is<br>your <em>laboratory.</em></h1>
        <p>Investigate a living valley. Solve problems in biology, chemistry and physics with ${objectiveCatalog.size} interactive 3D investigations.</p>
        <div class="hero-actions">
          <a class="button primary" href="#lab/${next.id}">${icon('play')}${progress || store.last ? 'Continue Expedition' : 'Begin Expedition'}</a>
          <a class="button" href="#missions">${icon('compass')} Mission Map</a>
        </div>
      </div>
      <span class="hero-location">${icon('pin')} Meridian Valley Research Station</span>
    </section>
    <section class="section" aria-labelledby="sector-title">
      <div class="section-head">
        <div><h2 id="sector-title">Explore the sectors</h2><p>Choose a discipline and take a field assignment.</p></div>
        <a class="small-link" href="#missions">${icon('target')} All missions</a>
      </div>
      <div class="sector-grid">${subjects.map(sectorCard).join('')}</div>
    </section>
    <section class="section dispatch" aria-labelledby="dispatch-title">
      <div class="dispatch-main">
        <span class="tile-icon">${icon('target')}</span>
        <div><div class="eyebrow">${progress ? 'Continue in the field' : 'Recommended first mission'}</div><h2 id="dispatch-title">${clean(next.quest)}</h2>
          <p>${clean(next.location)} · ${clean(next.title)} · 100 XP</p></div>
      </div>
      <div class="button-row dispatch-actions">
        <a class="button" href="#lab/${next.id}">Open mission</a>
        ${store.lastObjective && objectiveCatalog.has(store.lastObjective) ? `<a class="button" href="#objective/${store.lastObjective}">Resume objective</a>` : ''}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>One valley, connected systems</h2><p>Bring evidence from all three sectors to the reservoir recovery mission.</p></div>
        <a class="small-link" href="#connections">${icon('network')} Connections</a></div>
    </section>`;
}

function sectorCard(subject) {
  const group = all.filter(mission => mission.subject === subject.id);
  const count = group.filter(mission => store.done[mission.id]).length;
  return `<a class="sector ${subject.id}" href="#missions/${subject.id}">
    <div class="sector-art">
      <div><div class="eyebrow">${subject.site}</div><h3>${subject.name}</h3></div>
      <span class="tile-icon">${icon(subject.icon)}</span>
    </div>
    <div class="sector-body"><p>${subject.copy}</p>
      <div class="sector-progress"><progress max="${group.length}" value="${count}" aria-label="${subject.name} mission progress"></progress><span>${count} / ${group.length} missions</span></div>
    </div>
  </a>`;
}

function intro(label, title, description) {
  return `<div class="page-intro"><span class="eyebrow">${label}</span><h1>${title}</h1><p>${description}</p></div>`;
}

function missionCard(mission, mini = false) {
  return `<a class="mission-card ${mission.subject}" href="#lab/${mission.id}">
    <span class="code">${mission.id} · ${sName(mission.subject)} ${store.done[mission.id] ? '· Complete' : ''}</span>
    <${mini ? 'h3' : 'h2'}>${clean(mission.quest)}</${mini ? 'h3' : 'h2'}>
    <p>${clean(mission.title)}</p><span class="location">${icon('pin')}${clean(mission.location)}</span>
  </a>`;
}

function catalog(page, initial) {
  const isJournal = page === 'journal';
  const initialSubject = subjects.some(subject => subject.id === initial) ? initial : 'all';
  const { count, xp, completedObjectives } = stat();
  main.innerHTML = isJournal
    ? intro('Cambridge IGCSE 0654', 'Field journal', 'Find a Core or Supplement objective, run its experiment and track your evidence.') + `
      <div class="journal-metrics">
        <div class="score"><span>Missions complete</span><strong>${count} / ${all.length}</strong></div>
        <div class="score"><span>Objectives complete</span><strong>${completedObjectives} / ${objectiveCatalog.size}</strong></div>
        <div class="score"><span>Total experience</span><strong>${number.format(xp)} XP</strong></div>
      </div>
      <details class="panel panel-body section">
        <summary>Experimental skills · AO3</summary>
        <ul class="objective-list">${fieldSkills.map(skill => `<li>${icon('check')}<span>${skill}</span></li>`).join('')}</ul>
        <p class="muted">Record and compare trials in each experiment. The journal tracks your missions and objective experiments separately.</p>
      </details>`
    : intro('Field assignments', 'Mission map', 'Follow an assignment, test a variable and submit a conclusion. Each mission links to other places where the same science matters.');
  main.insertAdjacentHTML('beforeend', `
    <div class="filterbar">
      <div class="chips" aria-label="Filter by subject">
        <button type="button" class="chip" data-filter="all" aria-pressed="${initialSubject === 'all'}">All subjects</button>
        ${subjects.map(subject => `<button type="button" class="chip" data-filter="${subject.id}" aria-pressed="${initialSubject === subject.id}">${subject.name}</button>`).join('')}
      </div>
      <label class="search">${icon('search')}<span class="sr-only">Search ${isJournal ? 'objectives' : 'missions'}</span><input type="search" maxlength="100" placeholder="Search ${isJournal ? 'objectives' : 'missions'}"></label>
    </div>
    <div class="list-count" aria-live="polite"></div>
    <div class="${isJournal ? 'journal-list' : 'mission-list'}" id="catalog-results"></div>
    ${isJournal ? `<p class="section"><a class="small-link" href="${syllabus}" target="_blank" rel="noopener">Official Cambridge 0654 syllabus · 2025–2027</a></p>` : ''}`);
  const input = main.querySelector('input[type=search]');
  const results = main.querySelector('#catalog-results');
  let filter = initialSubject;
  const refresh = () => {
    const query = input.value.trim();
    const candidates = all.filter(mission => filter === 'all' || mission.subject === filter);
    const group = isJournal
      ? candidates.flatMap(mission => {
        const objectives = mission.objectives.filter(([number]) => objectiveMatches(getObjective(objectiveCatalog, mission.id, number), query));
        return objectives.length ? [{ mission, objectives }] : [];
      })
      : candidates.filter(mission => matches(mission, query)).map(mission => ({ mission }));
    const listed = isJournal ? group.reduce((total, entry) => total + entry.objectives.length, 0) : group.length;
    const noun = isJournal ? 'objective experiment' : 'mission';
    main.querySelector('.list-count').textContent = `${listed} ${noun}${listed === 1 ? '' : 's'}`;
    results.innerHTML = group.length
      ? group.map(({ mission, objectives }) => isJournal ? journalEntry(mission, objectives, Boolean(query)) : missionCard(mission)).join('')
      : `<p class="empty">No matching ${isJournal ? 'objective experiments' : 'missions'}. Try a syllabus code or another search term.</p>`;
  };
  main.querySelector('.chips').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    history.replaceState(null, '', `#${page}${filter === 'all' ? '' : '/' + filter}`);
    main.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', item === button));
    refresh();
  });
  input.addEventListener('input', refresh);
  refresh();
}

function objectiveMatches(objective, query) {
  const { mission, apparatus, action, description, key, tier } = objective;
  const text = [key, mission.quest, mission.location, mission.title, apparatus, action, description, tier].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).every(word => text.includes(word));
}

function objectiveList(mission, entries = mission.objectives) {
  return `<ol class="objective-list objective-launch-list">${entries.map(([number, tier, description]) => {
    const entry = getObjective(objectiveCatalog, mission.id, number);
    const done = store.objectiveProgress[entry.key]?.done;
    return `<li><a class="objective-launch" href="${objectiveHref(mission.id, number)}">
      <div class="objective-tags"><code>${mission.id} · ${clean(number)}</code><span class="tier ${tier === 'Supplement' ? 'supplement' : ''}">${clean(tier)}</span></div>
      <div class="objective-launch-copy"><strong>${clean(entry.apparatus)}</strong><p>${clean(description)}</p></div>
      <span class="objective-launch-icon">${icon(done ? 'check' : 'play')}<span>${done ? 'Complete' : 'Open lab'}</span></span>
    </a></li>`;
  }).join('')}</ol>`;
}

function journalEntry(mission, objectives, open) {
  const complete = objectives.filter(([number]) => store.objectiveProgress[`${mission.id}/${number}`]?.done).length;
  return `<details class="journal-entry ${mission.subject}" ${open ? 'open' : ''}>
    <summary><span class="code">${mission.id}</span>${clean(mission.title)} <span class="journal-completion">${complete} / ${objectives.length} complete</span></summary>
    <div class="entries">${objectiveList(mission, objectives)}<a class="small-link" href="#lab/${mission.id}">${icon('flask')} Open main field mission</a></div>
  </details>`;
}

function related(mission) {
  return [...new Set([
    ...mission.links.map(id => getMission(all, id)),
    ...all.filter(item => item.links.includes(mission.id))
  ].filter(item => item && item.id !== mission.id))];
}

function connectionContext(mission) {
  const examples = {
    'B6.1': 'Leaves use light energy to build sugars from water and carbon dioxide. The same energy accounting helps explain solar power, and the gas exchange changes the air around the plant.',
    'B19.1': 'Tree roots and vegetated banks protect soil from runoff. Water chemistry helps quantify what reaches the treatment plant, and the pump still needs enough power to keep water moving.',
    'C10.1': 'A filter can trap suspended sediment. The watershed influences the amount arriving at the filter, and electrical energy sets the time a pump can move water through the bed.',
    'P4.2.5': 'Electrical energy sets the pump’s operating time. Filtration and upstream habitat determine the quality of the water moved during that time.'
  };
  return `<div class="panel-body"><h2>Connected experiments</h2>
    ${examples[mission.id] ? `<p class="connection-note">${examples[mission.id]}</p>` : ''}
    <div class="quest-links">${related(mission).map(item => missionCard(item, true)).join('')}</div></div>`;
}

function lab(mission, token, initialContext) {
  if (store.last !== mission.id) {
    store.last = mission.id;
    save();
  }
  const [min, max, initial] = mission.range;
  const trials = store.trials[mission.id] ?? [];
  const step = mission.step ?? (max - min) / 100;
  const solution = mission.challenge;
  let value = trials.at(-1)?.input ?? initial;
  let selected = null;
  let scene;

  main.innerHTML = `
    <a class="back-link" href="#missions/${mission.subject}">${icon('back')} ${sName(mission.subject)} missions</a>
    <div class="page-intro lab-heading ${mission.subject}">
      <div class="lab-meta"><span class="eyebrow">${mission.id} · ${sName(mission.subject)}</span><span class="location">${icon('pin')}${clean(mission.location)}</span></div>
      <h1>${clean(mission.quest)}</h1><p>${clean(mission.brief)}</p>
    </div>
    <div class="lab-layout ${mission.subject}">
      <div>
        <section class="panel" aria-label="Experiment controls">
          <div class="viewer" id="viewer">
            <div class="viewer-top"><span class="viewer-tag">${icon('cube')} 3D Experiment</span><button class="icon-btn" id="reset-view" type="button" aria-label="Reset camera" title="Reset camera">${icon('reset')}</button></div>
            <p class="viewer-message">Loading experiment…</p>
            <span class="viewer-bottom">Drag to rotate · Scroll to zoom</span>
          </div>
          <div class="control-strip">
            <div class="slider-row">
              <label for="condition">${clean(mission.variable)} <output for="condition" id="condition-value"></output></label>
              <input id="condition" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
              <div class="range-ends"><span>${number.format(min)} ${clean(mission.unit)}</span><span>${number.format(max)} ${clean(mission.unit)}</span></div>
            </div>
            <div class="metric"><span class="data-label">${clean(mission.metric)}</span><span class="metric-value" id="metric-value"></span></div>
          </div>
        </section>
        <section class="panel context-panel" aria-label="Mission context">
          <div class="tabs" aria-label="Experiment help">
            <button class="chip" type="button" data-context="briefing" aria-pressed="true">Field briefing</button>
            <button class="chip" type="button" data-context="objectives" aria-pressed="false">Objective experiments</button>
            <button class="chip" type="button" data-context="connections" aria-pressed="false">Connections</button>
          </div>
          <div id="lab-context"></div>
        </section>
      </div>
      <aside class="lab-sidebar" aria-label="Mission evidence">
        <section class="panel panel-body">
          <div class="panel-heading">${icon('chart')}<h2>Field readings</h2></div>
          <p>Record a baseline. Change ${clean(mission.variable.toLowerCase())} and record a second reading to compare the results.</p>
          <div class="button-row"><button class="button primary" id="record" type="button">${icon('target')} Record reading</button></div>
          <div id="readings" aria-live="polite"></div>
        </section>
        <section class="panel panel-body" id="conclusion">
          <div class="panel-heading">${icon('flag')}<h2>Submit your conclusion</h2></div>
          <p>${clean(solution.prompt)}</p>
          <div class="choice-list">${solution.options.map((option, i) => `<button class="choice" data-choice="${i}" type="button" aria-pressed="false">${clean(option)}</button>`).join('')}</div>
          <div class="button-row"><button class="button" id="submit" type="button">Check conclusion</button></div>
          <div id="feedback" aria-live="polite"></div>
        </section>
      </aside>
    </div>`;

  const dom = Object.fromEntries(['viewer', 'condition', 'condition-value', 'metric-value', 'readings', 'submit', 'feedback', 'lab-context'].map(id => [id, main.querySelector('#' + id)]));
  const conditionValue = () => {
    const measured = sampleAt(mission, value);
    dom['condition-value'].textContent = `${number.format(value)} ${mission.unit}`.trim();
    dom.condition.setAttribute('aria-valuetext', dom['condition-value'].textContent);
    dom['metric-value'].innerHTML = `${number.format(measured)} <small>${clean(mission.metricUnit)}</small>`;
    const low = Math.min(...mission.samples);
    const high = Math.max(...mission.samples);
    scene?.setReading((value - min) / (max - min), high === low ? .5 : (measured - low) / (high - low));
  };

  function updateReadings() {
    if (!trials.length) {
      dom.readings.innerHTML = '<p class="muted">No readings recorded.</p>';
      return;
    }
    const windowed = trials.slice(-6);
    dom.readings.innerHTML = `<table class="trials"><caption class="sr-only">Recorded readings</caption><thead><tr>
      <th scope="col">${clean(mission.variable)}${mission.unit ? ' (' + clean(mission.unit) + ')' : ''}</th>
      <th scope="col">${clean(mission.metric)}${mission.metricUnit ? ' (' + clean(mission.metricUnit) + ')' : ''}</th>
    </tr></thead><tbody>${windowed.map(trial => `<tr><td>${number.format(trial.input)}</td><td>${number.format(trial.output)}</td></tr>`).join('')}</tbody></table>
    ${trials.length > windowed.length ? `<p>Showing the last ${windowed.length} of ${trials.length} readings.</p>` : ''}
    ${hasComparison(trials) ? '<canvas class="chart" height="120" width="420" aria-label="Plot of recorded readings" role="img"></canvas>' : ''}`;
    const chart = dom.readings.querySelector('.chart');
    if (chart) plot(chart, trials, mission, getComputedStyle(main.querySelector('.lab-layout')).getPropertyValue('--accent'));
  }

  const choices = [...main.querySelectorAll('.choice')];
  function feedback(message, error = false) {
    dom.feedback.innerHTML = `<p class="feedback ${error ? 'error' : ''}">${clean(message)}</p>`;
  }
  function done() {
    dom.submit.disabled = true;
    choices.forEach(button => {
      button.disabled = true;
      const correct = Number(button.dataset.choice) === solution.answer;
      button.classList.toggle('correct', correct);
      button.setAttribute('aria-pressed', correct);
    });
    dom.feedback.innerHTML = `<p class="feedback"><strong>Mission complete · 100 XP</strong><br>${clean(solution.explanation)}</p>
      <p><a class="small-link" href="#connections">${icon('network')} Apply your evidence</a></p>`;
  }

  dom.condition.addEventListener('input', () => {
    value = Number(dom.condition.value);
    conditionValue();
  });

  main.querySelector('#record').addEventListener('click', () => {
    if (trials.length >= 100) trials.shift();
    trials.push({ input: value, output: sampleAt(mission, value) });
    store.trials[mission.id] = trials;
    save();
    updateReadings();
  });

  choices.forEach(button => button.addEventListener('click', () => {
    selected = Number(button.dataset.choice);
    choices.forEach(item => {
      item.setAttribute('aria-pressed', item === button);
      item.classList.remove('incorrect');
    });
    dom.feedback.textContent = '';
  }));
  dom.submit.addEventListener('click', () => {
    if (!hasComparison(trials)) {
      feedback('Record readings at two different settings before checking your conclusion.');
      return;
    }
    if (selected === null) {
      feedback('Choose a conclusion based on your evidence.');
      return;
    }
    if (selected !== solution.answer) {
      choices[selected].classList.add('incorrect');
      feedback('Review how the reading changed and check the field briefing before trying again.', true);
      return;
    }
    store.done[mission.id] = true;
    save();
    updateRank();
    done();
    xpSound();
  });

  const context = {
    briefing: `<div class="panel-body"><h2>${clean(mission.title)}</h2><p>${clean(mission.insight)}</p></div>`,
    objectives: `<div class="panel-body"><h2>Objective experiments</h2>${objectiveList(mission)}</div>`,
    connections: connectionContext(mission)
  };
  const tabButtons = [...main.querySelectorAll('[data-context]')];
  const setContext = name => {
    tabButtons.forEach(item => item.setAttribute('aria-pressed', item.dataset.context === name));
    dom['lab-context'].innerHTML = context[name];
  };
  tabButtons.forEach(button => button.addEventListener('click', () => setContext(button.dataset.context)));
  setContext(initialContext === 'objectives' ? 'objectives' : 'briefing');

  conditionValue();
  updateReadings();
  if (store.done[mission.id]) done();

  main.querySelector('#reset-view').addEventListener('click', () => scene?.resetCamera());
  import('./lab-scene.js').then(({ createLabScene }) => {
    if (token !== routeToken) return;
    scene = createLabScene(dom.viewer, mission, motionReduced);
    disposeScene = scene?.dispose;
    dom.viewer.querySelector('.viewer-message').hidden = true;
    conditionValue();
  }).catch(() => {
    if (token !== routeToken) return;
    dom.viewer.querySelector('.viewer-message').textContent = 'The 3D view is unavailable in this browser. You can still adjust the variable and collect readings.';
    main.querySelector('#reset-view').hidden = true;
    dom.viewer.querySelector('.viewer-bottom').hidden = true;
  });
}

function plot(canvas, trials, mission, accent) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width, height = canvas.height;
  const left = 46, right = width - 16, top = 13, bottom = height - 25;
  const [minX, maxX] = mission.range;
  const minY = Math.min(...mission.samples), maxY = Math.max(...mission.samples);
  const x = input => left + (input - minX) / (maxX - minX) * (right - left);
  const y = output => bottom - (output - minY) / (maxY - minY || 1) * (bottom - top);
  context.strokeStyle = '#344657';
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    const mark = bottom - (bottom - top) * (i / 4);
    context.moveTo(left, mark);
    context.lineTo(right, mark);
    context.stroke();
  }
  context.fillStyle = '#b5c5d8';
  context.font = '12px monospace';
  context.fillText(number.format(minX), left, height - 8);
  context.textAlign = 'right';
  context.fillText(number.format(maxX), right, height - 8);
  context.fillText(number.format(maxY), left - 5, top + 4);
  context.fillText(number.format(minY), left - 5, bottom + 4);
  const points = [...trials].sort((a, b) => a.input - b.input);
  context.beginPath();
  points.forEach((trial, index) => {
    if (index === 0) context.moveTo(x(trial.input), y(trial.output));
    else context.lineTo(x(trial.input), y(trial.output));
  });
  context.strokeStyle = accent.trim() || '#7cf0c2';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = context.strokeStyle;
  points.forEach(trial => {
    context.beginPath();
    context.arc(x(trial.input), y(trial.output), 4, 0, Math.PI * 2);
    context.fill();
  });
}

function connections() {
  const complete = capstoneIds.every(id => store.done[id]);
  const essentials = capstoneIds.map(id => getMission(all, id)).filter(Boolean);
  main.innerHTML = intro('Cross-sector operation', 'Connections', 'Translate evidence across subjects to solve a problem that spans the entire valley.') + `
    <section class="panel capstone">
      <div class="eyebrow">Valley recovery · Capstone</div>
      <h2>Restore the reservoir</h2>
      <p>After heavy rain, muddy water is reaching the valley’s intake. Prepare an action plan that reduces sediment upstream, treats it at the waterworks and keeps the pump running from backup power.</p>
      <div class="capstone-evidence">${essentials.map(mission => `<a href="#lab/${mission.id}" class="${mission.subject}">
        <small>${sName(mission.subject)} · ${store.done[mission.id] ? 'Evidence ready' : 'Evidence needed'}</small>${clean(mission.quest)}
      </a>`).join('')}</div>
      ${complete ? `<div class="button-row"><a href="#capstone" class="button primary">${icon('flag')}${store.capstone ? 'Review recovery plan' : 'Build the recovery plan'}</a>
        ${store.capstone ? '<span class="step-result">Capstone complete · 300 XP</span>' : ''}</div>`
        : '<div class="button-row"><span class="rank">Complete the three evidence missions to unlock the recovery plan.</span></div>'}
    </section>
    <section class="section" aria-labelledby="routes-title">
      <div class="section-head"><h2 id="routes-title">Connected investigations</h2></div>
      <div class="investigation-list">${investigations.map(route => `<article class="panel panel-body">
        <div class="panel-heading">${icon('network')}<h3>${route.name}</h3></div>
        <p>${route.intro}</p>
        <div class="quest-links">${route.missions.map(id => missionCard(getMission(all, id), true)).join('')}</div>
      </article>`).join('')}</div>
    </section>`;
}

function evidenceSummary(id) {
  const mission = getMission(all, id);
  const trials = store.trials[id] ?? [];
  const sorted = [...trials].sort((a, b) => a.input - b.input);
  const endpoints = sorted.length > 1 ? [sorted[0], sorted.at(-1)] : sorted;
  const readings = endpoints.map(trial => `<li>${number.format(trial.input)} ${clean(mission.unit)} produced ${number.format(trial.output)} ${clean(mission.metricUnit)}</li>`);
  return `<details class="evidence-note"><summary>Your field readings · ${clean(mission.quest)}</summary>
    <ul>${readings.join('')}</ul><a class="small-link" href="#lab/${id}">Open the full field record</a>
  </details>`;
}

function capstone() {
  if (!capstoneIds.every(id => store.done[id])) {
    location.replace('#connections');
    return;
  }
  main.innerHTML = `<a class="back-link" href="#connections">${icon('back')} Connections</a>` +
    intro('Valley recovery · Capstone', 'Restore the reservoir', 'Combine your field evidence to recommend a recovery plan for the valley.') + `
    <form class="lab-sidebar" id="recovery">
      ${capstoneQuestions.map((question, i) => `<fieldset class="panel panel-body ${question.subject}">
        <legend>${question.name}</legend><p>${question.prompt}</p>
        ${evidenceSummary(capstoneIds[i])}
        <div class="choice-list">${question.options.map((option, index) => `<label class="choice">
          <input type="radio" name="q${i}" value="${index}" ${store.capstone && index === question.answer ? 'checked' : ''} required> ${option}</label>`).join('')}</div>
      </fieldset>`).join('')}
      <div class="button-row"><button class="button primary" type="submit">${icon('flag')} Submit recovery plan</button></div>
      <div id="recovery-feedback" aria-live="polite">${store.capstone ? '<p class="feedback">Recovery plan approved · 300 XP earned.</p>' : ''}</div>
    </form>`;
  const form = main.querySelector('#recovery');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const choices = new FormData(form);
    const missed = capstoneQuestions.filter((question, i) => Number(choices.get('q' + i)) !== question.answer);
    const response = main.querySelector('#recovery-feedback');
    if (missed.length) {
      response.innerHTML = `<p class="feedback error">Review your evidence for ${missed.map(question => question.name.toLowerCase()).join(', ')} and try again.</p>`;
      return;
    }
    if (!store.capstone) {
      store.capstone = true;
      save();
      updateRank();
      xpSound();
    }
    response.innerHTML = '<p class="feedback"><strong>Recovery plan approved · 300 XP</strong><br>Replanting the banks limits erosion, the filter reduces suspended solids, and adding 0.25 kWh gives the pump the 1.00 kWh it needs for the shift.</p>';
  });
}

function render() {
  const [requested, argument, part] = location.hash.slice(1).split('/');
  const page = ['expedition', 'missions', 'journal', 'connections', 'lab', 'capstone', 'objective'].includes(requested)
    ? requested : 'expedition';
  disposeScene?.();
  disposeScene = null;
  const token = ++routeToken;
  header(page === 'capstone' ? 'connections' : page);
  if (page === 'objective') {
    const objective = getObjective(objectiveCatalog, argument, part);
    if (objective) {
      disposeScene = showObjective(main, objective, store.objectiveProgress[objective.key], {
        isCurrent: () => token === routeToken,
        motionReduced,
        onProgress(progress, completed) {
          store.objectiveProgress[objective.key] = progress;
          store.lastObjective = objective.key;
          save();
          if (completed) {
            updateRank();
            xpSound();
          }
        }
      });
    } else {
      main.innerHTML = intro('Field journal', 'Objective not found', '<a class="small-link" href="#journal">Return to the field journal</a>');
    }
  } else if (page === 'lab') {
    const mission = getMission(all, argument ?? '');
    if (mission) lab(mission, token, part);
    else main.innerHTML = intro('Field assignments', 'Mission not found', '<a class="small-link" href="#missions">Return to the mission map</a>');
  } else if (page === 'missions' || page === 'journal') {
    catalog(page, argument);
  } else if (page === 'connections') {
    connections();
  } else if (page === 'capstone') {
    capstone();
  } else {
    expedition();
  }
  if (token > 1) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', render);
render();
