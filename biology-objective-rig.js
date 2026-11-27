const tau = Math.PI * 2;

export function biologyObjectiveRig(k, objective) {
  if (objective.mission.id === 'B3.2') {
    if (objective.number === '1') return selectivePanel(k);
    if (objective.number === '3') return potatoBalance(k);
    return plantCellBath(k, objective.number);
  }
  if (objective.mission.id !== 'B6.1') return null;
  switch (objective.number) {
    case '2': return reactionPipes(k);
    case '3': return pigmentSlide(k);
    case '4': return controlledShoots(k);
    case '5': return atomBalance(k);
    case '7': return carbonBranches(k);
    case '8': return nutrientTrial(k);
    case '10': return indicatorVials(k);
    default: return greenhouseTank(k, objective.number);
  }
}

function tint(k, colour, opacity = 1) {
  const material = (opacity < 1 ? k.crystal : k.light).clone();
  material.color.setHex(colour);
  material.opacity = opacity;
  return material;
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function phase(time, i, speed = .5) {
  return (time * speed + i * .137) % 1;
}

function ringFlat(k, radius, width, x, y, z, material) {
  const ring = k.ring(radius, width, x, y, z, material);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function selectivePanel(k) {
  const water = tint(k, 0x70b8ee);
  const sucrose = tint(k, 0xf5b373);
  const gateMaterial = tint(k, 0xc6eade, .48);
  k.box(2.26,.1,1.07,0,.21,0,k.dark);
  k.box(2.2,1.1,1.01,0,.79,0,k.crystal);
  const gate = k.box(.045,1.04,.96,0,.8,0,gateMaterial);
  const edges = [-.48,.48].map(z => k.box(.08,1.06,.041,0,.8,z,k.metal));
  const drops = Array.from({ length: 26 }, (_, i) =>
    k.sphere(i < 18 ? .041 : .064, 0,.48,0,i < 18 ? water : sucrose)
  );
  return (s, t, progress) => {
    const open = s.index === 0;
    const shut = s.index === 2;
    gate.visible = !open;
    edges.forEach(edge => { edge.visible = !open; });
    gateMaterial.opacity = shut ? .84 : .38;
    drops.forEach((drop, i) => {
      const start = -.14 - (i % 7) * .125;
      const crosses = !shut && (open || i < 18);
      const end = 1.01 * Math.sin(i * 2.36 + t * 1.65);
      drop.position.set(
        crosses ? start * (1 - progress) + end * progress : start,
        .78 + .38 * Math.sin(i * 1.39 + t * .8 * progress),
        .39 * Math.cos(i * 2.35 + t * .7 * progress)
      );
    });
  };
}

function plantCellBath(k, number) {
  const cellWall = tint(k, 0x8bd7ad, .47);
  const membrane = tint(k, 0x62c3a2, .38);
  const cytoplasm = tint(k, 0xa8e5dc, .31);
  const water = tint(k, 0x73cfff);
  const x = -.12;
  k.box(2.33,.12,1.27,0,.24,0,k.dark);
  k.box(2.19,.96,1.22,0,.74,0,k.crystal);
  k.box(1.23,.85,.81,x,.74,0,cellWall);
  for (const side of [-1,1]) {
    k.box(.045,.86,.86,x + side*.61,.75,0,k.light);
    k.box(1.24,.043,.86,x,.75 + side*.42,0,k.light);
  }
  const protoplast = k.box(1.13,.745,.74,x,.74,0,membrane);
  const vacuole = k.box(.78,.55,.64,x+.1,.74,.02,cytoplasm);
  const nucleus = k.sphere(.127,x-.31,.68,.27,k.response);
  const beads = Array.from({ length: 17 }, (_, i) => k.sphere(.034 + (i%3)*.007,0,.79,0,water));
  return (s, t, progress) => {
    let direction;
    if (number === '2') direction = [1,-1,0][s.index];
    else if (number === '4') direction = [1,0,-1][s.index];
    else if (number === '5') direction = [1,0,-1][s.index];
    else direction = [-1,1,-1][s.index];
    const shrinks = direction < 0;
    const target = direction > 0 ? 1.04 : shrinks ? .63 : .9;
    const scale = .89 + (target - .89) * progress;
    protoplast.scale.set(scale, scale, scale);
    vacuole.scale.setScalar(Math.max(.3, scale - (shrinks ? .07 : .025) * progress));
    nucleus.position.x = x - .31 * scale;
    nucleus.position.z = .27 * scale;
    beads.forEach((bead, i) => {
      const side = i % 2 ? 1 : -1;
      const fluctuation = phase(t, i, .69 * progress);
      const outward = direction === 0 ? (i % 4 < 2 ? 1 : -1) : -direction;
      const extent = .19 + .86 * (outward > 0 ? fluctuation : 1 - fluctuation);
      bead.position.set(x + side * extent, .78 + .33 * Math.sin(i * 1.29 + t * progress), .37 * Math.cos(i * 2.4));
      bead.visible = progress > .02 && (direction !== 0 || i < 12);
    });
  };
}

function potatoBalance(k) {
  const tuber = tint(k,0xceb887);
  const wet = tint(k,0x75c8e4,.28);
  k.box(2.34,.13,1.18,0,.24,0,k.dark);
  k.tube(.38,.60,-.66,.56,0,k.crystal);
  k.disc(.36,.32,-.66,.42,0,wet);
  ringFlat(k,.37,.022,-.66,.88,0,k.pale);
  const sample = k.box(.5,.18,.26,-.66,.62,0,tuber);
  k.box(.93,.25,.76,.58,.42,0,k.metal);
  k.disc(.34,.08,.58,.59,0,k.pale);
  const meter = k.box(.67,.12,.044,.58,.43,.39,k.dark);
  meter.rotation.x = -.26;
  const bars = Array.from({ length: 12 }, (_, i) =>
    k.box(.038,.054,.045,.31 + i*.05,.453,.423,k.response)
  );
  return (s, t, progress) => {
    const values = [11.4,10,8.7];
    const mass = 10 + (values[s.index] - 10) * clamp((progress - .29) / .71);
    const transfer = clamp((progress - .15) / .74);
    sample.position.set(-.66 + 1.24*transfer, .62 + .085*transfer + .49*Math.sin(Math.PI * transfer), .04);
    sample.rotation.y = .23*transfer;
    sample.scale.setScalar(Math.cbrt(mass / 10));
    bars.forEach((bar, i) => { bar.visible = i < Math.round(2 + (mass - 8.5) * 3.3); });
  };
}

function shoot(k, x, y, z, leafColour, size = 1) {
  const stem = k.beam([x,y,z],[x+.05*size,y+.83*size,z+.05],.027,leafColour);
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const sign = i % 2 ? 1 : -1;
    const blade = k.sphere(.136, x + sign*(.10+i*.012)*size, y + (.18+i*.087)*size, z, leafColour);
    blade.scale.set(1.5*size,.29*size,.85*size);
    blade.rotation.z = sign * (.34 + i*.012);
    return blade;
  });
  return { stem, leaves };
}

function greenhouseTank(k, number) {
  const green = tint(k,0x6fce80);
  const liquid = tint(k,0x4caabe,.19);
  const bubble = tint(k,0xc3f7ed,.57);
  const photon = tint(k,0xffd177);
  const carbohydrate = tint(k,0xf3c878);
  k.box(1.5,.10,.41,0,1.65,-.18,k.metal);
  const lamp = k.box(1.28,.048,.32,0,1.59,-.18,photon);
  k.box(2.28,.1,1.25,0,.24,0,k.dark);
  k.box(2.17,1.03,1.12,0,.81,0,k.crystal);
  k.box(2.1,.77,1.06,0,.67,0,liquid);
  k.box(.08,1.05,.08,-.81,1.13,-.49,k.dark);
  k.box(.08,1.05,.08,.81,1.13,-.49,k.dark);
  shoot(k,-.36,.33,.13,green,.90);
  shoot(k,.25,.33,-.2,green,.92);
  const oxygen = Array.from({ length: 19 }, (_, i) =>
    k.sphere(.027 + (i%3)*.012,0,.57,0,bubble)
  );
  const stores = Array.from({ length: 9 }, (_, i) =>
    k.disc(.065,.04,.69 + (i%3)*.13,.33 + Math.floor(i/3)*.055,.40,carbohydrate)
  );
  const lightPackets = Array.from({ length: 12 }, () => k.sphere(.022,0,1.41,-.18,photon));
  return (s,t,progress) => {
    const lit = number === '1' ? s.index !== 1 : number === '6' ? s.index < 2 : true;
    const fixing = number === '1' || number === '6' ? s.index === 0 : s.index < 2;
    const rate = number === '9' ? [1,.71,.33][s.index] : 1;
    lamp.visible = lit;
    lightPackets.forEach((packet,i) => {
      packet.visible = lit && progress > .04;
      const drift = phase(t,i,.81);
      const y = number === '6' && s.index === 1 ? .84 + drift*.74 : 1.58 - drift*.74;
      packet.position.set(-.62 + (i%6)*.24,y,-.21 + (i%2)*.27);
    });
    oxygen.forEach((one,i) => {
      one.visible = fixing && i < oxygen.length * progress * rate;
      one.position.set(-.30 + Math.sin(i*2.39+t)*.46, .47 + phase(t,i,.43*rate)*.55, .31*Math.cos(i*2.4));
    });
    stores.forEach((piece,i) => { piece.visible = fixing && i < progress * stores.length * rate; });
  };
}

function reactionPipes(k) {
  const carbon = tint(k,0xb79fc9);
  const water = tint(k,0x6dbfec,.59);
  const oxygen = tint(k,0xc6eee9,.63);
  const glucose = tint(k,0xffce84);
  const vialPositions = [-.91,-.44,.44,.91];
  const materials = [carbon,water,oxygen,glucose];
  const fill = vialPositions.map((x,i) => {
    k.tube(.19,.75,x,.75,0,k.crystal);
    k.disc(.198,.06,x,.35,0,k.metal);
    ringFlat(k,.185,.021,x,1.13,0,k.pale);
    k.beam([x,.54,0],[0,.54,-.35],.025,k.metal);
    return k.disc(.16,.62,x,.69,0,materials[i]);
  });
  k.box(2.34,.11,1.1,0,.22,0,k.dark);
  shoot(k,0,.35,-.33,tint(k,0x5ab273),.78);
  return (s,t,progress) => {
    const ready = s.index === 1;
    const supply = ready ? [.9 - .27*progress,.91 - .37*progress,.1 + .7*progress,.06 + .72*progress]
      : [.68,.52,.07,.06];
    fill.forEach((level,i) => {
      const height = supply[i];
      level.scale.y = height;
      level.position.y = .39 + .31*height;
    });
  };
}

function pigmentSlide(k) {
  const wall = tint(k,0x8adfa4,.4);
  const lens = tint(k,0xaeffff,.37);
  const green = tint(k,0x56bd65);
  k.box(2.16,.13,1.22,0,.22,0,k.dark);
  k.box(1.87,.06,1.02,0,.31,0,k.crystal);
  k.box(1.57,.51,.87,-.12,.61,0,wall);
  const vacuole = k.sphere(.36,-.13,.68,0,lens);
  vacuole.scale.set(1.38,.43,.91);
  const nucleus = k.sphere(.169,-.55,.69,.19,tint(k,0x93a7de));
  const chloroplast = Array.from({ length: 11 }, (_, i) => {
    const organelle = k.sphere(.071,-.12 + .63*Math.cos(i*tau/11),.82,.34*Math.sin(i*tau/11),green);
    organelle.scale.set(1.49,.56,.77);
    organelle.rotation.y = i*tau/11;
    return organelle;
  });
  const focus = ringFlat(k,.23,.027,0,1.09,0,k.response);
  return (s,t,progress) => {
    const centers = [[-.55,.19],[-.13,0],[.43,.17]];
    focus.position.x = centers[s.index][0];
    focus.position.z = centers[s.index][1];
    focus.position.y = 1.02 + .09*Math.sin(progress*Math.PI);
    nucleus.scale.setScalar(s.index === 0 ? 1+.14*progress : 1);
    chloroplast.forEach(organ => { organ.scale.y = s.index === 2 ? .56 + .42*progress : .56; });
  };
}

function controlledShoots(k) {
  const chambers = [-.67,.67].map(x => {
    const foliage = tint(k,0x62b356);
    k.tube(.4,.87,x,.78,0,k.crystal);
    const liquid = k.disc(.36,.53,x,.62,0,tint(k,0x5ca5b2,.3));
    ringFlat(k,.39,.022,x,1.226,0,k.pale);
    const { stem, leaves } = shoot(k,x,.36,0,foliage,.81);
    const lamp = k.box(.68,.083,.31,x,1.45,-.16,k.pale);
    const tray = k.disc(.30,.06,x,.29,.32,k.pale);
    const sample = k.sphere(.119,x,.36,.36,tint(k,0x374798,.72));
    return { foliage, liquid, stem, leaves, lamp, tray, sample };
  });
  k.box(2.37,.1,1.17,0,.21,0,k.dark);
  const [active, spare] = chambers;
  const cover = k.box(.36,.26,.04,-.67,.85,.29,k.dark);
  const absorber = k.disc(.099,.052,-.47,.37,-.14,k.pale);
  cover.visible = absorber.visible = false;
  return (s,t,progress) => {
    const settings = s.practical;
    cover.visible = Boolean(settings && !settings.light);
    absorber.visible = Boolean(settings && !settings.carbonDioxide);
    active.lamp.visible = settings ? Boolean(settings.light) : true;
    spare.lamp.visible = !settings && s.index !== 0;
    active.liquid.visible = spare.liquid.visible = !settings;
    spare.stem.visible = !settings;
    spare.leaves.forEach(leaf => { leaf.visible = !settings; });
    active.foliage.color.setHex(settings && !settings.chlorophyll ? 0xd9d09b : 0x62b356);
    active.sample.material.color.setHex(settings ? (settings.starch ? 0x1a2154 : 0xaf7429) : 0x374798);
    active.sample.visible = progress > .61 && (settings ? s.running : s.index !== 2);
    spare.sample.visible = false;
    for (const { tray } of chambers) tray.scale.setScalar(1+.05*Math.sin(t*2) * progress);
  };
}

function atomBalance(k) {
  const material = [tint(k,0x7b8597),tint(k,0xe7e7df),tint(k,0xf7767e)];
  const counts = [
    [[6,12,18],[6,12,18]],
    [[1,2,3],[6,12,8]],
    [[6,12,18],[6,12,12]]
  ];
  k.box(2.36,.11,1.24,0,.22,0,k.dark);
  k.box(.06,1.04,.91,0,.77,0,k.metal);
  const clusters = [-.65,.65].map(x => material.map((m,row) =>
    Array.from({ length: 18 }, (_, i) => k.sphere(.036, x + (i%6-2.5)*.113, 1.21 - row*.31, (Math.floor(i/6)-1)*.22,m))
  ));
  return (s,t,progress) => clusters.forEach((side,i) => side.forEach((group,row) => group.forEach((dot,j) => {
    dot.visible = j < counts[s.index][i][row];
    dot.scale.setScalar(.86 + .14*progress);
  })));
}

function carbonBranches(k) {
  const light = tint(k,0xbce995);
  const store = tint(k,0xffc589);
  k.box(2.3,.11,1.14,0,.2,0,k.dark);
  shoot(k,0,.31,0,tint(k,0x63ae6d),1.18);
  const sinks = [[-.76,.66,.05],[.70,.83,0],[.72,1.3,.1],[-.57,.41,.37]];
  sinks.forEach(([x,y,z]) => {
    k.beam([0,.73,0],[x,y,z],.025,k.metal);
    k.sphere(.113,x,y,z,store);
  });
  const trace = Array.from({ length: 20 }, () => k.sphere(.043,0,.73,0,light));
  return (s,t,progress) => trace.forEach((dot,i) => {
    const branch = s.index === 0 ? [0,3][i%2] : s.index === 1 ? [1,2][i%2] : -1;
    dot.visible = branch !== -1 && progress > .03;
    const position = sinks[branch] ?? [0,.73,0];
    const fraction = phase(t,i,.57);
    dot.position.set(position[0]*fraction,.73 + (position[1]-.73)*fraction,position[2]*fraction);
  });
}

function nutrientTrial(k) {
  const healthy = tint(k,0x6ebb6d);
  const subject = tint(k,0x75bf70);
  const amber = 0xd7bd62;
  k.box(2.35,.09,1.1,0,.21,0,k.dark);
  for (const x of [-.62,.62]) {
    k.disc(.39,.25,x,.34,0,k.metal);
    k.disc(.35,.05,x,.477,0,tint(k,0x736854));
  }
  shoot(k,-.62,.49,0,healthy,1.06);
  const specimen = shoot(k,.62,.49,0,subject,1.06);
  return (s,t,progress) => {
    subject.color.setHex(s.index === 0 ? 0x73b278 : amber);
    specimen.leaves.forEach((leaf,i) => {
      leaf.position.y = .49 + (.18+i*.087)*1.06 * (s.index === 0 ? 1 - progress*.36 : 1);
    });
    specimen.stem.scale.y = s.index === 0 ? 1 - progress*.31 : 1;
    specimen.stem.position.y = .93 - (s.index === 0 ? progress*.14 : 0);
  };
}

function indicatorVials(k) {
  const standard = 0xd57742;
  const left = tint(k,standard,.64);
  const right = tint(k,standard,.64);
  const reference = tint(k,0xb2e5a1);
  const shade = k.box(.89,.13,.84,.65,1.51,0,k.dark);
  k.box(2.33,.12,1.24,0,.23,0,k.dark);
  for (const [x,material] of [[-.64,left],[.64,right]]) {
    k.tube(.36,1,x,.82,0,k.crystal);
    k.disc(.32,.77,x,.69,0,material);
    ringFlat(k,.35,.024,x,1.33,0,k.pale);
    shoot(k,x,.35,0,reference,.77);
  }
  const baseline = left.color.clone();
  const target = baseline.clone();
  return (s,t,progress) => {
    const lit = s.index === 0;
    shade.visible = !lit;
    left.color.copy(baseline);
    right.color.copy(baseline).lerp(target.setHex(lit ? 0x9d71c9 : 0xe6c14e), progress);
  };
}
