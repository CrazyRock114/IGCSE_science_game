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
];

for (const { id, units, direction, points } of cases) {
  const mission = physics.find(entry => entry.id === id);
  assert.deepEqual([mission.unit, mission.metricUnit], units, `${id} units`);
  const step = mission.step ?? (mission.range[1] - mission.range[0]) / 100;
  const intermediateStep = (points[1][0] - mission.range[0]) / step;
  for (const [input, expected] of points) {
    const actual = sampleAt(mission, input);
    assert.ok(Math.abs(actual - expected) < 1e-9, `${id} at ${input} ${mission.unit}: expected ${expected}, got ${actual}`);
  }
  assert.ok(Math.abs(intermediateStep - Math.round(intermediateStep)) < 1e-9, `${id} intermediate value is selectable`);
  const readings = [...points].sort(([one], [two]) => one - two).map(([input]) => sampleAt(mission, input));
  assert.ok(readings.slice(1).every((value, index) => Math.sign(value - readings[index]) === direction), `${id} expected trend`);
}

const evaporation = physics.find(mission => mission.id === 'P2.2.2');
assert.equal(evaporation.calculate, undefined);
assert.equal(sampleAt(evaporation, 30), 0.06);

console.log('Round 1 physics readings: three deterministic models and reference interpolation passed.');
