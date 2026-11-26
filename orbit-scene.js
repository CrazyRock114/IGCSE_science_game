import * as THREE from 'three';

const TAU = Math.PI * 2;
const PLANETS = [
  { name: 'Mercury', orbit: .48, radius: .066, period: .241, colors: [0x6e655e, 0xcdb69e] },
  { name: 'Venus', orbit: .66, radius: .092, period: .615, colors: [0xad7449, 0xf4d39f] },
  { name: 'Earth', orbit: .85, radius: .102, period: 1, colors: [0x1b77c0, 0x67ad68] },
  { name: 'Mars', orbit: 1.04, radius: .075, period: 1.88, colors: [0xa33a2b, 0xf39759] },
  { name: 'Jupiter', orbit: 1.30, radius: .166, period: 11.86, colors: [0x98664c, 0xfbd7a5] },
  { name: 'Saturn', orbit: 1.55, radius: .123, period: 29.45, colors: [0xaa8254, 0xf0d79b] },
  { name: 'Uranus', orbit: 1.76, radius: .092, period: 84, colors: [0x549eaa, 0xb3e9e7] },
  { name: 'Neptune', orbit: 1.98, radius: .09, period: 165, colors: [0x315cbb, 0x77aefa] },
];

function place(parent, object, x = 0, y = 0, z = 0) {
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function spheroid(parent, radius, low, high, light, banded = false, emissive = false) {
  const geometry = new THREE.SphereGeometry(radius, 44, 30);
  const normal = geometry.getAttribute('normal');
  const base = new THREE.Color(low);
  const peak = new THREE.Color(high);
  const ice = new THREE.Color(0xdfeffa);
  const shade = new THREE.Color();
  const colors = [];
  for (let i = 0; i < normal.count; i += 1) {
    const x = normal.getX(i), y = normal.getY(i), z = normal.getZ(i);
    const terrain = Math.sin(x * 8.3 + z * 6.5) * Math.cos(y * 9.1 + x * 3.7)
      + .51 * Math.cos(x * 15.1 - z * 14.2 + y * 4.8);
    const bands = Math.sin(y * 34 + .29 * Math.cos(z * 6.9 + x * 4.3));
    const blend = THREE.MathUtils.clamp(.46 + .29 * (banded ? bands : terrain), 0, 1);
    shade.copy(base).lerp(peak, blend);
    if (low === PLANETS[2].colors[0]) {
      shade.copy(base).lerp(peak, THREE.MathUtils.smoothstep(terrain, .02, .4));
      shade.lerp(ice, THREE.MathUtils.smoothstep(Math.abs(y), .87, .99));
    }
    colors.push(shade.r, shade.g, shade.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: { light: { value: light }, unlit: { value: emissive ? 1 : 0 } },
    vertexShader: `
      varying vec3 localColor;
      varying vec3 worldNormal;
      void main() {
        localColor = color;
        worldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec3 localColor;
      varying vec3 worldNormal;
      uniform vec3 light;
      uniform float unlit;
      void main() {
        float lit = 0.17 + 0.88 * max(dot(normalize(worldNormal), normalize(light)), 0.);
        gl_FragColor = vec4(localColor * mix(lit, 1.40, unlit), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return place(parent, new THREE.Mesh(geometry, material));
}

function glaze(parent, inner, outer, color, opacity) {
  const material = new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ring = place(parent, new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), material));
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function halo(object, radius, color) {
  const material = new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 viewNormal;
      varying vec3 viewDir;
      void main() {
        vec4 point = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalize(normalMatrix * normal);
        viewDir = normalize(-point.xyz);
        gl_Position = projectionMatrix * point;
      }
    `,
    fragmentShader: `
      uniform vec3 glow;
      varying vec3 viewNormal;
      varying vec3 viewDir;
      void main() {
        float glowStrength = pow(1. - abs(dot(normalize(viewNormal), normalize(viewDir))), 2.4);
        gl_FragColor = vec4(glow, 0.80 * glowStrength);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return place(object, new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), material));
}

function dot(parent, radius, color, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, depthWrite: opacity === 1 });
  return place(parent, new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), material));
}

function line(parent, points, color, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return place(parent, new THREE.Line(geometry, material));
}

function label(parent, value, tint = '#f3eaff', width = 1.15) {
  if (!globalThis.document) return place(parent, new THREE.Group());
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (!ctx) return place(parent, new THREE.Group());
  ctx.font = '600 24px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const span = Math.min(canvas.width - 4, ctx.measureText(value).width + 32);
  ctx.fillStyle = '#151d35';
  ctx.strokeStyle = '#576076';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect((canvas.width - span) / 2, 15, span, 42, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tint;
  ctx.fillText(value, canvas.width / 2, canvas.height / 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = place(parent, new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })));
  sprite.scale.set(width, width * canvas.height / canvas.width, 1);
  return sprite;
}

function solarBody(parent, radius, low = 0xff7b1f, high = 0xffe5a2) {
  const star = spheroid(parent, radius, low, high, new THREE.Vector3(0, 1, 0), false, true);
  halo(star, radius * 1.17, high);
  return star;
}

function pointField(parent, positions, colors, size) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size, vertexColors: true, transparent: true, opacity: .79,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  return place(parent, new THREE.Points(geometry, material));
}

function randomSequence() {
  let state = 7621;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function lunarView(stage) {
  if (!globalThis.document) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const panel = place(stage, new THREE.Group(), -1.22, .71, .26);
  const disk = place(panel, new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })));
  disk.scale.set(.42, .42, 1);
  const caption = label(panel, 'Moon from Earth', '#cfe2ff', 1.72);
  caption.position.y = -.33;
  const pixels = ctx.createImageData(72, 72);
  const half = 36;
  let previous;
  const earthward = new THREE.Vector3(), sunward = new THREE.Vector3();
  return (visible, moon, light) => {
    panel.visible = visible;
    if (!visible) return;
    earthward.copy(moon).negate().normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(earthward.dot(sunward.copy(light).normalize()), -1, 1));
    earthward.cross(sunward);
    const phase = Math.round(angle * 18) * (earthward.y < 0 ? -1 : 1);
    if (phase === previous) return;
    previous = phase;
    const horizontal = Math.sin(phase / 18), facing = Math.cos(phase / 18);
    for (let row = 0; row < 72; row += 1) {
      for (let column = 0; column < 72; column += 1) {
        const x = (column - half + .5) / half, y = (row - half + .5) / half;
        const radius2 = x * x + y * y;
        if (radius2 > 1) continue;
        const brightness = .24 + .76 * Math.max(0, x * horizontal + Math.sqrt(1 - radius2) * facing);
        const texture = .86 + .14 * Math.sin(x * 30 + y * 11) * Math.cos(y * 24 - x * 7);
        const offset = 4 * (row * 72 + column);
        pixels.data[offset] = 221 * brightness * texture;
        pixels.data[offset + 1] = 216 * brightness * texture;
        pixels.data[offset + 2] = 210 * brightness * texture;
        pixels.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    map.needsUpdate = true;
  };
}

function solarSystem(group) {
  const stage = place(group, new THREE.Group(), 0, 1.25);
  const sun = solarBody(stage, .31);
  const selection = glaze(stage, .12, .13, 0xf7dfff, .88);
  const selectedBadge = PLANETS.map(planet => label(stage, planet.name));
  const phaseView = lunarView(stage);
  const glowLine = line(stage, [new THREE.Vector3(), new THREE.Vector3()], 0xc6b0fe, .64);
  const planets = PLANETS.map(({ radius, orbit, colors, name }, index) => {
    const path = glaze(stage, orbit - .005, orbit + .005, 0xb1a4ee, .26);
    const direction = new THREE.Vector3(1, 0, 0);
    const anchor = place(stage, new THREE.Group());
    const body = spheroid(anchor, radius, ...colors, direction, index === 1 || index === 4 || index === 5);
    if (name === 'Earth') {
      const axle = line(anchor, [
        new THREE.Vector3(-.043, -.14, 0), new THREE.Vector3(.043, .14, 0),
      ], 0x92c7ff, .85);
      axle.visible = false;
      body.rotation.z = -.30;
      const lunarPath = glaze(anchor, .164, .168, 0x9ec5e7, .5);
      lunarPath.visible = false;
      const moonDirection = direction.clone();
      const moon = spheroid(anchor, .029, 0x71798a, 0xc8c1b8, moonDirection);
      moon.visible = false;
      return { path, body, direction, anchor, axle, lunarPath, moon, moonDirection };
    }
    if (name === 'Saturn') {
      const inner = glaze(body, .163, .199, 0xe4ae77, .64);
      const outer = glaze(body, .206, .224, 0xd5c2a8, .51);
      inner.rotation.x = outer.rotation.x = -1.15;
    }
    return { path, body, direction, anchor };
  });
  const beltdots = [], beltcolors = [];
  const random = randomSequence();
  for (let i = 0; i < 160; i += 1) {
    const angle = random() * TAU, d = 1.09 + random() * .12;
    beltdots.push(Math.cos(angle) * d, (random() - .5) * .05, Math.sin(angle) * d);
    beltcolors.push(.38, .24 + random() * .19, .28);
  }
  pointField(stage, beltdots, beltcolors, .024);
  const scaleLabel = label(stage, 'Orbit spacing & periods compressed', '#b8caff', 2.1);
  scaleLabel.position.set(0, -.56, .7);

  return (t, setting) => {
    const index = Math.round(setting * (PLANETS.length - 1));
    sun.rotation.y = t * .16;
    planets.forEach((planet, i) => {
      const { orbit, period, radius } = PLANETS[i];
      const angle = i * 2.39 + t * .45 / Math.pow(period, .55);
      planet.anchor.position.set(Math.cos(angle) * orbit, 0, Math.sin(angle) * orbit);
      planet.direction.copy(planet.anchor.position).negate();
      planet.body.rotation.y = t * (i === 2 ? 1.25 : .33);
      planet.path.material.opacity = i === index ? .82 : .20;
      selectedBadge[i].visible = i === index;
      selectedBadge[i].position.copy(planet.anchor.position);
      selectedBadge[i].position.y = radius + .29;
      if (planet.moon) {
        const visible = index === i;
        planet.axle.visible = planet.lunarPath.visible = planet.moon.visible = visible;
        planet.moon.position.set(Math.cos(t * .63) * .166, .013, Math.sin(t * .63) * .166);
        planet.moonDirection.copy(planet.direction).sub(planet.moon.position);
        phaseView?.(visible, planet.moon.position, planet.moonDirection);
      }
    });
    const chosen = planets[index];
    selection.position.copy(chosen.anchor.position);
    selection.position.y = -.028;
    selection.scale.setScalar((PLANETS[index].radius + .04) / .12);
    const endpoint = glowLine.geometry.getAttribute('position');
    endpoint.setXYZ(1, ...chosen.anchor.position.toArray());
    endpoint.needsUpdate = true;
    glowLine.frustumCulled = false;
  };
}

function signalLab(group) {
  const stage = place(group, new THREE.Group(), -1.52, 1.26);
  const sun = solarBody(stage, .43);
  const emitter = label(stage, 'Sun', '#ffe1b1');
  emitter.position.set(-.08, .62, 0);
  const endpoint = place(stage, new THREE.Group());
  const body = place(endpoint, new THREE.Mesh(new THREE.BoxGeometry(.20, .19, .23), new THREE.MeshStandardMaterial({
    color: 0xb9a5e8, metalness: .7, roughness: .28, emissive: 0x503998, emissiveIntensity: .4,
  })));
  const dish = place(endpoint, new THREE.Mesh(new THREE.SphereGeometry(.148, 22, 16, 0, TAU, 0, Math.PI * .27),
    new THREE.MeshStandardMaterial({ color: 0xe3eafc, side: THREE.DoubleSide, metalness: .38, roughness: .37 })), -.12, 0);
  dish.rotation.z = Math.PI / 2;
  const receiver = label(endpoint, 'Probe', '#dfd2ff');
  receiver.position.y = .40;
  const rail = line(stage, [new THREE.Vector3(.48, 0, 0), new THREE.Vector3(3.4, 0, 0)], 0x93acea, .32);
  const trail = line(stage, [new THREE.Vector3(.48, 0, 0), new THREE.Vector3(3.4, 0, 0)], 0xabcafa, .54);
  trail.frustumCulled = false;
  const packet = dot(stage, .055, 0xd8eeff);
  halo(packet, .105, 0x759cff);
  const tickMaterial = new THREE.LineBasicMaterial({ color: 0xa9a2dc, transparent: true, opacity: .47 });
  const ticks = [];
  for (let i = 0; i <= 4; i += 1) {
    const x = .50 + (i / 4) * 2.90;
    ticks.push(new THREE.Vector3(x, -.12, -.15), new THREE.Vector3(x, -.12, .15));
    const reference = label(stage, `${i} AU`, '#bacaf0', .86);
    reference.position.set(x, -.38, .15);
  }
  place(stage, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), tickMaterial));

  return (t, setting, reading) => {
    const distance = setting * 2.9;
    sun.rotation.y = t * .22;
    endpoint.position.x = .50 + distance;
    const elapsed = t % 5.8;
    const traveled = elapsed * .66;
    const delivered = traveled >= distance && traveled - distance < .32;
    packet.visible = distance > .025 && traveled <= distance;
    packet.position.set(.50 + Math.min(traveled, distance), 0, 0);
    const position = trail.geometry.getAttribute('position');
    position.setXYZ(1, endpoint.position.x, 0, 0);
    position.needsUpdate = true;
    rail.material.opacity = .24 + reading * .18;
    body.material.emissiveIntensity = delivered ? 2 : .4;
  };
}

function starLab(group) {
  const stage = place(group, new THREE.Group(), 0, 1.30);
  const protostar = solarBody(stage, .29, 0xcf6933, 0xffbc87);
  const collapse = label(stage, 'Gas cloud → protostar', '#ffd0ba', 2.2);
  collapse.position.y = .98;
  const star = solarBody(stage, .62);
  const stable = label(stage, 'Main sequence', '#ffe1b1', 1.9);
  stable.position.y = .98;
  const giant = solarBody(stage, .73, 0xcc301b, 0xffa570);
  const giants = [
    label(stage, 'Red giant', '#ffd0ba', 1.9),
    label(stage, 'Red supergiant', '#ffd0ba', 1.9),
  ];
  giants.forEach(item => { item.position.y = .98; });
  const dwarf = solarBody(stage, .168, 0x9bcbff, 0xffffff);
  const neutron = solarBody(stage, .110, 0xb095f2, 0xe0f6ff);
  const blackHole = dot(stage, .14, 0x010207);
  const disk = glaze(blackHole, .148, .26, 0xffa366, .89);
  disk.rotation.x = -1.05;
  const flash = halo(stage, .66, 0xffe1ac);
  const burst = label(stage, 'Supernova', '#ffe2ad', 1.9);
  burst.position.y = .98;
  const names = [
    label(stage, 'White dwarf & nebula', '#bfe6ff', 2.2),
    label(stage, 'Neutron star & remnant', '#d2c3ff', 2.2),
    label(stage, 'Black hole & remnant', '#ffcea4', 2.2),
  ];
  names.forEach(item => { item.position.y = .98; });
  const shell = [];
  const random = randomSequence();
  const dust = [], colors = [];
  for (let i = 0; i < 460; i += 1) {
    const heading = random() * TAU, height = random() * 2 - 1;
    const spread = Math.sqrt(1 - height * height), radius = .62 + random() * .55;
    dust.push(radius * spread * Math.cos(heading), radius * height * .65, radius * spread * Math.sin(heading));
    colors.push(.44 + random() * .55, .26 + random() * .37, .66 + random() * .33);
  }
  const nebula = pointField(stage, dust, colors, .051);
  for (let i = 0; i < 4; i += 1) {
    const wave = glaze(stage, .75 + i * .11, .77 + i * .11, i % 2 ? 0x8c8fea : 0xe7ae9a, .32);
    wave.rotation.x = i * .61;
    wave.rotation.z = i * .40;
    shell.push(wave);
  }
  return (t, setting, reading) => {
    const cycle = (t + 1.6) % 13;
    const exhaustion = 3.4 + 3.1 * Math.pow(reading, .45);
    const massive = setting >= .25;
    const veryMassive = setting >= .75;
    protostar.visible = collapse.visible = cycle < 1.5;
    protostar.scale.setScalar(.62 + Math.min(1.5, cycle) * .46 + setting * .31);
    star.visible = stable.visible = !protostar.visible && cycle < exhaustion;
    star.scale.setScalar(.75 + setting * .54);
    star.rotation.y = t * .23;
    giant.visible = cycle >= exhaustion && cycle < exhaustion + 2.7;
    giant.scale.setScalar(.86 + .33 * setting);
    giant.rotation.y = t * .13;
    giants[0].visible = giant.visible && !massive;
    giants[1].visible = giant.visible && massive;
    const collapseAt = exhaustion + 2.7;
    const supernova = massive && cycle >= collapseAt && cycle < collapseAt + .74;
    const end = cycle >= collapseAt && !supernova;
    flash.visible = burst.visible = supernova;
    flash.scale.setScalar(Math.max(.1, 1 + (cycle - collapseAt) * 2.4));
    dwarf.visible = names[0].visible = end && !massive;
    neutron.visible = names[1].visible = end && massive && !veryMassive;
    blackHole.visible = names[2].visible = end && veryMassive;
    disk.rotation.z = t * .17;
    nebula.visible = protostar.visible || supernova || end;
    const sinceEnd = Math.max(0, cycle - collapseAt);
    const flux = protostar.visible
      ? 1.6 - cycle * .7
      : (massive ? .8 : .44) + .10 * Math.min(4, sinceEnd);
    nebula.scale.setScalar(flux);
    nebula.rotation.y = t * .065;
    nebula.material.opacity = Math.max(.32, .90 - sinceEnd * .093);
    shell.forEach((wave, i) => {
      wave.visible = end;
      wave.scale.setScalar(flux + i * .11);
      wave.material.opacity = Math.max(.025, .39 - sinceEnd * .069 - i * .05);
    });
  };
}

function galaxyLab(group) {
  const stage = place(group, new THREE.Group(), 0, 1.17);
  const random = randomSequence();
  const positions = [], colors = [];
  const warm = new THREE.Color(0xffd4a0), cool = new THREE.Color(0x8ca9ff), color = new THREE.Color();
  for (let i = 0; i < 3400; i += 1) {
    const radius = 2.01 * Math.pow(random(), 1.42);
    const arm = i % 4;
    const angle = arm * TAU / 4 + 1.69 * radius + (random() + random() - 1) * (.28 + .65 * radius);
    const dust = .035 + (1 - radius / 2.01) * .11;
    positions.push(
      Math.cos(angle) * radius,
      (random() + random() - 1) * dust * (radius < .5 ? 3 : 1),
      Math.sin(angle) * radius * .78,
    );
    color.copy(cool).lerp(warm, 1 - radius / 2.01).multiplyScalar(.30 + .70 * random());
    colors.push(color.r, color.g, color.b);
  }
  pointField(stage, positions, colors, .028);
  glaze(stage, 1.99, 2.00, 0x9fa0e4, .26).scale.y = .78;
  const observer = dot(stage, .054, 0xffdcad);
  observer.position.set(1.04, .055, 0);
  halo(observer, .102, 0xffbd85);
  const origin = label(observer, 'Solar System', '#ffe8c6', 1.45);
  origin.position.set(0, .38, 0);
  const source = dot(stage, .049, 0xc7e1ff);
  halo(source, .115, 0x9698fa);
  const sightline = line(stage, [observer.position, new THREE.Vector3(-.5, .32, 0)], 0xc9b9ef, .86);
  sightline.frustumCulled = false;
  const lookback = label(source, 'Distant star', '#d5e2ff', 1.25);
  lookback.position.set(0, .34, 0);
  const packet = dot(stage, .031, 0xdfecff);

  return (t, setting) => {
    const distance = setting * 1.58;
    source.position.set(observer.position.x - distance, .055, 0);
    lookback.visible = setting > .16;
    source.visible = setting > .025;
    const approach = (t * .53) % (distance + .3);
    packet.visible = distance > .04 && approach < distance;
    packet.position.set(source.position.x + approach, .071, 0);
    const position = sightline.geometry.getAttribute('position');
    position.setXYZ(1, source.position.x, source.position.y, source.position.z);
    position.needsUpdate = true;
  };
}

export function createOrbitScene(mission) {
  const model = new THREE.Group();
  const create = {
    'P6.1': solarSystem,
    'P6.2.1': signalLab,
    'P6.2.2': starLab,
    'P6.2.3': galaxyLab,
  }[mission.id] ?? solarSystem;
  const update = create(model);
  update(0, .5, .5);
  return { model, update };
}
