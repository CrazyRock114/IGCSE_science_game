export const subjects = [
  { id: 'biology', name: 'Biology', site: 'The Living Biome', icon: 'leaf', copy: 'Step inside living systems, from a cell to an entire watershed.' },
  { id: 'chemistry', name: 'Chemistry', site: 'The Waterworks', icon: 'flask', copy: 'Test matter, reactions and materials at the valley’s working laboratory.' },
  { id: 'physics', name: 'Physics', site: 'The Summit Observatory', icon: 'atom', copy: 'Put forces, energy, light and the night sky to work.' }
];

export const syllabus = 'https://www.cambridgeinternational.org/Images/664572-2025-2027-syllabus.pdf';
export const featuredId = 'B6.1';
export const capstoneIds = ['B19.1', 'C10.1', 'P4.2.5'];
export const capstoneQuestions = [
  {
    subject: 'biology', name: 'The watershed',
    prompt: 'What should the team do upstream to keep more sediment out of the reservoir over the long term?',
    options: ['Replant native vegetation and retain a buffer along the banks.', 'Clear the riverbanks to let stormwater travel to the reservoir faster.', 'Move the intake closer to the mouth of a muddy tributary.'],
    answer: 0
  },
  {
    subject: 'chemistry', name: 'The filter bed',
    prompt: 'Two filter beds pass the same volume per hour. Which provides the better first treatment for suspended mud?',
    options: ['The bed with the highest turbidity downstream.', 'The bed with the lowest turbidity downstream.', 'The bed whose incoming water has the highest salt content.'],
    answer: 1
  },
  {
    subject: 'physics', name: 'The power supply',
    prompt: 'The pump draws 250 W and must run for four hours. The existing bank delivers 0.75 kWh. What is the smallest increase in usable capacity for that shift?',
    options: ['No increase is needed.', 'Add 1.00 kWh.', 'Add 0.25 kWh.'],
    answer: 2
  }
];

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

export function getMission(missions, id) {
  return missions.find(mission => mission.id === id)
    ?? missions.find(mission => mission.id.startsWith(id + '.'));
}

export function matches(mission, query) {
  const text = [mission.id, mission.quest, mission.title, mission.location, ...mission.objectives.map(objective => objective[2])]
    .join(' ').toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).every(word => text.includes(word));
}
