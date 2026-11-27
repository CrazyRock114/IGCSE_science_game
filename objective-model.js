import * as THREE from 'three';
import { biologyObjectiveRig } from './biology-objective-rig.js';
import { chemistryObjectiveRig } from './chemistry-objective-rig.js';
import { physicsObjectiveRig } from './physics-objective-rig.js';
import { objectiveCaseOrder } from './objective-game.js';
import { apparatusPosition, atReferenceMark, sampleControl } from './apparatus-control.js';
import * as biologySimulation from './biology-simulation.js';
import * as chemistrySimulation from './chemistry-simulation.js';
import * as physicsSimulation from './physics-simulation.js';
import { createElectricalSimulation, electricalLiveReading, electricalSimulationControl } from './electrical-simulation.js';

const TAU = Math.PI * 2;
const accents = { biology: 0x80e7b5, chemistry: 0x8accff, physics: 0xc1a6ff };
const signals = {
  'blue-black': 0x181d54, 'brick-red': 0xcd5743, purple: 0xb087d6, violet: 0xa16de7,
  cloudy: 0xe6e6dc, white: 0xeaf1f2, yellow: 0xebc55e, green: 0x67bc8e,
  orange: 0xed9c50, brown: 0xaa704a, pink: 0xed7ea6, red: 0xe2666d, blue: 0x5aaee8,
  clear: 0xb2e6f2, colourless: 0xc2e6ef, colorless: 0xc2e6ef
};
const signalPattern = new RegExp(`\\b(${Object.keys(signals).join('|')})\\b`, 'i');
const modelTypes = [
  ['microscope', /microscope|micrometer|micrograph|organelle|specimen ruler|leaf section|cutaway cell/],
  ['membrane', /membrane|osmosis|diffusion|potato slice|water potential|root cell carrier/],
  ['genetics', /chromosome|punnett|allele|pedigree|gene model|dna|mitosis|meiosis/],
  ['leaf', /seedling|plant|chlorophyll|greenhouse|stoma|stomata|root hairs|leaf|xylem|phloem|flower/],
  ['body', /heart|lungs?|alveol|haemoglobin|blood|neurone|digest|kidney|artery|vein|hormone/],
  ['habitat', /stream|habitat|watershed|web|ecosystem|wetland|forest|conservation|population/],
  ['optics', /lens|prism|mirror|light ray|refraction|reflection|optical|spectrum/],
  ['mass', /balance|scale platform|weigh|density|displacement tank|pressure pad/],
  ['mechanics', /ruler|cart|track|pendulum|lever|spring|winch|lift|force|pulley|timing gate/],
  ['thermal', /thermometer|thermal|heating|conduction|convection|insulation|heater|calorimeter/],
  ['circuit', /circuit|coil|electroly|battery|bulb|led |ammeter|voltmeter|transformer|motor|generator|solar panel|magnet/],
  ['liquid', /burette|liquid|beaker|flask|pipette|solution|water|reagent|plate|vial|vessel|titration|distillation|precipitat|filtr/],
  ['orbit', /planet|solar system|orbital|galaxy|telescope|star model|stellar/],
  ['radiation', /radioactiv|nuclear|nucleus|isotope|geiger|half-life|radiation/],
  ['molecules', /molecul|atom|bond|lattice|compound|formula|particle|electron|periodic|enzyme/]
];
const backgroundRig = {
  plants: 'leaf', cells: 'microscope', human: 'body', ecosystem: 'habitat',
  particles: 'molecules', vessel: 'liquid', water: 'liquid', materials: 'material',
  heat: 'thermal', motion: 'mechanics', waves: 'optics', circuit: 'circuit',
  atom: 'radiation', orbit: 'orbit'
};

function kit(root, accent, grips = []) {
  const metal = surface(0x586e82, .40, .65);
  const dark = surface(0x24334a, .56, .19);
  const pale = surface(0xb4c2c9, .34, .46);
  const light = surface(accent, .25, .12);
  const crystal = surface(0x9fc8d8, .18, 0, { transparent: true, opacity: .19, depthWrite: false, side: THREE.DoubleSide });
  const response = surface(accent, .26, .32, { emissive: accent, emissiveIntensity: .15 });
  const add = (geometry, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  return {
    metal, dark, pale, light, crystal, response,
    box: (w, h, d, x, y, z, mat = metal) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z),
    sphere: (r, x, y, z, mat = light) => add(new THREE.SphereGeometry(r, 14, 10), mat, x, y, z),
    disc: (r, h, x, y, z, mat = metal) => add(new THREE.CylinderGeometry(r, r, h, 28), mat, x, y, z),
    tube: (r, h, x, y, z, mat = crystal) => add(new THREE.CylinderGeometry(r, r, h, 28, 1, true), mat, x, y, z),
    ring: (r, d, x, y, z, mat = metal) => add(new THREE.TorusGeometry(r, d, 8, 38), mat, x, y, z),
    capsule: (r, len, x, y, z, mat = pale) => add(new THREE.CapsuleGeometry(r, len, 6, 20), mat, x, y, z),
    cone: (top, bottom, h, x, y, z, mat = pale) => add(new THREE.CylinderGeometry(top, bottom, h, 28), mat, x, y, z),
    grip(object, axis = 'vertical') {
      object.userData.apparatusAxis = axis;
      grips.push(object);
      return object;
    },
    beam: (a, b, width, mat = light) => {
      const start = new THREE.Vector3(...a);
      const end = new THREE.Vector3(...b);
      const mesh = add(new THREE.CylinderGeometry(width, width, start.distanceTo(end), 9), mat, 0, 0, 0);
      mesh.position.copy(start).lerp(end, .5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
      return mesh;
    }
  };
}

function surface(color, roughness = .5, metalness = .08, other = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...other });
}

function quantities(text) {
  const reading = text.replaceAll('−', '-').match(/(?:^|[^\p{L}\p{N}])(-?\d+(?:\.\d+)?)\s*(kWh|kW|kJ|kPa|MW|GHz|nm|µm|mm|cm|mL|mol\/L|mol|NTU|rpm|Hz|kg|mg|m\/s²|m\/s|cm³|m³|mA|A|V|W|J|N|Ω|°C|°|%|s|min|h|g|m)(?![\p{L}\p{N}])/u);
  return reading ? { value: Number(reading[1]), unit: reading[2] } : null;
}

function observations(objective) {
  const measured = objective.cases.map(entry => quantities(entry.observation));
  const settings = objective.cases.map(entry => quantities(entry.condition));
  const unit = measured.find(Boolean)?.unit;
  const values = measured.filter(item => item?.unit === unit && item).map(item => item.value);
  const min = Math.min(...values), max = Math.max(...values);
  return objective.cases.map(({ condition, observation }, index) => {
    const observed = measured[index];
    const setting = settings[index];
    const text = `${condition} ${observation}`.toLowerCase();
    const colour = observation.toLowerCase().match(signalPattern)?.[0];
    const amount = observed?.unit === unit && max > min ? (observed.value - min) / (max - min) : null;
    return {
      text, condition: condition.toLowerCase(), setting, observed, amount, colour: signals[colour], index,
      blocked: /\b(no flow|no bubbles|no gas|no current|flow stops|zero current|never lights|does not pass|no movement|neither substance crosses)\b/.test(observation.toLowerCase()),
      crosses: /leaves|outward|right to left|moves out|drawn out|shrinks/i.test(observation) ? -1 : 1
    };
  });
}

function makeRig(k, kind, title) {
  switch (kind) {
    case 'microscope': return microscope(k);
    case 'membrane': return membrane(k);
    case 'genetics': return genetics(k);
    case 'leaf': return leaf(k);
    case 'body': return body(k, title);
    case 'habitat': return habitat(k);
    case 'optics': return optics(k, title);
    case 'mass': return balance(k);
    case 'mechanics': return mechanics(k, title);
    case 'thermal': return vessel(k, true);
    case 'circuit': return circuit(k);
    case 'liquid': return vessel(k, false);
    case 'radiation': return radiation(k);
    case 'molecules': return molecules(k);
    case 'orbit': return orbital(k);
    default: return materialTest(k);
  }
}

function microscope(k) {
  k.box(1.94, .16, 1.21, 0, .13, 0, k.dark);
  k.box(.21, 1.45, .31, -.78, .95, -.27);
  k.box(1.05, .2, .42, -.33, 1.62, -.26, k.pale);
  k.disc(.22, .42, .19, 1.45, -.23, k.dark);
  k.disc(.17, .28, .19, 1.19, -.23, k.pale);
  const stage = k.box(1.05, .13, .71, .17, .64, -.19, k.pale);
  const slide = k.box(.85, .028, .45, .17, .735, -.19, k.crystal);
  const knob = k.ring(.19, .038, -.79, .91, .06, k.light);
  const focus = k.sphere(.27, .15, .82, .31, k.response);
  focus.scale.set(1, .27, .85);
  const scale = k.box(.49, .03, .08, .18, .77, .45, k.light);
  return (s, t, motion) => {
    const power = s.setting?.unit === 'µm' || s.setting?.unit === 'mm' ? s.amount : null;
    const factor = power ?? s.amount ?? .49;
    knob.rotation.z = motion * TAU * .45;
    stage.position.y = .66 + .11 * motion;
    slide.position.y = stage.position.y + .075;
    focus.material.color.setHex(s.colour ?? (/bacter/.test(s.text) ? 0x8eabe3 : 0x71c7a9));
    focus.scale.x = .68 + factor * 1.12;
    scale.scale.x = .57 + factor * .8;
    focus.rotation.y = .12 * Math.sin(t * 2);
  };
}

function membrane(k) {
  k.box(2.17, .1, 1.15, 0, .24, 0, k.dark);
  k.box(2.09, 1.22, 1.05, 0, .86, 0, k.crystal);
  const gate = k.box(.055, 1.1, .99, 0, .86, 0, k.pale);
  const frame = k.ring(.26, .023, 0, .83, .53, k.light);
  const water = surface(0x6dbcf2, .27);
  const solute = surface(0xf3a474, .34);
  const dots = Array.from({ length: 25 }, (_, index) => k.sphere(index % 3 ? .053 : .076, 0, .8, 0, index % 3 ? water : solute));
  return (s, t, motion) => {
    const permeable = /permeable|selective|membrane|carrier/.test(s.condition);
    const open = /no barrier|unrestricted|open passive/.test(s.condition);
    const blocked = s.blocked || /impermeable|gas-tight/.test(s.condition);
    gate.visible = !open;
    gate.material.opacity = permeable ? .42 : .75;
    frame.visible = permeable;
    dots.forEach((dot, index) => {
      const phase = (index * .149 + t * .27 * motion) % 1;
      const side = index % 2 ? 1 : -1;
      const canCross = !blocked && (!permeable || index % 3 !== 0);
      dot.position.x = canCross ? (phase * 1.8 - .90) * s.crosses : side * (.15 + phase * .75);
      dot.position.y = .84 + Math.sin(index * 2.4 + t * motion) * .43;
      dot.position.z = Math.cos(index * 1.87 + t * motion * .66) * .38;
    });
  };
}

function genetics(k) {
  k.box(1.98, .19, 1.4, 0, .24, 0, k.dark);
  const plate = k.disc(.78, .1, 0, .38, 0, k.crystal);
  const chromosomes = Array.from({ length: 12 }, (_, index) => {
    const x = (index % 4 - 1.5) * .32;
    const z = (Math.floor(index / 4) - 1) * .29;
    const colour = index % 2 ? k.response : k.pale;
    const arm = k.box(.07, .1, .23, x, .54, z, colour);
    arm.rotation.y = Math.PI / 4;
    const other = k.box(.07, .1, .23, x, .55, z, colour);
    other.rotation.y = -Math.PI / 4;
    return [arm, other, x, z];
  });
  return (s, t, motion) => {
    const division = /separat|daughter|daughter cells|round of division/.test(s.text);
    const copy = s.observed?.unit === '%' ? Math.round(12 * s.observed.value / 100) : null;
    plate.rotation.y = motion * .8;
    chromosomes.forEach(([a, b, x, z], index) => {
      const spread = division ? Math.sin(motion * Math.PI / 2) * .22 : 0;
      a.position.set(x + (index % 2 ? spread : -spread), .55 + .07 * Math.sin(t + index), z);
      b.position.copy(a.position);
      b.rotation.y = -Math.PI / 4 + motion * .14;
      a.visible = b.visible = copy === null || index < copy;
    });
  };
}

function leaf(k) {
  k.box(1.93, .18, 1.26, 0, .24, 0, k.dark);
  k.box(.3, 1.25, .26, -.81, .98, -.38);
  const foliage = surface(0x389c71, .55);
  const blades = Array.from({ length: 7 }, (_, i) => {
    const angle = i * 2.36;
    const x = Math.cos(angle) * (.33 + (i % 2) * .17);
    const z = Math.sin(angle) * .37;
    const y = .63 + i * .15;
    const blade = k.sphere(.29, x, y, z, foliage);
    blade.rotation.y = -angle;
    blade.scale.set(1.15, .12, .44);
    k.beam([0, y - .15, 0], [x, y, z], .024, k.light);
    return blade;
  });
  k.beam([0,.33,0], [0,1.64,0], .038, k.light);
  const lamp = k.box(.81, .14, .38, .04, 1.82, -.19, k.response);
  k.beam([-.81,1.57,-.38],[.04,1.82,-.19], .042, k.pale);
  const drops = Array.from({ length: 9 }, (_, index) => k.sphere(.032, (index % 3 - 1) * .24, .6, ((index * .57) % .7) - .31, k.crystal));
  return (s,t,motion) => {
    const dark = /dark|unlit|no light|covered/.test(s.condition);
    const wilt = /wilt|turgor decreases|plasmolys|leaf droops/.test(s.text);
    const flow = /bubble|gas exchange|evapor|oxygen production|transpira/.test(s.text);
    lamp.material.emissiveIntensity = dark ? .02 : .38 + .58 * motion;
    blades.forEach((blade, i) => {
      blade.rotation.z = (wilt ? -.32 * motion : -.10) + .06 * Math.sin(i + t * 1.75) * motion;
      blade.scale.y = .11 + (wilt ? .025 : .055) * (s.amount ?? .5);
    });
    drops.forEach((drop, i) => {
      drop.visible = flow && !s.blocked;
      drop.position.y = .54 + ((i * .13 + t * .39) % 1) * (s.amount ?? .65) * 1.43;
    });
  };
}

function body(k, title) {
  const lungs = /lung|alveol|breath|gas exchange/.test(title);
  const path = /digesti|gut|stomach|duoden/.test(title);
  const tissue = surface(lungs ? 0xc987a5 : 0xba546d, .43);
  k.box(1.96, .2, 1.25, 0, .23, 0, k.dark);
  const organ = [-1, 1].map(side => {
    const x = side * (lungs ? .38 : .17);
    const specimen = k.sphere(lungs ? .42 : .48, x, 1.03, 0, tissue);
    specimen.scale.set(lungs ? .68 : .81, 1.34, .77);
    specimen.rotation.z = side * -.22;
    k.beam([0,1.83,0],[x,1.28,.08], .064, k.pale);
    return specimen;
  });
  const collected = Array.from({length: 9}, (_, i) => k.sphere(.057, 0, 0, 0, i % 2 ? k.light : k.response));
  const flow = [1.6, .6];
  return (s, t, motion) => {
    const pulse = (s.amount ?? .58) * Math.sin(t * (lungs ? 2.4 : 4.6)) * motion;
    organ.forEach(part => { part.scale.y = 1.34 + .16 * pulse; });
    collected.forEach((mark, i) => {
      const p = (i * .117 + t * .51 * motion) % 1;
      mark.visible = !s.blocked;
      mark.position.set(Math.sin(p * TAU) * (path ? .28 : .72), flow[0] - p * flow[1], Math.cos(p * TAU) * .51);
    });
  };
}

function habitat(k) {
  const bank = surface(0x5d866f, .87);
  const wet = surface(0x4da6c7, .36, .11);
  const soil = surface(0x6e5446, .91);
  k.box(2.46,.17,1.54,0,.32,0,soil);
  k.box(2.48,.08,.53,0,.43,-.48,bank);
  k.box(2.48,.08,.53,0,.43,.48,bank);
  k.box(2.47,.054,.53,0,.421,0,wet);
  const trees = Array.from({ length: 10 }, (_, index) => {
    const x = (index % 5 - 2) * .42;
    const z = index > 4 ? .52 : -.52;
    const stem = k.disc(.045,.28,x,.59,z,soil);
    const crown = k.sphere(.18,x,.80,z,bank);
    crown.scale.y = 1.39;
    return [stem, crown];
  });
  const particles = Array.from({ length: 10 }, () => k.sphere(.046,0,0,0,k.light));
  return (s,t,motion) => {
    const degraded = /clear.cut|no trees|bare bank|remove.*trees|treeless|deforest|cleared land/.test(s.condition);
    const turbid = /high turbidity|muddy|brown|more sediment|high sediment/.test(s.text);
    trees.forEach(([stem, crown], index) => {
      stem.visible = crown.visible = !degraded;
      crown.rotation.z = .11 * Math.sin(index + t * 2) * motion;
    });
    wet.color.setHex(turbid ? 0xa98962 : 0x4da6c7);
    particles.forEach((dot,i) => {
      dot.position.set(((i * .17 + t * .25 * motion) % 1 - .5) * 2.4, .46, .17 * Math.sin(i * 2.39));
    });
  };
}

function optics(k, title) {
  const mirror = /mirror|reflection|reflect/.test(title);
  const prism = /prism|dispersion|spectrum/.test(title);
  const lens = /lens|focus|image/.test(title) && !mirror;
  const screen = k.box(.036, .76, .80, 1.32, .95, 0, k.pale);
  const source = k.box(.33,.22,.42,-1.2,.88,0,k.dark);
  const optical = mirror || lens || prism
    ? k.sphere(.44, 0, .90, 0, mirror ? k.pale : k.crystal)
    : k.box(.92,.63,.66,0,.71,0,k.crystal);
  if (mirror || lens) optical.scale.set(.14, 1.07, .92);
  if (prism) optical.scale.set(.62, .83, .92);
  const line = k.beam([-1.15,.92,0], [0,.92,0], .023, k.light);
  const outgoing = k.beam([0,.92,0], [1.16,.92,0], .022, k.light);
  const beams = Array.from({length: 4}, (_, i) => k.beam([0,.92,0], [1.15,.92,.12 * i], .014, surface([0xf28c88,0xf4da79,0x70deb6,0xad9bfd][i], .25)));
  k.box(2.87,.13,1.46,0,.22,0,k.dark);
  return (s,t,motion) => {
    const incidence = s.setting?.unit === '°' ? THREE.MathUtils.clamp(s.setting.value, 0, 84) * Math.PI / 180 : .29;
    source.position.z = -.62 * Math.sin(incidence);
    optical.rotation.y = mirror ? 0 : .12 * Math.sin(motion * Math.PI);
    line.rotation.y = -incidence * .38;
    line.scale.y = .62 + .38 * motion;
    outgoing.visible = !prism && !s.blocked;
    const refraction = s.observed?.unit === '°' ? s.observed.value * Math.PI / 180 : Math.asin(Math.sin(incidence) / 1.33);
    outgoing.rotation.y = mirror ? Math.PI + incidence * .4 : refraction * .69;
    outgoing.position.x = mirror ? -.54 : .54;
    screen.visible = !mirror;
    beams.forEach((beam,i) => {
      beam.visible = prism;
      beam.rotation.y = (i - 1.5) * (.06 + .25 * motion);
    });
  };
}

function balance(k) {
  k.box(2.28,.23,1.17,0,.24,0,k.dark);
  k.box(.78,.19,.64,-.58,.43,0,k.pale);
  const platform = k.box(.67,.07,.76,-.58,.56,0,k.light);
  const specimen = k.box(.48,.49,.53,-.58,.84,0,k.response);
  const liquid = k.disc(.38,.58,.63,.69,0,k.crystal);
  k.tube(.401,.85,.63,.82,0);
  const marks = Array.from({length:6}, (_,i) => k.box(.11,.015,.02,.77,.46 + i * .13,.37,k.pale));
  return (s,_t,motion) => {
    const quantity = s.amount ?? .5;
    const line = .13 + .25 * quantity * motion;
    platform.position.y = .56 - .065 * quantity * motion;
    specimen.position.y = platform.position.y + .27 + .20 * (1 - motion);
    liquid.scale.y = .52 + line;
    liquid.position.y = .53 + line * .28;
    marks.forEach((mark,index) => { mark.material = index < 2 + quantity * 4 ? k.light : k.pale; });
  };
}

function mechanics(k, title) {
  k.box(2.63,.14,1.28,0,.25,0,k.dark);
  if (/pendulum|swing/.test(title)) {
    const pivot = [0,1.87,-.12];
    k.box(.13,1.66,.24,-.83,1.10,-.12);
    k.beam([-.89,1.87,-.12], pivot, .056, k.pale);
    const bob = k.sphere(.19,0,.69,-.12,k.response);
    const cord = k.beam(pivot,[0,.67,-.12],.019,k.pale);
    return (s,t,motion) => {
      const angle = Math.sin(t * Math.PI * (.91 + .17 * (s.amount ?? .5))) * .62 * motion;
      bob.position.x = 1.17 * Math.sin(angle);
      bob.position.y = pivot[1] - 1.17 * Math.cos(angle);
      cord.rotation.z = angle;
      cord.position.set(bob.position.x / 2, (bob.position.y + pivot[1]) / 2, pivot[2]);
    };
  }
  const pivot = /beam|lever|turning|moment|seesaw/.test(title);
  const track = k.box(2.42,.09,.24,0,.52,0,k.pale);
  k.disc(.20,.49,0,.42,0,k.pale);
  const carriage = k.box(.53,.26,.43,-.59,.72,0,k.response);
  const wheels = [-1,1].map(side => k.disc(.101,.06,0,.58,side * .23,k.dark));
  wheels.forEach(wheel => { wheel.rotation.x = Math.PI / 2; });
  return (s,t,motion) => {
    const factor = s.amount ?? .44;
    const x = pivot ? -.70 + factor * 1.4 : -1.01 + 1.88 * ((t * (.23 + factor * .12)) % 1) * motion;
    track.rotation.z = pivot ? (.47 - factor) * .27 * motion : 0;
    carriage.position.set(x, .74 + Math.tan(track.rotation.z) * x, 0);
    wheels.forEach((wheel,index) => {
      wheel.position.x = x + (index === 0 ? -.13 : .13);
      wheel.rotation.y = x * 5;
    });
  };
}

function vessel(k, thermal) {
  k.box(2.12,.17,1.28,0,.23,0,k.dark);
  const v = k.tube(.47,1.08,-.28,.94,0);
  const rim = k.ring(.48,.024,-.28,1.48,0,k.pale);
  rim.rotation.x = Math.PI / 2;
  k.disc(.45,.058,-.28,.40,0,k.pale);
  const fluidSurface = surface(0x5fa5c9, .22, .05, { transparent: true, opacity: .72 });
  const fluid = k.disc(.44,.77,-.28,.78,0,fluidSurface);
  const reader = k.box(.28,.83,.25,.64,.99,-.14,k.pale);
  const gauge = k.box(.12,.52,.051,.64,.95,.013,k.response);
  const samples = Array.from({length:10}, (_,i) => k.sphere(.025 + i % 3 * .009,-.3,.59,0,k.crystal));
  return (s,t,motion) => {
    const amount = s.amount ?? .49;
    const heated = thermal || /heated|warm |heat |boil|hot /.test(s.condition);
    const effervesces = /bubbles|carbon dioxide|effervescen|oxygen released|gas produced|fizz/.test(s.text);
    fluid.material.color.setHex(s.colour ?? (heated ? 0xdb9468 : 0x5fa5c9));
    fluid.scale.y = .56 + .34 * amount * motion;
    fluid.position.y = .43 + .77 * fluid.scale.y / 2;
    gauge.scale.y = .32 + .68 * amount * motion;
    gauge.position.y = .73 + .19 * gauge.scale.y;
    samples.forEach((bubble,i) => {
      bubble.visible = !s.blocked && (heated || effervesces);
      bubble.position.set(-.28 + Math.sin(i * 2.11 + t) * .29, .54 + ((t * .61 + i * .21) % 1) * .78 * motion, Math.cos(i * 2.39) * .26);
    });
    v.material.opacity = s.colour === signals.cloudy ? .31 : .19;
    reader.rotation.z = s.setting?.unit === '°C' ? -.09 * motion : 0;
  };
}

function circuit(k) {
  k.box(2.39,.19,1.41,0,.25,0,k.dark);
  const corners = [[-.94,.41,-.49],[.94,.41,-.49],[.94,.41,.49],[-.94,.41,.49]];
  const copper = surface(0xbb816a, .37, .6);
  for (let i = 0; i < 4; i += 1) k.beam(corners[i], corners[(i + 1) % 4], .033, copper);
  const source = k.disc(.18,.53,-.65,.58,-.49,k.pale);
  source.rotation.z = Math.PI / 2;
  const component = k.sphere(.23,.94,.63,.32,k.response);
  const switchArm = k.box(.45,.05,.09,0,.49,.49,k.pale);
  const dots = Array.from({length:12}, () => k.sphere(.04,0,0,0,k.light));
  return (s,t,motion) => {
    const off = s.blocked || /open switch|disconnected|no cell|open circuit|insulator/.test(s.condition);
    const level = s.amount ?? .59;
    switchArm.rotation.z = off ? .65 : 0;
    component.material.emissiveIntensity = off ? .025 : .33 + motion * level * 1.5;
    dots.forEach((dot,i) => {
      const phase = ((i / dots.length + t * (.16 + level * .25) * motion) % 1) * 4;
      const segment = Math.floor(phase);
      const a = corners[segment], b = corners[(segment + 1) % 4];
      dot.position.set(a[0] + (b[0] - a[0]) * (phase % 1), a[1] + .032, a[2] + (b[2] - a[2]) * (phase % 1));
      dot.visible = !off;
    });
  };
}

function molecules(k) {
  k.box(2.15,.17,1.30,0,.25,0,k.dark);
  const frame = k.box(1.92,1.40,1.22,0,1.08,0,k.crystal);
  const left = surface(0x78b8df, .32), right = surface(0xe99583, .34);
  const points = Array.from({length:24},(_,i) => k.sphere(i % 4 === 0 ? .094 : .069,0,0,0,i % 3 ? left : right));
  return (s,t,motion) => {
    const solid = /^(solid|ice|crystal)|solid (particles|structure)|locked in/.test(s.condition);
    const gas = /^(gas|steam|vapo[u]?r)|filled with gas/.test(s.condition) && !solid;
    const agitation = (gas ? .58 : solid ? .045 : .27) * motion;
    frame.material.opacity = .12 + .07 * (s.amount ?? .49);
    points.forEach((point,i) => {
      const x = (i % 6 - 2.5) * .25;
      const y = .79 + (Math.floor(i / 6) % 2) * .44;
      const z = i < 12 ? -.37 : .37;
      point.position.set(x + agitation * Math.sin(t * 2.6 + i * 2.37), y + agitation * .75 * Math.cos(t * 2.13 + i), z + agitation * .34 * Math.sin(t * 1.6 + i));
    });
  };
}

function radiation(k) {
  k.box(2.17,.17,1.28,0,.24,0,k.dark);
  k.disc(.24,.54,-.81,.61,0,k.pale);
  k.disc(.26,.72,.84,.70,0,k.dark);
  const screen = k.box(.037,.92,.60,0,.85,0,k.pale);
  const rays = Array.from({length: 10}, () => k.sphere(.042,0,.62,0,k.light));
  return (s,t,motion) => {
    const beam = !/background only|source removed/.test(s.condition);
    const barrier = /paper|aluminium|aluminum|lead|shield|screen/.test(s.condition);
    const stop = barrier && /absorbs|stopped|blocked|background only/.test(s.text);
    screen.visible = barrier;
    screen.scale.x = /lead/.test(s.condition) ? 2.8 : .86;
    rays.forEach((point,i) => {
      point.visible = beam && !s.blocked;
      point.position.set(-.66 + ((t * .52 * motion + i * .16) % 1) * (stop ? .64 : 1.43), .79 + Math.sin(i * 2.4) * .125, Math.cos(i * 2.4) * .15);
    });
  };
}

function orbital(k) {
  k.box(2.14,.15,1.34,0,.21,0,k.dark);
  const star = k.sphere(.31,0,.95,0,surface(0xeac07f,.29,.06,{emissive:0xf5a858,emissiveIntensity:.49}));
  const halos = [.51,.78,1.02].map(radius => {
    const ring = k.ring(radius,.011,0,.94,0,k.light);
    ring.rotation.x = Math.PI / 2.5;
    return ring;
  });
  const orbiters = [.09,.13,.16].map((size,index) => k.sphere(size,0,.94,0,index % 2 ? k.pale : k.response));
  return (s,t,motion) => {
    const level = s.amount ?? .49;
    star.scale.setScalar(.86 + level * motion * .25);
    orbiters.forEach((planet,i) => {
      const angle = t * (.48 - i * .10) * motion + i * 2.3;
      const radius = halos[i].geometry.parameters.radius;
      planet.position.set(Math.cos(angle) * radius, .94 + Math.sin(angle) * radius * .28, Math.sin(angle) * radius);
    });
  };
}

function materialTest(k) {
  k.box(2.10,.16,1.27,0,.23,0,k.dark);
  k.box(.20,1.19,.28,-.68,.92,-.29,k.metal);
  k.beam([-.67,1.47,-.29],[.25,1.47,-.01],.07,k.pale);
  const probe = k.disc(.10,.42,.24,1.23,0,k.pale);
  const sample = k.box(.78,.24,.78,.23,.46,0,k.response);
  const meter = k.box(.56,.14,.41,-.66,.39,.38,k.light);
  return (s,t,motion) => {
    const amount = s.amount ?? .46;
    const elastic = /bends|stretches|shape changes/.test(s.text);
    probe.position.y = 1.22 - .43 * motion;
    sample.rotation.y = .07 * Math.sin(t * 2);
    sample.scale.y = elastic ? 1 - .23 * motion * amount : 1;
    sample.material.color.setHex(s.colour ?? (/copper/.test(s.condition) ? 0xd6a182 : /rust/.test(s.text) ? 0xb98764 : 0x98b4cb));
    meter.scale.x = .35 + amount * .65 * motion;
  };
}

function wrap(context, value, width) {
  const rows = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    const probe = line ? line + ' ' + word : word;
    if (context.measureText(probe).width > width && line) {
      rows.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) rows.push(line);
  return rows;
}

function stagePanel(objective, colour) {
  const card = new THREE.Group();
  card.position.set(1.27, .91, .04);
  card.rotation.y = -.12;
  const k = kit(card, colour);
  k.box(1.31, .84, .09, 0, 0, 0, k.dark);
  k.box(1.24, .052, .091, 0, .409, .002, k.light);
  const fallback = k.box(.82, .046, .12, 0, -.18, .08, k.light);
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const context = canvas?.getContext('2d');
  let texture;
  if (context) {
    canvas.width = 720;
    canvas.height = 420;
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.216, .71), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    board.position.set(0, -.02, .05);
    card.add(board);
    fallback.visible = false;
  }
  let previous;
  const paint = (index, recorded, readout, condition = objective.cases[index].condition) => {
    const key = `${index}/${recorded}/${readout}/${condition}`;
    if (previous === key) return;
    previous = key;
    fallback.scale.x = .32 + .68 * ((index + 1) / objective.cases.length);
    if (!context) return;
    context.fillStyle = '#0d1b2b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#b4cfe2';
    context.font = '600 32px monospace';
    context.fillText(objective.mission.id + ' · ' + objective.number, 32, 52);
    context.fillStyle = '#f2f7fb';
    context.font = '600 45px system-ui';
    wrap(context, condition, 656).slice(0, 2).forEach((line, i) => context.fillText(line, 32, 119 + i * 53));
    context.fillStyle = recorded ? '#' + colour.toString(16).padStart(6, '0') : '#a7bece';
    context.font = '500 33px system-ui';
    wrap(context, readout, 656).slice(0, 4).forEach((line, i) => context.fillText(line, 32, 251 + i * 39));
    texture.needsUpdate = true;
  };
  return { card, paint };
}

export function objectiveSimulationControl(objective) {
  return biologySimulation.biologySimulationControl(objective)
    ?? chemistrySimulation.chemistrySimulationControl(objective)
    ?? physicsSimulation.physicsSimulationControl(objective)
    ?? electricalSimulationControl(objective) ?? sampleControl;
}

export function objectiveLiveReading(objective, index, position) {
  return biologySimulation.biologyLiveReading(objective, index, position)
    ?? chemistrySimulation.chemistryLiveReading(objective, index, position)
    ?? physicsSimulation.physicsLiveReading(objective, index, position)
    ?? electricalLiveReading(objective, index, position);
}

function buildSampleCarriage(k) {
  const trackMaterial = surface(0x627381, .33, .58);
  const gripMaterial = surface(0x4adccb, .30, .25, { emissive: 0x12726f, emissiveIntensity: .72 });
  const cartridgeMaterial = surface(0xadbfc8, .36, .37);
  const trackY = .176;
  k.box(1.39, .076, .29, -.97, trackY, .86, k.dark);
  for (const z of [.752, .958]) k.box(1.37, .034, .044, -.97, trackY + .055, z, trackMaterial);
  for (let index = 0; index <= 10; index += 1) {
    k.box(.012, .014, index % 5 ? .05 : .087, -1.58 + index * .12, .218, .981, k.pale);
  }
  k.box(.044, .109, .26, -.32, .215, .86, gripMaterial);
  const cartridge = k.box(.25, .111, .176, -1.59, .25, .851, cartridgeMaterial);
  const grip = k.grip(k.box(.16, .123, .14, -1.59, .36, .851, gripMaterial), 'horizontal');
  const sample = k.disc(.065, .022, -1.59, .320, .791, k.crystal);
  return (position, index) => {
    const x = -1.58 + position * 1.20;
    cartridge.position.x = grip.position.x = sample.position.x = x;
    cartridge.material.color.setHex([0xadbfc8, 0xbb9a81, 0x90adc9, 0xaab696][index]);
  };
}

export function createObjectiveModel(objective, presentation) {
  const { mission, apparatus } = objective;
  const model = new THREE.Group();
  model.name = 'Objective ' + objective.key + ' ' + apparatus;
  const accent = accents[mission.subject];
  const grips = [];
  const k = kit(model, accent, grips);
  const worktop = surface(0x405363, .59, .25);
  k.box(4.21,.13,2.13,0,.065,0,worktop);
  k.box(4.13,.038,.034,0,.112,1.058,k.metal);
  for (const x of [-1.88, 1.88]) for (const z of [-.87,.87]) {
    k.disc(.061,.025,x,.139,z,k.pale);
    const slot = k.box(.068,.012,.011,x,.155,z,k.dark);
    slot.rotation.y = x * 2 + z;
  }
  const deck = new THREE.Group();
  deck.position.set(-.69, .04, 0);
  deck.scale.setScalar(.89);
  model.add(deck);
  const kind = modelTypes.find(([, pattern]) => pattern.test(apparatus.toLowerCase()))?.[0] ?? backgroundRig[mission.scene];
  const equipment = kit(deck, accent, grips);
  const animate = biologySimulation.createBiologySimulation(equipment, objective)
    ?? chemistrySimulation.createChemistrySimulation(equipment, objective)
    ?? physicsSimulation.createPhysicsSimulation(equipment, objective)
    ?? createElectricalSimulation(equipment, objective)
    ?? biologyObjectiveRig(equipment, objective)
    ?? chemistryObjectiveRig(equipment, objective)
    ?? physicsObjectiveRig(equipment, objective)
    ?? makeRig(equipment, kind, `${apparatus} ${mission.title}`.toLowerCase());
  const presets = observations(objective);
  const { card, paint } = stagePanel(objective, accent);
  model.add(card);
  const order = objectiveCaseOrder(objective);
  const docks = presets.map((_, index) => {
    const dock = k.disc(.112,.071,1.27 + (order.indexOf(index) - (presets.length - 1) / 2) * .28,.155,.72,k.pale);
    dock.userData.setupIndex = index;
    return dock;
  });
  const marker = k.disc(.068,.12,0,.205,.72,k.response);
  marker.name = 'Selected sample marker';
  if (presentation) {
    for (const dock of docks) dock.visible = false;
    marker.visible = false;
  }
  const moveCarriage = grips.length ? null : buildSampleCarriage(k);
  let position = apparatusPosition(presentation?.position ?? 0);
  let selected = presentation?.index ?? order[0];
  let playback = presentation?.recorded ?? false;
  let start = 0;
  let clock = 0;
  const control = objectiveSimulationControl(objective);
  function paintPanel() {
    if (presentation) {
      paint(selected, playback, presentation.observation ?? '', presentation.condition ?? objective.apparatus);
      return;
    }
    const reading = objectiveLiveReading(objective, selected, position);
    const recorded = playback && atReferenceMark(position);
    paint(selected, recorded, recorded ? objective.cases[selected].observation
      : reading ?? (atReferenceMark(position) ? 'Ready to record' : control.format?.(position, selected) ?? 'Adjust reference control'));
  }
  paintPanel();
  return {
    model,
    kind,
    docks,
    grips,
    select(index, recorded) {
      selected = index;
      playback = recorded;
      start = clock;
      paintPanel();
    },
    adjust(value) {
      position = apparatusPosition(value);
      paintPanel();
    },
    present(next) {
      if (next.recorded && (!playback || next.index !== selected || next.observation !== presentation?.observation)) start = clock;
      presentation = next;
      selected = next.index;
      playback = next.recorded;
      position = apparatusPosition(next.position);
      paintPanel();
    },
    update(time, _level, _result, reduced = false) {
      clock = time;
      const active = presets[selected];
      const elapsed = Math.max(0, time - start);
      const running = playback && (presentation || atReferenceMark(position));
      const progress = running ? (reduced ? 1 : 1 - Math.exp(-elapsed * 4)) : position;
      const slide = .11 * (1 - position);
      marker.position.x = docks[selected].position.x;
      marker.position.y = .205 + (playback ? .1 * (1 - progress) : 0);
      card.position.y = .93 - slide;
      moveCarriage?.(position, selected);
      animate({ ...active, apparatus: position, running: Boolean(running), practical: presentation?.settings }, elapsed, progress);
    }
  };
}
