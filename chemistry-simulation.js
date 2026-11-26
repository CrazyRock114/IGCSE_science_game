import {
  CanvasTexture, Color, CylinderGeometry, LatheGeometry, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, SRGBColorSpace, Vector2
} from 'three';

const gasConstant = 8.314462618;
const faraday = 96485.33212;
const copperMolarMass = 63.546;
const clamp = value => Math.max(0, Math.min(1, value));
const fixed = (value, decimals = 1) => value.toFixed(decimals);

export function titrationPH(acidML, baseML, acidM = .1, baseM = .1) {
  const excessAcid = (acidML * acidM - baseML * baseM) / (acidML + baseML);
  const root = Math.hypot(excessAcid, 2e-7);
  // Solving [H⁺] − Kw/[H⁺] = excess concentration includes water at equivalence.
  const hydrogen = excessAcid >= 0 ? (root + excessAcid) / 2 : 2e-14 / (root - excessAcid);
  return -Math.log10(hydrogen);
}

export function copperMassMG(amps, seconds) {
  return (amps * seconds * copperMolarMass * 1000) / (2 * faraday);
}

export function chromatographyFront(position, finalMM = 60) {
  return finalMM * Math.sqrt(clamp(position));
}

export function reactionFraction(energyKJ, temperatureK) {
  return Math.exp(-energyKJ * 1000 / (gasConstant * temperatureK));
}

function material(color, values = {}) {
  return new MeshStandardMaterial({ color, roughness: .42, ...values });
}

const glass = (color = 0xd2f1f7, opacity = .20) => new MeshPhysicalMaterial({
  color, opacity, roughness: .12, metalness: .03, transparent: true,
  depthWrite: false, clearcoat: .75, clearcoatRoughness: .15
});
const tint = new Color();

function readout(k, width, x, y, z, title) {
  k.box(width, .28, .079, x, y, z, k.dark);
  if (typeof document === 'undefined') return () => {};
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 182;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const face = new MeshBasicMaterial({ map: texture, toneMapped: false });
  k.box(width - .025, .251, .023, x, y, z + .045, face);
  let previous;
  return label => {
    if (previous === label) return;
    previous = label;
    ctx.fillStyle = '#101c26';
    ctx.fillRect(0, 0, 720, 182);
    ctx.fillStyle = '#b1d6df';
    ctx.font = '500 38px system-ui';
    ctx.fillText(title, 24, 53, 672);
    ctx.fillStyle = '#e1fff6';
    ctx.font = '600 57px system-ui';
    ctx.fillText(label, 24, 133, 672);
    texture.needsUpdate = true;
  };
}

function cylinder(k, top, bottom, height, x, y, z, surface, open = false) {
  const object = k.disc(bottom, height, x, y, z, surface);
  object.geometry.dispose();
  object.geometry = new CylinderGeometry(top, bottom, height, 36, 1, open);
  return object;
}

function bar(k, thickness, from, to, surface) {
  return k.beam(from, to, thickness, surface);
}

function plinth(k, width = 2.75, depth = 1.35) {
  k.box(width, .11, depth, 0, .19, 0, k.dark);
  k.box(width - .12, .027, depth - .09, 0, .254, 0, k.metal);
  for (const x of [-width / 2 + .16, width / 2 - .16]) {
    k.disc(.054,.017,x,.275,depth / 2 - .105,k.pale);
  }
}

function graduations(k, x, z, startY, height, scale, surface) {
  for (let i = 0; i <= scale; i += 1) {
    const long = i % 5 === 0;
    k.box(long ? .083 : .053, .009, .009, x + (long ? .010 : 0), startY + height * i / scale, z, surface);
  }
}

function liquidColumn(k, radius, x, y0, z, appearance) {
  const fill = k.disc(radius, 1, x, y0, z, appearance);
  const top = k.disc(radius, .006, x, y0, z, appearance);
  return height => {
    fill.visible = top.visible = height > .003;
    fill.scale.y = Math.max(.002, height);
    fill.position.y = y0 + height / 2;
    top.position.y = y0 + height;
  };
}

function beaker(k, radius, height, x, bottom, z, fillMaterial) {
  const wall = glass();
  k.tube(radius, height, x, bottom + height / 2, z, wall).renderOrder = 2;
  k.disc(radius, .035, x, bottom + .015, z, wall);
  const lip = k.ring(radius, .012, x, bottom + height, z, wall);
  lip.rotation.x = Math.PI / 2;
  graduations(k, x + .11, z + radius * .95, bottom + height * .17, height * .66, 8, k.pale);
  return liquidColumn(k, radius - .016, x, bottom + .029, z, fillMaterial);
}

function conicalFlask(k, x, bottom, z, fluidMaterial) {
  const body = [[.315,0],[.34,.037],[.328,.092],[.16,.383],[.094,.49],[.094,.64],[.111,.654]];
  const flask = k.disc(.30,.05,x,bottom,z,glass());
  flask.geometry.dispose();
  flask.geometry = new LatheGeometry(body.map(([r,y]) => new Vector2(r,y)), 44);
  flask.renderOrder = 2;
  const fill = k.disc(.32, 1, x, bottom, z, fluidMaterial);
  const meniscus = k.disc(1, .007, x, bottom, z, fluidMaterial);
  let lastHeight = -1;
  return volume => {
    const depth = .08 + volume * .0041;
    if (Math.abs(depth - lastHeight) < .001) return bottom + depth;
    lastHeight = depth;
    const radius = .326 - Math.max(0, depth - .082) * .56;
    fill.geometry.dispose();
    fill.geometry = new CylinderGeometry(radius, .302, depth, 32);
    fill.position.y = bottom + depth / 2;
    meniscus.scale.x = meniscus.scale.z = radius;
    meniscus.position.y = bottom + depth;
    return bottom + depth;
  };
}

const endDose = [24.98, 25.006, 25.35];

function titrationState(objective, index, position) {
  const endpointLab = objective.key === 'C12.2/2';
  const p = clamp(position);
  const unknown = !endpointLab && index === 1;
  const aliquot = unknown ? 23.6 : 25;
  const delivered = endpointLab ? 24.9 + p * (endDose[index] - 24.9) : p * 29;
  return { delivered, aliquot, unknown, ph: titrationPH(aliquot, delivered), endpointLab };
}

const amber = new Color(0xefc94f);
const blue = new Color(0x417dd4);
const weakRed = new Color(0xcc4860);
const clearPink = new Color(0xf3e8e8);
const pink = new Color(0xd65b9e);

function indicatorTint(ph, phenolphthalein, acidTransition) {
  if (phenolphthalein) return tint.copy(clearPink).lerp(pink, clamp((ph - 8.2) / 1.8) ** 1.4);
  if (acidTransition && ph < 8) return tint.copy(weakRed).lerp(amber, clamp((ph - 1.2) / 1.6));
  if (acidTransition) return tint.copy(amber).lerp(blue, clamp((ph - 8) / 1.6));
  return tint.copy(amber).lerp(blue, clamp((ph - 6) / 1.6));
}

function titration(k, objective) {
  plinth(k);
  const x = -.25, bottom = .29, buretteBottom = 1.12, tubeLength = 1.11, z = .025;
  const chrome = material(0xacbcc1, { metalness: .69, roughness: .27 });
  const glassTint = glass();
  const titrant = glass(0xabd5e4, .53);
  const solution = glass(0xffde82, .84);
  const mark = material(0x193043);
  const support = material(0x27394a, { metalness: .37 });
  k.box(.54,.09,.60,-.94,.30,-.23,support);
  bar(k,.035,[-.96,.35,-.27],[-.96,2.24,-.27],chrome);
  bar(k,.031,[-.96,1.88,-.27],[x,1.88,z],chrome);
  k.tube(.069,tubeLength,x,buretteBottom + tubeLength / 2,z,glassTint).renderOrder = 2;
  const clampRing = k.ring(.083,.021,x,1.89,z,chrome);
  clampRing.rotation.x = Math.PI / 2;
  const lip = k.ring(.069,.010,x,buretteBottom + tubeLength,z,glassTint);
  lip.rotation.x = Math.PI / 2;
  graduations(k,x+.028,z+.067,buretteBottom,tubeLength,25,mark);
  const updateReservoir = liquidColumn(k,.060,x,buretteBottom,z,titrant);
  cylinder(k,.055,.032,.15,x,buretteBottom-.065,z,glassTint);
  k.disc(.030,.081,x,.980,z,chrome);
  const stopcock = k.box(.29,.047,.086,x,.982,z+.065,k.response);
  k.grip?.(stopcock,'horizontal');
  cylinder(k,.031,.010,.138,x,.907,z,glassTint);
  const fill = conicalFlask(k,x,bottom,z,solution);

  const pipetteZ = .55, pipetteX = -.82;
  const pipette = bar(k,.027,[pipetteX-.38,.35,pipetteZ],[pipetteX+.39,.35,pipetteZ],glassTint);
  const bulb = k.sphere(.056,pipetteX,.351,pipetteZ,glassTint);
  bulb.scale.x = 3.2;
  bar(k,.017,[-1.25,.35,pipetteZ],[-1.32,.37,pipetteZ],glassTint);
  k.box(.72,.053,.12,pipetteX,.301,pipetteZ,support);
  const pipetteCaption = readout(k,.76,-.90,.48,.16,'Fixed aliquot');
  const instrument = readout(k,.94,.62,1.51,.15,'Burette dose');
  const meter = readout(k,.9,.62,1.18,.15,'Bulk mixture');
  const indicator = readout(k,1.05,.62,.77,.17,'Indicator');

  const droplets = Array.from({length:4}, () => k.sphere(.021,x,.82,z,titrant));
  let previousPosition = 0;
  let lastAdjust = -10;
  const streak = k.sphere(.063,x,.58,z+.015,glass(0xed76b5,.56));
  streak.scale.set(.55,2.5,.55);
  return (s,t,motion) => {
    const position = s.apparatus ?? motion;
    if (position > previousPosition + .00001) lastAdjust = t;
    else if (position < previousPosition || t < lastAdjust) lastAdjust = -10;
    previousPosition = position;
    const state = titrationState(objective,s.index,position);
    const { delivered, aliquot, unknown, ph, endpointLab } = state;
    const phOfLocalStreak = ph + Math.max(0, 10 - ph) * .8;
    const mismatched = !endpointLab && s.index === 2;
    solution.color.copy(indicatorTint(ph,endpointLab,mismatched));
    const liquidTop = fill(aliquot + delivered);
    updateReservoir(tubeLength * (1 - delivered / 50));
    stopcock.rotation.z = -Math.PI / 2 * (s.apparatus ?? motion);
    pipette.visible = bulb.visible = !unknown;
    pipetteCaption(unknown ? 'Unmarked beaker' : '25.00 mL pipette');
    instrument(fixed(delivered, endpointLab ? 3 : 2) + ' mL');
    meter('pH ' + fixed(ph,2));
    indicator(endpointLab ? 'Phenolphthalein' : mismatched ? 'Thymol blue' : 'Bromothymol blue');
    const dripping = delivered > 0 && (t - lastAdjust < .65 || (s.running && t < 1.3));
    droplets.forEach((drop,index) => {
      const phase = (t * 1.8 + index / 4) % 1;
      drop.visible = dripping && phase > index / 10;
      drop.position.set(x,.83 + (liquidTop - .83) * (phase ** 1.65),z);
    });
    const mixing = 1 - (t * 1.15 % 1);
    streak.visible = dripping && endpointLab && ph < 8.2 && phOfLocalStreak >= 8.2;
    streak.position.y = liquidTop - .05 - (1 - mixing) * .07;
    streak.material.opacity = .51 * mixing;
    streak.scale.set(.6 + (1 - mixing) * 1.2, 1.65 * mixing + .22, .55);
  };
}

const chromaPairs = [[20], [20,55], [12,55]];

function chromatography(k, objective) {
  plinth(k);
  const solvent = glass(0x83afb8, .56);
  const paper = material(0xefead4, { roughness: .86 });
  const wetPaper = material(0xc7d6cf, { roughness: .76 });
  const graphite = material(0x565949);
  const stains = [material(0xc65589), material(0x4a76c1), material(0xcb9940)];
  const z = -.18, bottom = .38, baselineY = .69, rise = .98;
  const pool = k.box(2.34,.28,.79,0,.42,.02,solvent);
  k.box(2.40, 1.62, .018, 0,1.14,-.40,glass());
  k.box(2.40, 1.62, .018, 0,1.14,.44,glass(0xe3f7ff,.09)).renderOrder = 3;
  for (const x of [-1.207,1.207]) k.box(.018,1.62,.86,x,1.14,.018,glass());
  k.box(2.40,.055,.89,0,1.97,0,glass(0xbbdfe8,.34));
  for (const x of [-.89,.85]) {
    k.box(.14,.10,.12,x,1.86,z,k.pale);
    k.box(.18,.07,.15,x,1.91,z,k.metal);
  }
  k.box(2.12,1.48,.024,0,1.11,z,paper);
  const wetted = k.box(2.11,1,.014,0,bottom,z+.019,wetPaper);
  const pencil = k.box(2.08,.015,.009,0,baselineY,z+.035,graphite);
  const front = k.box(2.08,.018,.009,0,baselineY,z+.036,k.light);
  k.box(.073,1.15,.042,.99,1.165,z+.036,k.pale);
  graduations(k,.949,z+.064,baselineY,rise,12,graphite);
  const carriage = k.box(.145,.055,.106,.987,baselineY,z+.068,k.response);
  k.grip?.(carriage,'vertical');
  const needle = k.box(.31,.018,.021,.843,baselineY,z+.063,k.light);
  const lanes = [-.46,.38].map(x => Array.from({length:3},(_,i) =>
    k.sphere(.057,x,baselineY,z + .046,stains[i])));
  const marker = readout(k,1.12,.02,.425,.47,'Solvent front');
  const solventColor = new Color(0x83afb8);
  const bleedingColor = new Color(0xad8197);
  return (s,_t,motion) => {
    const p = s.apparatus ?? motion;
    const f = chromatographyFront(p) / 60;
    const method = objective.number === '1';
    const compare = objective.number === '2';
    const submerged = method && s.index === 1;
    const ink = method && s.index === 2;
    const origin = submerged ? .49 : baselineY;
    const top = baselineY + rise * f;
    pencil.position.y = origin;
    pool.scale.y = submerged ? 1.45 : .78;
    solvent.color.copy(solventColor).lerp(bleedingColor,submerged ? f : 0);
    wetted.scale.y = top - bottom;
    wetted.position.y = bottom + wetted.scale.y / 2;
    front.position.y = carriage.position.y = needle.position.y = top;
    const results = compare ? [[20,55],chromaPairs[s.index]] : method ? [ink ? [21,42,53] : [21,46], []] : [[30],[]];
    lanes.forEach((lane,j) => lane.forEach((spot,i) => {
      const distance = results[j][i];
      spot.visible = distance !== undefined && (!submerged || f < .89 && i === 0);
      spot.position.y = submerged ? origin : origin + rise * f * (distance ?? 0) / 60;
      spot.scale.set(submerged ? 1.8 + 3 * f : 1, submerged ? .45 : .65 + f * .23, .18);
    }));
    marker(fixed(60 * f) + ' mm');
  };
}

const kinetTimes = [15,6,12];
const kinetStarts = [0,0,12];
const kinetEnds = [30,18,36];

export function collisionEnergyFraction(energyKJ, temperatureK) {
  const ratio = energyKJ * 1000 / (gasConstant * temperatureK);
  const x = Math.sqrt(ratio);
  const t = 1 / (1 + .3275911 * x);
  const exp = Math.exp(-ratio);
  const erfc = t * (.254829592 + t * (-.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * exp;
  return Math.min(1, erfc + 2 * x * exp / Math.sqrt(Math.PI));
}

function kineticsState(objective,index,position) {
  const p = clamp(position);
  const n = Number(objective.number);
  if (n === 4) {
    const slope = (kinetEnds[index] - kinetStarts[index]) / kinetTimes[index];
    return { volume: kinetStarts[index] + slope * p * kinetTimes[index], seconds: p * kinetTimes[index], slope };
  }
  const temperature = (n === 7 ? [293,320,278] : n === 5 ? [298,314,298] : [298,308,283])[index];
  const multiplier = (n === 2 ? [2,2,1] : n === 7 ? [2,1,.64] : [1.7,1.5,.61])[index];
  const barrier = n === 2 && index < 2 ? 29 : n === 5 && index === 1 ? 27 : 34;
  const rate = n === 3 ? 1 : multiplier * reactionFraction(barrier,temperature) / reactionFraction(34,298);
  const seconds = p * 40;
  return {
    volume: 40 * (1 - Math.exp(-.035 * rate * seconds)), seconds, rate,
    fraction: collisionEnergyFraction(34,temperature)
  };
}

function gasSyringe(k,x,y,z,grabbable = true) {
  const window = glass();
  const plastic = material(0xcbe2e7,{roughness:.64});
  const stopper = material(0x3c4850);
  const radius = .113, length = 1.65;
  const barrel = k.tube(radius,length,x,y,z,window);
  barrel.rotation.z = Math.PI/2;
  const nozzle = k.disc(.038,.13,x - length/2-.038,y,z,plastic);
  nozzle.rotation.z = Math.PI/2;
  const barrelEnd = k.disc(.13,.042,x + length/2,y,z,plastic);
  barrelEnd.rotation.z = Math.PI/2;
  const stop = k.disc(radius-.011,.105,x,y,z,stopper);
  stop.rotation.z = Math.PI / 2;
  const rod = k.box(.64,.054,.054,x,y,z,plastic);
  const handle = k.box(.076,.144,.155,x,y,z,k.response);
  if (grabbable) k.grip?.(handle,'horizontal');
  for (let i = 0; i <= 12; i += 1) {
    k.box(.009,i%3===0?.075:.051,.012,x - length * .41 + i * length * .82 / 12,y + .052,z+.105,k.pale);
  }
  return volume => {
    const piston = x - length*.41 + length*.78*clamp(volume/60);
    stop.position.x = piston;
    rod.position.x = piston + .28;
    handle.position.x = piston + .59;
  };
}

function chart(k, points, surface, w, h, x0, y0, z) {
  for (let i = 1; i < points.length; i += 1) {
    const [xp,yp] = points[i-1];
    const [x,y] = points[i];
    bar(k,.009,[x0+xp*w,y0+yp*h,z],[x0+x*w,y0+y*h,z],surface);
  }
}

function energyProfile(k) {
  plinth(k);
  k.box(2.30,1.37,.075,0,1,.03,k.dark);
  for (const factor of [0,.25,.5,.75,1]) {
    bar(k,.006,[-1.045,.41 + factor*1.09,.078],[1.045,.41 + factor*1.09,.078],k.metal);
  }
  const profile = (peak,end) => Array.from({length:41},(_,i) => {
    const run = i / 40;
    const first = run <= .5;
    const edge = first ? .28 : end;
    return [run,edge + (peak-edge)*Math.sin((first ? run : 1-run)*Math.PI)**2];
  });
  chart(k,profile(.72,.24),k.pale,2.06,1.09,-1.03,.41,.098);
  const examples = [[.49,.24],[.94,.24],[.72,.09]];
  const root = k.box(.014,.014,.014,0,.26,0,k.dark).parent;
  const curves = examples.map(([peak,end]) => {
    const start = root.children.length;
    chart(k,profile(peak,end),k.response,2.06,1.09,-1.03,.41,.114);
    return root.children.slice(start);
  });
  const bead = k.sphere(.057,-1.03,.71,.115,k.light);
  k.grip?.(bead,'horizontal');
  const screen = readout(k,1.32,0,1.74,.11,'Reaction profile');
  return (s,_t,motion) => {
    const x = clamp(s.apparatus ?? motion);
    const [peak,end] = examples[s.index];
    curves.forEach((curve,i)=>curve.forEach(segment=>{ segment.visible = i === s.index; }));
    const edge = x <= .5 ? .28 : end;
    const y = edge + (peak-edge)*Math.sin((x <= .5 ? x : 1-x)*Math.PI)**2;
    bead.position.set(-1.03 + 2.06*x,.41 + y*1.09,.143);
    screen((x < .47 ? 'Reactants → barrier' : x < .53 ? 'Activation barrier' : 'Barrier → products'));
  };
}

function kineticBench(k, objective) {
  if (objective.number === '6') return energyProfile(k);
  plinth(k);
  const solution = glass(0xb3cfcf,.66);
  const bubbles = glass(0xd7f3f1,.42);
  const shell = glass();
  const solid = material(0xf1e6d1,{roughness:.90});
  const isBalance = objective.number === '3';
  const updateFlask = conicalFlask(k,-.64,.31,0,solution);
  const setFill = updateFlask(20);
  const syringeAssembly = subassembly(k,() => {
    k.disc(.10,.091,-.64,.954,0,k.dark);
    bar(k,.028,[-.64,.97,0],[-.64,1.30,0],shell);
    bar(k,.028,[-.64,1.30,0],[-1.10,1.43,0],shell);
    bar(k,.028,[-1.10,1.43,0],[-1.00,1.46,0],shell);
    const movePlunger = gasSyringe(k,-.11,1.46,0,!isBalance);
    return (signals,_time,motion) => movePlunger(kineticsState(objective,signals.index,signals.apparatus ?? motion).volume);
  });
  const observeGrip = isBalance ? k.box(.24,.081,.097,.13,.31,.50,k.response) : null;
  if (observeGrip) k.grip?.(observeGrip,'horizontal');
  const screen = readout(k,1.30,.51,.60,.27,'Reaction data');
  const glassBeads = Array.from({length:11},()=>k.sphere(.019,-.64,.38,0,bubbles));
  const chips = Array.from({length:7},(_,i)=>k.sphere(.039+(i%2)*.019,-.64+Math.sin(i*2.3)*.13,.355,Math.cos(i*2.3)*.11,solid));
  const balance = k.box(.67,.06,.55,-.64,.302,0,k.pale);
  return (s,t,motion) => {
    const p = s.apparatus ?? motion;
    const v = kineticsState(objective,s.index,p);
    const balanceTrial = isBalance && s.index === 0;
    balance.visible = balanceTrial;
    syringeAssembly(!isBalance || s.index === 1 ? s : null,t,motion);
    if (observeGrip) observeGrip.rotation.z = -1.44 * p;
    const lost = v.volume/24000 * 44.01;
    const data = objective.number === '4' ? fixed(v.seconds)+' s · '+fixed(v.volume)+' mL'
      : balanceTrial ? fixed(lost,3)+' g mass lost'
      : isBalance && s.index === 2 ? 'No timed reading'
      : objective.number === '7' ? fixed(v.fraction*100,4)+'% above Eₐ'
      : fixed(v.volume)+' mL evolved';
    screen(data);
    const density = objective.number === '4' ? v.slope : Math.min(8,v.rate);
    glassBeads.forEach((bubble,i) => {
      const phase = (t * (.62 + .12*density) + i/11) % 1;
      bubble.visible = p > .001 && i < 2 + Math.min(9,density*2.5);
      bubble.position.set(-.64 + .17*Math.sin(i*2.3+phase*.84)*(1-phase*.68),.36 + (setFill-.36)*phase,.12*Math.cos(i*2.3 + phase));
      bubble.scale.setScalar(.75 + .40*phase);
    });
    chips.forEach((chip,i) => {
      const consumed = objective.number === '2' && s.index === 1;
      chip.visible = !consumed || i/7 < 1-p;
      const crushed = objective.number === '1' && s.index===1;
      chip.scale.setScalar(crushed ? .58 : 1);
    });
  };
}

function polarity(k,x,y,z,positive,color) {
  k.box(.20,.03,.033,x,y,z,color);
  const plus = k.box(.030,.18,.033,x,y,z,color);
  plus.visible = positive;
}

function electrodeAccessories(k) {
  const voltage = k.box(.78,.37,.50,0,1.84,-.26,k.dark);
  voltage.material.roughness = .59;
  const terminals = [k.disc(.067,.042,-.25,1.72,-.005,k.pale),k.disc(.067,.042,.25,1.72,-.005,k.pale)];
  terminals.forEach(terminal=>{terminal.rotation.x = Math.PI/2;});
  return terminals;
}

function electrolysis(k, objective) {
  plinth(k);
  const copper = material(0xbf774c,{metalness:.62,roughness:.30});
  const metal = material(0xa7bcc5,{metalness:.64,roughness:.28});
  const graphite = material(0x434a50,{roughness:.79});
  const blueSolution = glass(0x369dc0,.72);
  const dyedGlass = glass(0xc4e3e8,.55);
  const anodeBubbleGlass = glass(0xd6eef3,.49);
  const track = material(0x364858,{metalness:.24});
  const positive = material(0xd08a66);
  const negative = material(0x7ccdda);
  const y = .91, z = .025;
  beaker(k,.575,1.02,0,.29,z,blueSolution)(.63);
  electrodeAccessories(k);
  polarity(k,-.25,1.95,.010,false,negative);
  polarity(k,.25,1.95,.010,true,positive);
  for (const side of [-1,1]) {
    bar(k,.026,[side*.25,1.72,-.012],[side*.96,1.72,-.012],track);
    bar(k,.026,[side*.96,1.72,-.012],[side*.97,1.43,.045],track);
    bar(k,.026,[side*.97,1.43,.045],[side*.32,1.43,.045],track);
  }
  const cathode = k.box(.14,.87,.13,-.32,y,.044,graphite);
  const anode = k.box(.14,.87,.13,.32,y,.044,graphite);
  bar(k,.022,[-.32,1.35,.044],[-.32,1.43,.044],track);
  bar(k,.022,[.32,1.35,.044],[.32,1.43,.044],track);
  const deposit = k.box(.16,.51,.016,-.32,.68,.120,copper);
  const dial = k.box(.14,.070,.054,.57,1.78,.27,k.response);
  const dialAxle = k.disc(.083,.058,.57,1.78,.263,k.dark);
  dialAxle.rotation.x = Math.PI/2;
  k.grip?.(dial,'horizontal');
  const meter = readout(k,1.36,0,.51,.59,'Electrolysis cell');
  const leftBubbles = Array.from({length:7},()=>k.sphere(.021,-.32,.49,.113,dyedGlass));
  const rightBubbles = Array.from({length:7},()=>k.sphere(.021,.32,.49,.113,anodeBubbleGlass));
  const ions = Array.from({length:18},(_,i)=>k.sphere(.028,0,.54,.14,i%2?negative:positive));
  const dry = material(0xe5ded0,{roughness:.84});
  const grains = Array.from({length:12},(_,i)=>k.box(.045,.045,.042,(i%6-2.5)*.12,.35,(i<6?-.15:.15),dry));
  const initialBlue = new Color(0x369dc0);
  const weakBlue = new Color(0x81b9cf);
  return (s,t,motion) => {
    const p = clamp(s.apparatus ?? motion);
    const index = s.index, n = Number(objective.number);
    const hasSolid = n === 1 && index === 0 || n === 2 && index === 1;
    const noDrive = n === 1 && index < 2 || n === 2 && index > 0 || n === 5 && index===2;
    const active = p > .002 && !noDrive;
    const copperBath = n === 5 || n === 8;
    const copperTransfer = n === 5 && index === 1;
    const molten = n === 3 && (index===0 || index===3) || n===7;
    const gasCathode = n===3 && (index===1 || index===2) || n===6;
    const gasAnode = !copperTransfer;
    anodeBubbleGlass.color.setHex(n===3 && molten ? 0xc98866 : n===3 && index===1 || n===7 ? 0xafc780 : 0xd6eef3);
    cathode.material = copperTransfer ? copper : graphite;
    anode.material = copperTransfer ? copper : graphite;
    if (molten) deposit.material = metal;
    else deposit.material = copper;
    deposit.visible = active && (copperBath || molten);
    deposit.scale.y = p;
    deposit.position.y = .43 + .25 * p;
    anode.scale.x = copperTransfer ? 1 - .23*p : 1;
    blueSolution.opacity = hasSolid ? .08 : molten ? .59 : .70;
    blueSolution.color.copy(copperBath ? initialBlue : weakBlue).lerp(weakBlue,n===5 && index===0 ? .60*p : 0);
    dial.rotation.z = -Math.PI * p * .68;
    grains.forEach(grain=>{ grain.visible = hasSolid; });
    ions.forEach((ion,i) => {
      const cation = i%2 === 0;
      const phase = (i/ions.length + t*.4*p) % 1;
      const x = active ? (cation ? .39 - phase*.71 : -.39 + phase*.71)
        : .42*Math.sin(2.4*i + t*(hasSolid ? 0 : .43));
      ion.position.set(x,.43 + .45*((i*7%17)/17),.105 + .038*Math.sin(i+t));
    });
    [leftBubbles,rightBubbles].forEach((group,side)=>group.forEach((bubble,i)=>{
      const phase = (i/group.length + t*.48) % 1;
      bubble.visible = active && (side===0?gasCathode:gasAnode) && i < 1 + p*group.length;
      bubble.position.set((side===0?-.32:.32)+.041*Math.cos(i*2.3 + phase),.50 + phase * .45,.13);
    }));
    meter(copperBath && n===5 && !noDrive ? fixed(copperMassMG(.5,60*p),2)+' mg Cu' : hasSolid ? 'Ions held in solid' : !active ? 'No current' : 'Ions carry current');
  };
}

function subassembly(k,build) {
  const anchor = k.box(.01,.01,.01,0,.20,0,k.dark);
  const meshes = anchor.parent.children;
  const start = meshes.length;
  const tick = build();
  const parts = meshes.slice(start);
  return (s,time,motion) => {
    for (const part of parts) part.visible = !!s;
    if (s) tick(s,time,motion);
  };
}

function filterRig(k,trapsSolid) {
  const pane = glass(0xbcdae3,.26);
  const source = glass(0xbcd6d3,.74);
  const output = glass(0xc4dde1,.74);
  const filterPaper = material(0xe5dfcf,{roughness:.85});
  const sediment = material(0x9b7357,{roughness:.89});
  const funnelX = -.20, y = 1.405;
  k.box(.51,.078,.66,-.95,.29,-.23,k.dark);
  bar(k,.042,[-.96,.35,-.25],[-.96,1.83,-.25],k.pale);
  bar(k,.031,[-.96,y,-.25],[funnelX,y,0],k.pale);
  cylinder(k,.36,.055,.47,funnelX,y,0,pane,true).renderOrder=2;
  cylinder(k,.331,.043,.414,funnelX,y+.009,0,filterPaper,true);
  k.tube(.043,.265,funnelX,1.05,0,pane);
  const tray = beaker(k,.337,.57,funnelX,.29,.03,output);
  const reservoir = beaker(k,.286,.50,.74,.295,-.16,source);
  const valve = k.box(.24,.048,.12,.73,.87,-.16,k.response);
  k.grip?.(valve,'horizontal');
  const particulates = Array.from({length:15},(_,i)=>k.sphere(.017 + (i%4)*.007,funnelX + Math.cos(i*2.38)*.09,1.21,Math.sin(i*2.38)*.082,sediment));
  const droplets = Array.from({length:5},()=>k.sphere(.020,funnelX,.89,.01,pane));
  const data = readout(k,1.10,.70,1.38,.12,'Filtrate');
  return (s,t,motion) => {
    const p = clamp(s.apparatus ?? motion);
    reservoir(.41 * (1-p));
    const delayed = clamp((p-.11)/.89);
    tray(.47*delayed);
    valve.rotation.z = -.85*p;
    for (const grain of particulates) grain.visible = trapsSolid && p>.02;
    droplets.forEach((drop,i)=>{
      const phase=(t*.77+i/5)%1;
      drop.visible = delayed>.002 && p < .999;
      drop.position.y=.91-(.91-(.32 + .47*delayed))*(phase**1.48);
    });
    data(trapsSolid ? 'Dissolved phase' : 'Clear brine');
  };
}

function distillationRig(k,fractional,showCrystals = false) {
  const outer = glass();
  const vaporGlass = glass(0xe8f2fc,.31);
  const condensate = glass(0xacdce0,.68);
  const brine = glass(0xc2d6cc,.80);
  const coolant = glass(0x58a0b5,.38);
  const heater = material(0x5d5754,{emissive:0xcb5621,emissiveIntensity:.04});
  const flaskX = -.76;
  k.box(.70,.18,.73,flaskX,.35,0,k.dark);
  k.disc(.37,.065,flaskX,.46,0,heater);
  const flask = k.sphere(.355,flaskX,.82,0,outer);
  flask.renderOrder = 2;
  const modelLiquid = liquidColumn(k,.296,flaskX,.60,0,brine);
  k.tube(.087,.40,flaskX,1.14,0,outer);
  k.disc(.093,.055,flaskX,1.354,0,k.dark);
  const bendStart = [flaskX,1.37,0];
  const condenserStart = [-.42,1.33,0];
  const condenserEnd = [.68,.93,0];
  const receiverTip = [.85,.77,0];
  bar(k,.054,bendStart,condenserStart,outer);
  if (fractional) {
    k.tube(.112,.53,flaskX,1.36,0,outer);
    for (let i=0;i<13;i+=1) {
      k.sphere(.034,flaskX+.060*Math.cos(i*2.4),1.15+i*.037,.053*Math.sin(i*2.4),k.crystal);
    }
  }
  bar(k,.125,condenserStart,condenserEnd,coolant);
  bar(k,.041,condenserStart,condenserEnd,outer);
  bar(k,.043,condenserEnd,receiverTip,outer);
  bar(k,.033,[-.21,1.27,0],[-.28,1.57,-.24],coolant);
  bar(k,.033,[.56,.966,0],[.63,.66,-.29],coolant);
  bar(k,.033,[.63,.66,-.29],[.97,.68,-.35],coolant);
  bar(k,.032,[-.28,1.57,-.24],[-.63,1.76,-.25],coolant);
  const receiver = beaker(k,fractional?.205:.285,.49,.85,.285,0,condensate);
  const secondReceiver = fractional ? beaker(k,.205,.49,.51,.285,.42,condensate) : null;
  if (fractional) bar(k,.034,condenserEnd,[.51,.76,.42],outer);
  const crystals = showCrystals ? evaporatorAliquot(k) : null;
  const dial = k.box(.138,.061,.054,flaskX,.37,.385,k.response);
  k.grip?.(dial,'horizontal');
  const screen = readout(k,1.18,.66,1.58,.12,fractional ? 'Fraction collected' : 'Distillate collected');
  const flowing = Array.from({length:9},()=>k.sphere(.023,0,.91,.01,vaporGlass));
  const cooled = Array.from({length:6},()=>k.sphere(.024,.85,.76,.013,condensate));
  return (s,t,motion) => {
    const p=clamp(s.apparatus ?? motion);
    const fraction=clamp((p-.19)/.81);
    const collected=30*fraction;
    heater.emissiveIntensity=.08+p*.48;
    modelLiquid(.35-.18*fraction);
    const firstPart = fractional ? Math.min(fraction,.48) : fraction;
    const secondPart = fractional ? Math.max(0,fraction-.48) : 0;
    receiver(firstPart * (fractional ? .75 : .42));
    secondReceiver?.(.75*secondPart);
    crystals?.(fraction);
    dial.rotation.z=-1.6*p;
    screen(fractional ? fixed(firstPart*30)+' / '+fixed(secondPart*30)+' mL' : fixed(collected)+' mL');
    flowing.forEach((dot,i)=>{
      const phase=(t*.50+i/flowing.length)%1;
      dot.visible=p>.17 && i<2+fraction*7;
      dot.position.set(-.40+1.08*phase,1.32-.40*phase,Math.sin(i*2.38+phase)*.016);
    });
    cooled.forEach((drop,i)=>{
      const phase=(t*.71+i/6)%1;
      drop.visible=fraction>.02 && i<1+fraction*5;
      const afterSwitch=fractional && secondPart>0;
      const fluidDepth=afterSwitch?.75*secondPart:firstPart*(fractional?.75:.42);
      drop.position.set(afterSwitch?.51:.85,.77-(.77-(.32+fluidDepth))*(phase**1.48),afterSwitch?.42:.013);
    });
  };
}

function evaporatorAliquot(k) {
  const salts = material(0xf1e7d1,{roughness:.55});
  const crystalTray = material(0xc7d5d7,{roughness:.43});
  k.disc(.228,.04,.04,.315,.45,crystalTray);
  const crystals=Array.from({length:18},(_,i)=>k.box(.038,.043,.041,.04+.16*Math.sin(i*2.39)*(i%6)/5,.349,.45+.16*Math.cos(i*2.39)*(i%6)/5,salts));
  crystals.forEach((crystal,i)=>crystal.rotation.set(i*.62,i*.83,i*.61));
  return fraction => {
    crystals.forEach((crystal,i)=>{crystal.visible=i/18<clamp((fraction-.55)/.45);});
  };
}

function evaporator(k) {
  const hot = material(0x454243,{emissive:0xe66e21,emissiveIntensity:.04});
  const porcelain = material(0xdcddd2,{roughness:.51});
  const solution = glass(0xc3dbd8,.71);
  const salts = material(0xf4e8d5);
  k.box(1.14,.16,.93,0,.36,0,k.dark);
  k.disc(.63,.084,0,.476,0,hot);
  cylinder(k,.588,.42,.18,0,.604,0,porcelain,true);
  const fill=liquidColumn(k,.44,0,.603,0,solution);
  const crystal=Array.from({length:52},(_,i)=>k.box(.063,.07,.065,Math.sin(i*2.38)*.36*(i%7)/6,.626,Math.cos(i*2.38)*.36*(i%7)/6,salts));
  const fumes=Array.from({length:13},()=>k.sphere(.054,0,.79,0,glass(0xf8ffff,.20)));
  const dial=k.box(.19,.07,.05,.47,.31,.50,k.response);
  k.grip?.(dial,'horizontal');
  const screen=readout(k,1.15,.49,1.46,.12,'Open evaporator');
  return (s,t,motion)=>{
    const p=clamp(s.apparatus ?? motion), loss=clamp((p-.12)/.88);
    fill(.101*(1-loss));
    hot.emissiveIntensity=.03+.55*p;
    dial.rotation.z=-1.4*p;
    crystal.forEach((chip,i)=>{
      chip.rotation.set(i*.47,i*.587,i*.694);
      chip.visible=i/52<clamp((loss-.65)/.35);
    });
    fumes.forEach((dot,i)=>{
      const phase=(t*.42+i/13)%1;
      dot.visible=loss>.01&&loss<.999;
      dot.position.set(.33*Math.cos(i*2.38+phase),.73+phase*.55,Math.sin(i*2.38)*.29);
      dot.scale.setScalar(.82+phase*.52);
    });
    screen('No collected water');
  };
}

function separation(k,objective) {
  plinth(k);
  const methods=objective.number==='1'
    ? [()=>filterRig(k,true),()=>distillationRig(k,false,true),()=>distillationRig(k,true),()=>filterRig(k,false)]
    : [()=>filterRig(k,false),()=>distillationRig(k,false),()=>evaporator(k)];
  const apparatus=methods.map(method=>subassembly(k,method));
  return (s,t,motion)=>apparatus.forEach((render,index)=>render(index===s.index?s:null,t,motion));
}

const acidity = {
  2: [[0xc65663,0xd95f66],[0x577da9,0xecd16a],[0x577da9,0xe4995c]],
  5: [[0x527db1,0xe9cd56],[0xb85f62,0xc94f62],[0xb85f62,0xe9cb5f]],
  6: [[0xe99c57],[0x5cbd92],[0x8359b4]]
};
const acidPh = [4,7,12];

function acidIndicators(k,objective) {
  const n=Number(objective.number);
  plinth(k,2.6,1.28);
  k.box(1.73,.09,.89,0,.33,.02,k.dark);
  const frame=material(0xc0d0d1,{metalness:.49,roughness:.37});
  const strip=k.box(.16,.75,.033,-.42,1.49,.06,material(n===5?0xb85f62:0x577da9,{roughness:.89}));
  const clampGrip=k.box(.27,.08,.126,-.42,1.91,.045,k.response);
  k.grip?.(clampGrip,'vertical');
  bar(k,.047,[-1.03,.36,-.36],[-1.03,2.02,-.36],frame);
  bar(k,.039,[-1.03,1.80,-.36],[-.44,1.8,0],frame);
  const vial1Liquid=glass(0xcfeaf0,.76);
  const vial2Liquid=glass(0xeee0a8,.84);
  beaker(k,.295,.72,-.42,.37,.03,vial1Liquid)(.51);
  beaker(k,.295,.72,.43,.37,.03,vial2Liquid)(.51);
  const reagent = cylinder(k,.074,.022,.16,.43,1.32,.027,glass());
  const drop=k.sphere(.038,.43,1.12,.03,glass(0xd5a359,.62));
  const marker=readout(k,1.57,.39,1.63,.15,n===6?'Universal indicator':'Indicator test');
  const baseStrip=new Color(n===5?0xb85f62:0x577da9);
  const clearSolution=new Color(0xcfeaf0);
  return (s,t,motion)=>{
    const p=clamp(s.apparatus ?? motion);
    const tested=clamp((p-.21)/.79);
    const [paper,dye]=acidity[n][s.index];
    strip.material.color.copy(baseStrip).lerp(tint.setHex(paper),tested);
    strip.position.y=1.47-.58*p;
    clampGrip.position.y=strip.position.y+.389;
    reagent.position.y=1.59-.35*p;
    drop.visible=tested>.04&&tested<.999&&n!==6;
    drop.position.y=1.28-.45*(t*.95%1);
    vial1Liquid.color.copy(clearSolution).lerp(tint.setHex(n===6?paper:0xcfeaf0),tested);
    vial2Liquid.color.copy(clearSolution).lerp(tint.setHex(dye??paper),tested);
    marker(tested>.16 && n===6?'pH ≈ '+acidPh[s.index]:p>=.999?'Compare colours':'Dip and test');
  };
}

function waterPads(k) {
  plinth(k);
  const padColours=[material(0x5077a0,{roughness:.93}),material(0xe1e5df,{roughness:.84})];
  const tips=[-.51,.51].map((x,i)=>{
    k.box(.68,.16,.61,x,.34,.04,k.dark);
    k.box(.59,.05,.52,x,.443,.04,padColours[i]);
    const glassCap=glass(0xc2e6e8,.68);
    cylinder(k,.084,.025,.20,x,.88,.034,glassCap);
    return k.sphere(.036,x,.63,.031,glassCap);
  });
  const grip=k.box(1.15,.074,.13,0,1.10,.036,k.response);
  k.grip?.(grip,'vertical');
  const left=readout(k,.82,-.55,1.54,.15,'Cobalt chloride');
  const right=readout(k,.95,.55,1.54,.15,'Copper sulfate');
  const colors=[
    [new Color(0xd98cbb),new Color(0x549aca)],
    [new Color(0x5077a0),new Color(0xe1e5df)],
    [new Color(0x395b7e),new Color(0xbcbbb3)]
  ];
  const start=[new Color(0x5077a0),new Color(0xe1e5df)];
  const facts=[['Pink','Blue'],['Blue','White'],['Darker blue','Gray-white']];
  return (s,t,motion)=>{
    const p=clamp(s.apparatus ?? motion), response=clamp((p-.31)/.69);
    grip.position.y=1.10-.24*p;
    tips.forEach((tip,i)=>{
      padColours[i].color.copy(start[i]).lerp(colors[s.index][i],response);
      tip.visible=response>.01&&response<.99;
      tip.position.y=.754-.30*(t*.71%1);
    });
    left(response > .35 ? facts[s.index][0] : facts[1][0]);
    right(response > .35 ? facts[s.index][1] : facts[1][1]);
  };
}

function waterTransition(objective,index,p) {
  const t = -16 + 131*clamp(p);
  if (objective.mission.id === 'C12.4' && objective.number === '3') {
    const meltRange=index===0?[-12,0]:[0,0];
    return {temperature:t,melted:meltRange[0]===meltRange[1]?Number(t>=meltRange[0]):clamp((t-meltRange[0])/12), boiling:t >= (index===2?83:100)};
  }
  const melting=[0,-6,20][index], boiling=[100,106,80][index];
  return {temperature:t,melted:Number(t>=melting),boiling:t>=boiling};
}

function temperatureBath(k,objective) {
  plinth(k);
  const liquid=glass(0x72b9d2,.80);
  const plate=material(0x61605c,{emissive:0xdf652c,emissiveIntensity:.03});
  const x=-.43;
  const holder=k.box(.826,.121,.88,x,.322,0,k.dark);
  holder.material.roughness=.7;
  k.disc(.42,.057,x,.409,0,plate);
  const fill=beaker(k,.331,.86,x,.438,0,liquid);
  const metal=material(0xbfcbd1,{metalness:.56,roughness:.29});
  bar(k,.023,[x,.67,0],[x,1.80,0],metal);
  const probe=k.disc(.066,.154,x,1.80,0,metal);
  probe.name='Temperature probe';
  const ice=Array.from({length:12},(_,i)=>k.box(.105,.1,.12,x+Math.cos(i*2.386)*.165,.70+(i%3)*.082,.166*Math.sin(i*2.386),glass(0xc1e8f2,.52)));
  ice.forEach((shape,i)=>{shape.rotation.set(i*.27,i*1.37,i*.62);});
  const bubbles=Array.from({length:8},()=>k.sphere(.023,x,.60,.048,glass(0xd3f3fb,.51)));
  const dial=k.box(.201,.065,.054,-.16,.323,.463,k.response);
  k.grip?.(dial,'horizontal');
  const screen=readout(k,1.08,.58,1.25,.17,'Controlled bath');
  const state=readout(k,1.08,.58,.91,.198,'Specimen');
  return (s,t,motion)=>{
    const p=clamp(s.apparatus ?? motion);
    const result=waterTransition(objective,s.index,p);
    dial.rotation.z=-1.48*p;
    plate.emissiveIntensity=.025+.59*p;
    fill(.35*result.melted);
    ice.forEach((shape,i)=>{shape.visible=i/12<1-result.melted;});
    bubbles.forEach((bubble,i)=>{
      const phase=(t*.92+i/8)%1;
      bubble.visible=result.boiling;
      bubble.position.set(x+.12*Math.sin(i*2.3+phase),.49+.29*phase,.078*Math.cos(i*1.8));
    });
    screen(fixed(result.temperature)+' °C');
    state(result.boiling?'Boiling':result.melted===1?'Liquid':result.melted>0?'Melting':'Solid');
  };
}

const conductivity = [250,1,10000];
function currentUA(index,position) {
  // σ in µS/cm, effective immersed area 1 cm² at full travel, a 1 cm gap and 2 V.
  return 2 * conductivity[index] * clamp(position);
}

function conductivityBench(k) {
  plinth(k);
  const x=-.23;
  const solution=glass(0xabd0d5,.66), graphite=material(0x424d53,{roughness:.82});
  beaker(k,.494,.89,x,.3,.04,solution)(.68);
  k.box(.65,.08,.59,-.96,.31,-.26,k.dark);
  bar(k,.037,[-.97,.33,-.29],[-.97,1.92,-.29],k.pale);
  bar(k,.033,[-.97,1.61,-.29],[x,1.61,.03],k.pale);
  const grip=k.box(.52,.10,.19,x,1.64,.035,k.response);
  k.grip?.(grip,'vertical');
  const electrodes=[x-.123,x+.123].map(x0=>k.box(.085,.366,.076,x0,1.37,.045,graphite));
  const screen=readout(k,1.00,.71,1.21,.17,'Model ammeter');
  return (s,_t,motion)=>{
    const p=clamp(s.apparatus ?? motion);
    grip.position.y=1.64-.59*p;
    electrodes.forEach(e=>{e.position.y=grip.position.y-.24;});
    const value=currentUA(s.index,p);
    screen(value>=1000 ? fixed(value/1000,2)+' mA' : fixed(value,1)+' µA');
  };
}

function treatment(k) {
  plinth(k,2.80,1.23);
  const fluid=[glass(0xb88a58,.75),glass(0xb7c2ab,.68),glass(0x8cbdcc,.60)];
  const sand=material(0xbb9c72,{roughness:.85}), carbon=material(0x4b4d45,{roughness:.88});
  const valves=k.box(.265,.054,.102,-1.08,1.46,.015,k.response);
  k.grip?.(valves,'horizontal');
  const positions=[-.84,-.02,.82];
  const jars=positions.map((x,i)=>beaker(k,.294,.98,x,.29,0,fluid[i]));
  k.tube(.044,.201,-.49,.58,0,k.crystal).rotation.z=Math.PI/2;
  k.tube(.044,.218,.39,.58,0,k.crystal).rotation.z=Math.PI/2;
  const media=[k.disc(.257,.15,-.02,.52,0,sand), k.disc(.255,.15,.82,.52,0,carbon)];
  const sediment=Array.from({length:12},(_,i)=>k.sphere(.015+i%3*.006,-.85,.31,0,sand));
  const screen=readout(k,1.64,0,1.48,.16,'Treatment train');
  return (s,t,motion)=>{
    const p=clamp(s.apparatus ?? motion);
    const filters=s.index!==2, carbonBed=s.index!==1, disinfection=s.index===0;
    valves.rotation.z=-p*Math.PI/2;
    jars.forEach((fill,i)=>fill(i===0?.72-.20*p:i===1?.22+.44*p:.08+.53*p));
    media[0].visible=filters;
    media[1].visible=carbonBed;
    fluid[1].color.setHex(filters?0xaec8c4:0xb88a58);
    fluid[2].color.setHex(filters?0x8cbdcc:0xb88a58);
    sediment.forEach((grain,i)=>{
      const phase=(t*.605+i/12)%1;
      const settling=filters?p*.86:0;
      grain.position.set(-.84+.23*Math.sin(i*2.39),.335+phase*(.69-.57*settling),.22*Math.cos(i*2.39));
    });
    screen(disinfection && p>.85 ? 'Disinfection complete' : filters && p>.29?'Solids retained':carbonBed && p>.49?'Carbon stage':'Raw-water feed');
  };
}

const control = {
  titration: {label:'Burette stopcock',hint:'Drag to dispense titrant. Check the meniscus and watch how the indicator responds.'},
  chromatography: {label:'Chromatogram cursor',hint:'Drag the cursor to advance solvent travel and compare the solute distances.'},
  kinetics: {label:'Reaction progress',hint:'Advance the measured interval. Compare the gas volume or reaction trace.'},
  electrolysis: {label:'Cell operation',hint:'Turn the control to advance the cell and inspect each electrode.'},
  separation: {label:'Separation control',hint:'Operate the selected apparatus. Compare the residue and the liquid or vapor collected.'},
  indicator: {label:'Indicator strip holder',hint:'Lower the indicator into the sample and compare the final colors.'},
  pads: {label:'Sample dropper',hint:'Apply the water sample and compare both tests against their original colors.'},
  temperature: {label:'Bath temperature',hint:'Raise the bath temperature and watch the specimen change state.'},
  conductivity: {label:'Conductivity probe',hint:'Lower the electrodes into the sample and read the ammeter at full depth.'},
  treatment: {label:'Intake valve',hint:'Advance the water through the selected treatment train.'}
};

function simulationType(objective) {
  const id=objective.mission.id;
  if (id==='C12.2') return 'titration';
  if (id==='C12.3') return 'chromatography';
  if (id==='C6.2') return 'kinetics';
  if (id==='C4.1') return 'electrolysis';
  if (id==='C12.4') return objective.number==='3'?'temperature':'separation';
  if (id==='C7.1' && ['2','5','6'].includes(objective.number)) return 'indicator';
  if (id==='C10.1') return ['pads','temperature','conductivity','treatment'][Number(objective.number)-1] ?? null;
  return null;
}

export function chemistrySimulationControl(objective) {
  const type=simulationType(objective);
  if (!type) return null;
  const energyProfile=objective.key==='C6.2/6';
  const settings=energyProfile ? {label:'Reaction pathway cursor',hint:'Move the cursor over the reactants, activation barrier, and products.'} : control[type];
  return {
    ...settings,
    initial:0,
    format(position,index=0) {
      const p=clamp(position);
      if (type==='titration') return fixed(titrationState(objective,index,p).delivered,objective.number==='2'?3:2)+' mL';
      if (type==='chromatography') return fixed(chromatographyFront(p))+' mm';
      if (type==='temperature') return fixed(waterTransition(objective,index,p).temperature)+' °C';
      if (type==='kinetics' && !energyProfile && objective.key!=='C6.2/3') return fixed(kineticsState(objective,index,p).seconds)+' s';
      return Math.round(p*100)+'%';
    }
  };
}

export function chemistryLiveReading(objective,setupIndex,position) {
  const type=simulationType(objective), p=clamp(position);
  if (type==='titration') {
    const state=titrationState(objective,setupIndex,p);
    return fixed(state.delivered,state.endpointLab?3:2)+' mL delivered · pH '+fixed(state.ph,2);
  }
  if (type==='chromatography') {
    const front=chromatographyFront(p);
    return objective.number==='3' && front>0
      ? fixed(front/2)+' mm spot · '+fixed(front)+' mm solvent front'
      : fixed(front)+' mm solvent front';
  }
  if (type==='kinetics' && objective.key!=='C6.2/6') {
    const data=kineticsState(objective,setupIndex,p);
    if (objective.key==='C6.2/3') {
      if (setupIndex===0) return fixed(data.seconds)+' s · '+fixed(data.volume/24000*44.01,3)+' g lost';
      if (setupIndex===2) return 'No timer for this setup';
    }
    if (objective.key==='C6.2/4') return fixed(data.seconds)+' s · '+fixed(data.volume)+' mL';
    if (objective.key==='C6.2/7') return data.fraction.toExponential(2)+' above threshold · '+fixed(data.volume)+' mL gas';
    return fixed(data.seconds)+' s · '+fixed(data.volume)+' mL gas';
  }
  if (type==='electrolysis' && objective.key==='C4.1/5') {
    return setupIndex===2?'No applied current':fixed(copperMassMG(.5,60*p),2)+' mg copper deposited · '+fixed(60*p)+' s';
  }
  if (type==='separation' && (objective.number==='1' && (setupIndex===1 || setupIndex===2) || objective.number==='2' && setupIndex===1)) {
    const fraction=clamp((p-.19)/.81);
    if (objective.number==='1' && setupIndex===2) {
      return fixed(30*Math.min(fraction,.48))+' mL first fraction · '+fixed(30*Math.max(0,fraction-.48))+' mL second fraction';
    }
    return fixed(30*fraction)+' mL condensate collected';
  }
  if (type==='temperature') {
    const state=waterTransition(objective,setupIndex,p);
    return fixed(state.temperature)+' °C · '+(state.boiling?'boiling':state.melted===1?'liquid':state.melted>0?'melting':'solid');
  }
  if (type==='conductivity') {
    const value=currentUA(setupIndex,p);
    return value>=1000 ? fixed(value/1000,2)+' mA model current' : fixed(value)+' µA model current';
  }
  if (type==='indicator' && objective.number==='6' && p>.5) return 'Approximate pH '+acidPh[setupIndex];
  return null;
}

export function createChemistrySimulation(k,objective) {
  const renderers={
    titration, chromatography, kinetics:kineticBench, electrolysis, separation, indicator:acidIndicators,
    pads:waterPads, temperature:temperatureBath, conductivity:conductivityBench, treatment
  };
  const type=simulationType(objective);
  return type ? renderers[type](k,objective) : null;
}
