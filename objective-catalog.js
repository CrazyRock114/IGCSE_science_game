import { biology } from './curriculum/biology.js';
import { chemistry } from './curriculum/chemistry.js';
import { physics } from './curriculum/physics.js';
import { biologyObjectives } from './curriculum/biology-objectives.js';
import { chemistryObjectives } from './curriculum/chemistry-objectives.js';
import { physicsObjectives } from './curriculum/physics-objectives.js';
import { subjects } from './game.js';
import { makeObjectiveCatalog } from './objective-game.js';

export const missions = [biology, chemistry, physics].flatMap((entries, index) =>
  entries.map(mission => ({ ...mission, subject: subjects[index].id }))
);
export const content = { ...biologyObjectives, ...chemistryObjectives, ...physicsObjectives };
export const objectiveCatalog = makeObjectiveCatalog(missions, content);
