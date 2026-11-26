import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFiltrationScene } from './filtration-scene.js';
import { createGeneticsScene } from './genetics-scene.js';
import { createOpticsScene } from './optics-scene.js';
import { createOrbitScene } from './orbit-scene.js';
import { createPhScene } from './ph-scene.js';
import { createWatershedScene } from './watershed-scene.js';

const tau = Math.PI * 2;
const palette = {
  biology: [0x82e9bd, 0x183936],
  chemistry: [0x81c9fa, 0x1b324d],
  physics: [0xc1a9ff, 0x2d284f]
};

function material(color, roughness = .36, metalness = .1, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function glass(color = 0x85e4e7, opacity = .17) {
  return material(color, .15, .05, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function box(parent, surface, x, y, z, width, height, depth) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function sphere(parent, surface, x, y, z, radius, width = 1, height = 1, depth = 1) {
  const object = mesh(parent, new THREE.SphereGeometry(radius, 22, 16), surface, x, y, z);
  object.scale.set(width, height, depth);
  return object;
}

function cylinder(parent, surface, x, y, z, top, bottom, height) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 36), surface, x, y, z);
}

function tube(parent, points, radius, surface) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, 38, radius, 8, false), surface);
}

function edge(parent, geometry, color, opacity = .5) {
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, opacity, transparent: true }));
  parent.add(outline);
  return outline;
}

function liquidColumn(parent, x, height, tint, radius = .69) {
  const wall = mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 44, 1, true), glass(tint), x, height / 2 + .1);
  const metal = material(0x9cb6c2, .32, .56);
  for (const y of [.11, height + .11]) {
    const rim = mesh(parent, new THREE.TorusGeometry(radius, .021, 8, 46), metal, x, y);
    rim.rotation.x = Math.PI / 2;
  }
  const liquid = cylinder(parent, glass(tint, .46), x, height * .28 + .1, 0, radius - .028, radius - .028, height * .55);
  return { wall, liquid };
}

function plant(parent, x, y, z, h) {
  const green = [material(0x2f8f53), material(0x4fb864), material(0x81d37a)];
  const stem = material(0x91b86b);
  const local = new THREE.Group();
  local.position.set(x, y, z);
  parent.add(local);
  tube(local, [[0, 0, 0], [.1, h * .38, .05], [-.08, h * .7, -.05], [.12, h, 0]], .024, stem);
  for (let i = 0; i < 7; i += 1) {
    const fraction = (i + 1) / 8;
    const leaf = sphere(local, green[i % green.length], 0, h * fraction, 0, .29, 1, .12, .37);
    const heading = i * 2.39;
    leaf.position.x += Math.cos(heading) * .22;
    leaf.position.z += Math.sin(heading) * .22;
    leaf.rotation.y = -heading;
    leaf.rotation.z = .35 - fraction * .14;
    leaf.scale.multiplyScalar(1.1 - .4 * fraction);
  }
  return local;
}

function greenhouse(group, accent) {
  const base = material(0x24444c, .36, .58);
  const trim = material(0x83cbc2, .25, .57);
  const soil = material(0x545147, .95);
  const y = .19;
  const tankGeo = new THREE.BoxGeometry(2.75, 2.02, 1.76);
  mesh(group, tankGeo, glass(0x92e9d5, .12), 0, 1.2, .1);
  edge(group, tankGeo, 0x93eadb, .56).position.set(0, 1.2, .1);
  box(group, base, 0, .105, .1, 2.88, .21, 1.89);
  box(group, soil, 0, y + .08, .1, 2.64, .18, 1.66);
  box(group, glass(0x3bcbbf, .20), 0, 1.07, .1, 2.68, 1.57, 1.69);
  for (let i = 0; i < 40; i += 1) {
    const angle = i * 2.399;
    sphere(group, i % 2 ? soil : trim, Math.cos(angle) * (i % 12) / 10, .29, .1 + Math.sin(angle) * .71, .048 + .016 * (i % 4), 1.1, .52, 1);
  }
  const shoots = [
    plant(group, -.64, .29, .25, 1.34),
    plant(group, -.25, .29, -.37, 1.54),
    plant(group, .31, .29, .24, 1.25),
    plant(group, .66, .29, -.18, 1.52)
  ];
  const arm = material(0x3d5660, .28, .8);
  cylinder(group, base, 1.58, .08, -.48, .29, .33, .16);
  tube(group, [[1.58, .12, -.48], [1.58, 2.46, -.48], [1.43, 2.88, -.48], [.62, 2.97, -.48]], .055, arm);
  box(group, arm, .02, 2.93, -.26, 1.36, .14, .61);
  const glow = material(0xd6fae0, .28, .1, { emissive: accent, emissiveIntensity: 1 });
  box(group, glow, .02, 2.848, -.26, 1.21, .034, .48);
  const lamp = new THREE.PointLight(0xc2ffe8, 14, 5, 2);
  lamp.position.set(0, 2.68, -.24);
  group.add(lamp);
  const bubbles = Array.from({ length: 29 }, (_, i) => {
    const bubble = sphere(group, glass(0xbdfff5, .64), 0, 0, 0, .023 + (i % 4) * .009);
    return bubble;
  });
  return (t, input, output) => {
    lamp.intensity = input * 22;
    glow.emissiveIntensity = .15 + input * 2.2;
    shoots.forEach((shoot, i) => { shoot.rotation.z = Math.sin(t * 1.4 + i) * .017; });
    bubbles.forEach((bubble, i) => {
      bubble.visible = i < Math.round(output * bubbles.length);
      const phase = (i * .137 + t * (.16 + .19 * output)) % 1;
      bubble.position.set((i % 5 - 2) * .27 + .07 * Math.sin(t + i), .48 + phase * 1.32, Math.sin(i * 2.4) * .51);
    });
  };
}

function tank(group, accent) {
  const steel = material(0x7a9daa, .34, .54);
  const stand = material(0x283d51, .47, .55);
  box(group, stand, 0, .1, .04, 3.7, .2, 1.77);
  const first = liquidColumn(group, -1.04, 2.1, accent, .64);
  const second = liquidColumn(group, 1.04, 2.35, accent, .64);
  tube(group, [[-.56, .88, 0], [-.25, .88, 0], [-.19, 1.66, 0], [.18, 1.66, 0], [.29, .88, 0], [.50, .88, 0]], .075, steel);
  box(group, stand, 0, 1.69, .02, .46, .21, .36);
  cylinder(group, steel, 0, 1.88, .02, .22, .22, .08);
  const dots = Array.from({ length: 42 }, (_, i) => sphere(group, glass(0xaeeaff, .68), 0, .25, 0, .025 + (i % 3) * .015));
  return (t, input, output) => {
    second.liquid.scale.y = .78 + .43 * output;
    first.liquid.material.opacity = .43 + .1 * Math.sin(t * .6);
    dots.forEach((dot, i) => {
      const onRight = i % 2 === 0;
      dot.visible = !onRight || i < 6 + 36 * output;
      dot.position.set((onRight ? 1.04 : -1.04) + Math.sin(i + t * .55) * .43, .27 + ((t * .28 + i * .137) % 1) * (onRight ? 1.05 : .91), Math.cos(i * 1.7 + t * .45) * .42);
    });
  };
}

function particleChamber(group, accent, mission) {
  const chamber = new THREE.BoxGeometry(2.95, 2.18, 1.96);
  mesh(group, chamber, glass(accent, .075), 0, 1.21, 0);
  edge(group, chamber, accent, .42).position.y = 1.21;
  const source = material(accent, .35, .18, { emissive: accent, emissiveIntensity: .13 });
  const other = material(0x77b1fb, .32, .18, { emissive: 0x577aff, emissiveIntensity: .16 });
  const selected = Array.from({ length: 70 }, (_, i) => sphere(group, i % 4 === 0 ? other : source, 0, 0, 0, .055 + (i % 7) * .008));
  const lattice = /^C(?:1|2)\./.test(mission.id);
  return (t, input, output) => {
    selected.forEach((dot, i) => {
      const row = Math.floor(i / 7), angle = i * 2.39996;
      const speed = .27 + input * 1.2;
      const scale = .4 + (lattice ? input : .42 + output * .18);
      dot.position.set(
        lattice ? ((i % 7 - 3) * .37) * (1 - .5 * input) + Math.sin(t * speed + angle) * .55 * input : Math.sin(t * speed + angle) * 1.31 * scale,
        lattice ? (row % 4) * .44 + .43 + Math.sin(t * speed * .7 + i) * .32 * input : 1.21 + Math.sin(t * speed * .81 + i * .67) * .98 * scale,
        lattice ? (Math.floor(row / 4) - 1) * .52 + Math.sin(t * speed + i * 1.3) * .4 * input : Math.cos(t * speed * .78 + angle) * .9 * scale
      );
    });
  };
}

function cell(group, accent) {
  const membrane = sphere(group, glass(accent, .19), 0, 1.18, 0, 1.08, 1.45, .94, 1.04);
  const organelle = new THREE.Group();
  group.add(organelle);
  organelle.position.y = 1.18;
  const nuclear = material(0x6779d2, .33, .17);
  const nucleus = sphere(organelle, nuclear, -.21, .04, -.09, .37, 1.04, .9, 1);
  sphere(organelle, material(0xac94ed), -.2, .12, .02, .14);
  const green = material(0x38ab85, .35, .17);
  const gold = material(0xe0a965, .44, .15);
  for (let i = 0; i < 14; i += 1) {
    const angle = i * 2.39;
    const part = sphere(organelle, i % 3 ? green : gold, Math.sin(angle) * 1.04, Math.cos(angle * .7) * .62, Math.cos(angle) * .64, .14, 1.6, .65, .84);
    part.rotation.z = angle;
  }
  const particles = Array.from({ length: 29 }, (_, i) => sphere(group, material(i % 2 ? accent : 0xc1b0ff), 0, 0, 0, .04));
  return (t, input, output) => {
    membrane.scale.y = .9 + output * .12;
    nucleus.rotation.y = t * .37;
    organelle.rotation.y = Math.sin(t * .35) * .25;
    particles.forEach((part, i) => {
      const phase = (t * (.22 + .78 * input) + i * .237) % 1;
      const phi = i * 2.4;
      const distance = .46 + phase * 1.6;
      part.position.set(Math.sin(phi) * distance, 1.21 + Math.cos(phi * .51) * .88 * distance, Math.cos(phi) * distance * .72);
    });
  };
}

function anatomy(group, accent, mission) {
  const lungs = /^B11/.test(mission.id);
  const heart = /^B9/.test(mission.id);
  const tissue = material(lungs ? 0xb35f83 : 0xb15370, .46, .07);
  const rose = material(0xc8809b, .49);
  const red = material(0xd56078, .38);
  const blue = material(0x658cc8, .42);
  const outline = new THREE.Group();
  group.add(outline);
  outline.position.y = 1.08;
  if (lungs) {
    for (const direction of [-1, 1]) {
      const lobe = sphere(outline, tissue, direction * .55, .01, .04, .73, .72, 1.33, .62);
      lobe.rotation.z = direction * .19;
      tube(outline, [[0, 1.03, .22], [0, .64, .22], [direction * .41, .31, .31], [direction * .7, -.24, .37]], .07, rose);
      for (let i = 0; i < 7; i += 1) {
        const x = direction * (.22 + i * .12);
        tube(outline, [[direction * .14, .58, .32], [x, .31 - i * .077, .43], [x, .22 - i * .08, .50]], .025, rose);
      }
    }
  } else if (heart) {
    const lobe = sphere(outline, tissue, .02, .12, 0, .86, .88, 1.19, .81);
    lobe.rotation.z = -.3;
    sphere(outline, rose, -.36, .48, -.14, .49, .91, .87, 1);
    tube(outline, [[-.2, .48, .10], [-.09, .96, .12], [.40, 1.17, .10], [.61, .91, .10]], .132, red);
    tube(outline, [[.29, .42, -.09], [.50, .78, -.17], [.11, 1.03, -.23]], .115, blue);
    tube(outline, [[.41, .73, .33], [.23, .29, .69], [-.22, -.23, .62], [-.12, -.66, .24]], .045, rose);
  } else {
    const body = sphere(outline, glass(accent, .18), 0, .1, 0, 1, .85, 1.15, .57);
    body.rotation.z = -.07;
    tube(outline, [[-.35,.95,.06],[-.35,.51,.14],[.35,.31,.34],[.44,-.04,.37],[-.45,-.17,.36],[-.32,-.36,.31],[.38,-.48,.31],[.07,-.78,.23]], .14, tissue);
    for (let i = 0; i < 9; i += 1) {
      sphere(outline, rose, Math.sin(i * 2.2) * .52, .68 - i * .15, .39, .066);
    }
  }
  const signals = Array.from({ length: 22 }, (_, i) => sphere(group, i % 2 ? red : blue, 0, 0, 0, .048));
  return (t, input, output) => {
    const cycle = Math.sin(t * (1.4 + 3 * output));
    outline.scale.setScalar(1 + cycle * (lungs ? .055 : .025));
    signals.forEach((signal, i) => {
      const p = (i / signals.length + t * (.11 + input * .3)) * tau;
      signal.position.set(Math.sin(p) * (1.27 + .16 * (i % 2)), 1.05 + Math.cos(p) * .72, Math.cos(p) * .49);
    });
  };
}

function watershed(group, accent) {
  const terrain = material(0x517765, .95);
  const sand = material(0x827657, .94);
  const water = material(0x4a9fb4, .24, .13);
  const bark = material(0x745c49, .79);
  const leaves = [material(0x106e54, .76), material(0x298863, .78), material(0x4c9f68, .78)];
  box(group, terrain, 0, .11, 0, 4.3, .22, 2.7);
  box(group, sand, -.13, .27, .08, 4.13, .21, 1.58);
  const river = tube(group, [[-2.02,.39,.22],[-1.28,.39,.12],[-.61,.39,-.08],[.28,.39,.15],[.98,.39,.48],[2.06,.39,.33]], .17, water);
  river.scale.y = .48;
  river.position.y = .2;
  const trees = Array.from({ length: 22 }, (_, i) => {
    const tree = new THREE.Group();
    const side = i % 2 ? -.86 : .88;
    tree.position.set(-1.96 + (i % 11) * .38, .35, side + Math.sin(i * 2.2) * .25);
    group.add(tree);
    cylinder(tree, bark, 0, .13, 0, .038, .052, .26);
    cylinder(tree, leaves[i % 3], 0, .32, 0, 0, .17, .40);
    cylinder(tree, leaves[(i + 1) % 3], 0, .49, 0, 0, .14, .33);
    return tree;
  });
  const drops = Array.from({ length: 32 }, () => sphere(group, glass(0xb6fdff, .72), 0, 1, 0, .033, .7, 1.6, .7));
  const blue = new THREE.Color(0x4a9fb4);
  const brown = new THREE.Color(0xa99765);
  return (t, input, output) => {
    trees.forEach((tree, i) => { tree.visible = i < 4 + Math.round(input * 18); });
    water.color.copy(blue).lerp(brown, output);
    drops.forEach((drop, i) => {
      const progress = (t * .38 + i * .173) % 1;
      drop.visible = i < 25;
      drop.position.set(-1.91 + (i % 12) * .34, 1.94 - 1.55 * progress, Math.sin(i * 2.9) * 1.16);
    });
  };
}

function tracks(group, accent, mission) {
  const floor = material(0x354c62, .52, .56);
  const frame = material(0x9caaba, .36, .64);
  const signal = material(accent, .28, .38, { emissive: accent, emissiveIntensity: .17 });
  const tire = material(0x1b2732, .86);
  const cart = new THREE.Group();
  group.add(cart);
  const incline = /force|gradient|slope/i.test(mission.variable) && !/mass/i.test(mission.variable);
  const platform = new THREE.Group();
  group.add(platform);
  platform.add(cart);
  box(platform, floor, 0, .26, 0, 4.65, .2, 1.58);
  for (const z of [-.45, .45]) box(platform, frame, 0, .375, z, 4.62, .027, .019);
  for (let i = 0; i < 12; i += 1) box(platform, frame, -2.2 + i * .4, .368, .72, .024, .016, .11);
  box(cart, signal, 0, .61, 0, .85, .24, .62);
  box(cart, frame, .14, .83, 0, .45, .24, .43);
  const wheels = [];
  for (const x of [-.31, .31]) for (const z of [-.32, .32]) {
    const wheel = cylinder(cart, tire, x, .48, z, .14, .14, .095);
    wheel.rotation.x = Math.PI / 2;
    const hub = cylinder(cart, frame, x, .48, z * 1.15, .057, .057, .1);
    hub.rotation.x = Math.PI / 2;
    wheels.push(wheel, hub);
  }
  for (const x of [-1.65, 1.65]) box(group, floor, x, .12, 0, .24, .24, 1.41);
  return (t, input, output) => {
    platform.rotation.z = incline ? -.04 - input * .10 : 0;
    platform.position.y = incline ? input * .18 : 0;
    const time = t * (.46 + 2.35 * output);
    cart.position.x = Math.sin(time) * 1.63;
    wheels.forEach(wheel => { wheel.rotation.y = time * 3.6; });
  };
}

function thermal(group, accent) {
  const metal = material(0xb9bac0, .34, .71);
  const graphite = material(0x374351, .55, .45);
  const copper = material(0xb9765e, .38, .58);
  box(group, graphite, 0, .14, 0, 3.45, .28, 1.83);
  cylinder(group, graphite, -.72, .38, .13, .74, .77, .22);
  const sample = liquidColumn(group, -.72, 1.68, 0x68ccd9, .64);
  sample.wall.position.y += .45;
  sample.liquid.position.y += .45;
  const hot = material(0xf59a70, .42, .35, { emissive: 0xef5e37, emissiveIntensity: .4 });
  for (let i = 0; i < 4; i += 1) {
    const coil = mesh(group, new THREE.TorusGeometry(.18 + .14 * i, .025, 8, 40), hot, -.72, .515, .13);
    coil.rotation.x = Math.PI / 2;
  }
  const probe = cylinder(group, metal, -.69, 1.49, .07, .043, .043, 1.52);
  probe.rotation.z = -.19;
  tube(group, [[-.46,2.24,.07],[.09,2.38,.07],[.77,1.8,.08],[.91,.92,.08]], .036, copper);
  box(group, metal, 1.02, .63, .11, .86, .69, 1.16);
  const slots = Array.from({ length: 7 }, (_, i) => box(group, material(accent, .35, .2, { emissive: accent, emissiveIntensity: .35 }), .75 + i * .087, .985, .14, .045, .035, .26));
  const vapor = Array.from({ length: 28 }, () => sphere(group, glass(0xe5f8ff, .35), 0, 1, 0, .043));
  return (t, input, output) => {
    hot.emissiveIntensity = .1 + input * 2.2;
    slots.forEach((slot, i) => { slot.visible = i < 1 + 7 * output; });
    vapor.forEach((drop, i) => {
      drop.visible = i < output * vapor.length;
      drop.position.set(-.72 + Math.sin(i * 1.3 + t) * .46, 1.15 + ((i * .13 + t * .32) % 1) * 1.68, .12 + Math.cos(i * 2.3) * .42);
    });
  };
}

function waves(group, accent) {
  const platform = material(0x304352, .68, .37);
  box(group, platform, 0, .1, 0, 4.06, .2, 2.52);
  const water = material(0x1e9fbb, .35, .36, { side: THREE.DoubleSide });
  const geometry = new THREE.PlaneGeometry(3.9, 2.38, 80, 40);
  const surface = mesh(group, geometry, water, 0, .54, 0);
  surface.rotation.x = -Math.PI / 2;
  const source = material(accent, .23, .33, { emissive: accent, emissiveIntensity: .24 });
  const actuator = cylinder(group, source, -1.42, .51, 0, .16, .16, .73);
  const points = geometry.attributes.position;
  return (t, input, output) => {
    for (let i = 0; i < points.count; i += 1) {
      const distance = Math.hypot(points.getX(i) + 1.42, points.getY(i));
      points.setZ(i, Math.sin(distance * (4.2 + input * 9) - t * (3 + input * 7)) * (.04 + .17 * output) * Math.exp(-distance * .37));
    }
    points.needsUpdate = true;
    geometry.computeVertexNormals();
    actuator.position.y = .54 + .17 * Math.sin(t * (3 + input * 7));
  };
}

function mechanicsRig(group, accent, mission) {
  const frame = material(0x4c6073, .43, .55);
  const alloy = material(0xb4c9d3, .32, .67);
  const marked = material(accent, .34, .35, { emissive: accent, emissiveIntensity: .12 });
  const dark = material(0x24364a, .58, .43);
  box(group, dark, 0, .11, 0, 3.58, .22, 1.82);

  if (mission.id === 'P1.1') {
    box(group, frame, -1.03, 1.27, -.16, .14, 2.18, .22);
    box(group, alloy, -.47, 2.34, -.16, 1.25, .13, .22);
    const pendulum = new THREE.Group();
    group.add(pendulum);
    pendulum.position.set(.1, 2.28, -.13);
    cylinder(pendulum, alloy, 0, -.78, 0, .017, .017, 1.56);
    sphere(pendulum, marked, 0, -1.58, 0, .215);
    for (let index = 0; index < 11; index += 1) {
      const angle = (.10 * index - .5);
      box(group, alloy, .1 + 1.62 * Math.sin(angle), .27, .67, .02, .075, index % 5 === 0 ? .2 : .1);
    }
    return t => { pendulum.rotation.z = .51 * Math.sin(t * Math.PI); };
  }

  if (mission.id === 'P1.5.1') {
    for (const x of [-1.1, 1.1]) box(group, frame, x, 1.26, -.20, .15, 2.11, .21);
    box(group, alloy, 0, 2.33, -.20, 2.37, .13, .19);
    const coil = new THREE.Group();
    group.add(coil);
    coil.position.set(0, 2.26, -.12);
    const helix = Array.from({ length: 91 }, (_, i) => [Math.sin(i * tau / 10) * .16, -.01 * i, Math.cos(i * tau / 10) * .16]);
    tube(coil, helix, .025, alloy);
    const hanger = cylinder(group, marked, 0, 1.10, -.12, .18, .2, .26);
    box(group, dark, .53, 1.20, -.12, .14, 1.9, .085);
    for (let i = 0; i < 12; i += 1) box(group, marked, .56, .36 + .145 * i, -.061, .08, .011, .028);
    return (_t, input, output) => {
      coil.scale.y = .69 + output * .51;
      hanger.position.y = 2.13 - .9 * coil.scale.y;
      hanger.scale.y = .78 + .51 * input;
    };
  }

  if (mission.id === 'P1.5.2') {
    cylinder(group, frame, -.64, .55, 0, .085, .31, .68);
    const beam = box(group, alloy, .25, .98, 0, 3.08, .14, .37);
    const load = cylinder(group, marked, 0, .72, 0, .15, .18, .32);
    for (let i = 0; i < 8; i += 1) box(group, dark, -.74 + i * .31, 1.058, .10, .019, .01, .11);
    return (_t, input) => {
      load.position.x = -.61 + 2.03 * input;
      beam.material.emissive.setHex(accent);
      beam.material.emissiveIntensity = input * .13;
    };
  }

  const ropeMaterial = material(0xb29a76, .69, .09);
  const left = -1.14;
  box(group, frame, left, 1.29, -.23, .21, 2.18, .30);
  box(group, alloy, -.25, 2.34, -.23, 1.98, .15, .31);
  const wheel = cylinder(group, alloy, .63, 2.11, -.16, .27, .27, .12);
  wheel.rotation.x = Math.PI / 2;
  const spool = cylinder(group, marked, .63, 2.11, -.08, .14, .14, .17);
  spool.rotation.x = Math.PI / 2;
  const load = box(group, marked, .85, .50, -.13, .63, .48, .61);
  const rope = cylinder(group, ropeMaterial, .85, 1.44, -.13, .026, .026, 1);
  return (t, input, output) => {
    const lifted = (mission.id === 'P1.6.2' ? input : .5 + .5 * Math.sin(t * (1 + 2 * output)));
    load.position.y = .48 + 1.15 * lifted;
    const liftHeight = 1.96 - (load.position.y + .24);
    rope.scale.y = liftHeight;
    rope.position.y = 1.96 - liftHeight / 2;
    spool.rotation.z = lifted * 7;
  };
}

function diffusionChamber(group, accent) {
  const geometry = new THREE.BoxGeometry(3.62, 1.88, 1.49);
  mesh(group, geometry, glass(accent, .09), 0, 1.12, 0);
  edge(group, geometry, accent, .52).position.y = 1.12;
  const barrier = box(group, glass(0x9ad3ef, .24), 0, 1.1, 0, .016, 1.82, 1.46);
  barrier.material.side = THREE.DoubleSide;
  const dye = material(0xe2a875, .37, .22, { emissive: 0xe89a50, emissiveIntensity: .18 });
  const water = material(0x65adba, .45, .16);
  const particles = Array.from({ length: 64 }, (_, i) => sphere(group, i % 2 ? dye : water, 0, 1, 0, i % 2 ? .057 : .032));
  return (t, input, output) => {
    particles.forEach((particle, index) => {
      const time = t * .76, phase = index * 2.397;
      const drift = Math.sin(time * .77 + phase) * 1.18;
      const start = index % 4 < 2 ? -.52 - .19 * input : .52 - .19 * input;
      const motion = 1 + Number(index % 2 === 1) * .2 * output;
      particle.position.set(Math.max(-1.71, Math.min(1.71, start + drift * motion)), 1.14 + Math.sin(time * 1.1 + phase * .71) * .78, Math.cos(phase + time * .65) * .64);
    });
  };
}

function circuit(group, accent, mission) {
  const base = material(0x214747, .57, .31);
  const silver = material(0xbfc9cd, .36, .64);
  const copper = material(0xb87856, .4, .53);
  const casing = material(0x3e4c60, .3, .5);
  const glow = material(accent, .27, .18, { emissive: accent, emissiveIntensity: .65 });
  box(group, base, 0, .12, 0, 3.72, .24, 2.37);
  for (const x of [-1.71,1.71]) for (const z of [-1.02,1.02]) cylinder(group, silver, x, .27, z, .046, .046, .064);
  const points = [[-1.44,.33,-.7],[1.36,.33,-.7],[1.44,.33,.72],[-1.44,.33,.72]];
  const circuitWire = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), true, 'catmullrom', .08);
  mesh(group, new THREE.TubeGeometry(circuitWire, 80, .033, 10, true), copper);
  const supply = cylinder(group, casing, -1.21, .57, 0, .233, .233, .99);
  supply.rotation.x = Math.PI / 2;
  for (const z of [-.5,.5]) {
    const terminal = cylinder(group, silver, -1.21, .57, z, .155, .155, .13);
    terminal.rotation.x = Math.PI / 2;
  }
  box(group, glow, -1.19, .742, 0, .24, .11, .42);
  const meter = box(group, casing, -.21, .43, .76, .95, .35, .70);
  meter.rotation.x = -.08;
  box(group, material(0x0d232d), -.21, .608, .76, .79, .045, .50);
  const bars = Array.from({ length: 10 }, (_, i) => box(group, glow, -.51 + i * .065, .646, .71, .045, .02, .26));
  const pump = mission.id === 'P4.2.5';
  const coil = /^P4\.5/.test(mission.id);
  const moving = new THREE.Group();
  moving.position.set(1.05, .62, -.24);
  group.add(moving);
  if (pump) {
    cylinder(group, casing, 1.05,.46,-.24,.47,.51,.65);
    const rotor = cylinder(moving, silver, 0,.28,0,.13,.13,.17);
    rotor.rotation.x = .01;
    for (let i = 0; i < 5; i += 1) {
      const blade = box(moving, glow, 0, .28, 0, .62, .065, .11);
      blade.rotation.y = i * tau / 5;
    }
    tube(group, [[1.05,.50,-.60],[1.05,.62,-.90],[.5,.85,-.91],[.13,.85,-.90]],.115,silver);
  } else if (coil) {
    for (let i = 0; i < 12; i += 1) {
      const winding = mesh(moving, new THREE.TorusGeometry(.34, .036, 9, 25), copper, 0, 0, - .46 + .08 * i);
      winding.rotation.y = .04;
    }
    const core = cylinder(group, silver, 1.05, .62, -.24, .23, .23, 1.41);
    core.rotation.x = Math.PI / 2;
  } else {
    cylinder(group, silver, 1.07, .46, -.24, .23, .29, .33);
    const bulb = sphere(group, glass(accent, .49), 1.07, .82, -.24, .25, 1, 1.36, 1);
    bulb.material.emissive.setHex(accent);
    bulb.material.emissiveIntensity = .35;
    tube(group, [[.97,.68,-.24],[.99,.83,-.24],[1.15,.83,-.24],[1.16,.68,-.24]], .025, glow);
  }
  const electrons = Array.from({ length: 23 }, () => sphere(group, glow, 0, 0, 0, .039));
  return (t, input, output) => {
    if (pump) moving.rotation.y = t * (input > 0 ? 3.7 : 0);
    if (coil) moving.rotation.z = t * (1.2 + input * 2);
    glow.emissiveIntensity = .14 + output * 1.5;
    bars.forEach((bar, i) => { bar.visible = i < 1 + output * 9; });
    electrons.forEach((dot, i) => {
      const phase = THREE.MathUtils.euclideanModulo(i / electrons.length + t * (.014 + .099 * output), 1);
      circuitWire.getPointAt(phase, dot.position);
      dot.position.y += .035;
      dot.visible = i < 4 + Math.round(19 * output);
    });
  };
}

function specimen(group, accent, mission) {
  const slab = material(0x39495a, .54, .56);
  const gray = material(0xb5c6cf, .38, .68);
  const tip = material(accent, .26, .56, { emissive: accent, emissiveIntensity: .15 });
  const rust = /rust/i.test(mission.metric);
  const rusted = new THREE.Color(0x9b6b4b);
  const fresh = new THREE.Color(0xb3c1cd);
  box(group, slab, 0, .14, 0, 3.66, .28, 2.08);
  for (const x of [-1.46,1.46]) box(group, slab, x, 1.13, -.33, .15, 1.94, .29);
  box(group, slab, 0, 2.14, -.33, 3.05, .19, .33);
  const head = new THREE.Group();
  group.add(head);
  cylinder(head, gray, 0, -.17, -.28, .14, .14, .49);
  cylinder(head, tip, 0, -.41, -.28, .14, .03, .22);
  const sheet = box(group, gray, 0, .62, .12, 2.65, .24, 1.25);
  for (const x of [-.91,.91]) box(group, slab, x, .43, .12, .22, .29, .49);
  const markers = Array.from({length: 8}, (_, i) => box(group, tip, -1.31+i*.18, .34, .83, .087, .035, .09));
  return (_t, input, output) => {
    head.position.y = 1.9 - input * .51;
    sheet.scale.x = 1 + (/length/i.test(mission.metric) ? output * .18 : 0);
    if (rust) gray.color.copy(fresh).lerp(rusted, output);
    markers.forEach((marker, i) => { marker.visible = i < 1 + output * 7; });
  };
}

function atom(group, accent, mission) {
  const protons = material(0xf291a4, .36, .35, { emissive: 0xd9506b, emissiveIntensity: .25 });
  const neutrons = material(0x95a8fc, .36, .35, { emissive: 0x5b75d2, emissiveIntensity: .26 });
  const orbital = material(accent, .32, .23, { emissive: accent, emissiveIntensity: .36 });
  const center = new THREE.Group();
  center.position.set(0,1.2,0);
  group.add(center);
  const core = [];
  for (let i = 0; i < 29; i += 1) {
    const phi = i * 2.4;
    const c = Math.cos(i * .46);
    const radius = Math.sqrt(1 - c * c) * (.23 + i % 3 * .09);
    core.push(sphere(center, i % 2 ? protons : neutrons, Math.sin(phi) * radius, c * .41, Math.cos(phi) * radius, .115));
  }
  const orbitals = [0, 1, 2].map(i => {
    const ring = new THREE.Group();
    center.add(ring);
    ring.rotation.set(.45 + i * .72, i * .77, i * .33);
    mesh(ring, new THREE.TorusGeometry(.89 + i * .22, .009, 6, 80), glass(accent, .69));
    return { ring, dots: [sphere(ring, orbital, 0, 0, 0, .063), sphere(ring, orbital, 0, 0, 0, .063)] };
  });
  const halfLife = /undecayed/i.test(mission.metric);
  return (t, input, output) => {
    center.rotation.y = t * .18;
    core.forEach((particle, i) => { particle.visible = i < (halfLife ? 2 + output * 27 : 13 + output * 16); });
    orbitals.forEach(({ dots }, i) => {
      dots.forEach((dot, j) => {
        const angle = t * (1.05 + input * .45 - i * .2) + j * Math.PI + i;
        const radius = .89 + i * .22;
        dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      });
    });
  };
}

function installWorktable(scene) {
  const top = new THREE.Shape();
  const x = 2.30, y = 1.29, radius = .14;
  top.moveTo(-x + radius, -y);
  top.lineTo(x - radius, -y);
  top.quadraticCurveTo(x, -y, x, -y + radius);
  top.lineTo(x, y - radius);
  top.quadraticCurveTo(x, y, x - radius, y);
  top.lineTo(-x + radius, y);
  top.quadraticCurveTo(-x, y, -x, y - radius);
  top.lineTo(-x, -y + radius);
  top.quadraticCurveTo(-x, -y, -x + radius, -y);
  const topGeometry = new THREE.ExtrudeGeometry(top, { depth: .13, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 3, steps: 1 });
  topGeometry.rotateX(-Math.PI / 2);
  mesh(scene, topGeometry, material(0x3f4c58, .59, .42), 0, -.17, 0);

  const foot = material(0x27313c, .58, .29);
  const brushedSteel = material(0x69787f, .33, .69);
  for (const px of [-1.97, 1.97]) for (const pz of [-.97, .97]) {
    cylinder(scene, foot, px, -.217, pz, .155, .178, .064);
    cylinder(scene, brushedSteel, px, -.177, pz, .124, .135, .055);
  }
  const shadowSurface = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec2 panelUV;
      void main() {
        panelUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 panelUV;
      void main() {
        vec2 position = abs(panelUV - 0.5) * 2.0;
        float shadow = (1.0 - smoothstep(0.36, 1.0, position.x)) * (1.0 - smoothstep(0.31, 1.0, position.y));
        gl_FragColor = vec4(0.014, 0.023, 0.032, shadow * 0.57);
      }
    `
  });
  const shadow = mesh(scene, new THREE.PlaneGeometry(7.6, 4.5), shadowSurface, .05, -.253, .07);
  shadow.rotation.x = -Math.PI / 2;
}

export function createLabScene(host, mission, reducedMotion, model) {
  const [accent, secondary] = palette[mission.subject];
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1522);
  scene.fog = new THREE.FogExp2(0x0b1522, .033);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 45);
  if (model) camera.position.set(4.15, 3.18, 6.6);
  else camera.position.set(4.83, 3.5, 7.75);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, model ? .92 : 1.21, 0);
  orbit.minDistance = 3.9;
  orbit.maxDistance = 14;
  orbit.maxPolarAngle = Math.PI * .51;
  orbit.enablePan = false;
  orbit.enableDamping = true;
  orbit.update();
  orbit.saveState();
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xcfe8fa, 0x455366, 2.12);
  const key = new THREE.DirectionalLight(0xd8f2ff, 3.1);
  key.position.set(4, 7, 3);
  const rim = new THREE.DirectionalLight(accent, 1.86);
  rim.position.set(-3, 1.5, -3);
  scene.add(ambient, key, rim);
  const experiment = model ?? createExperimentModel(mission);
  scene.add(experiment.model);
  if (model) installWorktable(scene);
  else {
    const platform = cylinder(scene, material(secondary, .43, .62), 0, -.12, 0, 2.72, 2.65, .24);
    platform.scale.z = .81;
    const strip = mesh(scene, new THREE.TorusGeometry(2.73,.015,8,128), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .64 }), 0, -.118, 0);
    strip.rotation.x = Math.PI / 2;
    strip.scale.y = .81;
    const grid = new THREE.GridHelper(36, 75, 0x466375, 0x2b4657);
    grid.material.transparent = true;
    grid.material.opacity = .33;
    grid.position.y = -.25;
    scene.add(grid);
  }
  const floor = mesh(scene, new THREE.PlaneGeometry(60, 60), material(model ? 0x263946 : 0x101c2c, .89, .03), 0, -.255, 0);
  floor.rotation.x = -Math.PI / 2;

  let disposed = false;
  let level = 0, result = 0;

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.fov = 35 + Math.max(0, 1.3 - camera.aspect) * 12;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frame;
  const start = performance.now();
  function tick(now) {
    if (disposed) return;
    const reduced = reducedMotion();
    const time = reduced ? 0 : Math.max(0, (now - start) / 1000);
    experiment.update(time, level, result, reduced);
    orbit.update();
    renderer.render(scene, camera);
    if (!host.dataset.sceneState) host.dataset.sceneState = 'ready';
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return {
    setReading(input, output) {
      level = Math.max(0, Math.min(1, input));
      result = Math.max(0, Math.min(1, output));
    },
    resetCamera: () => orbit.reset(),
    setOrbitEnabled(enabled) { orbit.enabled = enabled; },
    pick(x, y, targets) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return undefined;
      const pointer = new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, camera);
      return ray.intersectObjects(targets, false)[0]?.object;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      disposeObjects(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}

export function createExperimentModel(mission) {
  const model = new THREE.Group();
  return { model, update: buildModel(model, palette[mission.subject][0], mission) };
}

function buildModel(group, accent, mission) {
  const override = specializedModel(mission);
  if (override) {
    const { model, update } = override(mission);
    if (mission.id.startsWith('B19.')) {
      model.scale.setScalar(.76);
      model.position.y = .45;
    }
    if (mission.id === 'P6.1') model.scale.setScalar(1.24);
    group.add(model);
    return update;
  }

  if (['P1.1', 'P1.5.1', 'P1.5.2', 'P1.6.2', 'P1.6.4'].includes(mission.id)) return mechanicsRig(group, accent, mission);
  if (['B3.1', 'C1.2'].includes(mission.id)) return diffusionChamber(group, accent);
  if (mission.scene === 'water' || mission.scene === 'vessel') return tank(group, accent);
  const presets = {
    plants: greenhouse, cells: cell, human: anatomy, ecosystem: watershed,
    particles: particleChamber, materials: specimen, heat: thermal,
    motion: tracks, waves, circuit, atom
  };
  return (presets[mission.scene] ?? particleChamber)(group, accent, mission);
}

function specializedModel(mission) {
  if (mission.id.startsWith('B16.')) return createGeneticsScene;
  if (mission.id.startsWith('B19.')) return createWatershedScene;
  if (mission.id.startsWith('P3.2.')) return createOpticsScene;
  if (['C10.1', 'C12.4'].includes(mission.id)) return createFiltrationScene;
  if (['C7.1', 'C7.2', 'C12.2'].includes(mission.id)) return createPhScene;
  if (mission.scene === 'orbit') return createOrbitScene;
  return null;
}

function disposeObjects(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!surface) continue;
      materials.add(surface);
      Object.values(surface).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  geometries.forEach(item => item.dispose());
  textures.forEach(item => item.dispose());
  materials.forEach(item => item.dispose());
}
