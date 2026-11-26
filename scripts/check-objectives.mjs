import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { content, missions, objectiveCatalog } from '../objective-catalog.js';
import { checkEvidence, getObjective, objectiveHref, recordObjective, restoreObjective } from '../objective-game.js';
import { createObjectiveModel, objectiveLiveReading, objectiveSimulationControl } from '../objective-model.js';
import { apparatusPosition, atReferenceMark, sampleControl } from '../apparatus-control.js';
import { diffusionFlux, expectedDiffusionCounts } from '../biology-simulation.js';
import { chromatographyFront, copperMassMG, titrationPH } from '../chemistry-simulation.js';
import { refractionAt, springExtension, thinLensAt } from '../physics-simulation.js';
import { electricPower, equivalentResistance, transformerVoltage } from '../electrical-simulation.js';

assert.equal(objectiveCatalog.size, 650);
assert.equal(apparatusPosition(-0.1), 0);
assert.equal(apparatusPosition(2), 1);
assert.equal(apparatusPosition(Infinity), 0);
assert.equal(atReferenceMark(.99), false);
assert.equal(atReferenceMark(1), true);
assert.equal(diffusionFlux(1, 2, 25, 5, 4), 10);
assert.equal(diffusionFlux(1, 2, 5, 25, 4), -10);
assert.equal(expectedDiffusionCounts(60, 20, .4, 12).reduce((sum, count) => sum + count), 80);
assert.equal(titrationPH(25, 25), 7);
assert.ok(titrationPH(25, 20) < 7 && titrationPH(25, 30) > 7);
assert.ok(Math.abs(copperMassMG(1, 60) - 19.7588) < .002);
assert.equal(chromatographyFront(.25, 60), 30);
assert.equal(springExtension(4, 200), .02);
assert.equal(thinLensAt(10, 15).distance, 30);
assert.equal(refractionAt(48, 1.5, 1).totalInternal, true);
assert.ok(Math.abs(refractionAt(30, 1, 1.5).transmitted - 19.4712) < .0001);
assert.equal(equivalentResistance([4, 6], false), 10);
assert.ok(Math.abs(equivalentResistance([4, 6], true) - 2.4) < 1e-12);
assert.equal(electricPower(50, 5), 250);
assert.equal(transformerVoltage(60, 500, 100), 12);
assert.deepEqual(Object.keys(content).sort(), missions.map(mission => mission.id).sort(), 'one data block for each mission');

const uniqueTasks = new Set();
const bounds = new Box3();
const totals = { biology: 0, chemistry: 0, physics: 0 };
const simulations = { biology: 0, chemistry: 0, physics: 0 };
let testedSetups = 0;

for (const mission of missions) {
  assert.equal(content[mission.id].length, mission.objectives.length, mission.id + ' complete objective mapping');
  for (const [number, tier] of mission.objectives) {
    const objective = getObjective(objectiveCatalog, mission.id, number);
    const { key, action, apparatus, cases, answer, insight } = objective;
    assert.equal(objective.tier, tier);
    assert.equal(objectiveHref(mission.id, number), '#objective/' + key);
    assert.ok([action, apparatus, insight].every(value => typeof value === 'string' && value.trim().length > 0), key + ' authored content');
    assert.ok(!uniqueTasks.has(action), key + ' unique quest instruction');
    uniqueTasks.add(action);
    assert.ok(cases.length >= 2 && cases.length <= 4, key + ' distinct setups');
    assert.equal(new Set(cases.map(entry => entry.condition)).size, cases.length, key + ' distinct conditions');
    assert.ok(cases.every(({ condition, observation }) => condition?.trim() && observation?.trim()), key + ' inspectable cases');
    assert.ok(answer.length > 0 && answer.length < cases.length && new Set(answer).size === answer.length, key + ' evidence has a distractor');
    assert.ok(answer.every(index => Number.isInteger(index) && cases[index]), key + ' valid evidence');

    let progress = restoreObjective(objective);
    assert.equal(checkEvidence(objective, progress, answer), 'compare', key + ' evidence gate');
    const { model, update, select, adjust, kind, grips } = createObjectiveModel(objective);
    assert.ok(kind && model.children.length > 0, key + ' 3D geometry');
    assert.ok(grips.length && grips.every(grip => ['horizontal', 'vertical', 'vertical-down'].includes(grip.userData.apparatusAxis)), key + ' direct manipulation');
    const equipment = objectiveSimulationControl(objective);
    if (equipment !== sampleControl) simulations[mission.subject] += 1;
    const sample = model.getObjectByName('Selected sample marker');
    const poses = new Set();
    cases.forEach((entry, index) => {
      progress = recordObjective(objective, progress, index);
      assert.equal(recordObjective(objective, progress, index), progress, key + ' repeat does not duplicate');
      select(index, false);
      for (const [step, position] of [0, .35, .72, 1].entries()) {
        adjust(position);
        const signal = objectiveLiveReading(objective, index, position);
        assert.ok(signal === null || (typeof signal === 'string' && signal.length && !/NaN|undefined/.test(signal)), key + ' live reading');
        update(step * .24);
        bounds.setFromObject(model);
        assert.ok([...bounds.min, ...bounds.max].every(Number.isFinite), key + ' finite scene');
      }
      select(index, true);
      update(1.2);
      poses.add(sample.position.x);
      testedSetups += 1;
    });
    assert.equal(poses.size, cases.length, key + ' each setup changes model state');

    const other = cases.findIndex((_, index) => !answer.includes(index));
    assert.equal(checkEvidence(objective, progress, []), 'choose');
    assert.equal(checkEvidence(objective, progress, [other]), 'retry');
    assert.equal(checkEvidence(objective, progress, answer), 'complete');
    assert.deepEqual(restoreObjective(objective, JSON.parse(JSON.stringify({ ...progress, done: true }))),
      { ...progress, done: true }, key + ' playable after save round trip');

    const resources = new Set();
    model.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.material) resources.add(object.material);
    });
    resources.forEach(resource => resource.dispose());
    totals[mission.subject] += 1;
  }
}

assert.deepEqual(totals, { biology: 231, chemistry: 181, physics: 238 });
assert.equal(testedSetups, 1866);
console.log(`650 objective experiments and ${testedSetups} setups verified for controls, evidence, saves and finite 3D states.`);
console.log('Live simulation controls:', simulations);
