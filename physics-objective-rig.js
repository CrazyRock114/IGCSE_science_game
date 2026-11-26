import { Vector3 } from 'three';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const up = new Vector3(0, 1, 0);
const spectrum = [0xef7581, 0xfaac6a, 0xf7db7b, 0x88dfa5, 0x73b9fd, 0xa597f5, 0xce80f7];

export function physicsObjectiveRig(kit, objective) {
  const id = objective.mission.id;
  const number = Number(objective.number);
  if (id === 'P3.2.1') return mirror(kit, number);
  if (id === 'P3.2.2') return number === 8 ? fibre(kit) : refraction(kit, number);
  if (id === 'P3.2.3') return lens(kit, number);
  if (id === 'P3.2.4') return prism(kit, number);
  if (id === 'P3.4') return sound(kit, number);
  return null;
}

function ray(kit, material, width = .014) {
  const beam = kit.beam([0, 0, 0], [0, 1, 0], width, material);
  return (a, b, show = true) => {
    beam.visible = show;
    if (!show) return;
    const start = new Vector3(...a);
    const end = new Vector3(...b);
    const direction = end.clone().sub(start);
    beam.position.copy(start).lerp(end, .5);
    beam.scale.y = Math.max(.001, direction.length());
    beam.quaternion.setFromUnitVectors(up, direction.normalize());
  };
}

function dash(kit, material, count = 8) {
  const segments = Array.from({ length: count }, () => ray(kit, material, .007));
  return (a, b, show = true) => {
    const start = new Vector3(...a);
    const end = new Vector3(...b);
    segments.forEach((segment, index) => {
      segment(start.clone().lerp(end, index / count).toArray(), start.clone().lerp(end, (index + .53) / count).toArray(), show);
    });
  };
}

function stage(kit) {
  kit.box(2.49, .17, 1.16, 0, .22, 0, kit.dark);
}

function mirror(kit, number) {
  stage(kit);
  kit.box(.045, 1.24, .77, 0, .94, -.1, kit.pale);
  kit.box(.21, .22, .91, .008, .36, -.1, kit.dark);
  const marker = kit.box(.09, .21, .18, -.94, .85, .27, kit.response);
  const sign = kit.box(.075, .35, .27, -.83, .71, .25, kit.light);
  const image = kit.box(.075, .35, .27, .83, .71, .25, kit.crystal);
  const foot = kit.box(.18, .13, .21, -.83, .36, .25, kit.metal);
  const incoming = ray(kit, kit.light);
  const reflected = ray(kit, kit.response);
  const secondIncident = ray(kit, kit.light, .009);
  const secondReflected = ray(kit, kit.response, .009);
  const normal = dash(kit, kit.pale);
  const virtual = dash(kit, kit.light);
  const secondVirtual = dash(kit, kit.light);
  return (setup, time, motion) => {
    const middle = [0, .98, .28];
    const baseAngles = { 1: 35, 2: 25, 3: 42, 4: 32, 5: 65 };
    const angle = baseAngles[number] * DEG;
    const reach = { 1: .74, 2: .92, 3: .62, 4: .86, 5: .25 }[number];
    const rise = reach * Math.tan(angle);
    const source = [-reach, middle[1] + rise, .28];
    const end = [-reach, middle[1] - rise, .28];
    const geometry = number === 2 || number === 4;
    const reverse = number === 4 && setup.index === 0;
    const incorrectReceiver = (number === 3 || number === 5) && setup.index !== 0;
    incoming(source, middle);
    reflected(middle, end);
    normal([-.97, middle[1], .31], [.88, middle[1], .31], number !== 2 && (number !== 1 || setup.index === 0));
    virtual(middle, [.90, middle[1] + rise * (.90 / reach), .28], reverse);
    const secondPoint = [0, middle[1] - .27, .28];
    const secondSlope = (source[1] - secondPoint[1]) / reach;
    secondVirtual(secondPoint, [reach, source[1], .28], reverse);
    secondIncident(source, secondPoint, number === 4);
    secondReflected(secondPoint, [-.36, secondPoint[1] - .36 * secondSlope, .28], number === 4);
    sign.visible = image.visible = foot.visible = geometry;
    sign.position.y = source[1] - .12;
    image.position.x = number === 2 && setup.index === 2 ? -.68 : number === 2 && setup.index === 1 ? 1.14 : .83;
    image.scale.y = number === 2 && setup.index === 1 ? .5 : 1;
    image.position.y = sign.position.y;
    marker.visible = !geometry;
    marker.position.set(end[0], incorrectReceiver ? Math.max(.4, end[1] + .45 * setup.index) : end[1], .28);
    marker.scale.setScalar(1 + (incorrectReceiver ? 0 : .12 * motion * Math.sin(time * 5)));
  };
}

function refraction(kit, number) {
  stage(kit);
  const water = kit.box(2.30, .68, .88, 0, .76, -.02, kit.crystal);
  const boundary = kit.box(2.32, .023, .91, 0, 1.10, -.02, kit.pale);
  const proportion = 1.33;
  const incoming = ray(kit, kit.light);
  const reflected = ray(kit, kit.pale, .010);
  const transmitted = ray(kit, kit.response);
  const outgoing = ray(kit, kit.response);
  const normal = dash(kit, kit.pale);
  const pulse = kit.sphere(.039, 0, 1.1, .40, kit.response);
  const at = (x, y) => [x, y, .40];

  return (setup, time, motion) => {
    const under = (number === 6 && setup.index < 2) || number === 7;
    const angles = { 1: [40, 0], 6: [60, 30, 60], 7: [30, 41.81, 60] };
    const angle = (angles[number]?.[setup.index] ?? 40) * DEG;
    const indexRatio = under ? (number === 7 ? 1.5 : proportion) : 1 / proportion;
    const sine = indexRatio * Math.sin(angle);
    const turns = sine > 1;
    const refracted = Math.asin(Math.min(1, sine));
    const from = under ? -1 : 1;
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
    const endSign = under ? 1 : -1;
    const entry = at(-.20, 1.103);
    const start = at(entry[0] - dx * .73, entry[1] + from * dy * .73);
    const bounce = at(entry[0] + dx * .76, entry[1] + from * dy * .76);
    const passesSlab = number === 3;
    const path = passesSlab ? Math.min(1.25, .67 / Math.max(.30, Math.cos(refracted))) : 1.00;
    const exit = at(entry[0] + Math.sin(refracted) * path, entry[1] + endSign * Math.cos(refracted) * path);
    const through = at(exit[0] + dx * .48, exit[1] + endSign * dy * .48);
    boundary.scale.y = number === 2 && setup.index === 1 ? 2.2 : 1;
    water.material.opacity = under ? .25 : .19;
    incoming(start, entry);
    transmitted(entry, exit, !turns);
    outgoing(exit, through, passesSlab && !turns);
    reflected(entry, bounce, turns || number === 6);
    normal(at(entry[0], .46), at(entry[0], 1.78), number !== 2 || setup.index !== 1);
    const progress = (time * .84) % 1;
    const [origin, destination, fraction] = progress < .5 ? [start, entry, 2 * progress] : [entry, turns ? bounce : exit, 2 * progress - 1];
    pulse.position.set(origin[0] + (destination[0] - origin[0]) * fraction, origin[1] + (destination[1] - origin[1]) * fraction, .40);
    pulse.visible = motion > 0;
  };
}

function fibre(kit) {
  stage(kit);
  kit.box(2.28, .61, .46, 0, .81, 0, kit.crystal);
  kit.box(.20, .30, .52, -1.12, .79, 0, kit.pale);
  kit.box(.20, .35, .52, 1.12, .79, 0, kit.pale);
  const beams = Array.from({ length: 5 }, () => ray(kit, kit.response));
  const pulse = kit.sphere(.05, -1.02, .78, .25, kit.light);
  return (setup, time, motion) => {
    const guides = setup.index === 0;
    const path = guides
      ? [[-1.02,.80,.24],[-.62,1.07,.24],[-.20,.55,.24],[.22,1.07,.24],[.65,.55,.24],[1.02,.81,.24]]
      : [[-1.02,.80,.24],[-.62,1.07,.24],[-.16,1.34,.24],[.35,1.52,.24]];
    beams.forEach((beam, i) => beam(path[i] ?? path.at(-1), path[i + 1] ?? path.at(-1), i < path.length - 1));
    const p = ((time * .72) % 1) * (path.length - 1);
    const i = Math.floor(p);
    pulse.position.fromArray(path[i]).lerp(new Vector3(...path[i + 1]), p % 1);
    pulse.visible = motion > 0;
  };
}

function lens(kit, number) {
  stage(kit);
  const optic = kit.sphere(.36, 0, .91, 0, kit.crystal);
  optic.scale.set(.27, 1.55, .96);
  const base = kit.box(.35, .22, .58, 0, .40, 0, kit.metal);
  const object = kit.box(.042, .26, .21, -.74, 1.04, .22, kit.light);
  const screen = kit.box(.035, .63, .33, .74, .87, .22, kit.pale);
  const image = kit.box(.042, .26, .15, .74, .79, .40, kit.response);
  const focus = kit.sphere(.035, .37, .91, .30, kit.response);
  const segments = Array.from({ length: 4 }, (_, index) => ray(kit, index % 2 ? kit.response : kit.light));
  const extension = [dash(kit, kit.pale), dash(kit, kit.pale)];
  const axis = dash(kit, kit.pale, 14);
  axis([-1.16, .91, .26], [1.16, .91, .26]);
  return (setup, time, motion) => {
    const f = .36;
    const h = .17;
    const distances = {
      1: [100, .15], 2: [100, 100], 3: [.54, .54, .54], 4: [.54, 1.08, .21],
      5: [.20, .20], 6: [1.08, .18], 7: [.18, 1.08, .36]
    };
    const distance = distances[number][setup.index];
    const distant = distance > 10;
    const atFocal = distance === f;
    const real = distance > f;
    const v = atFocal ? 10000 : f * distance / (distance - f);
    const objectX = distant ? -1.13 : -distance;
    const tip = [objectX, .91 + h, .27];
    const centre = [0, .91, .27];
    const parallel = [0, .91 + h, .27];
    const x = real ? Math.min(v, 1.06) : Math.min(.99, .51 * distance / h);
    const risen = distant ? 0 : -v / distance * h;
    const rayEnd = [x, .91 + h * (1 - x / f), .27];
    const centralEnd = [x, .91 - h * x / distance, .27];
    const virtualX = Math.max(-1.16, v);
    object.visible = !distant;
    base.scale.x = 1;
    object.position.x = objectX;
    segments[0](tip, parallel);
    segments[1](parallel, rayEnd);
    segments[2](distant ? [-1.13, .91 - h, .27] : tip, distant ? [0, .91 - h, .27] : centre);
    segments[3](distant ? [0, .91 - h, .27] : centre, distant ? [f, .91, .27] : centralEnd);
    const showVirtual = !real && !atFocal && !(number === 5 && setup.index === 1);
    extension[0](parallel, [virtualX, .91 + h * (1 - virtualX / f), .27], showVirtual);
    extension[1](centre, [virtualX, .91 - h * virtualX / distance, .27], showVirtual);
    focus.visible = number === 1 || (number === 2 && setup.index === 0);
    const projected = (number === 3 || number === 6) && (real || number === 3);
    screen.visible = projected;
    screen.position.x = number === 3 && setup.index !== 0 ? (setup.index === 1 ? .36 : -.54) : Math.min(1.08, v);
    image.visible = (number === 3 && setup.index === 0) || number === 4 || (number === 6 && real) || (number === 7 && !atFocal);
    image.position.set(Math.max(-1.16, Math.min(1.08, v)), .91 + risen * .5, .31);
    image.scale.y = Math.min(2.65, Math.max(.28, Math.abs(risen) / .26));
    image.material.emissiveIntensity = .17 + .17 * motion * (1 + Math.sin(time * 4));
  };
}

function prism(kit, number) {
  stage(kit);
  const triangle = [[-.39,.49,.15],[.42,.49,.15],[.03,1.48,.15]];
  triangle.forEach((point, index) => kit.beam(point, triangle[(index + 1) % 3], .038, kit.crystal));
  kit.box(.23, .25, .32, -1.02, 1.02, .12, kit.pale);
  kit.box(.037, 1.05, .54, 1.13, .91, .09, kit.pale);
  const bright = kit.light.clone();
  bright.color.setHex(0xf4f5f3);
  const incoming = ray(kit, bright,.018);
  const rays = spectrum.map(colour => {
    const material = kit.response.clone();
    material.color.setHex(colour);
    material.emissive.setHex(colour);
    return ray(kit, material, .012);
  });
  return (setup, time, motion) => {
    const white = number === 2 || setup.index === 0;
    const order = setup.index === 1 ? [6, 5, 4, 3, 2, 1, 0] : [3, 0, 6, 1, 2, 5, 4];
    bright.color.setHex(white ? 0xf4f5f3 : spectrum[0]);
    incoming([-1.09,1.03,.33],[.17,.99,.33]);
    const shift = .02 * Math.sin(time * 5) * motion;
    rays.forEach((beam, index) => {
      const rank = number === 2 && setup.index > 0 ? order[index] : index;
      beam([.17,.99,.33], [1.12,.84 - rank * .061 + shift,.33], white || index === 0);
    });
  };
}

function sound(kit, number) {
  stage(kit);
  const cabinet = kit.box(.28,.67,.62,-1.05,.65,-.01,kit.pale);
  const membrane = kit.disc(.27,.12,-.86,.68,-.01,kit.response);
  membrane.rotation.z = Math.PI / 2;
  const box = kit.box(2.00,.55,.70,.10,.69,-.03,kit.crystal);
  const reflector = kit.box(.08,.78,.68,1.05,.76,-.01,kit.pale);
  const particles = Array.from({ length: 30 }, () => kit.sphere(.026, 0, .69, 0, kit.response));
  const pulses = Array.from({ length: 5 }, () => {
    const hoop = kit.ring(.29,.012,0,.70,-.02,kit.light);
    hoop.rotation.y = Math.PI / 2;
    return hoop;
  });

  return (setup, time, motion) => {
    const vacuum = number === 3 && setup.index === 0;
    const muted = (number === 1 && setup.index === 1) || vacuum;
    const transverse = number === 8 && setup.index === 1;
    const rate = number === 2 ? [.64, 1.5, 2.6][setup.index] : number === 7 ? [1.2, 1.9, 2.9][setup.index] : number === 5 ? [2, 1.0][setup.index] : 1.5;
    const strength = number === 5 && setup.index === 1 ? .105 : .047;
    const propagates = number === 10 ? [1.6, .94, .61][setup.index] : .86;
    const pulseTime = time * propagates;
    const echo = number === 6;
    cabinet.position.y = .65;
    box.visible = number === 3 || number === 10;
    reflector.visible = echo || number === 4;
    reflector.scale.set(1, 1, echo && setup.index === 1 ? .7 : 1);
    membrane.position.x = -.86 + (number === 1 && muted ? 0 : .043 * Math.sin(time * rate * TAU)) * motion;
    particles.forEach((particle, index) => {
      const position = -.80 + (index % 15) * .133;
      const phase = number === 9 ? (index % 15) / 15 * TAU : time * rate * TAU - position * 6;
      const oscillation = (muted ? 0 : 1) * (number === 9 ? (setup.index === 0 ? .10 : -.10) : strength) * Math.sin(phase) * (number === 9 ? 1 : motion);
      particle.visible = !vacuum;
      particle.position.set(position + (transverse ? 0 : oscillation), .68 + (transverse ? oscillation : 0), index < 15 ? .16 : -.25);
    });
    pulses.forEach((pulse, index) => {
      const phase = (pulseTime * rate * .66 + index / pulses.length) % 1;
      const returning = echo && phase > .5;
      const distance = echo ? (returning ? 2 * (1 - phase) : 2 * phase) : phase;
      pulse.position.x = -.81 + 1.82 * distance;
      pulse.scale.setScalar(.67 + .18 * phase);
      pulse.visible = motion > 0 && !muted && (!returning || setup.index === 0) && (number < 8 || number === 10);
    });
  };
}
