import assert from 'node:assert/strict';
import { capstoneEvidence, gradeCapstone, pumpShift } from '../capstone-game.js';
import { missions } from '../objective-catalog.js';
import { capstoneIds, getMission, sampleAt } from '../game.js';

const [watershed, filter, power] = capstoneIds;

function record(id, ...settings) {
  const mission = getMission(missions, id);
  return settings.map(input => ({ input, output: sampleAt(mission, input) }));
}

const trials = {
  [watershed]: record(watershed, 0, 50, 25, 75),
  [filter]: record(filter, 0, 20, 10, 30),
  [power]: record(power, 0, 2, 4, 1.32),
  'B6.1': record('B6.1', 25)
};
const ids = purpose => capstoneEvidence(purpose, trials[purpose]).map(reading => reading.ref);
const [tree0, tree50, tree25, tree75] = ids(watershed);
const [sand0, sand20, sand10, sand30] = ids(filter);
const [pump0, pump2, pump4, pumpInterpolated] = ids(power);
const [irrelevant] = ids('B6.1');
const valid = {
  watershedA: tree0, watershedB: tree50, watershedAction: 'retain',
  filterA: sand0, filterB: sand20, filterTreatment: 'b', filterClaim: 'clarity',
  powerReading: pump4, capacity: '0.25', capacityUnit: 'kWh', evaluation: 'microbes'
};

assert.deepEqual(pumpShift, { powerW: 250, hours: 4, availableKWh: .75 });
assert.deepEqual(capstoneEvidence(filter, [null, { input: NaN, output: 0 }, trials[filter][0], trials[filter][0]]), [
  { ref: sand0, input: 0, output: 48 }
]);
assert.deepEqual(capstoneEvidence(filter, null), []);
assert.equal(capstoneEvidence(filter, [...trials[filter]].reverse())[0].ref, sand30);

const approved = gradeCapstone(trials, valid);
assert.equal(approved.complete, true);
assert.match(approved.parts.watershed.message, /50%.*114 mg\/L.*240 mg\/L.*0%/);
assert.match(approved.parts.filter.message, /20 cm.*9 NTU.*48 NTU.*0 cm/);
assert.match(approved.parts.power.message, /4 h.*1 kWh.*0\.25 kWh \(250 Wh\)/);

const alternate = gradeCapstone(trials, {
  ...valid, watershedA: tree75, watershedB: tree25,
  filterA: sand30, filterB: sand10, filterTreatment: 'a',
  powerReading: pump2, capacity: '250', capacityUnit: 'Wh', evaluation: 'storms'
});
assert.equal(alternate.complete, true);
assert.match(alternate.parts.watershed.message, /75%.*62 mg\/L.*175 mg\/L.*25%/);
assert.match(alternate.parts.filter.message, /30 cm.*4 NTU.*21 NTU.*10 cm/);
assert.match(alternate.parts.power.message, /2 h.*0\.5 kWh/);
assert.equal(gradeCapstone(trials, { ...valid, powerReading: pumpInterpolated, capacity: '.25' }).complete, true);

function rejects(part, changes, message, available = trials) {
  const result = gradeCapstone(available, { ...valid, ...changes });
  assert.equal(result.complete, false);
  assert.equal(result.parts[part].ok, false);
  assert.match(result.parts[part].message, message);
  assert.ok(Object.entries(result.parts).every(([name, { ok }]) => name === part || ok));
}

const noCitations = gradeCapstone(trials, {
  ...valid, watershedA: '', watershedB: '', filterA: '', filterB: '', powerReading: ''
});
assert.equal(noCitations.complete, false);
assert.deepEqual(Object.values(noCitations.parts).map(result => result.ok), [false, false, false, true]);
rejects('watershed', { watershedA: irrelevant }, /two readings from this mission/);
rejects('watershed', { watershedA: tree50 }, /different tree cover/);
rejects('watershed', { watershedAction: 'clear' }, /recommendation/);
rejects('filter', { filterB: '' }, /two readings from this mission/);
rejects('filter', { filterA: tree0 }, /two readings from this mission/);
rejects('filter', { filterB: sand0 }, /different filter depth/);
rejects('filter', { filterTreatment: 'a' }, /lower outflow turbidity/);
rejects('filter', { filterClaim: 'safe' }, /Turbidity measures cloudiness/);
rejects('power', { powerReading: '' }, /Select a saved reading/);
rejects('power', { powerReading: sand0 }, /Select a saved reading/);
rejects('power', { powerReading: pump0 }, /above 0 h/);
rejects('power', { capacity: '0.25', capacityUnit: 'kW' }, /energy unit/);
rejects('power', { capacity: '1' }, /subtract/);
rejects('power', { capacity: '250' }, /subtract/);
rejects('power', { capacity: '0.25', capacityUnit: 'Wh' }, /subtract/);
rejects('power', { capacity: '' }, /as a number/);
rejects('evaluation', { evaluation: 'appearance' }, /specific limit/);

const noChange = { input: 4, output: 48 };
const [sameTurbidity] = capstoneEvidence(filter, [noChange]);
rejects('filter', { filterB: sameTurbidity.ref }, /same turbidity/, { ...trials, [filter]: [...trials[filter], noChange] });
rejects('filter', {}, /two readings from this mission/, { ...trials, [filter]: record(filter, 0, 10, 30) });

console.log('Round 3 capstone checks passed for two evidence sets, mission-specific citations, supported recommendations, energy units, and evaluation.');
