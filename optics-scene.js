import * as THREE from 'three';

const { lerp, degToRad } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);
const MINT = 0x86ffd2;
const LILAC = 0xcfb5ff;
const BLUE = 0x88c9fa;

function attach(group, object, x = 0, y = 0, z = 0) {
  object.position.set(x, y, z);
  group.add(object);
  return object;
}

function mesh(group, geometry, material, x, y, z) {
  return attach(group, new THREE.Mesh(geometry, material), x, y, z);
}

function panel(group, color, size, position, opacity = 1) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({
    color, roughness: .33, metalness: opacity === 1 ? .33 : .1,
    transparent: opacity < 1, depthWrite: opacity === 1, opacity,
  });
  const body = mesh(group, geometry, material, ...position);
  if (opacity < 1) {
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color, opacity: .54, transparent: true }));
    body.add(outline);
  }
  return body;
}

function table(group) {
  panel(group, 0x222b47, [4.02, .18, 2.24], [0, .09, 0]);
  for (const x of [-1.77, 1.77]) {
    panel(group, 0x687f9c, [.14, .024, 2.12], [x, .194, 0]);
  }
  for (const z of [-.98, .98]) {
    panel(group, 0x444b72, [3.68, .032, .033], [0, .195, z]);
  }
}

function badge(group, text, color, x, y, z, width = 1.26) {
  if (!globalThis.document) return;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.font = '650 29px system-ui';
  const size = Math.min(canvas.width - 8, ctx.measureText(text).width + 36);
  ctx.fillStyle = '#151c36';
  ctx.strokeStyle = '#625b8f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect((canvas.width - size) / 2, 18, size, 60, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map, transparent: true, depthWrite: false, toneMapped: false,
  }));
  sprite.scale.set(width, width / 4, 1);
  attach(group, sprite, x, y, z);
  return sprite;
}

function trace(group, points, color, opacity, dashed = false) {
  const path = new THREE.BufferGeometry().setFromPoints(points);
  const options = { color, opacity, transparent: true };
  const material = dashed
    ? new THREE.LineDashedMaterial({ ...options, dashSize: .085, gapSize: .043 })
    : new THREE.LineBasicMaterial(options);
  const line = new THREE.Line(path, material);
  if (dashed) line.computeLineDistances();
  return attach(group, line);
}

function ray(group, color, width = .016) {
  const geometry = new THREE.CylinderGeometry(width, width, 1, 10);
  const core = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const aura = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .25, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const beam = attach(group, new THREE.Group());
  mesh(beam, geometry, core);
  mesh(beam, geometry, aura).scale.set(2.65, 1, 2.65);
  const photon = mesh(group, new THREE.SphereGeometry(width * 1.9, 14, 10), core);
  const delta = new THREE.Vector3(), direction = new THREE.Vector3();
  return {
    set(start, finish, phase) {
      delta.subVectors(finish, start);
      const length = delta.length();
      beam.visible = photon.visible = length > .0001;
      beam.position.copy(start).addScaledVector(delta, .5);
      beam.scale.y = length;
      if (beam.visible) beam.quaternion.setFromUnitVectors(UP, direction.copy(delta).normalize());
      photon.position.copy(start).addScaledVector(delta, phase);
    },
    tint(colour) {
      core.color.set(colour);
      aura.color.set(colour);
    },
  };
}

function angleMark(group, color) {
  const segments = 28;
  const path = trace(group, Array.from({ length: segments }, () => new THREE.Vector3()), color, .9);
  path.frustumCulled = false;
  return project => {
    const position = path.geometry.getAttribute('position');
    for (let i = 0; i < segments; i += 1) position.setXYZ(i, ...project(i / (segments - 1)));
    position.needsUpdate = true;
  };
}

function reflect(group, mission) {
  const mirror = panel(group, 0x849ccf, [3.45, 1.4, .066], [0, 1.22, -.69], .70);
  mirror.material.roughness = .18;
  mirror.material.metalness = .81;
  panel(group, 0x53648f, [3.60, .08, .14], [0, 1.95, -.69]);
  panel(group, 0x53648f, [3.60, .08, .14], [0, .49, -.69]);
  for (const x of [-1.73, 1.73]) {
    panel(group, 0x303d5c, [.12, 1.65, .19], [x, 1.07, -.69]);
  }
  const origin = new THREE.Vector3(0, 1.27, -.645);
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const normal = new THREE.Vector3(0, origin.y, 1.03);
  trace(group, [origin, normal], 0xd9e6ff, .68, true);
  badge(group, 'Plane mirror', '#e1d7ff', 0, 2.15, -.73, 1.78);
  badge(group, 'Normal', '#dfebff', 0, 1.42, 1.01);
  badge(group, 'Incident', '#a2ffd9', -1.40, .68, .58, 1.41);
  badge(group, 'Reflected', '#e6c4ff', 1.40, .68, .58, 1.41);
  const incident = ray(group, MINT), reflected = ray(group, LILAC);
  const arcIn = angleMark(group, MINT), arcOut = angleMark(group, LILAC);
  const [minimum, maximum] = mission.range;
  return (t, setting) => {
    const angle = degToRad(lerp(minimum, maximum, setting));
    const reach = 1.68;
    const dx = reach * Math.sin(angle), dz = reach * Math.cos(angle);
    incoming.set(-dx, origin.y, origin.z + dz);
    outgoing.set(dx, origin.y, origin.z + dz);
    incident.set(incoming, origin, (t * .6) % 1);
    reflected.set(origin, outgoing, (t * .6 + .5) % 1);
    const arc = sign => fraction => [sign * Math.sin(angle * fraction) * .53, origin.y, origin.z + Math.cos(angle * fraction) * .53];
    arcIn(arc(-1));
    arcOut(arc(1));
  };
}

function refract(group, mission) {
  panel(group, 0x517dce, [3.51, .94, 1.36], [0, .76, 0], .22);
  panel(group, 0x558dbc, [3.5, .019, 1.35], [0, 1.23, 0], .50);
  panel(group, 0x99d8f2, [3.56, .027, .039], [0, 1.234, .70], .77);
  const origin = new THREE.Vector3(0, 1.25, .20);
  trace(group, [new THREE.Vector3(0, .37, .20), new THREE.Vector3(0, 2.52, .20)], 0xdcecff, .72, true);
  badge(group, 'Air', '#edf4ff', 1.44, 1.73, .26);
  badge(group, 'Water', '#c0e7ff', 1.44, .75, .76);
  badge(group, 'Normal', '#e1edff', 0, 2.66, .22);
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const incident = ray(group, MINT), refracted = ray(group, BLUE);
  const arcIn = angleMark(group, MINT), arcOut = angleMark(group, BLUE);
  const [minimum, maximum] = mission.range;
  return (t, setting) => {
    const input = lerp(minimum, maximum, setting);
    const theta = degToRad(input);
    const bent = degToRad(mission.calculate(input));
    incoming.set(-1.25 * Math.sin(theta), origin.y + 1.25 * Math.cos(theta), origin.z);
    outgoing.set(.91 * Math.sin(bent), origin.y - .91 * Math.cos(bent), origin.z);
    incident.set(incoming, origin, (t * .58) % 1);
    refracted.set(origin, outgoing, (t * .58 + .50) % 1);
    arcIn(f => [-.42 * Math.sin(theta * f), origin.y + .42 * Math.cos(theta * f), origin.z]);
    arcOut(f => [.40 * Math.sin(bent * f), origin.y - .40 * Math.cos(bent * f), origin.z]);
  };
}

function arrow(group, colour) {
  const mark = attach(group, new THREE.Group());
  const material = new THREE.MeshBasicMaterial({ color: colour, toneMapped: false });
  mesh(mark, new THREE.CylinderGeometry(.021, .021, .78, 12), material, 0, .39, 0);
  mesh(mark, new THREE.ConeGeometry(.077, .22, 18), material, 0, .89, 0);
  return mark;
}

function lens(group, mission) {
  const height = 1.26;
  const focalLength = 10;
  const scale = .052;
  const focus = focalLength * scale;
  const lensBody = mesh(group, new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x80caff, metalness: .12, roughness: .12,
      transparent: true, opacity: .32, depthWrite: false,
    }), 0, height, 0);
  lensBody.scale.set(.125, .78, .78);
  const rim = mesh(group, new THREE.TorusGeometry(.78, .016, 12, 80),
    new THREE.MeshStandardMaterial({ color: 0xa3c9ef, metalness: .57, roughness: .27 }), 0, height, 0);
  rim.rotation.y = Math.PI / 2;
  panel(group, 0x53648e, [.29, .3, .42], [0, .34, 0]);
  trace(group, [new THREE.Vector3(-1.96, height, 0), new THREE.Vector3(1.85, height, 0)], 0xbac9f7, .57, true);
  for (const side of [-1, 1]) {
    mesh(group, new THREE.SphereGeometry(.038, 17, 11), new THREE.MeshBasicMaterial({ color: 0xe4e0ff }), side * focus, height, 0);
    badge(group, 'F', '#e3ebff', side * focus, height - .23, .08, .73);
  }
  badge(group, 'Converging lens', '#bee7ff', 0, 2.29, -.09, 2.0);
  const slide = attach(group, new THREE.Group());
  const screen = attach(group, new THREE.Group());
  panel(slide, 0x73e9d5, [.035, 1.13, .60], [0, height + .07, 0], .17);
  panel(screen, 0xa995fb, [.03, 1.77, .66], [0, height, 0], .26);
  badge(slide, 'Slide', '#b2ffdf', -.03, .37, .32, 1.15);
  badge(screen, 'Real image', '#dfceff', .01, .37, .32, 1.32);
  const objectArrow = arrow(slide, MINT), imageArrow = arrow(screen, LILAC);
  imageArrow.rotation.z = Math.PI;
  const firstRay = [ray(group, MINT, .011), ray(group, MINT, .011)];
  const secondRay = [ray(group, LILAC, .011), ray(group, LILAC, .011)];
  const center = new THREE.Vector3(0, height, 0);
  const objectSize = .39;
  const edge = new THREE.Vector3(0, height + objectSize, 0);
  const objectPoint = new THREE.Vector3(), imagePoint = new THREE.Vector3();
  const [minimum, maximum] = mission.range;
  return (t, setting) => {
    const objectDistance = lerp(minimum, maximum, setting);
    const imageDistance = mission.calculate(objectDistance);
    const imageSize = objectSize * imageDistance / objectDistance;
    slide.position.x = -objectDistance * scale;
    screen.position.x = imageDistance * scale;
    objectArrow.position.y = imageArrow.position.y = height;
    objectArrow.scale.y = objectSize;
    imageArrow.scale.y = imageSize;
    objectPoint.set(slide.position.x, height + objectSize, 0);
    imagePoint.set(screen.position.x, height - imageSize, 0);
    const phase = (t * .73) % 1, after = (phase + .5) % 1;
    firstRay[0].set(objectPoint, edge, phase);
    firstRay[1].set(edge, imagePoint, after);
    secondRay[0].set(objectPoint, center, phase);
    secondRay[1].set(center, imagePoint, after);
  };
}

const wavelengths = [
  [0x904dff, 'Violet'], [0x536eff, 'Indigo'], [0x39b3ff, 'Blue'], [0x4dff8d, 'Green'],
  [0xfff06d, 'Yellow'], [0xff9c45, 'Orange'], [0xff506d, 'Red'],
];

function prism(group, mission) {
  const width = 1.42, base = -.53, tip = base + Math.sqrt(3) * width / 2;
  const shape = new THREE.Shape().moveTo(-width / 2, -base).lineTo(width / 2, -base).lineTo(0, -tip).closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.68, bevelEnabled: false });
  const block = mesh(group, geometry, new THREE.MeshPhysicalMaterial({
    color: 0xa8caff, roughness: .16, metalness: .06,
    transparent: true, opacity: .30, depthWrite: false, side: THREE.DoubleSide,
  }), 0, .25, 0);
  block.rotation.x = -Math.PI / 2;
  block.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xbabcf5, opacity: .73, transparent: true })));
  badge(group, '60° glass prism', '#ded8ff', 0, 2.18, -.11, 1.90);

  const spectrum = attach(group, new THREE.Group(), 0, .55, .96);
  const bars = wavelengths.map(([color], i) => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .42, toneMapped: false });
    return mesh(spectrum, new THREE.BoxGeometry(.20, .072, .10), material, (i - 3) * .235, 0, 0);
  });
  badge(group, 'Visible spectrum', '#f0d4fc', 0, .74, .97, 1.86);
  const bandLabels = wavelengths.map(([, name]) => badge(group, name, '#eee0fd', 0, .35, 1.00));
  const start = new THREE.Vector3(), finish = new THREE.Vector3();
  const beamHeight = 1.28, beamDepth = .13;
  const edgeX = width / 2 * (tip - beamDepth) / (tip - base);
  const entry = new THREE.Vector3(-edgeX, beamHeight, beamDepth);
  const exit = new THREE.Vector3(edgeX, beamHeight, beamDepth);
  const paths = Array.from({ length: 3 }, () => ray(group, LILAC, .015));
  const transmission = new THREE.Color();
  const nextColor = new THREE.Color();
  return (t, setting) => {
    const sampleIndex = setting * (mission.samples.length - 1);
    const index = Math.min(Math.floor(sampleIndex), mission.samples.length - 2);
    const deviation = lerp(mission.samples[index], mission.samples[index + 1], sampleIndex - index);
    const angle = degToRad(deviation / 2);
    const distance = 1.53;
    start.set(entry.x - distance * Math.cos(angle), beamHeight, beamDepth - distance * Math.sin(angle));
    finish.set(exit.x + distance * Math.cos(angle), beamHeight, beamDepth - distance * Math.sin(angle));
    const band = setting * (wavelengths.length - 1);
    const low = Math.min(Math.floor(band), wavelengths.length - 2);
    transmission.setHex(wavelengths[low][0]).lerp(nextColor.setHex(wavelengths[low + 1][0]), band - low);
    const selected = Math.round(band);
    bars.forEach((bar, i) => {
      bar.material.opacity = i === selected ? 1 : .46;
      bar.scale.y = i === selected ? 1.8 : 1;
      if (bandLabels[i]) bandLabels[i].visible = i === selected;
    });
    paths.forEach(path => path.tint(transmission));
    const phase = (t * .62) % 1;
    paths[0].set(start, entry, phase);
    paths[1].set(entry, exit, (phase + .33) % 1);
    paths[2].set(exit, finish, (phase + .67) % 1);
  };
}

export function createOpticsScene(mission) {
  const model = new THREE.Group();
  table(model);
  const create = {
    'P3.2.1': reflect,
    'P3.2.2': refract,
    'P3.2.3': lens,
    'P3.2.4': prism,
  }[mission.id];
  const update = create(model, mission);
  update(0, .5, .5);
  return { model, update };
}
