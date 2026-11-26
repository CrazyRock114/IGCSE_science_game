import * as THREE from 'three';

const TAU = Math.PI * 2;

function surface(color, roughness = 0.35, metalness = 0.12, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

function addMesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function stage(material, x = 5.1, z = 3.1) {
  const model = new THREE.Group();
  model.position.y = 0.23;
  addMesh(model, new THREE.BoxGeometry(x, 0.22, z), material, 0, -0.12);
  return model;
}

function chromosomeSet(model, center, tint) {
  const set = new THREE.Group();
  set.position.x = center;
  model.add(set);
  const backbone = surface(tint, 0.32, 0.22, { emissive: tint, emissiveIntensity: 0.23 });
  const centromere = surface(0xd3e1bb, 0.28, 0.16);
  const chromosomes = [];
  for (let index = 0; index < 23; index += 1) {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const x = (column - 2) * 0.34;
    const z = (row - 2) * 0.46;
    const size = 0.17 + 0.06 * Math.cos(index * 0.88) - index * 0.0025;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-size * 0.55, 0, -size),
      new THREE.Vector3(0, 0, -size * 0.04),
      new THREE.Vector3(size * 0.38, 0.02, size * 0.71),
    ]);
    const chromosome = addMesh(set, new THREE.TubeGeometry(curve, 9, 0.031, 6, false), backbone, x, 0.19, z);
    addMesh(chromosome, new THREE.SphereGeometry(0.039, 8, 5), centromere);
    chromosome.rotation.y = Math.sin(index * 1.3) * 1.22;
    chromosomes.push(chromosome);
  }
  return {
    set,
    update(time) {
      for (let index = 0; index < chromosomes.length; index += 1) {
        chromosomes[index].position.y = 0.19 + Math.sin(time * 1.8 + index * 0.44) * 0.03;
      }
    },
  };
}

function chromosomes() {
  const model = stage(surface(0x223450, 0.52, 0.53));
  const well = surface(0x16293b, 0.28, 0.39);
  const rims = surface(0x9aabbf, 0.33, 0.69);
  for (const x of [-1.17, 1.17]) {
    addMesh(model, new THREE.BoxGeometry(2.15, 0.12, 2.67), rims, x, 0);
    addMesh(model, new THREE.BoxGeometry(2.09, 0.10, 2.60), well, x, 0.045);
  }
  const first = chromosomeSet(model, -1.17, 0x68d1e2);
  const second = chromosomeSet(model, 1.17, 0xf19e99);
  return {
    model,
    update(time, setting) {
      const sets = Math.round(setting * 2);
      first.set.visible = sets >= 1;
      second.set.visible = sets >= 2;
      first.update(time);
      second.update(time + 0.7);
    },
  };
}

function mitosis() {
  const model = stage(surface(0x254640, 0.4, 0.49), 4.8, 4.15);
  const mesh = new THREE.SphereGeometry(1, 26, 14);
  const cytoplasm = surface(0x62e6a9, 0.28, 0.15, { transparent: true, opacity: 0.31, depthWrite: false });
  const nucleus = surface(0x8065b3, 0.27, 0.18, { emissive: 0x1f123e, emissiveIntensity: 0.6 });
  const core = surface(0xc5a2ff, 0.31, 0.23);
  const membrane = new THREE.TorusGeometry(1.04, 0.018, 8, 36);
  const edge = surface(0x69d4b2, 0.32, 0.34);
  const copies = Array.from({ length: 16 }, () => {
    const body = new THREE.Group();
    model.add(body);
    addMesh(body, mesh, cytoplasm).scale.set(1, 0.57, 1);
    addMesh(body, mesh, nucleus, 0.04, 0.08, -0.09).scale.setScalar(0.37);
    addMesh(body, mesh, core, 0.1, 0.34, 0.01).scale.setScalar(0.12);
    addMesh(body, membrane, edge).rotation.x = Math.PI / 2;
    return body;
  });
  let previousRound = -1;
  let radius = 0;

  return {
    model,
    update(time, setting) {
      const round = Math.round(setting * 4);
      const count = 2 ** round;
      if (round !== previousRound) {
        const width = 2 ** Math.ceil(round / 2);
        const depth = 2 ** Math.floor(round / 2);
        radius = Math.min(1.18, 1.94 / width, 1.65 / depth);
        copies.forEach((body, index) => {
          body.visible = index < count;
          const x = (index % width - (width - 1) / 2) * radius * 2.3;
          const z = (Math.floor(index / width) - (depth - 1) / 2) * radius * 2.3;
          body.position.set(x, radius * 0.54 + 0.03, z);
        });
        previousRound = round;
      }
      copies.forEach((body, index) => {
        if (!body.visible) return;
        const phase = time * 1.6 + index * 0.37;
        body.scale.set(radius * (1 + Math.sin(phase) * 0.04), radius, radius * (1 - Math.sin(phase) * 0.03));
        body.rotation.y = Math.sin(time * 0.5 + index) * 0.24;
      });
    },
  };
}

const glyphs = {
  A: ['0110', '1001', '1001', '1111', '1001', '1001'],
  a: ['0000', '0110', '0001', '0111', '1001', '0111'],
};

function alleleLabel(value) {
  const columns = value.length * 5 - 1;
  const data = new Uint8Array(columns * 6 * 4);
  for (let letter = 0; letter < value.length; letter += 1) {
    const shape = glyphs[value[letter]];
    for (let row = 0; row < shape.length; row += 1) {
      for (let column = 0; column < shape[row].length; column += 1) {
        if (shape[row][column] !== '1') continue;
        const pixel = ((5 - row) * columns + letter * 5 + column) * 4;
        data.set([226, 250, 238, 255], pixel);
      }
    }
  }
  const texture = new THREE.DataTexture(data, columns, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
}

function addLabel(group, material, x, z, columns = 1) {
  const label = addMesh(group, new THREE.PlaneGeometry(0.15 * columns, 0.19), material, x, 0.068, z);
  label.rotation.x = -Math.PI / 2;
  return label;
}

function selectableLabel(group, labels, values, x, z) {
  const variants = values.map(value => [value, addLabel(group, labels[value], x, z, value.length)]);
  return selected => {
    variants.forEach(([value, label]) => { label.visible = value === selected; });
  };
}

function peaFlower(group, x, z, colour) {
  const plant = new THREE.Group();
  plant.position.set(x, 0.05, z);
  group.add(plant);
  const stem = surface(0x83b45a, 0.59);
  const leaf = surface(0x527c4c, 0.55);
  addMesh(plant, new THREE.CylinderGeometry(0.019, 0.021, 0.48, 9), stem, 0, 0.24);
  addMesh(plant, new THREE.SphereGeometry(0.13, 10, 7), leaf, 0.10, 0.18, 0.04).scale.set(1, 0.12, 0.50);
  addMesh(plant, new THREE.SphereGeometry(0.14, 10, 7), leaf, -0.09, 0.28, -0.01).scale.set(1, 0.12, 0.43);
  const petalGeometry = new THREE.SphereGeometry(0.076, 12, 9);
  for (let i = 0; i < 5; i += 1) {
    const theta = i / 5 * TAU;
    const petal = addMesh(plant, petalGeometry, colour, Math.cos(theta) * 0.062, 0.49, Math.sin(theta) * 0.062);
    petal.scale.set(1, 0.55, 1);
  }
  addMesh(plant, new THREE.SphereGeometry(0.044, 10, 8), surface(0xf0bf73, 0.55), 0, 0.534);
  return plant;
}

function punnett() {
  const model = stage(surface(0x304151, 0.5, 0.48), 4.0, 3.55);
  const square = surface(0x19343e, 0.43, 0.26);
  const frame = surface(0x578b81, 0.41, 0.41);
  const labels = Object.fromEntries(['A', 'a', 'AA', 'Aa', 'aa'].map(value => [value, alleleLabel(value)]));
  const purple = surface(0x9d62e0, 0.39);
  const white = surface(0xece7d8, 0.42);
  addLabel(model, labels.A, -1.41, -0.36);
  addLabel(model, labels.a, -1.41, 0.68);
  const headings = [
    selectableLabel(model, labels, ['A', 'a'], -0.49, -1.23),
    selectableLabel(model, labels, ['A', 'a'], 0.68, -1.23),
  ];
  const grid = Array.from({ length: 4 }, (_, index) => {
    const x = index % 2 * 1.17 - 0.49;
    const z = Math.floor(index / 2) * 1.04 - 0.36;
    addMesh(model, new THREE.BoxGeometry(1.09, 0.11, 0.98), frame, x, -0.001, z);
    addMesh(model, new THREE.BoxGeometry(1.04, 0.105, 0.94), square, x, 0.006, z);
    const showLabel = selectableLabel(model, labels, index < 2 ? ['AA', 'Aa'] : ['Aa', 'aa'], x - 0.22, z + 0.22);
    const purplePlant = peaFlower(model, x + 0.13, z - 0.10, purple);
    const whitePlant = peaFlower(model, x + 0.13, z - 0.10, white);
    return { showLabel, purplePlant, whitePlant };
  });
  let previousGenotype = -1;

  return {
    model,
    update(time, setting) {
      const secondParent = Math.round(setting * 2);
      if (secondParent !== previousGenotype) {
        const secondGametes = [['A', 'A'], ['A', 'a'], ['a', 'a']][secondParent];
        headings.forEach((showLabel, index) => showLabel(secondGametes[index]));
        grid.forEach(({ showLabel, purplePlant, whitePlant }, index) => {
          const first = index < 2 ? 'A' : 'a';
          const second = secondGametes[index % 2];
          const outcome = first === second ? first + second : 'Aa';
          showLabel(outcome);
          purplePlant.visible = outcome !== 'aa';
          whitePlant.visible = outcome === 'aa';
        });
        previousGenotype = secondParent;
      }
      grid.forEach(({ purplePlant, whitePlant }, index) => {
        const plant = purplePlant.visible ? purplePlant : whitePlant;
        plant.rotation.z = Math.sin(time * 1.6 + index) * 0.09;
      });
    },
  };
}

export function createGeneticsScene(mission) {
  switch (mission.id) {
    case 'B16.1': return chromosomes();
    case 'B16.2': return mitosis();
    case 'B16.3': return punnett();
    default: throw new Error('Unknown genetics experiment');
  }
}
