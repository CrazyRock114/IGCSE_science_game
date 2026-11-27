export const subjects = [
  { id: 'biology', name: 'Biology', site: 'The Living Biome', icon: 'leaf', copy: 'Step inside living systems, from a cell to an entire watershed.' },
  { id: 'chemistry', name: 'Chemistry', site: 'The Waterworks', icon: 'flask', copy: 'Test matter, reactions and materials at the valley’s working laboratory.' },
  { id: 'physics', name: 'Physics', site: 'The Summit Observatory', icon: 'atom', copy: 'Put forces, energy, light and the night sky to work.' }
];

export const syllabus = 'https://www.cambridgeinternational.org/Images/664572-2025-2027-syllabus.pdf';
export const featuredId = 'B6.1';
export const capstoneIds = ['B19.1', 'C10.1', 'P4.2.5'];

export const investigations = [
  {
    name: 'A greenhouse on a power budget',
    intro: 'Use light at the leaves, trace the gases they exchange with the air, and compare how a solar panel uses the same light to supply electricity.',
    missions: ['B6.1', 'C10.2', 'P1.6.3']
  },
  {
    name: 'A cooler route to the market',
    intro: 'Temperature changes both enzyme activity and reaction rates. Follow the heat leaving a container to work out what insulation can do.',
    missions: ['B5.1', 'C6.2', 'P2.3.4']
  },
  {
    name: 'Looking closer at a leaf',
    intro: 'Choose a magnification that resolves leaf cells, test the lens geometry, and compare how size measurements are recorded.',
    missions: ['B2.2', 'P3.2.3', 'P1.1']
  }
];

export const fieldSkills = [
  'Make a prediction and choose a useful range for the independent variable.',
  'Change one factor at a time, measure a dependent variable and keep other conditions fixed.',
  'Use suitable instruments and record readings with their units and sensible precision.',
  'Repeat measurements, spot anomalies, and use a mean when the readings are comparable.',
  'Present results in a table or graph and interpret the pattern using scientific ideas.',
  'Identify sources of uncertainty, suggest improvements and explain the limits of a model.'
];

export function sampleAt(mission, input) {
  const [min, max] = mission.range;
  const setting = Math.max(min, Math.min(max, input));
  if (mission.calculate) return mission.calculate(setting);
  const position = (setting - min) / (max - min);
  const scaled = position * (mission.samples.length - 1);
  const index = Math.min(Math.floor(scaled), mission.samples.length - 2);
  const low = mission.samples[index];
  const high = mission.samples[index + 1];
  return low + (high - low) * (scaled - index);
}

export function hasComparison(trials = []) {
  return new Set(trials.map(trial => trial.input)).size >= 2;
}

function missionEvidenceIssue(mission, trials) {
  const plateauStart = mission.evidence?.plateauStart;
  if (plateauStart === undefined) {
    return hasComparison(trials) ? '' : 'Record readings at two different settings before checking your conclusion.';
  }

  const [min, max] = mission.range;
  const plateauOutput = sampleAt(mission, plateauStart);
  const readings = trials.filter(({ input, output }) =>
    Number.isFinite(input) && input >= min && input <= max && output === sampleAt(mission, input)
  );
  const missing = [];
  if (!readings.some(({ input, output }) => input < plateauStart && output < plateauOutput)) {
    missing.push('Record a lower setting that gives a lower output.');
  }
  if (!readings.some(({ input }) => input === plateauStart)) {
    missing.push('Record a reading at the start of the plateau.');
  }
  if (!readings.some(({ input, output }) => input > plateauStart && output === plateauOutput)) {
    missing.push('Record a higher setting with the same output to confirm the plateau.');
  }
  return missing.join(' ');
}

export function checkMissionConclusion(mission, trials, selected) {
  const issue = missionEvidenceIssue(mission, trials);
  if (issue) return { status: 'needs-evidence', message: issue };
  if (selected === null) return { status: 'needs-choice', message: 'Choose a conclusion based on your evidence.' };
  if (selected !== mission.challenge.answer) {
    return { status: 'incorrect', message: 'Review how the reading changed and check the field briefing before trying again.' };
  }
  return { status: 'correct' };
}

export function getMission(missions, id) {
  return missions.find(mission => mission.id === id)
    ?? missions.find(mission => mission.id.startsWith(id + '.'));
}

export function matches(mission, query) {
  const text = [mission.id, mission.quest, mission.title, mission.location, ...mission.objectives.map(objective => objective[2])]
    .join(' ').toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).every(word => text.includes(word));
}
