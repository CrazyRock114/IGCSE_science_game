import assert from 'node:assert/strict';
import { physics } from '../curriculum/physics.js';
import { sampleAt } from '../game.js';

const cases = [
  {
    id: 'P1.6.1', units: ['m/s', 'J'], direction: 1,
    points: [[2, 120], [1.04, 32.448], [8, 1920]],
  },
  {
    id: 'P1.6.4', units: ['s', 'W'], direction: -1,
    points: [[4, 300], [3.04, 394.7368421052632], [10, 120]],
  },
  {
    id: 'P1.7', units: ['cm²', 'kPa'], direction: -1,
    points: [[40, 50], [30, 66.66666666666667], [100, 20]],
  },
  {
    id: 'P1.5.3', units: ['m', '°'], direction: -1,
    points: [[0.5, 26.56505117707799], [0.37, 34.04593735660166], [1.25, 11.309932474020215]],
  },
  {
    id: 'P2.1.2', units: ['K', 'm/s'], direction: 1,
    points: [[300, 516.8391885639508], [274, 493.93532853641005], [450, 632.9961455278891]],
  },
  {
    id: 'P2.1.3', units: ['mL', 'kPa'], direction: -1,
    points: [[20, 250], [14, 357.14285714285717], [50, 100]],
  },
  {
    id: 'P2.3.4', units: ['mm', 'W'], direction: -1,
    points: [[10, 12], [7.4, 16.216216216216214], [25, 4.8]],
  },
  {
    id: 'P3.1', units: ['Hz', 'm'], direction: -1,
    points: [[2, 1], [1.48, 1.3513513513513513], [5, 0.4]],
  },
  {
    id: 'P3.3', units: ['nm', 'THz'], direction: -1,
    points: [[450, 666.6666666666666], [398, 753.7688442211055], [750, 400]],
  },
  {
    id: 'P4.3.1', units: ['Ω', 'A'], direction: -1,
    points: [[20, 0.3], [14.8, 0.4054054054054054], [50, 0.12]],
  },
  {
    id: 'P4.4', units: ['A', 'W'], direction: 1,
    points: [[2, 2], [0.96, 0.4608], [8, 32]],
  },
  {
    id: 'P4.5.2', units: ['s', 'V'],
    points: [[0.25, 4], [0.13, 2.915874509685646], [1, 0]],
  },
  {
    id: 'P5.2.3', units: ['years', 'nuclei'], direction: -1,
    points: [[5730, 800], [2750.4, 1147.1641984126618], [22920, 100]],
  },
  {
    id: 'P5.2.4', units: ['h', '%'], direction: -1,
    points: [[6, 50], [2.88, 71.69776240079136], [24, 6.25]],
  },
  {
    id: 'P5.2.5', units: ['m', '%'], direction: -1,
    points: [[2, 25], [1.48, 45.65376186997809], [5, 4]],
  },
];

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${message}: expected ${expected}, got ${actual}`);
}

for (const { id, units, direction, points } of cases) {
  const mission = physics.find(entry => entry.id === id);
  assert.equal(typeof mission.calculate, 'function', `${id} uses its formula`);
  assert.deepEqual([mission.unit, mission.metricUnit], units, `${id} units`);
  const [min, max] = mission.range;
  const step = mission.step ?? (max - min) / 100;
  assert.equal(points.at(-1)[0], max, `${id} valid endpoint`);
  for (const [input, expected] of points) {
    const ticks = (input - min) / step;
    assert.ok(input >= min && input <= max, `${id} at ${input} stays within range`);
    near(ticks, Math.round(ticks), `${id} at ${input} is selectable`);
    near(sampleAt(mission, input), expected, `${id} at ${input} ${mission.unit}`);
  }
  if (direction) {
    const readings = [...points].sort(([one], [two]) => one - two).map(([input]) => sampleAt(mission, input));
    assert.ok(readings.slice(1).every((value, index) => Math.sign(value - readings[index]) === direction), `${id} expected trend`);
  }
}

const reading = (id, input) => sampleAt(physics.find(mission => mission.id === id), input);
near(0.37 * Math.tan(reading('P1.5.3', 0.37) * Math.PI / 180), 0.25, 'Tipping uses the half-width after converting degrees to radians');
near(reading('P2.1.2', 274) ** 2 / 274, reading('P2.1.2', 398) ** 2 / 398, 'Mean square molecular speed scales with absolute temperature');
near(reading('P2.1.3', 14) * 14, 500 * 10, 'Absolute pressure times volume stays constant');
near(reading('P2.3.4', 14.8), reading('P2.3.4', 7.4) / 2, 'Doubling thickness halves the sidewall heat loss');
near(1.48 * reading('P3.1', 1.48), 2, 'Wavelength times frequency gives wave speed in m/s');
near(reading('P3.3', 398) * 1e12 * 398e-9, 3e8, 'Frequency in Hz times wavelength in metres gives vacuum wave speed');
near(14.8 * reading('P4.3.1', 14.8), 6, 'Current times resistance gives the fixed supply voltage');
near(reading('P4.4', 1.92), 4 * reading('P4.4', 0.96), 'Doubling the current quadruples cable heating');
near(reading('P4.5.2', 0.63), -reading('P4.5.2', 0.13), 'Generator polarity reverses after half a turn');
for (const seconds of [0, 0.5, 1]) assert.equal(reading('P4.5.2', seconds), 0, 'Generator zero crossing displays zero');
near(reading('P5.2.3', 8480.4), reading('P5.2.3', 2750.4) / 2, 'The expected carbon-14 count halves in 5730 years');
near(reading('P5.2.4', 8.88), reading('P5.2.4', 2.88) / 2, 'The tracer share halves in six hours');
near(reading('P5.2.5', 2.96), reading('P5.2.5', 1.48) / 4, 'Doubling point-source distance quarters the count rate');

const evaporation = physics.find(mission => mission.id === 'P2.2.2');
assert.equal(evaporation.calculate, undefined);
assert.equal(sampleAt(evaporation, 30), 0.06);
const magnetism = physics.find(mission => mission.id === 'P4.1');
assert.equal(magnetism.calculate, undefined);
near(sampleAt(magnetism, 7.4), 0.768, 'Illustrative magnetic pull retains its reference interpolation');

console.log('Round 1 and 3.1 physics readings: 15 deterministic models and reference interpolation passed.');
