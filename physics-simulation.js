import { Vector3 } from 'three';
import { motionSample } from './practical-motion.js';

const DEG = Math.PI / 180;
const UP = new Vector3(0, 1, 0);
const GRAVITY = 9.8;
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const fixed = (value, decimals = 2) => Number(value.toFixed(decimals)).toString();
const f = (value, unit) => `${number.format(Math.abs(value) < 0.0005 ? 0 : value)} ${unit}`;
const norm = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function refractionAt(incidentDegrees, fromIndex, toIndex) {
  const sine = fromIndex * Math.sin(incidentDegrees * DEG) / toIndex;
  const totalInternal = Math.abs(sine) > 1 + 1e-12;
  return {
    reflected: incidentDegrees,
    transmitted: totalInternal ? null : Math.asin(Math.max(-1, Math.min(1, sine))) / DEG,
    totalInternal
  };
}

export function thinLensAt(focalLength, distance) {
  if (Math.abs(distance - focalLength) <= 1e-9) return { distance: Infinity, magnification: null, real: false };
  const image = focalLength * distance / (distance - focalLength);
  return { distance: image, magnification: -image / distance, real: image > 0 };
}

export function springExtension(load, constant, limit = Infinity, aboveLimitConstant = constant) {
  return Math.min(load, limit) / constant + Math.max(0, load - limit) / aboveLimitConstant;
}

function describe(objective) {
  const id = objective.mission.id;
  const n = Number(objective.number);
  if (id === 'P1.1' && n === 3) return [pendulum, pendulumState, 'Turn the timer dial', 'Scrub the swing count. Compare the fixed reaction delay per period.'];
  if (id === 'P1.2' && n === 13) return [dropTube, dropState, 'Lower the timing marker', 'Advance the drop in slow motion and watch the speed sensor.'];
  if (id === 'P1.2') return [track, cartState(n), 'Advance the timing slider', 'Slide through the run and read the cart position and speed.'];
  if (id === 'P1.3') return [gravityBalance, gravityState(n), n === 1 ? 'Adjust the gravity dial' : 'Lower the test load', 'Compare mass and gravitational force on the scale.'];
  if (id === 'P1.4') return [densityTank, densityState(n), n === 1 ? 'Close the volume gauge' : 'Lower the sample', 'Lower the specimen or fill the sample vessel and read the sensors.'];
  if (id === 'P1.5.1' && n >= 8) return [spring, springState(n), 'Add load to the spring', 'Drag the spring hanger down to increase the calibrated force.'];
  if (id === 'P1.5.1' && [2, 6, 7].includes(n)) return [track, forceState(n), 'Advance the track timer', 'Drag the timing slider to compare motion under the installed forces.'];
  if (id === 'P1.5.2') return [n === 1 ? swingGate : lever, momentState(n), 'Move the force trolley', 'Slide the point of application and read each turning moment.'];
  if (id === 'P1.5.3' && n === 3) return [tiltTable, tiltState, 'Tilt the test platform', 'Move the tilt control and watch the vertical weight line relative to the wheelbase.'];
  if (id === 'P1.6.1' && n === 4) return [track, kineticState, 'Set the roller speed', 'Turn the speed control and measure the rider’s kinetic energy.'];
  if (id === 'P1.6.1' && n === 5) return [hoist, heightState, 'Raise the platform', 'Adjust the rider’s height and read the change in gravitational energy.'];
  if (id === 'P1.6.2' && n === 2) return [winchTrack, workState, 'Pull the winch carriage', 'Move the load along the track in the direction of the pull.'];
  if (id === 'P1.6.4') return [hoist, powerState, 'Run the lift timer', 'Advance the motor timer and measure the energy transferred.'];
  if (id === 'P1.7') return [press, pressureState(n), 'Apply the load', 'Lower the press onto the selected contact pads.'];
  if (id === 'P3.2.1' && n === 2) return [mirrorImage, mirrorImageState, 'Move the sign towards its mark', 'Compare the sign with the position and height of its virtual image.'];
  if (id === 'P3.2.1') return [mirror, mirrorState(n), n === 3 || n === 5 ? 'Rotate the receiver' : 'Rotate the incident laser', 'Rotate the component and compare angles measured from the normal.'];
  if (id === 'P3.2.2' && n === 8) return [fibre, fibreState, 'Set the launch angle', 'Aim the ray and watch whether the core confines it at each boundary.'];
  if (id === 'P3.2.2') return [refraction, refractionState(n), 'Rotate the incident laser', 'Change the incidence angle and read the refracted angle or see total internal reflection.'];
  if (id === 'P3.2.3') return [lens, lensState(n), n === 3 ? 'Slide the cinema screen' : 'Slide the optical carriage', 'Align the components on the optical rail and compare the focused and defocused patterns.'];
  if (id === 'P3.2.4') return [prism, prismState(n), 'Rotate the incident laser', 'Change the incidence and measure how the exit angle depends on wavelength.'];
  return null;
}

export function createPhysicsSimulation(kit, objective) {
  const descriptor = describe(objective);
  if (!descriptor) return null;
  const [build, calculate] = descriptor;
  const update = build(kit);
  return (signals, time) => update(calculate(signals.index, norm(signals.apparatus), signals.practical), signals.running ? time : 0);
}

export function physicsSimulationControl(objective) {
  const descriptor = describe(objective);
  if (!descriptor) return null;
  const [, calculate, label, hint] = descriptor;
  return { label, hint, initial: 0, format(position, index) { return calculate(index, norm(position)).setting; } };
}

export function physicsLiveReading(objective, setupIndex, position) {
  return describe(objective)?.[1](setupIndex, norm(position)).reading ?? null;
}

function moveBeam(mesh, a, b) {
  if (!a || !b) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.scale.y = Math.max(.0001, direction.length());
  if (direction.lengthSq() > 1e-12) mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}

function line(k, width, material) {
  return k.beam([0, 0, 0], [0, 1, 0], width, material);
}

function base(k, width = 2.55) {
  k.box(width, .14, 1.4, 0, .21, 0, k.dark);
  for (const x of [-1, 1]) for (const z of [-.55, .55]) k.disc(.066, .028, x, .287, z, k.pale);
}

function gauge(k, height, x, y, z) {
  k.box(.20, height, .040, x, y, z, k.pale);
  for (let i = 0; i <= 12; i += 1) {
    k.box(i % 3 ? .065 : .13, .012, .02, x, y + (i / 12 - .5) * (height - .04), z + .024, k.dark);
  }
}

function pendulumState(index, p) {
  const swings = index ? 20 : 1;
  const count = swings * p;
  const elapsed = count * 2;
  const delay = p >= .9999 ? .1 : 0;
  return { angle: .16 * Math.sin(count * 2 * Math.PI), p, setting: f(elapsed, 's'),
    reading: p < .9999 ? `${f(count, 'cycles')} · ${f(elapsed, 's')} elapsed` :
      `${f(elapsed + delay, 's')} on timer · ${fixed((elapsed + delay) / swings, 3)} s per swing` };
}

function pendulum(k) {
  base(k);
  k.disc(.32, .12, -.79, .32, 0, k.metal);
  k.disc(.035, 1.5, -.8, 1.13, 0, k.pale);
  k.box(.86, .075, .12, -.37, 1.84, 0, k.metal);
  k.disc(.079, .08, .10, 1.82, 0, k.pale);
  const rod = line(k, .017, k.pale);
  const bob = k.sphere(.16, .10, .68, 0, k.metal);
  k.grip?.(bob, 'horizontal');
  k.box(.55, .26, .57, .66, .40, .34, k.dark);
  const timer = k.disc(.10, .078, .66, .57, .40, k.response);
  k.grip?.(timer, 'horizontal');
  return state => {
    const point = [.10 + 1.16 * Math.sin(state.angle), 1.82 - 1.16 * Math.cos(state.angle), 0];
    bob.position.set(...point);
    moveBeam(rod, [.10, 1.82, 0], point);
    timer.rotation.y = state.p * 2.5;
  };
}

function cartState(n) {
  return (i, p, practical) => {
    let t, d, v, span, a;
    let direction = 1;
    let supplement = '';
    if (n === 1) {
      span = [24,24,16][i]; t = [8,12,8][i] * p; v = [3,2,2][i]; d = v * t;
    } else if (n === 2) {
      span = 24; t = 12 * p; d = 4 * (Math.min(t, 3) + Math.max(0, t - 9)); v = t < 3 || t >= 9 ? 4 : 0;
      const denominator = i === 0 ? t : Math.min(t, 3) + Math.max(0, t - 9);
      supplement = denominator > 0 ? ` · Average ${f(d / denominator, 'm/s')}` : '';
    } else if (n === 3 || n === 8) {
      span = 4; t = 2 * p; v = 2; d = v * t;
    } else if (n === 4) {
      span = 5; t = 2 * p; a = i === 0 ? 1.5 : -1.5; const v0 = i === 0 ? 1 : 4;
      v = v0 + a * t; d = v0 * t + .5 * a * t ** 2;
    } else if (n === 5) {
      span = 22; t = 8 * p;
      const schedule = i === 0 ? [[2,0],[2,1.5],[2,0],[2,-1.5]] :
        i === 1 ? [[2,1],[3,0],[3,1.5]] : [[8,0]];
      d = 0; v = 0; let elapsed = t;
      for (const [duration, acceleration] of schedule) {
        const dt = Math.min(elapsed, duration);
        d += v * dt + .5 * acceleration * dt ** 2;
        v += acceleration * dt;
        elapsed -= dt;
      }
    } else if (n === 6) {
      span = 12;
      ({ time: t, distance: d, speed: v } = motionSample(n, p, practical?.guided ?? true));
      supplement = !practical && i === 1 && p > 0 ? ` · Reading from origin ${f(d / t, 'm/s')}` : '';
    } else if (n === 7) {
      const guided = practical?.guided ?? true;
      span = motionSample(n, 1, guided).distance;
      ({ time: t, distance: d, speed: v, acceleration: a } = motionSample(n, p, guided));
    } else if (n === 9) {
      span = 8; t = 4 * p; a = i === 0 ? .5 : -.5; const v0 = i === 0 ? 1 : 3;
      v = v0 + a * t; d = v0 * t + .5 * a * t ** 2;
    } else if (n === 10) {
      span = 5; t = 2 * p;
      a = i === 0 ? 2 : 1 + 2 * t;
      v = i === 0 ? 2 * t : t + t ** 2;
      d = i === 0 ? t ** 2 : t ** 2 / 2 + t ** 3 / 3;
    } else if (n === 11) {
      span = 15; t = 1 + 3 * p; a = 2; v = a * t; d = t ** 2 - 1;
    } else {
      span = 8; t = 2 * p; direction = i === 0 ? 1 : -1;
      a = -direction * 2; v = direction * 6 + a * t; d = direction * 6 * t + .5 * a * t ** 2;
    }
    return { position: -direction * .92 + 1.84 * d / span, velocity: v, showDirection: n === 8 && i === 1,
      progress: p, setting: f(t, 's'),
      reading: `${f(d, 'm')} position · ${f(v, 'm/s')}${a === undefined ? '' : ' · ' + f(a, 'm/s²')}${supplement}` };
  };
}

function forceState(n) {
  return (i, p) => {
    const net = n === 2 ? [2,-2,12][i] : n === 7 ? [-6,6,-3][i] : [0,0,2][i];
    const mass = 2;
    const a = net / mass;
    const t = p;
    const v0 = n === 6 && i > 0 ? 2 : 0;
    const x = v0 * t + .5 * a * t ** 2;
    return { position: .55 * x, velocity: v0 + a * t, force: net, showDirection: net !== 0, progress: p,
      setting: f(t, 's'), reading: `${f(net, 'N')} resultant · ${f(a, 'm/s²')} acceleration · ${f(v0 + a * t, 'm/s')}` };
  };
}

function kineticState(i, p) {
  const v = [2,4,8][i] * p;
  return { position: 0, velocity: v, roller: true, progress: p, setting: f(v, 'm/s'), reading: `${f(.5 * 50 * v ** 2, 'J')} kinetic energy at ${f(v, 'm/s')}` };
}

function workState(i, p) {
  const force = [80,80,120][i];
  const d = [3,2,3][i] * p;
  return { position: -.9 + .6 * d, velocity: .4 * p, force, showDirection: true, progress: p, setting: f(d, 'm'),
    reading: `${f(force, 'N')} along the pull · ${f(force * d, 'J')} transferred` };
}

function winchTrack(k) {
  return track(k, true);
}

function track(k, winch = false) {
  base(k);
  const rail = k.pale.clone();
  rail.metalness = .68;
  rail.roughness = .26;
  for (const z of [-.25,.25]) k.box(2.48, .068, .042, 0, .372, z, rail);
  for (let i = 0; i <= 20; i += 1) k.box(.02, .015, i % 5 ? .052 : .102, -.99 + i * .10, .302, .43, k.pale);
  for (const x of winch ? [] : [-1.12,1.12]) {
    k.box(.10,.56,.095,x,.55,-.39,k.metal);
    k.box(.10,.56,.095,x,.55,.39,k.metal);
    k.box(.10,.075,.78,x,.82,0,k.pale);
    k.sphere(.037,x,.76,.32,k.light);
  }
  let drum, cable;
  if (winch) {
    k.box(.42,.13,.55,1.00,.357,-.17,k.pale);
    drum = k.disc(.106,.21,1.00,.53,-.06,k.metal);
    drum.rotation.x = Math.PI / 2;
    cable = line(k,.012,k.pale);
  }
  const chassis = k.box(.43,.114,.40,0,.53,0,k.metal);
  const shell = k.box(.29,.108,.30,0,.632,0,k.response);
  const wheels = [-.142,.142].flatMap(dx => [-.215,.215].map(z => {
    const wheel = k.disc(.084,.058,0,.46,z,k.dark);
    wheel.rotation.x = Math.PI / 2;
    const hub = k.disc(.033,.063,0,.46,z,rail);
    hub.rotation.x = Math.PI / 2;
    return { dx, wheel, hub };
  }));
  const slider = k.box(.11,.075,.136,0,.343,.46,k.response);
  const vector = line(k,.013,k.light);
  const vectorTip = k.sphere(.033,0,.72,.07,k.light);
  k.grip?.(slider,'horizontal');
  k.grip?.(shell,'horizontal');
  return (state, elapsed) => {
    const x = state.position;
    if (winch) {
      drum.rotation.y = x * 7;
      moveBeam(cable,[.99,.55,.03],[Math.min(.97,x + .21),.55,.03]);
    }
    chassis.position.x = shell.position.x = x;
    slider.position.x = -.99 + 1.98 * state.progress;
    for (const { dx, wheel, hub } of wheels) {
      wheel.position.x = hub.position.x = x + dx;
      wheel.rotation.y = state.roller ? state.velocity * elapsed * 5 : x / .084;
      hub.rotation.y = wheel.rotation.y;
    }
    const dir = Math.sign(state.force ?? state.velocity) || 1;
    const start = [x,.745,.06], end = [x + .26 * dir,.745,.06];
    moveBeam(vector, state.showDirection ? start : null, end);
    vectorTip.visible = !!state.showDirection;
    vectorTip.position.set(...end);
  };
}

function dropState(index, p) {
  const t = .49 * p;
  if (index === 0) return { d: .5 * GRAVITY * t ** 2, setting: f(t,'s'), reading: `Speed ${f(GRAVITY * t, 'm/s')} · ${f(GRAVITY, 'm/s²')} downward`, fluid: false };
  const effectiveG = 6;
  const terminal = .8;
  const ratio = effectiveG * t / terminal;
  const d = terminal ** 2 / effectiveG * Math.log(Math.cosh(ratio));
  return { d, setting: f(t,'s'), reading: `Speed ${f(terminal * Math.tanh(ratio), 'm/s')} · Approaches ${f(terminal, 'm/s')} in this liquid`, fluid: true };
}

function dropTube(k) {
  base(k,2.1);
  const vessel = k.crystal.clone();
  vessel.opacity = .26;
  k.disc(.34,.11,-.26,.36,0,k.metal);
  k.tube(.28,1.475,-.26,1.09,0,vessel);
  k.disc(.32,.10,-.26,1.83,0,k.pale);
  const liquid = k.disc(.262,1.40,-.26,1.08,0,k.crystal.clone());
  liquid.material.color.setHex(0x65b4dc);
  liquid.material.opacity = .32;
  const ball = k.sphere(.090,-.26,1.66,0,k.metal);
  k.grip?.(ball, 'vertical-down');
  gauge(k,1.42,.23,1.1,.28);
  const marker = k.box(.21,.036,.092,.23,1.67,.32,k.response);
  k.grip?.(marker, 'vertical-down');
  return state => {
    ball.position.y = marker.position.y = 1.66 - state.d;
    liquid.visible = state.fluid;
  };
}

function gravityState(n) {
  return (i, p) => {
    const masses = n === 3 ? [10,10,5] : n === 4 ? [2,4,2] : [12,12];
    const fields = n === 3 ? [9.8,1.6,3] : n === 4 ? [10,10,20] : n === 5 ? [9.8,1.6] : [9.8,9.8];
    const gravity = n === 1 ? 1.6 + 8.2 * p : fields[i];
    const mass = masses[i];
    const weight = mass * gravity;
    const massReading = (n === 1 || n === 2) && i === 0;
    return { mass, weight, p, scale: n === 1 || p >= .9999, massReading,
      setting: n === 1 ? f(gravity,'N/kg') : `${Math.round(p * 100)}% travel`,
      reading: n !== 1 && p < .9999 ? 'Load suspended above the sensor' :
        n === 5 ? `Scale setting ${f(gravity,'N/kg')} · Drop clip ${f(GRAVITY,'m/s²')}` :
        massReading ? `Mass ${f(mass,'kg')}` :
        n === 3 ? `${f(weight,'N')} ÷ ${f(mass,'kg')} = ${f(gravity,'N/kg')}` : `Weight ${f(weight,'N')} downward` };
  };
}

function gravityBalance(k) {
  base(k);
  const panel = k.box(.96,.16,.66,-.25,.38,0,k.metal);
  const platform = k.box(.89,.07,.65,-.25,.49,0,k.pale);
  const bag = k.box(.61,.36,.40,-.25,1.36,0,k.dark);
  const handle = k.ring(.125,.029,-.25,1.58,0,k.pale);
  k.grip?.(bag, 'vertical-down');
  gauge(k,.91,.69,.91,.31);
  const sensor = k.box(.21,.037,.125,.69,.50,.35,k.response);
  return state => {
    const y = state.scale ? .705 : 1.48 - .775 * state.p;
    bag.position.y = y;
    handle.position.y = y + .205;
    platform.position.y = panel.position.y + .11 - (state.scale ? .03 * Math.min(1,state.weight / 120) : 0);
    sensor.position.y = .49 + (state.scale ? .84 * Math.min(1,state.weight / 120) : 0);
  };
}

function densityState(n) {
  return (i, p) => {
    const density = n === 1 ? [120 / 160,1,120 / 80][i] : n === 2 ? [.8,4,2.7,2.7][i] : [.8,1.2][i];
    const volume = n === 1 ? [160,120,80][i] : n === 2 ? [50,24,20,20][i] : 20;
    const submergedTravel = Math.max(0,(p - .64) / .36);
    const immersed = n === 1 ? 0 : n === 2 ? (i <= 1 ? 0 : submergedTravel) : Math.min(density,1) * submergedTravel;
    const liquidVolume = n === 2 && i === 0 ? 50 * p : 30 + volume * immersed;
    return { n, i, density, volume, p, immersed, liquidVolume,
      setting: `${Math.round(p * 100)}% travel`,
      reading: n === 1 ? (p < .9999 ? 'Volume jaws in transit' : `120 g ÷ ${f(volume,'cm³')} = ${f(density,'g/cm³')}`) :
        n === 2 ? (i === 1 ? (p < .9999 ? 'Cuboid above the tray' : '96 g ÷ (2 × 3 × 4 cm³) = 4 g/cm³') :
          i === 0 ? `${f(liquidVolume,'mL')} · ${f(.8 * liquidVolume,'g')}` :
          i === 3 ? `Cylinder ${f(liquidVolume,'mL')} · Initial volume and mass unrecorded` :
          `Cylinder ${f(liquidVolume,'mL')} · Displacement ${f(liquidVolume - 30,'mL')}`) :
        `${f(density,'g/cm³')} sample · ${p < .9999 ? 'Sample supported' : density < 1 ? 'Floats with 80% submerged' : 'Sinks in fresh water'}` };
  };
}

function densityTank(k) {
  base(k);
  const vessel = k.crystal.clone();
  vessel.opacity = .19;
  k.tube(.37,1.12,-.45,.95,0,vessel);
  k.disc(.397,.075,-.45,.40,0,k.pale);
  const water = k.disc(.352,1,-.45,.63,0,k.crystal.clone());
  water.material.color.setHex(0x669dc0);
  water.material.opacity = .53;
  gauge(k,1.0,.075,.96,.18);
  k.box(.78,.14,.63,.68,.37,.09,k.metal);
  k.box(.63,.041,.52,.68,.46,.09,k.pale);
  const specimen = k.box(.35,.29,.32,0,1.59,0,k.response);
  const bolt = k.disc(.126,.38,0,1.59,0,k.metal);
  const boltHead = k.disc(.20,.105,0,1.77,0,k.pale);
  const jaw = k.box(.075,.36,.46,.44,1.26,.09,k.pale);
  k.grip?.(specimen, 'vertical-down');
  k.grip?.(bolt, 'vertical-down');
  k.grip?.(jaw,'horizontal');
  return state => {
    const height = state.liquidVolume * .014;
    const surface = .44 + height;
    water.scale.y = Math.max(.001,height);
    water.visible = state.n !== 1 && !(state.n === 2 && state.i === 1);
    water.position.y = .44 + height / 2;
    const size = .28 * Math.cbrt(state.volume / 80);
    specimen.scale.set(size / .35, size / .29, size / .32);
    const floatEnd = state.density > 1 ? .46 + size * .5 : surface + size * (.5 - state.density);
    specimen.visible = state.n === 1 || state.n === 3 || state.i === 1;
    specimen.position.set(state.n === 3 ? -.45 : .68,
      1.60 + ((state.n === 3 ? floatEnd : .50 + size / 2) - 1.60) * state.p, state.n === 3 ? 0 : .09);
    const boltY = state.p < .64 ? 1.64 + (surface + .195 - 1.64) * state.p / .64 :
      surface + .195 - .47 * state.immersed;
    bolt.visible = boltHead.visible = state.n === 2 && state.i >= 2;
    bolt.position.set(-.45,boltY,0);
    boltHead.position.set(-.45,boltY + .18,0);
    jaw.visible = state.n === 1;
    jaw.position.set(.18 + (.50 - size / 2) * state.p, specimen.position.y,.09);
  };
}

function springState(n) {
  return (i, p) => {
    const load = (n === 8 ? 3 : n === 9 ? 1 : i + 2) * p;
    const constant = n === 9 && i === 1 ? 25 : n === 8 && i === 2 ? [250,200,325,180][Math.min(3,Math.floor(load + .001))] : 250;
    const mm = 1000 * springExtension(load, constant, n === 10 ? 3 : Infinity, 125);
    return { load, mm, p, setting: f(load,'N'),
      reading: `${f(load,'N')} force · ${n === 8 && i === 1 ? f(60 + mm,'mm') + ' loaded length' : f(mm,'mm') + ' extension'}${n === 9 && load > 0 ? ' · ' + f(constant,'N/m') : ''}` };
  };
}

function spring(k) {
  base(k);
  k.disc(.23,.12,-.81,.34,-.13,k.metal);
  k.disc(.047,1.48,-.81,1.13,-.13,k.pale);
  k.box(.94,.102,.13,-.36,1.85,-.13,k.metal);
  const coilMaterial = k.pale.clone();
  coilMaterial.metalness = .75;
  coilMaterial.roughness = .29;
  const x = .08, z = -.13, turns = 8;
  const coil = Array.from({length:64}, () => line(k,.022,coilMaterial));
  const retort = line(k,.023,k.metal);
  const weight = k.disc(.165,.113,x,.8,z,k.response);
  const hook = k.ring(.061,.019,x,.91,z,k.metal);
  gauge(k,1.22,.50,1.04,.06);
  const cursor = k.box(.25,.022,.061,.43,.77,.102,k.light);
  k.grip?.(weight, 'vertical-down');
  k.grip?.(cursor, 'vertical-down');
  return state => {
    const end = 1.18 - state.mm * .013;
    const coordinate = index => {
      const fraction = index / coil.length;
      const theta = 2 * Math.PI * turns * fraction;
      return [x + .10 * Math.cos(theta), 1.79 + (end - 1.79) * fraction, z + .10 * Math.sin(theta)];
    };
    coil.forEach((beam,index)=>moveBeam(beam,coordinate(index),coordinate(index + 1)));
    moveBeam(retort,coordinate(coil.length),[x,end-.084,z]);
    weight.position.y = end - .20;
    weight.scale.y = .33 + .67 * state.p;
    hook.position.y = end - .093;
    cursor.position.y = end;
  };
}

function momentState(n) {
  return (i, p) => {
    const force = n === 3 ? 80 : 30;
    const d = (n === 1 ? [.06,.45,.88][i] : n === 2 ? [.25,.50,0][i] : n === 4 ? [1,2,2.5][i] : [.6,.6,.6][i]) * p;
    const moment = force * d;
    const left = n === 4 ? 60 : 0;
    const unbalanced = n === 3 && i === 2;
    const net = n === 3 ? (i === 1 ? 12 * p : 0) : moment - left;
    return { d, moment, net, p, n, unbalanced, setting: f(d,'m'), reading: n === 3 ?
      (i === 0 ? 'Opposing forces and moments balance' : i === 1 ? 'Forces balance; clockwise resultant moment' : 'Moments balance; vertical resultant force') :
      n === 4 ? `Left ${f(left,'N m')} · Right ${f(moment,'N m')} · ${f(net,'N m')} clockwise resultant` :
      `${f(force,'N')} × ${f(d,'m')} = ${f(moment,'N m')}` };
  };
}

function lever(k) {
  base(k);
  k.disc(.29,.104,0,.33,0,k.metal);
  k.disc(.078,.31,0,.53,0,k.pale);
  const bracket = k.disc(.13,.19,0,.69,0,k.metal);
  bracket.rotation.x = Math.PI / 2;
  const rail = k.box(2.31,.10,.33,0,.77,0,k.pale);
  const carrier = k.box(.22,.17,.29,0,.90,0,k.response);
  const leftWeight = k.box(.21,.20,.27,-.72,.92,0,k.metal);
  const guide = k.box(2.30,.026,.05,0,.37,.48,k.pale);
  const sled = k.box(.14,.06,.12,0,.42,.48,k.response);
  const indicator = line(k,.014,k.light);
  k.grip?.(carrier,'horizontal');
  k.grip?.(sled,'horizontal');
  return state => {
    const tilt = Math.max(-.29,Math.min(.29,-state.net * .017));
    const y = state.unbalanced ? .77 + .17 * state.p : .77;
    rail.rotation.z = tilt;
    rail.position.y = y;
    const x = state.n === 4 ? state.d * .42 : state.d * 1.1;
    carrier.position.set(x * Math.cos(tilt),y + x * Math.sin(tilt) + .126,0);
    carrier.rotation.z = tilt;
    leftWeight.visible = state.n === 4;
    leftWeight.position.set(-.72 * Math.cos(tilt),y - .72 * Math.sin(tilt) + .15,0);
    leftWeight.rotation.z = tilt;
    sled.position.x = -1.04 + state.p * 2.08;
    moveBeam(indicator,[carrier.position.x,carrier.position.y + .44,0],[carrier.position.x,carrier.position.y + .12,0]);
    guide.visible = true;
  };
}

function tiltState(index, p) {
  const angle = 20 * p;
  const centre = index === 0 ? [0,.28] : [.37,.57];
  const projection = centre[0] + Math.tan(angle * DEG) * centre[1];
  const inside = Math.abs(projection) <= .48;
  return { angle, centre, projection, inside, setting: f(angle,'°'),
    reading: Math.abs(projection) <= .48 ? `Weight line ${f(projection,'m')} from centre · Within the wheelbase` :
      `Weight line ${f(projection,'m')} from centre · Outside the wheelbase` };
}

function tiltTable(k) {
  base(k);
  const deck = k.box(2.10,.14,.83,0,.70,0,k.metal);
  k.disc(.17,.44,0,.45,0,k.pale);
  const body = k.box(1.12,.13,.50,0,.87,0,k.light);
  const wheels = [-.48,.48].flatMap(x => [-.29,.29].map(z => {
    const wheel = k.disc(.084,.067,x,.81,z,k.dark);
    wheel.rotation.x = Math.PI / 2;
    return {wheel,x,z};
  }));
  const crate = k.box(.36,.43,.38,0,1.1,0,k.response);
  const arrow = line(k,.013,k.response);
  const mark = k.sphere(.038,0,.88,0,k.light);
  const start = k.sphere(.039,0,1.15,0,k.pale);
  k.grip?.(deck,'horizontal');
  k.grip?.(crate);
  return state => {
    const angle = -state.angle * DEG;
    const rotate = (x,y,z) => [x * Math.cos(angle) - y * Math.sin(angle), .70 + x * Math.sin(angle) + y * Math.cos(angle), z];
    deck.rotation.z = body.rotation.z = crate.rotation.z = angle;
    body.position.set(...rotate(0,.18,0));
    wheels.forEach(({wheel,x,z})=>wheel.position.set(...rotate(x,.14,z)));
    const weightCentre = rotate(...state.centre,.11);
    start.position.set(...weightCentre);
    crate.position.set(...rotate(state.centre[0],state.centre[1] + .105, 0));
    const end = rotate(state.projection,0,.11);
    mark.position.set(...end);
    moveBeam(arrow,weightCentre,end);
  };
}

function pressureState(n) {
  return (index, p) => {
    const area = (n === 1 ? [.10,.40] : [.10,.20,.40])[index];
    const force = 400 * p;
    const pressure = force / area;
    return { area, p, pressure, setting:f(force,'N'),
      reading: `${f(force,'N')} across ${f(area,'m²')} · ${f(pressure,'Pa')}` };
  };
}

function press(k) {
  base(k);
  k.box(1.40,.10,.86,0,.37,0,k.pale);
  const mat = k.metal.clone();
  mat.color.setHex(0x637287);
  mat.roughness = .84;
  const foam = [];
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const x = -.63 + col * .14, z = -.35 + row * .14;
      foam.push({point:k.box(.137,.18,.137,x,.52,z,mat),x,z});
    }
  }
  k.disc(.047,1.3,-1.0,.99,0,k.pale);
  k.box(1.1,.105,.27,-.45,1.64,0,k.metal);
  k.disc(.14,.19,0,1.63,0,k.pale);
  const actuator = line(k,.056,k.metal);
  const pad = k.box(.59,.12,.59,0,1.1,0,k.response);
  const handle = k.disc(.15,.07,0,1.42,.26,k.pale);
  k.grip?.(pad);
  k.grip?.(handle);
  return state => {
    const size = Math.sqrt(state.area / .40);
    const compression = .105 * Math.min(1,state.pressure / 4000);
    pad.scale.set(size,1,size);
    pad.position.y = .67 - compression;
    handle.position.y = pad.position.y + .40;
    moveBeam(actuator,[0,1.59,0],[0,pad.position.y + .045,0]);
    foam.forEach(({point,x,z})=>{
      const under = Math.abs(x) < .295 * size && Math.abs(z) < .295 * size;
      const dent = under ? compression : 0;
      point.scale.y = 1 - dent / .18;
      point.position.y = .52 - dent * .5;
    });
  };
}

function heightState(index, p) {
  const h = [.5,1,2][index] * p;
  return { h, p, setting:f(h,'m'), reading:`${f(50 * GRAVITY * h,'J')} gravitational energy gained by a 50 kg rider` };
}

function powerState(index, p) {
  const pWatts = [300,500,600][index];
  const seconds = 12 * p;
  const e = pWatts * seconds;
  return { h: e / (420 * GRAVITY), p, setting:f(seconds,'s'), reading: `${f(pWatts,'W')} × ${f(seconds,'s')} = ${f(e,'J')}` };
}

function hoist(k) {
  base(k);
  for (const x of [-.63,.63]) k.disc(.044,1.45,x,1.03,-.16,k.pale);
  k.box(1.47,.12,.40,0,1.78,-.12,k.metal);
  k.disc(.15,.16,0,1.77,.08,k.pale).rotation.x = Math.PI / 2;
  const rope = line(k,.016,k.pale);
  const deck = k.box(1.12,.12,.61,0,.47,0,k.pale);
  const load = k.box(.42,.36,.38,0,.71,0,k.response);
  const hook = k.ring(.079,.023,0,.93,0,k.metal);
  gauge(k,1.30,.88,1.06,.28);
  const mark = k.box(.23,.035,.055,.88,.47,.32,k.response);
  k.grip?.(deck);
  k.grip?.(mark);
  return state => {
    const y = .47 + state.h * .50;
    deck.position.y = mark.position.y = y;
    load.position.y = y + .24;
    hook.position.y = y + .476;
    moveBeam(rope,[0,1.74,.01],[0,y+.52,.01]);
  };
}

function laser(k,z=.28,width=.013) {
  const source = k.box(.28,.16,.19,0,1,z,k.metal);
  const aperture = k.sphere(.052,0,1,z,k.response);
  const emitted = line(k,width,k.light);
  k.grip?.(source,'horizontal');
  return (start, end) => {
    source.position.set(...start);
    source.rotation.z = Math.atan2(end[1]-start[1],end[0]-start[0]);
    aperture.position.set(start[0] + (end[0]-start[0])*.064,start[1] + (end[1]-start[1])*.064,start[2]);
    moveBeam(emitted,start,end);
  };
}

function dashed(k, colour, count = 13) {
  const lines = Array.from({length:count},()=>line(k,.005,colour));
  return (start,end,visible=true) => lines.forEach((dash,i)=>{
    const sample = p => start.map((value,j)=>value+(end[j]-value)*p);
    moveBeam(dash,visible ? sample(i / count) : null,sample((i + .51) / count));
  });
}

function mirrorState(n) {
  return (index,p) => {
    const incidence = (n === 1 ? 35 : n === 3 ? 42 : n === 5 ? 65 : 38) * (n === 3 || n === 5 ? 1 : p);
    const receiver = (n === 3 ? [42,48,-42][index] : n === 5 ? [65,25][index] : incidence) * p;
    const hit = Math.abs(receiver-incidence) <= 1.4;
    return { n, index, p, incidence, receiver, hit, setting:f(n === 3 || n === 5 ? receiver : incidence,'°'),
      reading: n === 3 || n === 5 ? `Reflected beam at ${f(incidence,'°')} · Receiver ${hit ? 'lit' : 'off'} at ${f(receiver,'°')}` :
        n === 1 && index === 1 ? `${f(90-incidence,'°')} to mirror surface · ${f(incidence,'°')} from normal` :
        `Incidence ${f(incidence,'°')} · Reflection ${f(incidence,'°')} from normal` };
  };
}

function mirror(k) {
  base(k);
  const reflective = k.pale.clone();
  reflective.roughness = .11;
  reflective.metalness = .8;
  k.box(.037,1.31,.72,0,1.02,-.07,reflective);
  k.box(.38,.12,.88,0,.35,-.07,k.metal);
  const source = laser(k);
  const reflected = line(k,.015,k.response);
  const normal = dashed(k,k.pale);
  const virtual = dashed(k,k.light);
  const secondIn = line(k,.011,k.light), secondOut = line(k,.011,k.response);
  const secondVirtual = dashed(k,k.light);
  const receiver = k.box(.21,.19,.23,0,.7,.29,k.dark);
  const led = k.sphere(.043,0,.7,.44,k.response.clone());
  k.grip?.(receiver,'horizontal');
  const origin = [0,1.03,.28];
  return state => {
    const angle = state.incidence * DEG;
    const radius = .69;
    const start = [-radius * Math.cos(angle),origin[1]+radius*Math.sin(angle),.28];
    const bounce = [-radius*Math.cos(angle),origin[1]-radius*Math.sin(angle),.28];
    source(start,origin);
    moveBeam(reflected,origin,bounce);
    normal([-.96,origin[1],.31],[.74,origin[1],.31]);
    const drawVirtual = state.n === 4 && state.index === 0;
    virtual(origin,[-start[0],start[1],.28],drawVirtual);
    const lower = [0,origin[1]-.27,.28];
    const y = lower[1] - (start[1] - lower[1]);
    moveBeam(secondIn,state.n === 4 ? start : null,lower);
    moveBeam(secondOut,state.n === 4 ? lower : null,[start[0],y,.28]);
    secondVirtual(lower,[-start[0],start[1],.28],drawVirtual);
    const show = [3,5].includes(state.n);
    const aim = state.receiver*DEG;
    receiver.visible = led.visible = show;
    receiver.position.set(-radius*Math.cos(aim),origin[1]-radius*Math.sin(aim),.34);
    led.position.copy(receiver.position);
    led.position.z += .13;
    led.material.emissiveIntensity = state.hit ? 2.4 : .02;
    led.material.color.setHex(state.hit ? 0xcafa83 : 0x323745);
  };
}

function mirrorImageState(index,p) {
  const d = .24 + .76*p;
  const proposal = [d,2*d,-d][index];
  return { d,p,proposal,index, setting:f(d,'m'), reading: `Virtual image ${f(d,'m')} behind mirror · Same 30 cm height` };
}

function mirrorImage(k) {
  base(k);
  const silver = k.pale.clone();
  silver.metalness = .86;
  silver.roughness = .11;
  k.box(.028,1.18,.76,0,.96,-.07,silver);
  k.box(.33,.126,.87,0,.35,-.07,k.dark);
  const post = k.box(.066,.54,.32,-.8,.72,.30,k.response);
  const crossbar = k.box(.062,.097,.22,-.8,.90,.25,k.light);
  const image = k.box(.062,.54,.32,.8,.72,.30,k.crystal);
  const ghost = k.box(.034,.53,.40,.8,.72,.49,k.metal);
  const ruler = dashed(k,k.pale);
  k.grip?.(post,'horizontal');
  return state => {
    const x = .59*state.d;
    post.position.x = crossbar.position.x = -x;
    image.position.x = x;
    ghost.position.x = .59*state.proposal;
    ghost.visible = state.index !== 0;
    ghost.scale.y = state.index === 1 ? .5 : 1;
    ruler([-x,.46,.40],[x,.46,.40]);
  };
}

function refractionState(n) {
  return (index,p) => {
    const nGlass = 1.5, nWater = 4/3;
    const slowToFast = n === 6 && index < 2 || n === 7;
    const medium = n === 4 || n === 7 ? nGlass : nWater;
    const angles = n === 1 ? [40,0] : n === 6 ? [60,30,60] : n === 7 ? [30,Math.asin(1/1.5)/DEG,60] : [];
    const incidence = n === 1 && index === 1 ? 40*(1-p) : (angles[index] ?? 40)*p;
    const trace = refractionAt(incidence,slowToFast ? medium : 1,slowToFast ? 1 : medium);
    const refracted = trace.transmitted;
    let reading = trace.totalInternal ? 'Total internal reflection · No transmitted ray' : `Incidence ${f(incidence,'°')} · Transmission ${f(refracted,'°')} from normal`;
    if (n === 2 && index === 1) reading = `${f(90-incidence,'°')} in air · ${f(90-refracted,'°')} in water from surface`;
    if (n === 3) reading += ' · Emergent ray parallel to incoming ray';
    if (n === 4) reading = `Light speed ≈ ${fixed(3/medium)} × 10⁸ m/s in glass · n = 1.5`;
    if (n === 5 && refracted > .0001) reading += ` · sin i/sin r = ${fixed(Math.sin(incidence*DEG)/Math.sin(refracted*DEG))}`;
    return { n,p,incidence,refracted,slowToFast,trace,medium,setting:f(incidence,'°'),reading };
  };
}

function refraction(k) {
  base(k);
  const fill = k.crystal.clone();
  fill.color.setHex(0x67afda);
  fill.opacity = .27;
  k.box(2.34,.48,.82,0,.91,0,fill);
  const edge = k.box(2.36,.026,.85,0,1.162,0,k.pale.clone());
  edge.material.roughness = .21;
  const source = laser(k,.45,.011);
  const reflected = line(k,.009,k.pale);
  const transmitted = line(k,.015,k.response);
  const emergent = line(k,.012,k.response);
  const normal = dashed(k,k.pale,12);
  const rayStop = k.sphere(.042,0,1.17,.45,k.response);
  return state => {
    const surface = [-.36,1.163,.45];
    const i = state.incidence*DEG;
    const r = (state.refracted ?? 0)*DEG;
    const above = state.slowToFast ? -1 : 1;
    const sourceDistance = state.slowToFast ? .41 : .66;
    source([surface[0]-Math.sin(i)*sourceDistance,surface[1]+above*Math.cos(i)*sourceDistance,.45],surface);
    const slab = state.n === 3;
    const length = slab ? .48/Math.cos(r) : state.slowToFast ? .63 : .43/Math.max(.40,Math.cos(r));
    fill.color.setHex(state.medium > 1.4 ? 0xacd7d9 : 0x67afda);
    const rx = surface[0]+Math.sin(r)*length;
    const ry = surface[1]-above*Math.cos(r)*length;
    const towards = [rx,ry,.45];
    moveBeam(transmitted,state.trace.totalInternal ? null : surface,towards);
    moveBeam(emergent,slab && !state.trace.totalInternal ? towards : null,[rx+.44*Math.sin(i),ry-.44*Math.cos(i),.45]);
    const reflection = [surface[0]+.64*Math.sin(i),surface[1]+above*.64*Math.cos(i),.45];
    moveBeam(reflected,state.trace.totalInternal || state.slowToFast ? surface : null,reflection);
    normal([surface[0],.62,.48],[surface[0],1.78,.48]);
    rayStop.position.set(...(state.trace.totalInternal ? reflection : tendsEndpoint(slab,towards,i)));
  };
}

function tendsEndpoint(slab, point, i) {
  return slab ? [point[0]+.44*Math.sin(i),point[1]-.44*Math.cos(i),point[2]] : point;
}

function fibreState(index,p) {
  const nCore = 1.5, nClad = index === 1 ? 1.5 : 1.42;
  const angle = (index === 2 ? 60 : 76)*p;
  const trace = refractionAt(angle,nCore,nClad);
  return { angle, trace, setting:f(angle,'°'),
    reading:`Core ${nCore} · Cladding ${nClad} · ${trace.totalInternal ? 'Total internal reflection' : 'Light can leave the core'}` };
}

function fibre(k) {
  base(k);
  const material = k.crystal.clone();
  material.opacity = .35;
  k.box(2.30,.34,.51,0,.91,0,material);
  k.box(2.37,.073,.55,0,.702,0,k.crystal);
  k.box(2.37,.073,.55,0,1.114,0,k.crystal);
  const source = laser(k,.29);
  const rays = Array.from({length:9},()=>line(k,.012,k.response));
  return state => {
    const points = [[-1.14,.89,.29]];
    let rise = 1;
    const slope = Math.cos(state.angle*DEG)/Math.max(.0001,Math.sin(state.angle*DEG));
    while (points.length <= 8) {
      const tail = points.at(-1);
      const wall = rise === 1 ? 1.08 : .74;
      const hitX = tail[0]+Math.abs(wall-tail[1])/slope;
      if (hitX >= 1.13) {
        points.push([1.13,tail[1]+(1.13-tail[0])*rise*slope,.29]);
        break;
      }
      points.push([hitX,wall,.29]);
      if (!state.trace.totalInternal) {
        const angle = state.trace.transmitted*DEG;
        points.push([hitX+.43*Math.sin(angle),wall+rise*.43*Math.cos(angle),.29]);
        break;
      }
      rise *= -1;
    }
    source([-1.29,.89-.15*Math.min(1,slope),.29],points[0]);
    rays.forEach((ray,index)=>moveBeam(ray,points[index],points[index+1]));
  };
}

function lensState(n) {
  const focal = .20;
  return (index,p) => {
    const distances = {1:[5,.02],2:[5,5],3:[.30,.30,.30],4:[.30,.60,.10],5:[.10,.10],6:[.60,.10],7:[.10,.60,.20]};
    const max = distances[n][index];
    const u = (n === 3 || n === 5 || n === 2) ? max : .025 + (max - .025)*p;
    const screen = n === 3 ? [.60,.20,-.30][index]*p : n === 6 && u > focal ? Math.min(.68,thinLensAt(focal,u).distance)*p : null;
    const optical = thinLensAt(focal,u);
    const blur = screen !== null && optical.real && screen > 0 ? Math.abs(screen-optical.distance) : null;
    let read = !Number.isFinite(optical.distance) ? 'Parallel output · No image at a finite distance' :
      `${optical.real ? 'Real image' : 'Virtual image'} ${f(Math.abs(optical.distance)*100,'cm')} on ${optical.real ? 'screen' : 'object'} side · ${optical.magnification < 0 ? 'Inverted' : 'Upright'}`;
    if (n === 2) read = index === 0
      ? `Ruler ${f(focal*100*p,'cm')}${p >= .9999 ? ' from centre to focus · Principal axis horizontal' : ' from lens centre'}`
      : 'Room distance does not measure focal length';
    if (n === 3) read = screen <= 0 ? 'No projected image on the object side' :
      `${f(screen*100,'cm')} to screen · ${blur < .015 ? 'Sharp inverted image' : 'Defocused'}`;
    if (n === 1 && index === 0 && p >= .9999) read = 'Parallel rays converge at the 20 cm principal focus';
    return { n, index,p,focal,u,screen,optical,blur,setting:n === 5 ? `${Math.round(p*100)}% ray extension` :
      f((n === 2 ? (index ? 1 : focal)*p : screen ?? u)*100,'cm'),reading:read };
  };
}

function lens(k) {
  base(k);
  const glass = k.crystal.clone();
  glass.opacity = .52;
  glass.color.setHex(0xa6d7ee);
  const lensElement = k.sphere(.35,0,1.03,0,glass);
  lensElement.scale.set(.25,1.23,.85);
  k.box(.33,.65,.14,0,.65,-.23,k.metal);
  k.box(2.43,.05,.07,0,.40,.36,k.pale);
  const arrow = line(k,.027,k.light);
  const arrowTip = k.sphere(.045,0,1,.35,k.light);
  const plate = k.box(.036,.75,.74,0,1.02,.02,k.pale);
  const focus = k.sphere(.035,0,1,.39,k.response);
  const mark = k.box(.075,.06,.17,0,.43,.35,k.response);
  const dot = k.sphere(.095,0,1.02,.29,k.response.clone());
  const beams = Array.from({length:4},(_,i)=>line(k,.010,i%2 ? k.response : k.light));
  const virtual = [dashed(k,k.pale),dashed(k,k.pale)];
  const axis = dashed(k,k.pale,15);
  axis([-1.17,1.03,.40],[1.17,1.03,.40]);
  k.grip?.(plate,'horizontal');
  k.grip?.(arrowTip,'horizontal');
  k.grip?.(mark,'horizontal');
  return state => {
    const px = 1.8;
    const h = .17;
    const y = 1.03, z = .35;
    const far = state.n === 1 && state.index === 0 && state.p >= .982 || state.n === 2;
    const u = far ? 1000 : state.u;
    const f = state.focal * px;
    const uX = u * px;
    const xObj = -Math.min(1.13,uX);
    const object = [xObj,y+h,z];
    const firstAt = [0,y+h,z], secondAt = [0,far ? y-h : y,z];
    const traceEnd = .97;
    const first = [traceEnd,y+h*(1-traceEnd/f),z];
    const second = [traceEnd,far ? y-h*(1-traceEnd/f) : y-h*traceEnd/uX,z];
    const forwardTrace = state.n === 5 && state.index === 1;
    const showDashes = !far && state.optical.distance < 0;
    const pxVirtual = (forwardTrace ? 1.22 : Math.max(-1.20,state.optical.distance*px)) *
      (state.n === 5 ? state.p : 1);
    moveBeam(arrow,far ? null : [xObj,y,z],object);
    arrowTip.visible = !far;
    arrowTip.position.set(...object);
    focus.position.set(f,y,z+.04);
    mark.position.x = state.n === 2
      ? (state.index === 0 ? f : -1.11)*state.p
      : Math.min(1.11, Math.max(-1.11, state.screen !== null ? px*state.screen : xObj));
    moveBeam(beams[0],object,firstAt);
    moveBeam(beams[1],firstAt,first);
    moveBeam(beams[2],far ? [xObj,y-h,z] : object,secondAt);
    moveBeam(beams[3],secondAt,second);
    const traceVirtual = bound => [pxVirtual,bound,z];
    virtual[0](firstAt,traceVirtual(y+h*(1-pxVirtual/f)),showDashes);
    virtual[1](secondAt,traceVirtual(y-h*pxVirtual/uX),showDashes);
    plate.visible = state.screen !== null;
    plate.position.x = state.screen === null ? 1.1 : state.screen * px;
    const image = state.optical.distance * px;
    const visibleImage = state.screen !== null ? state.screen > .04 && state.optical.real : !far && Number.isFinite(image) && Math.abs(image) < 1.10;
    dot.visible = visibleImage;
    const mag = state.optical.magnification ?? 0;
    const x = state.screen !== null ? plate.position.x-.025 : image;
    dot.position.set(Number.isFinite(x) ? x : 1.16,y + Math.max(-.40,Math.min(.40,mag*h)),.397);
    const blur = state.blur ?? 0;
    dot.scale.set(.29,Math.max(.26,Math.min(3,1 + blur * 5)),Math.max(.4,Math.min(1.4,.50+blur*4)));
    dot.material.emissiveIntensity = blur < .015 ? 1.12 : .2;
  };
}

const wavelengths = [
  [650,0xf86a76,1.514], [605,0xffa46d,1.517],[575,0xfada75,1.519],
  [530,0x81e69e,1.521], [470,0x7eb6ff,1.526], [440,0x9780f8,1.531], [410,0xbe7cf4,1.537]
];

function prismState(number) {
  return (index,p) => {
    const incidence = 34 + p * 17;
    const rays = number === 1 && index === 1 ? wavelengths.slice(0,1) : wavelengths;
    const deviations = rays.map(([nm,colour,n]) => {
      const first = refractionAt(incidence,1,n).transmitted;
      const second = refractionAt(60-first,n,1).transmitted;
      return {nm,colour,first,second,deviation:second === null ? null : incidence+second-60};
    });
    const red = deviations[0].deviation;
    const violet = deviations.at(-1).deviation;
    return {incidence,deviations,setting:f(incidence,'°'),
      reading: deviations.length === 1 ? `Red ${f(650,'nm')} deflects ${f(red,'°')}` :
        `Red ${f(red,'°')} deviation · Violet ${f(violet,'°')} deviation`};
  };
}

function prism(k) {
  base(k);
  const bottom = .51;
  const side = .55;
  const peak = bottom + Math.sqrt(3)*side;
  const matrix = [[-side,bottom],[side,bottom],[0,peak]];
  for (const z of [-.2,.30]) {
    for (let i = 0; i < 3; i += 1) k.beam([...matrix[i],z],[...matrix[(i+1)%3],z],.027,k.crystal);
  }
  for (const point of matrix) k.beam([...point,-.2],[...point,.30],.027,k.crystal);
  const source = laser(k,.34);
  const rays = wavelengths.map(([,rgb]) => {
    const material = k.response.clone();
    material.color.setHex(rgb);
    material.emissive.setHex(rgb);
    return [line(k,.010,material),line(k,.010,material)];
  });
  const x = -.28;
  const cross = [x,peak-Math.abs(x)*Math.sqrt(3),.34];
  return state => {
    const i = (state.incidence-30)*DEG;
    source([cross[0]-.71*Math.cos(i),cross[1]-.71*Math.sin(i),.34],cross);
    rays.forEach(([inner,outer],index)=>{
      const colour = state.deviations[index];
      if (!colour) {
        moveBeam(inner,null,null); moveBeam(outer,null,null); return;
      }
      const angle = (colour.first-30)*DEG;
      const m = Math.tan(angle);
      const exitX = (peak-cross[1]+m*x) / (m + Math.sqrt(3));
      const start = [exitX,cross[1]+(exitX-x)*m,.34];
      moveBeam(inner,cross,start);
      const bend = (30-colour.second)*DEG;
      moveBeam(outer,colour.second === null ? null : start,
        [start[0]+.78*Math.cos(bend),start[1]+.78*Math.sin(bend),.34]);
    });
  };
}

function swingGate(k) {
  base(k);
  const x0 = -.79, z0 = .05;
  k.box(.22,1.37,.22,x0,.98,z0,k.metal);
  k.box(.32,.09,.33,x0,.34,z0,k.pale);
  k.box(.27,.08,.27,x0,1.69,z0,k.pale);
  const uprights = Array.from({length:6},() => k.box(.049,.69,.047,0,1,0,k.metal));
  const rails = [.66,1.31].map(() => k.box(1.26,.055,.06,0,1,0,k.pale));
  const pushPad = k.box(.116,.14,.093,0,1.02,0,k.response);
  const force = line(k,.017,k.light);
  k.grip?.(pushPad,'horizontal');
  return state => {
    const pivotRotation = -Math.min(.80,state.moment/30);
    const onRail = d => [x0 + d*Math.cos(pivotRotation), z0 - d*Math.sin(pivotRotation)];
    uprights.forEach((part,i)=>{
      const [x,z]=onRail(.09+.22*i);
      part.position.set(x,.98,z);
      part.rotation.y=pivotRotation;
    });
    rails.forEach((part,i)=>{
      const [x,z]=onRail(.65);
      part.position.set(x,i ? 1.31 : .66,z);
      part.rotation.y=pivotRotation;
    });
    const [x,z]=onRail(.085+1.16*state.d/.88);
    pushPad.position.set(x,1.02,z);
    pushPad.rotation.y=pivotRotation;
    moveBeam(force,[x + .40*Math.sin(pivotRotation),1.02,z + .40*Math.cos(pivotRotation)],
      [x + .06*Math.sin(pivotRotation),1.02,z + .06*Math.cos(pivotRotation)]);
  };
}
