export const objectiveXp = 20;

export function objectiveKey(missionId, number) {
  return `${missionId}/${number}`;
}

export function objectiveHref(missionId, number) {
  return `#objective/${objectiveKey(missionId, number)}`;
}

export function makeObjectiveCatalog(missions, content) {
  return new Map(missions.flatMap(mission => mission.objectives.map(([number, tier, description], index) => {
    const [action, apparatus, cases, answer, insight] = content[mission.id]?.[index] ?? [];
    const key = objectiveKey(mission.id, number);
    if (!cases) throw new Error(`Missing objective experiment ${key}`);
    return [key, {
      key, mission, number, tier, description, action, apparatus, insight,
      cases: cases.map(([condition, observation]) => ({ condition, observation })),
      answer: [answer].flat()
    }];
  })));
}

export function objectiveCaseOrder(objective) {
  let seed = 17;
  for (const character of objective.key) seed = Math.imul(seed, 31) + character.charCodeAt(0);
  const size = objective.cases.length;
  const offset = (seed >>> 0) % size;
  return objective.cases.map((_, index) => (index + offset) % size);
}

export function getObjective(catalog, missionId, number) {
  return catalog.get(objectiveKey(missionId, number));
}

export function restoreObjective(objective, saved) {
  const cases = Array.isArray(saved?.runs) ? saved.runs : [];
  return {
    runs: [...new Set(cases.filter(index => validCase(objective, index)))],
    done: saved?.done === true
  };
}

export function recordObjective(objective, progress, index) {
  if (!validCase(objective, index) || progress.runs.includes(index)) return progress;
  return { ...progress, runs: [...progress.runs, index] };
}

export function checkEvidence(objective, progress, selected) {
  if (progress.runs.length < 2) return 'compare';
  if (!selected.length) return 'choose';
  if (selected.some(index => !progress.runs.includes(index))) return 'unrecorded';
  if (selected.length !== objective.answer.length || !objective.answer.every(index => selected.includes(index))) return 'retry';
  return 'complete';
}

function validCase(objective, index) {
  return Number.isInteger(index) && index >= 0 && index < objective.cases.length;
}
