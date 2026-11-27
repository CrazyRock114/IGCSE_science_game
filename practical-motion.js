import { clean } from './html.js';

const tolerance = 0.01;
const pointIds = ['A', 'B', 'C', 'D', 'E'];
const units = ['m', 'm/s', 'm/s²', 's/m', 's'];
const distanceUnits = ['m', 'm/s', 'm²', 's'];
const profiles = {
  6: { duration: 4, ordinate: 'distance', axis: 'Distance (m)', unit: 'm', gradientUnit: 'm/s' },
  7: { duration: 8, ordinate: 'speed', axis: 'Speed (m/s)', unit: 'm/s', gradientUnit: 'm/s²' }
};

export function motionSample(number, position, guided) {
  const time = profiles[number].duration * position;
  if (Number(number) === 6) {
    const speed = guided ? 2.5 : 1.75;
    return { time, distance: (guided ? 2 : 1) + speed * time, speed };
  }
  const acceleration = guided ? 0.5 : 0.75;
  return { time, speed: acceleration * time, distance: 0.5 * acceleration * time ** 2, acceleration };
}

export function motionPoints(number, guided) {
  const profile = profiles[number];
  return pointIds.map((id, index) => {
    const position = index / (pointIds.length - 1);
    const sample = motionSample(number, position, guided);
    return { id, position, time: sample.time, value: sample[profile.ordinate] };
  });
}

function selectedPoints(points, draft) {
  const first = points.find(point => point.id === draft.pointA);
  const second = points.find(point => point.id === draft.pointB);
  return [first, second];
}

function enteredNumber(value) {
  return String(value ?? '').trim() !== '' && Number.isFinite(Number(value));
}

function agrees(value, expected) {
  return Math.abs(Number(value) - expected) <= tolerance + 1e-10;
}

export function gradeMotion(number, guided, draft) {
  const [first, second] = selectedPoints(motionPoints(number, guided), draft);
  if (!first || !second) return { code: 'points' };
  if (first.time === second.time) return { code: 'same-time' };
  const hasArea = Number(number) === 7;
  if (!enteredNumber(draft.gradient) || !draft.gradientUnit ||
    (hasArea && (!enteredNumber(draft.distance) || !draft.distanceUnit))) return { code: 'incomplete' };

  const [start, end] = first.time < second.time ? [first, second] : [second, first];
  const duration = end.time - start.time;
  const gradient = (end.value - start.value) / duration;
  const distance = hasArea ? (start.value + end.value) / 2 * duration : null;
  const expected = { start, end, gradient, distance, unit: profiles[number].gradientUnit };
  if (draft.gradientUnit !== expected.unit) return { code: 'gradient-unit', expected };
  if (!agrees(draft.gradient, gradient)) return { code: 'gradient-number', expected };
  if (hasArea && draft.distanceUnit !== 'm') return { code: 'distance-unit', expected };
  if (hasArea && !agrees(draft.distance, distance)) return { code: 'distance-number', expected };
  return { code: 'complete', expected };
}

const feedbackText = {
  points: 'Choose two labelled points from the plotted trace.',
  'same-time': 'Choose points at different times. A zero time interval cannot give a gradient.',
  incomplete: 'Enter a value and choose a unit for each calculation.',
  'gradient-unit': 'Check the gradient unit. Divide the vertical-axis unit by the horizontal-axis unit.',
  'gradient-number': 'Check the gradient. Use the change between the two readings and the elapsed time.',
  'distance-unit': 'Check the distance unit. Multiply the speed axis unit by the time axis unit.',
  'distance-number': 'Check the region from your earlier time to your later time. Use the average of the two speeds for this straight segment.',
  complete: 'Calculations verified for your two points.'
};

const format = number => String(Number(number.toFixed(2)));

function feedbackMarkup(result) {
  const { code, expected } = result;
  const { start, end, gradient, distance, unit } = expected ?? {};
  const worked = expected ? `
    <p>Gradient = (${end.value} − ${start.value}) ÷ (${end.time} − ${start.time}) = ${format(gradient)} ${unit}.</p>
    ${distance === null ? '' : `<p>Distance = (${start.value} + ${end.value}) ÷ 2 × (${end.time} − ${start.time}) = ${format(distance)} m.</p>`}` : '';
  return `<div class="feedback${code === 'complete' ? '' : ' error'}"><strong>${feedbackText[code]}</strong>${worked}</div>`;
}

function plotScale(points) {
  const x = time => 54 + time / points.at(-1).time * 356;
  const y = value => 174 - value / points.at(-1).value * 154;
  return { x, y };
}

function graphMarkup(profile, points, draft, hasArea) {
  const { x, y } = plotScale(points);
  const selected = selectedPoints(points, draft).filter(Boolean);
  const [first, second] = selected;
  const area = hasArea && first && second && first !== second
    ? `<polygon points="${x(first.time)},174 ${x(first.time)},${y(first.value)} ${x(second.time)},${y(second.value)} ${x(second.time)},174" fill="#b8a2ff" fill-opacity=".19" />` : '';
  const horizontal = Array.from({ length: 5 }, (_, index) => index * points.at(-1).value / 4);
  return `<svg class="motion-chart" viewBox="0 0 440 230" aria-hidden="true" focusable="false">
    <rect x=".5" y=".5" width="439" height="229" rx="9" fill="#0d1724" stroke="#314255" />
    <g fill="#b8cbe2" font-size="13">
      ${horizontal.map(value => `
        <path d="M54 ${y(value)} H410" stroke="#2e4157" />
        <text x="45" y="${y(value) + 4}" text-anchor="end">${format(value)}</text>`).join('')}
      ${points.map(point => `
        <path d="M${x(point.time)} 20 V174" stroke="#2e4157" />
        <text x="${x(point.time)}" y="194" text-anchor="middle">${point.time}</text>`).join('')}
      <text x="14" y="97" text-anchor="middle" transform="rotate(-90 14 97)">${profile.axis}</text>
      <text x="232" y="218" text-anchor="middle">Time (s)</text>
    </g>
    ${area}
    <path d="M54 20 V174 H410" stroke="#a0b5cd" fill="none" />
    <polyline points="${points.map(point => `${x(point.time)},${y(point.value)}`).join(' ')}" stroke="#c1a6ff" stroke-width="2.5" fill="none" />
    <line id="motion-cursor-line" y2="174" stroke="#86decf" stroke-dasharray="4 4" />
    ${points.map(point => `
      <circle cx="${x(point.time)}" cy="${y(point.value)}" r="${selected.includes(point) ? 7 : 4}" fill="${selected.includes(point) ? '#0d1724' : '#c1a6ff'}" stroke="#c1a6ff" stroke-width="2" />
      <text x="${x(point.time)}" y="${y(point.value) + (point.id === 'E' ? 21 : -10)}" text-anchor="middle" font-weight="700" font-size="14" fill="#e5dcff">${point.id}</text>`).join('')}
    <circle id="motion-cursor-dot" r="2.5" fill="#86decf" />
  </svg>`;
}

function options(values, selection, placeholder = 'Choose a unit') {
  return `<option value="">${placeholder}</option>` + values.map(value =>
    `<option value="${value}"${selection === value ? ' selected' : ''}>${value}</option>`).join('');
}

export const motionPractical = {
  createState() {
    return { cursor: 0, pointA: '', pointB: '', gradient: '', gradientUnit: '', distance: '', distanceUnit: '', attempted: false };
  },

  render(root, { objective, state, guided, update, scene }) {
    const { number } = objective;
    const profile = profiles[number];
    const points = motionPoints(number, guided);
    const pointOptions = points.map(point => point.id);
    const hasArea = Number(number) === 7;
    const context = hasArea
      ? 'The harbor crew needs the cart’s acceleration and the distance it rolls during a timed interval.'
      : 'The harbor crew needs the cart’s speed. Its distance sensor measures from a fixed depot mark behind the starting position.';
    const hint = hasArea
      ? 'Choose two points at different times. Divide the change in speed by the elapsed time. To find the distance, use the area between the trace and time axis over that same interval.'
      : 'Choose two points at different times. Subtract the distance readings and divide by their elapsed time. The starting distance is a position reading from the depot mark.';
    let draft = state;
    root.innerHTML = `
      <section class="panel panel-body practical-step" aria-labelledby="motion-plot-heading">
        <h2 id="motion-plot-heading">Depot cart trace</h2>
        <p>${context}</p>
        <div class="apparatus-control motion-timer">
          <label for="motion-timer">Cart timer <output id="motion-timer-reading" for="motion-timer"></output></label>
          <input id="motion-timer" type="range" min="0" max="100" step="1">
        </div>
        ${graphMarkup(profile, points, draft, hasArea)}
        <table class="practical-table">
          <caption>Plotted readings from the cart sensors</caption>
          <thead><tr><th scope="col">Point</th><th scope="col">Time (s)</th><th scope="col">${profile.axis}</th></tr></thead>
          <tbody>${points.map(({ id, time, value }) => `<tr><th scope="row">${id}</th><td>${time}</td><td>${value}</td></tr>`).join('')}</tbody>
        </table>
      </section>
      <form class="panel panel-body practical-step" id="motion-form" novalidate aria-labelledby="motion-analysis-heading">
        <h2 id="motion-analysis-heading">Calculate from two points</h2>
        <p>${guided ? hint : hasArea ? 'Choose two plotted points. Submit the gradient and the distance travelled between their times.' : 'Choose two plotted points. Submit the gradient to report the cart’s speed.'}</p>
        <p id="motion-tolerance">Enter your values to within 0.01 of the calculated result.</p>
        <div class="practical-fields">
          <label>First point <select class="objective-select" id="motion-point-a">${options(pointOptions, draft.pointA, 'Choose a point')}</select></label>
          <label>Second point <select class="objective-select" id="motion-point-b">${options(pointOptions, draft.pointB, 'Choose a point')}</select></label>
          <label>Gradient <input id="motion-gradient" type="number" step="any" inputmode="decimal" value="${clean(draft.gradient)}" aria-describedby="motion-tolerance"></label>
          <label>Gradient unit <select class="objective-select" id="motion-gradient-unit">${options(units, draft.gradientUnit)}</select></label>
          ${hasArea ? `
            <label>Distance travelled <input id="motion-distance" type="number" step="any" inputmode="decimal" value="${clean(draft.distance)}" aria-describedby="motion-tolerance"></label>
            <label>Distance unit <select class="objective-select" id="motion-distance-unit">${options(distanceUnits, draft.distanceUnit)}</select></label>` : ''}
        </div>
        <button class="button primary" type="submit" id="motion-submit">Check calculations</button>
        <div id="motion-feedback" role="status">${draft.attempted ? feedbackMarkup(gradeMotion(number, guided, draft)) : ''}</div>
      </form>`;

    const find = id => root.querySelector('#motion-' + id);
    const timer = find('timer');
    const timerReading = find('timer-reading');
    const cursorLine = find('cursor-line');
    const cursorDot = find('cursor-dot');
    const feedback = find('feedback');
    const { x, y } = plotScale(points);

    function present(position) {
      const { time, [profile.ordinate]: value } = motionSample(number, position, guided);
      const reading = `${format(time)} s · ${format(value)} ${profile.unit}`;
      timer.value = String(Math.round(position * 100));
      timer.setAttribute('aria-valuetext', reading);
      timerReading.value = reading;
      cursorLine.setAttribute('x1', x(time));
      cursorLine.setAttribute('x2', x(time));
      cursorLine.setAttribute('y1', y(value));
      cursorDot.setAttribute('cx', x(time));
      cursorDot.setAttribute('cy', y(value));
      scene.present({ index: 0, position, settings: { guided },
        condition: guided ? 'Depot practice run' : 'Independent depot run', observation: reading });
    }

    function setCursor(position) {
      const cursor = Math.round(position * 100) / 100;
      if (cursor === draft.cursor) return;
      draft = { ...draft, cursor };
      present(cursor);
      update(draft, { redraw: false });
    }

    timer.addEventListener('input', () => setCursor(Number(timer.value) / 100));
    scene.onAdjust?.(setCursor);

    for (const [id, field] of [['point-a', 'pointA'], ['point-b', 'pointB']]) {
      const control = find(id);
      control.addEventListener('change', () => {
        const point = points.find(entry => entry.id === control.value);
        draft = { ...draft, [field]: control.value, cursor: point?.position ?? draft.cursor, attempted: false };
        update(draft, { focus: control.id });
      });
    }

    for (const [id, field] of [['gradient', 'gradient'], ['gradient-unit', 'gradientUnit'], ['distance', 'distance'], ['distance-unit', 'distanceUnit']]) {
      const control = find(id);
      control?.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
        draft = { ...draft, [field]: control.value, attempted: false };
        feedback.replaceChildren();
        update(draft, { redraw: false });
      });
    }

    find('form').addEventListener('submit', event => {
      event.preventDefault();
      draft = { ...draft, attempted: true };
      const result = gradeMotion(number, guided, draft);
      update(draft, { complete: result.code === 'complete', redraw: false });
      feedback.innerHTML = feedbackMarkup(result);
    });
    present(draft.cursor);
  }
};
