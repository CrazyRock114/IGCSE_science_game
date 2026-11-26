import * as THREE from 'three';

const up = new THREE.Vector3(0, 1, 0);
const universal = [[0, 0xb82237], [3, 0xf05736], [5, 0xebbc42], [7, 0x3eaa5e], [9, 0x247eb7], [12, 0x6246aa], [14, 0x733796]];
const bromothymol = [[6, 0xeac341], [7, 0x4fa359], [7.6, 0x268ac9]];

function surface(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .36, metalness: .12, ...options });
}

function clear(color, opacity) {
  return surface(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: .15 });
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function cylinder(parent, material, radius, height, x, y, z, open = false) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 38, 1, open), material, x, y, z);
}

function join(parent, material, radius, from, to) {
  const a = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(a);
  const center = a.addScaledVector(direction, .5);
  const object = cylinder(parent, material, radius, direction.length(), ...center.toArray());
  object.quaternion.setFromUnitVectors(up, direction.normalize());
  return object;
}

function ring(parent, material, radius, size, x, y, z) {
  const shape = mesh(parent, new THREE.TorusGeometry(radius, size, 8, 38), material, x, y, z);
  shape.rotation.x = Math.PI / 2;
  return shape;
}

function box(parent, material, width, height, depth, x, y, z) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
}

function text(parent, label, width, height, x, y, z, color = '#d4e6ef') {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.height = 72;
  canvas.width = Math.round(canvas.height * width / height);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.font = '600 46px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(label, canvas.width / 2, 37, canvas.width - 4);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  mesh(parent, new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }), x, y, z);
}

function colorFor(palette, ph, target, scratch) {
  const upper = palette.findIndex(([p]) => p >= ph);
  if (upper <= 0) return target.setHex(palette[upper === 0 ? 0 : palette.length - 1][1]);
  const [min, low] = palette[upper - 1];
  const [max, high] = palette[upper];
  return target.setHex(low).lerp(scratch.setHex(high), (ph - min) / (max - min));
}

function stage(model, frame, chrome) {
  box(model, frame, 4.14, .16, 1.66, 0, .12, 0);
  box(model, chrome, 4.04, .035, 1.58, 0, .216, 0);
  for (const x of [-1.76, 1.76]) {
    for (const z of [-.57, .57]) cylinder(model, frame, .094, .075, x, .038, z);
  }
}

function indicatorGuide(parent, frame, chrome, palette, titration) {
  const guide = new THREE.Group();
  guide.position.set(1.26, .76, .26);
  guide.rotation.y = -.16;
  parent.add(guide);
  box(guide, frame, 1.13, .64, .13, 0, 0, 0);
  box(guide, chrome, 1.055, .56, .03, 0, 0, .067);
  const screen = surface(0x213c48, { roughness: .49 });
  box(guide, screen, 1.01, .51, .013, 0, 0, .084);
  text(guide, titration ? 'BROMOTHYMOL BLUE' : 'UNIVERSAL INDICATOR', .92, .10, 0, .152, .093);
  const count = palette.length;
  for (let i = 0; i < count; i += 1) {
    const [ph, color] = palette[i];
    const x = -.43 + .86 * i / (count - 1);
    box(guide, new THREE.MeshBasicMaterial({ color }), .80 / count, .105, .012, x, -.012, .099);
    text(guide, String(ph), .11, .081, x, -.142, .11, '#a3c8d8');
  }
  const marker = mesh(guide, new THREE.ConeGeometry(.043, .071, 3), new THREE.MeshBasicMaterial({ color: 0xe9f5fb }), 0, .075, .12);
  marker.rotation.z = Math.PI;
  return ph => {
    const first = palette[0][0];
    const last = palette[count - 1][0];
    const value = THREE.MathUtils.clamp(ph, first, last);
    const upper = palette.findIndex(([p]) => p >= value);
    let index = 0;
    if (upper > 0) {
      const min = palette[upper - 1][0], max = palette[upper][0];
      index = upper - 1 + (value - min) / (max - min);
    }
    marker.position.x = -.43 + .86 * index / (count - 1);
  };
}

function flask(model, glass, solution, chrome, x, base) {
  const profile = [[0, 0], [.51, 0], [.62, .035], [.62, .105], [.18, .74], [.18, .99]];
  mesh(model, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 44), glass, x, base, 0);
  ring(model, chrome, .183, .017, x, base + .99, 0);
  ring(model, chrome, .595, .012, x, base + .046, 0);

  const shape = new THREE.CylinderGeometry(1, 1, 1, 44);
  const positions = shape.getAttribute('position');
  const reference = positions.clone();
  const liquid = mesh(model, shape, solution, x, base + .08, 0);
  liquid.name = 'Indicator solution in conical flask';
  liquid.renderOrder = 1;

  const bottomRadius = .593;
  const slope = .64;
  let previousVolume;
  let liquidDepth;
  return added => {
    if (added === previousVolume) return liquid.position.y + liquidDepth;
    previousVolume = added;
    const volume = added * .0051;
    let low = 0, high = .605;
    for (let i = 0; i < 12; i += 1) {
      const depth = (low + high) / 2;
      const size = Math.PI * depth * (bottomRadius ** 2 - bottomRadius * slope * depth + (slope * depth) ** 2 / 3);
      if (size < volume) low = depth;
      else high = depth;
    }
    liquidDepth = (low + high) / 2;
    const topRadius = bottomRadius - slope * liquidDepth;
    for (let i = 0; i < positions.count; i += 1) {
      const top = reference.getY(i) > 0;
      const radius = top ? topRadius : bottomRadius;
      positions.setXYZ(i, reference.getX(i) * radius, top ? liquidDepth : 0, reference.getZ(i) * radius);
    }
    positions.needsUpdate = true;
    shape.computeVertexNormals();
    shape.computeBoundingSphere();
    return liquid.position.y + liquidDepth;
  };
}

function buretteExperiment(model, mission, materials, color) {
  const { frame, chrome, glass, alkali } = materials;
  const titration = mission.id === 'C12.2';
  const x = -.27;
  const y0 = 1.65;
  const length = 1.21;
  const bottom = .265;
  const initial = titration ? 25 : 20;
  const fill = flask(model, glass, color, chrome, x, bottom);
  const guide = indicatorGuide(model, frame, chrome, titration ? bromothymol : universal, titration);

  box(model, frame, .89, .095, .72, -1.25, .28, -.33);
  join(model, chrome, .04, [-1.35, .32, -.35], [-1.35, 2.88, -.35]);
  ring(model, chrome, .108, .021, x, y0 + length, 0);
  cylinder(model, glass, .105, length, x, y0 + length / 2, 0, true);
  const column = cylinder(model, alkali, .088, 1, x, y0, 0);
  column.name = 'Remaining alkali in graduated burette';
  const meniscus = ring(model, alkali, .088, .008, x, y0, 0);
  column.renderOrder = 1;
  for (let i = 0; i <= 25; i += 1) {
    const y = y0 + length * (1 - i / 25);
    box(model, chrome, i % 5 === 0 ? .065 : .04, .009, .009, x + .045, y, .094);
  }
  text(model, '0', .069, .081, x + .167, y0 + length, .10);
  text(model, '20', .115, .080, x + .168, y0 + length * .60, .10);
  text(model, '40', .115, .080, x + .168, y0 + length * .20, .10);
  const clampY = y0 + .77;
  join(model, chrome, .035, [-1.35, clampY, -.35], [x, clampY, -.11]);
  ring(model, frame, .123, .023, x, clampY, 0);
  cylinder(model, glass, .052, .19, x, 1.55, 0);
  join(model, chrome, .054, [x - .133, 1.545, 0], [x + .103, 1.545, 0]);
  box(model, frame, .147, .053, .13, x - .156, 1.545, 0);
  cylinder(model, glass, .035, .12, x, 1.415, 0);

  if (titration) {
    join(model, glass, .033, [-1.98, .47, .36], [-.93, .47, .36]);
    join(model, alkali, .061, [-1.63, .47, .36], [-1.29, .47, .36]);
    join(model, glass, .020, [-.94, .47, .36], [-.77, .47, .36]);
    box(model, frame, .88, .056, .14, -1.44, .416, .36);
    text(model, '25 mL PIPETTE', .72, .096, -1.43, .32, .44);
  }

  const dots = Array.from({ length: 4 }, (_, i) => {
    const drop = mesh(model, new THREE.SphereGeometry(.033 - .002 * i, 12, 9), alkali, x);
    drop.scale.set(.77, 1.13, .77);
    return drop;
  });
  return (t, setting, ph) => {
    const [min, max] = mission.range;
    const delivered = min + (max - min) * setting;
    const remaining = length * (1 - delivered / 50);
    column.scale.y = remaining;
    column.position.y = y0 + remaining / 2;
    meniscus.position.y = y0 + remaining;
    const liquidTop = fill(initial + delivered);
    guide(ph);
    dots.forEach((drop, i) => {
      const phase = (t * 1.14 + i / dots.length) % 1;
      drop.position.y = THREE.MathUtils.lerp(1.36, liquidTop, phase);
      drop.visible = delivered > 0;
    });
  };
}

function carbonDioxideExperiment(model, materials, solution) {
  const { frame, chrome, glass, alkali } = materials;
  const x = -.29;
  const wall = cylinder(model, glass, .63, 1.43, x, .97, 0, true);
  wall.name = 'Water vessel';
  ring(model, chrome, .633, .022, x, 1.68, 0);
  cylinder(model, frame, .65, .09, x, .28, 0);
  const liquid = cylinder(model, solution, .59, .84, x, .735, 0);
  liquid.renderOrder = 1;
  const guide = indicatorGuide(model, frame, chrome, universal, false);

  const gas = surface(0x4f7e91, { metalness: .61 });
  const tank = cylinder(model, gas, .24, .92, -1.57, .77, -.13);
  tank.name = 'Carbon dioxide supply';
  mesh(model, new THREE.SphereGeometry(.24, 24, 18), gas, -1.57, 1.22, -.13).scale.y = .60;
  cylinder(model, chrome, .075, .17, -1.57, 1.45, -.13);
  text(model, 'CO₂', .31, .138, -1.57, .89, .114);
  const sections = [[-1.57, 1.54, -.13], [-1.37, 1.71, -.13], [-.69, 1.75, -.13], [x, 1.73, -.13], [x, 1.49, -.13], [x, .44, -.13]];
  const path = new THREE.CatmullRomCurve3(sections.map(point => new THREE.Vector3(...point)));
  mesh(model, new THREE.TubeGeometry(path, 40, .047, 10), glass);
  cylinder(model, chrome, .078, .044, x, .43, -.13);
  const bubbles = Array.from({ length: 17 }, () => mesh(model, new THREE.SphereGeometry(.031, 11, 8), alkali));
  return (t, setting, ph) => {
    guide(ph);
    bubbles.forEach((bubble, i) => {
      const phase = (t * (.37 + setting * .15) + i / bubbles.length) % 1;
      bubble.position.set(x + Math.sin(i * 2.4 + phase * 4) * phase * .14, .47 + phase * .65, -.13 + Math.cos(i * 2.4) * phase * .11);
      bubble.scale.setScalar(.55 + phase * .76);
      bubble.visible = setting > 0 && i < 3 + setting * 14;
    });
  };
}

export function createPhScene(mission) {
  const model = new THREE.Group();
  const frame = surface(0x294653, { roughness: .51, metalness: .39 });
  const chrome = surface(0x7293a3, { roughness: .28, metalness: .57 });
  const materials = { frame, chrome, glass: clear(0xa5d6ed, .20), alkali: clear(0xa7e5f8, .59) };
  const solution = clear(0x9bc97f, .86);
  const tint = new THREE.Color();
  const scratch = new THREE.Color();
  const palette = mission.id === 'C12.2' ? bromothymol : universal;
  const minPh = Math.min(...mission.samples);
  const maxPh = Math.max(...mission.samples);
  stage(model, frame, chrome);
  const run = mission.id === 'C7.2'
    ? carbonDioxideExperiment(model, materials, solution)
    : buretteExperiment(model, mission, materials, solution);

  function update(t, setting, reading) {
    const ph = minPh + (maxPh - minPh) * reading;
    colorFor(palette, ph, tint, scratch);
    solution.color.copy(tint);
    run(t, setting, ph);
  }

  update(0, .5, (7 - minPh) / (maxPh - minPh));
  return { model, update };
}
