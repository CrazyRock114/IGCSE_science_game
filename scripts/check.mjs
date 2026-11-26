import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { createExperimentModel } from '../lab-scene.js';
import { biology } from '../curriculum/biology.js';
import { chemistry } from '../curriculum/chemistry.js';
import { physics } from '../curriculum/physics.js';
import { capstoneIds, capstoneQuestions, featuredId, getMission, hasComparison, investigations, matches, sampleAt } from '../game.js';

const groups = [
  ['Biology', biology, 43, 147, 84],
  ['Chemistry', chemistry, 46, 120, 61],
  ['Physics', physics, 53, 144, 94]
];
const all = groups.flatMap(([, missions]) => missions);
const visuals = new Set(['plants', 'cells', 'human', 'ecosystem', 'particles', 'vessel', 'water', 'materials', 'heat', 'motion', 'waves', 'circuit', 'atom', 'orbit']);
assert.equal(new Set(all.map(mission => mission.id)).size, all.length, 'unique syllabus codes');

for (const [subject, missions, expectedMissions, expectedCore, expectedSupplement] of groups) {
  assert.equal(missions.length, expectedMissions, subject);
  let core = 0;
  let supplement = 0;
  for (const mission of missions) {
    assert.match(mission.id, /^[BCP]\d+\.\d+(?:\.\d+)?$/);
    assert.ok(visuals.has(mission.scene), mission.id + ' scene');
    assert.ok([mission.title, mission.quest, mission.location, mission.brief, mission.variable, mission.metric, mission.insight].every(value => typeof value === 'string' && value.trim()), mission.id + ' field notes');
    const [min, max, initial] = mission.range;
    assert.ok(mission.range.every(Number.isFinite) && max > min && initial >= min && initial <= max, mission.id + ' range');
    if (mission.step !== undefined) {
      assert.ok(Number.isFinite(mission.step) && mission.step > 0 && (max - min) >= mission.step, mission.id + ' step');
      for (const value of [initial, max]) {
        const steps = (value - min) / mission.step;
        assert.ok(Math.abs(steps - Math.round(steps)) < 1e-8, mission.id + ' slider alignment');
      }
    }
    assert.ok(mission.samples.length >= 2 && mission.samples.every(Number.isFinite), mission.id + ' samples');
    mission.samples.forEach((value, index, samples) => {
      const input = min + (max - min) * index / (samples.length - 1);
      const reading = sampleAt(mission, input);
      assert.ok(Math.abs(value - reading) < 1e-8 * Math.max(1, Math.abs(value)), mission.id + ' anchor reading');
    });
    assert.equal(sampleAt(mission, min - 1), mission.samples[0]);
    assert.ok(Math.abs(sampleAt(mission, max + 1) - mission.samples.at(-1)) < 1e-8 * Math.max(1, Math.abs(mission.samples.at(-1))));
    assert.equal(new Set(mission.links).size, mission.links.length, mission.id + ' unique links');
    assert.ok(mission.links.length && mission.links.every(id => id !== mission.id && getMission(all, id)), mission.id + ' valid links');
    const { answer, options, prompt, explanation } = mission.challenge;
    assert.ok(options.length >= 2 && new Set(options).size === options.length, mission.id + ' options');
    assert.ok(prompt && explanation && Number.isInteger(answer) && answer >= 0 && answer < options.length, mission.id + ' challenge');
    assert.ok(mission.objectives.length, mission.id + ' objectives');
    mission.objectives.forEach(([id, tier, description], index) => {
      assert.equal(id, String(index + 1), mission.id + ' objective numbering');
      assert.ok(typeof description === 'string' && description.length > 10, mission.id + ' objective description');
      assert.ok(tier === 'Core' || tier === 'Supplement', mission.id + ' objective tier');
      if (tier === 'Core') core += 1;
      else supplement += 1;
    });
  }
  assert.equal(core, expectedCore);
  assert.equal(supplement, expectedSupplement);
  console.log(`${subject}: ${missions.length} missions, ${core} Core + ${supplement} Supplement objectives checked.`);
}

const featured = getMission(all, featuredId);
assert.ok(matches(featured, 'greenhouse photosynthesis'));
assert.ok(!matches(featured, 'orbit telescope'));
assert.equal(sampleAt(featured, 50), 12);
assert.equal(sampleAt(featured, 75), 18);
assert.equal(sampleAt(featured, 100), 18);
assert.ok(!hasComparison([{ input: 2 }, { input: 2 }]));
assert.ok(hasComparison([{ input: 2 }, { input: 3 }]));
assert.ok(capstoneIds.every(id => all.some(mission => mission.id === id)));
assert.deepEqual(capstoneQuestions.map(question => question.subject), ['biology', 'chemistry', 'physics']);
assert.equal(sampleAt(getMission(all, 'P4.2.5'), 3), 0.75);
assert.equal(sampleAt(getMission(all, 'P4.2.5'), 4), 1);
console.log('All mission links, sample readings, challenge data and capstone prerequisites checked.');

for (const investigation of investigations) {
  assert.ok(investigation.missions.every(id => all.some(mission => id === mission.id)));
}

const bounds = new Box3();
const inputs = [0, .5, 1];
for (const [subject, missions] of groups) {
  for (const mission of missions) {
    const { model, update } = createExperimentModel({ ...mission, subject: subject.toLowerCase() });
    assert.ok(model.children.length > 0, mission.id + ' 3D objects');
    const min = Math.min(...mission.samples);
    const max = Math.max(...mission.samples);
    for (const input of inputs) {
      const value = mission.range[0] + (mission.range[1] - mission.range[0]) * input;
      const result = (sampleAt(mission, value) - min) / (max - min || 1);
      for (const time of [0, .01, 2.25, 4.5]) update(time, input, result);
      bounds.setFromObject(model);
      assert.ok([...bounds.min, ...bounds.max].every(Number.isFinite), mission.id + ' finite model bounds');
    }
    const resources = new Set();
    model.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      for (const material of [object.material].flat()) {
        if (material) resources.add(material);
      }
    });
    resources.forEach(resource => resource.dispose());
  }
}
console.log('All 142 experiment models constructed and updated at three settings.');
