import { capstoneIds } from './game.js';

export const pumpShift = { powerW: 250, hours: 4, availableKWh: .75 };
const [watershedId, filterId, powerId] = capstoneIds;
const digits = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const format = value => digits.format(value);
const fail = message => ({ ok: false, message });
const pass = message => ({ ok: true, message });

export function capstoneEvidence(missionId, trials) {
  if (!Array.isArray(trials)) return [];
  const evidence = new Map();
  for (const trial of trials) {
    const { input, output } = trial ?? {};
    if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) continue;
    // Identical measurements are interchangeable. Including their source keeps
    // references stable across tabs, new readings and older saves without IDs.
    const ref = JSON.stringify([missionId, input, output]);
    evidence.set(ref, { ref, input, output });
  }
  return [...evidence.values()];
}

function compare(readings, firstRef, secondRef, setting, result) {
  const first = readings.find(reading => reading.ref === firstRef);
  const second = readings.find(reading => reading.ref === secondRef);
  if (!first || !second) return { issue: 'Select two readings from this mission’s saved field record. Return to the mission to record them if needed.' };
  if (first.input === second.input) return { issue: `Choose readings at two different ${setting} settings so you can compare what changed.` };
  if (first.output === second.output) return { issue: `These readings show the same ${result}. Choose a pair that shows a measured difference.` };
  return { first, second };
}

function gradeWatershed(readings, draft) {
  const { first, second, issue } = compare(readings, draft.watershedA, draft.watershedB, 'tree cover', 'sediment level');
  if (issue) return fail(issue);
  const [low, high] = first.input < second.input ? [first, second] : [second, first];
  if (high.output > low.output) return fail('This pair shows more sediment at higher tree cover. Check the settings and repeat the comparison under the same rainfall and slope.');
  if (draft.watershedAction !== 'retain') return fail('Choose the recommendation that matches the lower sediment concentration at higher tree cover.');
  return pass(`Under the same rainfall and slope, ${format(high.input)}% tree cover gave ${format(high.output)} mg/L of sediment compared with ${format(low.output)} mg/L at ${format(low.input)}% cover. That supports retaining or restoring tree cover.`);
}

function gradeFilter(readings, draft) {
  const { first, second, issue } = compare(readings, draft.filterA, draft.filterB, 'filter depth', 'turbidity');
  if (issue) return fail(issue);
  const preferFirst = first.output < second.output;
  const best = preferFirst ? first : second;
  const other = preferFirst ? second : first;
  if (draft.filterTreatment !== (preferFirst ? 'a' : 'b')) {
    return fail('Use the tested setting with the lower outflow turbidity. Compare the two NTU readings you selected.');
  }
  if (draft.filterClaim !== 'clarity') {
    return fail('Turbidity measures cloudiness. Select a claim limited to the suspended particles in this test. Assess microbes or dissolved substances separately.');
  }
  return pass(`The ${format(best.input)} cm setting gave ${format(best.output)} NTU compared with ${format(other.output)} NTU at ${format(other.input)} cm. That supports choosing it to reduce suspended sediment under the tested conditions. Microbiological safety needs separate evidence.`);
}

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function gradePower(readings, draft) {
  const reading = readings.find(entry => entry.ref === draft.powerReading);
  const { powerW, hours, availableKWh } = pumpShift;
  const demandKWh = powerW / 1000 * hours;
  const additionWh = (demandKWh - availableKWh) * 1000;
  if (!reading) return fail('Select a saved reading from the water-treatment pump’s field record. Return to the pump mission to record one if needed.');
  if (reading.input <= 0) return fail('Choose a pump reading above 0 h. A run with elapsed time lets you compare its energy use to the pump’s power rating.');
  if (Math.abs(reading.output / reading.input * 1000 - powerW) > 1e-9) {
    return fail(`Choose a pump reading whose energy used divided by runtime agrees with the ${powerW} W pump rating.`);
  }
  if (draft.capacityUnit !== 'kWh' && draft.capacityUnit !== 'Wh') {
    return fail('Choose kWh or Wh as the energy unit. The battery capacity is an amount of energy.');
  }
  const text = String(draft.capacity ?? '').trim();
  const addition = decimal.test(text) ? Number(text) * (draft.capacityUnit === 'kWh' ? 1000 : 1) : NaN;
  if (!Number.isFinite(addition)) return fail('Enter the additional usable battery capacity as a number.');
  if (Math.abs(addition - additionWh) > 1e-9) {
    return fail(`Multiply ${powerW} W by ${hours} h to find the shift’s energy use, then subtract the ${format(availableKWh)} kWh already available. Convert both amounts into the same unit first.`);
  }
  return pass(`Your recorded ${format(reading.input)} h run used ${format(reading.output)} kWh, consistent with ${powerW} W. The shift uses ${format(demandKWh)} kWh. Subtracting ${format(availableKWh)} kWh leaves ${format(additionWh / 1000)} kWh (${format(additionWh)} Wh) to add.`);
}

function gradeEvaluation(answer) {
  if (answer === 'microbes') return pass('Testing the filtered outflow for microbes addresses a safety question left open by the turbidity measurements.');
  if (answer === 'storms') return pass('Repeat sediment measurements during comparable storms to check whether the controlled model’s trend holds in the watershed.');
  return fail('Choose a follow-up that addresses a specific limit. Think about which property the instruments measured and which conditions were held constant.');
}

export function gradeCapstone(trialsByMission = {}, draft = {}) {
  const parts = {
    watershed: gradeWatershed(capstoneEvidence(watershedId, trialsByMission[watershedId]), draft),
    filter: gradeFilter(capstoneEvidence(filterId, trialsByMission[filterId]), draft),
    power: gradePower(capstoneEvidence(powerId, trialsByMission[powerId]), draft),
    evaluation: gradeEvaluation(draft.evaluation)
  };
  return { complete: Object.values(parts).every(result => result.ok), parts };
}
