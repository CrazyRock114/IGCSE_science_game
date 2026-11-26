import { CanvasTexture, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three';

const tau = 2 * Math.PI;
const proton = 0xf39981;
const neutron = 0x91adcf;
const electron = 0x62e2ef;

const scans = {
  'C2.2/1': [
    [[6, 6, [2, 4], 'nucleus and shells', 'normal']],
    [[6, 6, [2, 4], 'electrons at center', 'swap']],
    [[6, 6, [2, 4], 'all on shells', 'scatter']]
  ],
  'C2.2/3': [[[7, 8, [2, 5], 'N']], [[8, 10, [2, 6], 'O']], [[9, 8, [2, 7], 'F']]],
  'C2.2/4': [
    [[11, 12, [2, 8, 1], '11 counted', 'protons']],
    [[11, 12, [2, 8, 1], '12 counted', 'neutrons']],
    [[11, 12, [2, 8, 1], '23 counted', 'normal']]
  ],
  'C2.2/5': [
    [[1, 0, [1], 'H'], [11, 12, [2, 8, 1], 'Na'], [20, 20, [2, 8, 8, 2], 'Ca']],
    [[1, 0, [2], 'H'], [11, 12, [2, 9], 'Na'], [20, 20, [2, 8, 10], 'Ca']],
    [[1, 0, [1], 'H'], [11, 12, [2, 7, 2], 'Na'], [20, 20, [2, 8, 10], 'Ca']]
  ],
  'C2.2/6': [[[12, 12, [2, 8, 2], 'Group II · Period 3']], [[16, 16, [2, 8, 6], 'Group VI · Period 3']], [[10, 10, [2, 8], 'Group VIII · Period 2']]],
  'C2.3/1': [
    [[6, 6, [2, 4], 'C-12'], [6, 8, [2, 4], 'C-14']],
    [[6, 6, [2, 4], 'C-12'], [7, 6, [2, 5], 'N-13']],
    [[6, 6, [2, 4], 'C-12'], [6, 6, [2, 4], 'C-12']]
  ],
  'C2.3/2': [
    [[17, 18, [2, 8, 8], 'Cl-35 · −1']],
    [[17, 20, [2, 8, 6], 'Cl-37 · +1']],
    [[17, 20, [2, 8, 8], 'Cl-37 · −1']]
  ],
  'C2.3/3': [
    [[6, 6, [2, 4], 'C-12'], [6, 8, [2, 4], 'C-14']],
    [[6, 6, [2, 4], 'C-12'], [7, 7, [2, 5], 'N-14']],
    [[6, 6, [2, 4], 'C-12'], [10, 10, [2, 8], 'Ne-20']]
  ]
};

function material(color, other = {}) {
  return new MeshStandardMaterial({ color, roughness: .42, ...other });
}

function label(k, width, height, x, y, z, colour = '#cce2ee') {
  k.box(width, height, .03, x, y, z, k.dark);
  if (typeof document === 'undefined') return () => {};
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 104;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const face = new MeshBasicMaterial({ map, toneMapped: false });
  k.box(width - .015, height - .015, .012, x, y, z + .02, face);
  let previous;
  return text => {
    if (text === previous) return;
    previous = text;
    ctx.fillStyle = '#172538';
    ctx.fillRect(0, 0, 512, 104);
    ctx.fillStyle = colour;
    ctx.font = '600 44px system-ui';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 52, 480);
    map.needsUpdate = true;
  };
}

function modelBase(k) {
  k.box(2.58, .12, 1.2, 0, .16, 0, k.dark);
  k.box(2.42, .024, .062, 0, .232, .55, k.light);
}

function atom(k, maxData, x, y, scale) {
  const pMat = material(proton), nMat = material(neutron);
  const eMat = material(electron, { emissive: electron, emissiveIntensity: .24 });
  const orbits = [0, 1, 2, 3].map(index => {
    const radius = (.235 + index * .143) * scale;
    return [k.ring(radius, .012 * scale, x, y, 0, k.pale), radius];
  });
  const allocations = [0, 1, 2, 3].map(index => Math.max(0, ...maxData.map(sample => sample[2][index] ?? 0)));
  const dots = allocations.map(count => Array.from({length: count}, () => k.sphere(.037 * scale, x, y, 0, eMat)));
  const ps = Array.from({length: Math.max(...maxData.map(data => data[0]))}, () => k.sphere(.039 * scale, x, y, 0, pMat));
  const ns = Array.from({length: Math.max(...maxData.map(data => data[1]))}, () => k.sphere(.039 * scale, x, y, 0, nMat));
  const caption = label(k, Math.min(1.58, .92 * scale + .16), .151, x, .365, .25);
  return (data, t, motion) => {
    const [p, n, shells, text, placement] = data;
    const outside = placement === 'scatter', misplaced = placement === 'swap';
    caption(text);
    const center = (object, index, count, radius) => {
      const angle = index * 2.39996;
      const r = Math.sqrt((index + .35) / Math.max(1, count)) * radius;
      object.position.set(x + Math.cos(angle) * r, y + Math.sin(angle) * r, .12 * scale * Math.sin(index * 1.97));
    };
    pMat.color.setHex(placement === 'neutrons' ? 0x435369 : proton);
    nMat.color.setHex(placement === 'protons' ? 0x435369 : neutron);
    const placeNucleons = (items, total, isProton) => items.forEach((item, i) => {
      item.visible = i < total;
      if (outside || (misplaced && isProton)) {
        const angle = (i + (isProton ? 0 : .5)) * tau / Math.max(1,total) + t * .4 * motion;
        const radius = (isProton ? .414 : .54) * scale;
        item.position.set(x + radius * Math.cos(angle), y + radius * Math.sin(angle), -.10 + (isProton ? .08 : 0));
      } else {
        const cluster = .155 * scale;
        center(item, i * 2 + Number(!isProton), 2 * Math.max(p,n), cluster);
      }
    });
    placeNucleons(ps, p, true);
    placeNucleons(ns, n, false);
    let e = 0;
    orbits.forEach(([ring, radius], index) => {
      const count = shells[index] ?? 0;
      ring.visible = count > 0 || (index < 3 && outside);
      dots[index].forEach((dot, i) => {
        dot.visible = i < count;
        const angle = i * tau / Math.max(1, count) + .47 * index + t * .57 * (index % 2 ? -1 : 1) * motion;
        if (misplaced) center(dot, e++, 6, .105 * scale);
        else dot.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, .04 * Math.cos(angle));
      });
    });
  };
}

function shells(k, data) {
  modelBase(k);
  const count = data[0].length;
  const scale = count === 1 ? .99 : count === 2 ? .75 : .58;
  const stage = Array.from({length: count}, (_, i) =>
    atom(k, data.map(cases => cases[i]), (i - (count - 1) / 2) * (count === 3 ? .88 : 1.11), count === 1 ? 1.08 : .99, scale)
  );
  label(k, .70, .13, -.78, .27, .61, '#f39981')('protons');
  label(k, .71, .13, 0, .27, .61, '#91adcf')('neutrons');
  label(k, .72, .13, .78, .27, .61, '#62e2ef')('electrons');
  return (s, t, motion) => stage.forEach((animate, index) => animate(data[s.index][index], t, motion));
}

function chargeSorter(k) {
  modelBase(k);
  const positive = material(proton), negative = material(electron);
  const particle = material(neutron);
  k.box(2.3, .08, .62, 0, 1.63, 0, positive);
  k.box(2.3, .08, .62, 0, .47, 0, negative);
  k.box(.08, 1.19, .68, -1.15, 1.04, 0, k.pale);
  k.box(.08, 1.19, .68, 1.15, 1.04, 0, k.pale);
  label(k,.34,.13,0,1.74,.18,'#f39981')('+');
  label(k,.34,.13,0,.61,.18,'#62e2ef')('−');
  const stream = Array.from({length: 15}, () => k.sphere(.047, -1, 1.06, 0, particle));
  const choices = [proton, neutron, electron];
  const bend = [-.17, 0, .49];
  return (s, t, motion) => {
    particle.color.setHex(choices[s.index]);
    stream.forEach((dot, i) => {
      const offset = (i / stream.length + t * .58 * motion) % 1;
      dot.position.set(-1.04 + 2.08 * offset, 1.02 + bend[s.index] * offset ** 2, .10);
      dot.scale.setScalar(s.index === 2 ? .67 : 1);
      dot.visible = (motion > 0 || i === 0);
    });
  };
}

function chromatogram(k, objective) {
  modelBase(k);
  const first = objective.number === '1';
  const compare = objective.number === '2';
  const colours = [material(0xe479a5), material(0x708ddb), material(0xebc549)];
  const origin = .63;
  const travel = 1;
  k.box(2.35, 1.44, .63, 0, .98, .03, k.crystal);
  k.box(2.29, 1.25, .03, 0, 1.015, -.16, material(0xf0e7d5));
  const pool = k.box(2.28, .29, .55, 0, .39, .03, material(0x7abbd9, {transparent: true, opacity: .55}));
  const baseline = k.box(2.12, .023, .023, 0, origin, -.132, k.dark);
  const front = k.box(2.09, .021, .025, 0, origin, -.114, k.light);
  const traces = [-.53, .46].map(x => [0, 1, 2].map(i => {
    const spot = k.sphere(.072, x, origin, -.064, colours[i]);
    spot.scale.set(1, .6, .33);
    return spot;
  }));
  k.box(.15, 1.07, .047, .94, 1.12, -.087, compare ? k.pale : k.metal);
  for (let i = 0; i < 11; i += 1) k.box(i % 5 === 0 ? .12 : .07, .013, .025, .92, .62 + i * .10, -.045, k.pale);
  const leftCaption = label(k, .79, .15, -.55, .48, .39);
  const rightCaption = label(k, .93, .15, .48, .48, .39);
  const measurements = first || compare ? [] : [-.32, .22].map(x => {
    const shaft = k.box(.028, 1, .028, x, origin, -.035, k.response);
    const marker = k.box(.135, .026, .036, x, origin, -.035, k.response);
    return [shaft, marker];
  });
  return (s, _t, motion) => {
    const i = s.index;
    const submerged = first && i === 1;
    const dirty = first && i === 2;
    baseline.position.y = submerged ? .47 : origin;
    pool.scale.y = submerged ? 1.30 : .68;
    front.position.y = origin + Math.max(.018, travel * motion);
    const points = first
      ? [submerged ? [] : dirty ? [.28, .49, .77] : [.32, .74], []]
      : compare
        ? [[20 / 60, 55 / 60], [[20 / 60], [20 / 60, 55 / 60], [12 / 60, 55 / 60]][i]]
        : [[.50], []];
    leftCaption(first ? (submerged ? 'dye in solvent' : 'dye lane') : compare ? 'unknown' : 'spot: 30 mm');
    rightCaption(first ? (dirty ? 'ink interference' : submerged ? 'below solvent line' : 'pencil baseline') : compare ? `reference ${'ABC'[i]}` : ['front: 60 mm', 'distance inverted', 'distance only'][i]);
    const caliperHeights = i === 0 ? [.5, 1] : i === 1 ? [1, .5] : [.5, 0];
    measurements.forEach(([shaft, marker], index) => {
      const range = caliperHeights[index] * motion;
      shaft.visible = marker.visible = range > .015;
      shaft.scale.y = Math.max(.015, range);
      shaft.position.y = origin + range / 2;
      marker.position.y = origin + range;
    });
    traces.forEach((lane, slot) => lane.forEach((spot, j) => {
      spot.visible = j < points[slot].length || (submerged && slot === 0 && j === 0);
      spot.position.y = submerged ? .397 : origin + (points[slot][j] ?? 0) * travel * motion;
      spot.scale.x = submerged ? 5.4 * Math.max(.24,motion) : dirty && j === 2 ? 1.9 : 1;
    }));
  };
}

export function chemistryObjectiveRig(k, objective) {
  if (objective.key === 'C2.2/2') return chargeSorter(k);
  if (scans[objective.key]) return shells(k, scans[objective.key]);
  if (objective.mission.id === 'C12.3') return chromatogram(k, objective);
  return null;
}
