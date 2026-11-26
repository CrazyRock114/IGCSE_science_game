import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tau = Math.PI * 2;

function surface(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .13, ...options });
}

function glass(color, opacity) {
  return surface(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: .18 });
}

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function tube(parent, material, radius, points) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  add(parent, new THREE.TubeGeometry(path, 40, radius, 10), material);
  return path;
}

function cylinder(parent, material, radius, height, x, y, z, open = false) {
  return add(parent, new THREE.CylinderGeometry(radius, radius, height, 40, 1, open), material, x, y, z);
}

function sleeve(parent, material, radius, from, to, open = false) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const center = a.addScaledVector(direction, .5);
  const object = cylinder(parent, material, radius, direction.length(), center.x, center.y, center.z, open);
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object;
}

function ring(parent, material, radius, size, x, y, z) {
  const object = add(parent, new THREE.TorusGeometry(radius, size, 10, 44), material, x, y, z);
  object.rotation.x = Math.PI / 2;
  return object;
}

function particles(parent, count, geometry, material, updater) {
  const swarm = new THREE.InstancedMesh(geometry, material, count);
  swarm.frustumCulled = false;
  parent.add(swarm);
  const marker = new THREE.Object3D();
  return (...args) => {
    for (let i = 0; i < count; i += 1) {
      marker.scale.setScalar(1);
      updater(marker, i, ...args);
      marker.updateMatrix();
      swarm.setMatrixAt(i, marker.matrix);
    }
    swarm.instanceMatrix.needsUpdate = true;
  };
}

function platform(model, base, metal) {
  add(model, new THREE.BoxGeometry(4.25, .14, 1.72), base, 0, .13, 0);
  add(model, new THREE.BoxGeometry(4.12, .036, 1.66), metal, 0, .217, 0);
  for (const x of [-1.82, 1.82]) {
    for (const z of [-.59, .59]) {
      cylinder(model, metal, .11, .07, x, .035, z);
    }
  }
}

function tank(parent, materials, x, bottom, radius, height, tint) {
  const { frame, chrome } = materials;
  cylinder(parent, glass(0xa1dee9, .18), radius, height, x, bottom + height / 2, 0, true);
  cylinder(parent, frame, radius * 1.03, .09, x, bottom, 0);
  ring(parent, chrome, radius, .019, x, bottom + height, 0);
  const water = cylinder(parent, glass(tint, .82), radius - .028, 1, x, bottom, 0);
  water.renderOrder = 1;
  return {
    water,
    fill(depth) {
      water.visible = depth > .004;
      water.scale.y = Math.max(depth, .002);
      water.position.y = bottom + depth / 2 + .035;
    }
  };
}

function sandFilter(model, materials) {
  const { frame, chrome, blue, brightBlue } = materials;
  const dirtyColor = new THREE.Color(0xae8552);
  const cleanColor = new THREE.Color(0x48b6d0);
  const intake = tank(model, materials, -1.47, .3, .44, 1.40, 0xb18e54);
  const outlet = tank(model, materials, 1.44, .3, .43, 1.24, 0x49a6c7);
  intake.fill(.98);
  outlet.fill(.77);

  const chamberBottom = .47;
  const gravelTop = .68;
  const chamberRadius = .58;
  cylinder(model, glass(0xa8e5f4, .16), chamberRadius, 1.96, 0, chamberBottom + .98, 0, true);
  for (const y of [chamberBottom, 2.43]) {
    cylinder(model, frame, chamberRadius * 1.05, .12, 0, y, 0);
    ring(model, chrome, chamberRadius, .026, 0, y - .01, 0);
  }
  cylinder(model, surface(0x6c6258, { roughness: .93 }), .54, .14, 0, gravelTop - .07, 0);
  const sand = cylinder(model, surface(0xd0a46d, { roughness: .87 }), .54, 1, 0, gravelTop, 0);
  sand.name = 'Adjustable sand bed';
  const inletWater = cylinder(model, glass(0xbb9b67, .34), .52, 1, 0, 1.9, 0);
  inletWater.renderOrder = 1;

  for (let i = 0; i < 6; i += 1) {
    const y = .73 + i * .22;
    add(model, new THREE.BoxGeometry(i % 5 === 0 ? .15 : .10, .013, .022), chrome, .37, y, .45);
  }

  const intakePoints = [[-1.47, 1.31, 0], [-1.47, 2.13, 0], [-1.23, 2.29, 0], [-.56, 2.29, 0], [-.30, 2.10, 0]];
  const outletPoints = [[.33, .52, 0], [.74, .52, 0], [.82, 1.35, 0], [1.05, 1.52, 0], [1.44, 1.52, 0], [1.44, 1.15, 0]];
  const intakePipe = tube(model, glass(0xc4a76b, .4), .068, intakePoints);
  const outletPipe = tube(model, glass(0x86d8f2, .45), .068, outletPoints);
  const connector = new THREE.Vector3();
  for (const path of [intakePipe, outletPipe]) {
    for (const position of [.06, .36, .72, .94]) {
      path.getPointAt(position, connector);
      const collar = cylinder(model, chrome, .092, .071, connector.x, connector.y, connector.z);
      collar.quaternion.setFromUnitVectors(UP, path.getTangentAt(position));
    }
  }

  const grains = particles(model, 83, new THREE.DodecahedronGeometry(.035, 0), surface(0xe8bb7c), (grain, i, height) => {
    const angle = tau * i * .38196;
    const radius = .52 * Math.sqrt((i + .5) / 83);
    grain.position.set(Math.cos(angle) * radius, gravelTop + height + Math.sin(i * 3.8) * .009, Math.sin(angle) * radius);
    grain.rotation.set(i * .6, i * .4, i * .3);
    grain.scale.setScalar(height <= .0001 ? 0 : .40 + (i % 5) * .13);
  });
  const trapped = particles(model, 24, new THREE.DodecahedronGeometry(.027, 0), surface(0x6c4735), (grain, i, height, reading) => {
    const angle = tau * i * .38196;
    const radius = .49 * Math.sqrt((i + .5) / 24);
    grain.position.set(Math.cos(angle) * radius, gravelTop + height + .022, Math.sin(angle) * radius);
    grain.scale.setScalar(height <= .0001 || i >= Math.ceil(24 * (1 - reading)) ? 0 : 1);
  });
  const inletCloud = particles(model, 32, new THREE.IcosahedronGeometry(.022, 0), surface(0x75543f), (grain, i, t) => {
    const angle = i * 2.39996 + t * .12;
    const radius = .35 * Math.sqrt((i + 1) / 32);
    grain.position.set(-1.47 + radius * Math.cos(angle), .42 + ((i * .312 + t * .041) % 1) * .80, radius * Math.sin(angle));
    grain.scale.setScalar(.65 + .17 * (i % 4));
  });
  const outletCloud = particles(model, 30, new THREE.IcosahedronGeometry(.02, 0), surface(0x75543f), (grain, i, t, reading) => {
    const angle = i * 2.39996 + t * .11;
    const radius = .35 * Math.sqrt((i + 1) / 30);
    grain.position.set(1.44 + radius * Math.cos(angle), .40 + ((i * .153 + t * .034) % 1) * .61, radius * Math.sin(angle));
    grain.scale.setScalar(i < Math.round(1 + reading * 29) ? .85 : 0);
  });
  const inletFlow = particles(model, 12, new THREE.SphereGeometry(.037, 8, 6), blue, (bubble, i, t) => {
    intakePipe.getPointAt((i / 12 + t * .42) % 1, bubble.position);
  });
  const outletFlow = particles(model, 12, new THREE.SphereGeometry(.033, 8, 6), brightBlue, (bubble, i, t) => {
    outletPipe.getPointAt((i / 12 + t * .36) % 1, bubble.position);
  });

  return (t, setting, reading) => {
    const depth = setting * 1.13;
    sand.visible = depth > .0001;
    sand.position.y = gravelTop + depth / 2;
    sand.scale.y = Math.max(depth, .001);
    const waterTop = 2.12;
    const waterHeight = waterTop - gravelTop - depth;
    inletWater.position.y = waterTop - waterHeight / 2;
    inletWater.scale.y = waterHeight;
    outlet.water.material.color.copy(cleanColor).lerp(dirtyColor, reading);
    grains(depth);
    trapped(depth, reading);
    inletCloud(t);
    outletCloud(t, reading);
    inletFlow(t);
    outletFlow(t);
  };
}

function distillation(model, materials) {
  const { frame, chrome, blue, brightBlue } = materials;
  const warm = surface(0xd89464, { emissive: 0xb44918, emissiveIntensity: .85, metalness: .45 });
  const brine = surface(0x6d9a9d, { roughness: .27 });
  const glassWall = glass(0xa5d6df, .19);
  const flask = new THREE.LatheGeometry([
    [0, 0], [.42, 0], [.5, .11], [.5, .25], [.44, .5], [.29, .79], [.16, 1.05], [.16, 1.34]
  ].map(point => new THREE.Vector2(...point)), 42);
  add(model, flask, glassWall, -1.22, .48);
  ring(model, chrome, .16, .023, -1.22, 1.81, 0);
  cylinder(model, frame, .56, .17, -1.22, .32, 0);
  cylinder(model, warm, .49, .055, -1.22, .43, 0);
  const brineVolume = cylinder(model, brine, .425, 1, -1.22, .6, 0);
  brineVolume.name = 'Brine remaining in boiling flask';
  ring(model, warm, .47, .013, -1.22, .415, 0);
  const distillate = tank(model, materials, 1.39, .30, .42, .98, 0x46afcd);
  distillate.water.name = 'Condensed fresh water';
  for (let i = 0; i < 5; i += 1) {
    add(model, new THREE.BoxGeometry(i === 4 ? .13 : .09, .013, .02), chrome, 1.58, .48 + i * .15, .37);
  }

  const coldEnd = [.99, 1.50, 0];
  const hotEnd = [-.65, 2.02, 0];
  const waterJacket = glass(0x4daecb, .35);
  const passage = tube(model, glassWall, .069, [[-1.22, 1.80, 0], [-1.22, 2.13, 0], [-1.01, 2.15, 0], hotEnd, coldEnd, [1.30, 1.40, 0], [1.38, 1.24, 0], [1.38, 1.04, 0]]);
  sleeve(model, waterJacket, .16, hotEnd, coldEnd, true);
  const line = new THREE.Vector3(...coldEnd).sub(new THREE.Vector3(...hotEnd)).normalize();
  for (const point of [hotEnd, coldEnd]) {
    const collar = cylinder(model, chrome, .17, .056, ...point);
    collar.quaternion.setFromUnitVectors(UP, line);
  }
  const coolingPorts = [
    [[.83, 1.49, 0], [.83, 1.33, -.32], [.84, .33, -.66]],
    [[-.48, 2.00, 0], [-.48, 2.18, -.31], [-.40, 2.03, -.68], [-.40, .33, -.70]]
  ];
  const blueHose = surface(0x397fa7, { metalness: .28 });
  for (const points of coolingPorts) tube(model, blueHose, .049, points);
  sleeve(model, chrome, .039, [.43, .24, -.47], [.43, 1.79, -.47]);
  sleeve(model, chrome, .046, [.43, 1.66, -.47], [.43, 1.66, 0]);

  const vapor = particles(model, 15, new THREE.SphereGeometry(.027, 8, 6), blue, (dot, i, t) => {
    passage.getPointAt(((i / 15 + t * .36) % 1) * .65, dot.position);
    dot.scale.setScalar(1 + .18 * (i % 3));
  });
  const drip = particles(model, 8, new THREE.SphereGeometry(.028, 8, 6), brightBlue, (dot, i, t) => {
    const fraction = (i / 8 + t * .31) % 1;
    passage.getPointAt(.57 + fraction * .43, dot.position);
    dot.scale.setScalar(.86 + fraction * .34);
  });
  const boiling = particles(model, 16, new THREE.SphereGeometry(.023, 7, 5), brightBlue, (dot, i, t, depth) => {
    const phase = (i * .186 + t * .74) % 1;
    const radius = .32 * Math.sqrt((i + 1) / 16);
    dot.position.set(-1.22 + Math.cos(i * 2.399) * radius, .51 + phase * depth, Math.sin(i * 2.399) * radius);
    dot.scale.setScalar(.6 + phase * .5);
  });
  return (t, _setting, reading) => {
    const brineDepth = .43 - reading * .20;
    brineVolume.scale.y = brineDepth;
    brineVolume.position.y = .49 + brineDepth / 2;
    distillate.fill(reading * .68);
    vapor(t);
    drip(t);
    boiling(t, brineDepth);
    warm.emissiveIntensity = .75 + .14 * Math.sin(t * 2.1);
  };
}

export function createFiltrationScene(mission) {
  const model = new THREE.Group();
  const materials = {
    frame: surface(0x233747, { roughness: .56, metalness: .42 }),
    chrome: surface(0x809bab, { roughness: .29, metalness: .62 }),
    blue: surface(0xb4dfed, { emissive: 0x5aacc7, emissiveIntensity: .20 }),
    brightBlue: surface(0x6be0fc, { emissive: 0x29a9e2, emissiveIntensity: .25 })
  };
  platform(model, materials.frame, materials.chrome);
  const update = mission.id === 'C12.4' ? distillation(model, materials) : sandFilter(model, materials);
  update(0, .5, .5);
  return { model, update };
}
