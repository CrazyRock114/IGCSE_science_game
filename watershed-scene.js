import * as THREE from 'three';

const HALF_X = 3;
const HALF_Z = 1.95;
const TREE_COUNT = 45;
const STREAM_START = -HALF_X;
const STREAM_END = HALF_X;

const soilDark = new THREE.Color(0x524431);
const soilLight = new THREE.Color(0xa08459);
const grassDark = new THREE.Color(0x254752);
const grassLight = new THREE.Color(0x536c49);
const waterClear = new THREE.Color(0x27abbc);
const waterMuddy = new THREE.Color(0xa66a35);

function streamZ(x) {
  return 0.53 * Math.sin(x * 1.2) + 0.14 * Math.sin(x * 2.3);
}

function streamY(x) {
  return 0.28 - (x - STREAM_START) * 0.047;
}

function terrainY(x, z) {
  const distance = Math.abs(z - streamZ(x));
  const bank = THREE.MathUtils.smoothstep(distance, 0.27, 0.92);
  const hills = 0.24 + Math.sin(x * 1.48 + z * 1.21) * 0.12 + Math.cos(z * 2.14 - x * 0.7) * 0.13;
  return streamY(x) - 0.17 + bank * (0.47 + hills);
}

function terrainGeometry() {
  const positions = [], colors = [], indices = [];
  const columns = 54, rows = 35;
  const stride = columns + 1;
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = (column / columns * 2 - 1) * HALF_X;
      const z = (row / rows * 2 - 1) * HALF_Z;
      positions.push(x, terrainY(x, z), z);
      const bank = THREE.MathUtils.smoothstep(Math.abs(z - streamZ(x)), 0.25, 0.7);
      const variation = 0.5 + Math.sin(column * 0.55 + row * 0.7) * 0.2 + Math.cos(column * 0.2 - row * 0.6) * 0.15;
      const color = soilDark.clone().lerp(soilLight, variation).lerp(grassDark.clone().lerp(grassLight, variation), bank);
      colors.push(color.r, color.g, color.b);
      if (column < columns && row < rows) {
        const index = row * stride + column;
        indices.push(index, index + stride, index + 1, index + 1, index + stride, index + stride + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function earthSides() {
  const corners = [[-HALF_X, -HALF_Z], [HALF_X, -HALF_Z], [HALF_X, HALF_Z], [-HALF_X, HALF_Z]];
  const positions = [], indices = [];
  for (let side = 0; side < corners.length; side += 1) {
    const [sx, sz] = corners[side];
    const [ex, ez] = corners[(side + 1) % corners.length];
    for (let index = 0; index <= 32; index += 1) {
      const x = THREE.MathUtils.lerp(sx, ex, index / 32);
      const z = THREE.MathUtils.lerp(sz, ez, index / 32);
      const vertex = positions.length / 3;
      positions.push(x, -0.42, z, x, terrainY(x, z), z);
      if (index < 32) indices.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3);
    }
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setIndex(indices);
  shape.computeVertexNormals();
  return shape;
}

function streamGeometry() {
  const positions = [], indices = [];
  for (let section = 0; section <= 80; section += 1) {
    const x = THREE.MathUtils.lerp(STREAM_START, STREAM_END, section / 80);
    const width = 0.49 + 0.06 * Math.sin(x * 1.25);
    const z = streamZ(x);
    positions.push(x, streamY(x), z - width, x, streamY(x), z + width);
    if (section < 80) {
      const index = section * 2;
      indices.push(index, index + 1, index + 2, index + 2, index + 1, index + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function randomSequence(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function treePositions(random) {
  const trees = [];
  while (trees.length < TREE_COUNT) {
    const x = (random() - 0.5) * (HALF_X * 2 - 0.32);
    const z = (random() - 0.5) * (HALF_Z * 2 - 0.32);
    if (Math.abs(z - streamZ(x)) < 0.72 || trees.some(tree => Math.hypot(tree.x - x, tree.z - z) < 0.32)) continue;
    trees.push({ x, z, y: terrainY(x, z), size: 0.68 + random() * 0.55 });
  }
  return trees;
}

function forest(model, random) {
  const trees = treePositions(random);
  const stemGeometry = new THREE.CylinderGeometry(0.038, 0.051, 0.57, 6);
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(stemGeometry, new THREE.MeshStandardMaterial({ color: 0x70482c }), TREE_COUNT);
  const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), TREE_COUNT * 2);
  const stumps = new THREE.InstancedMesh(stemGeometry, new THREE.MeshStandardMaterial({ color: 0xc99762 }), TREE_COUNT);
  const temporary = new THREE.Object3D();
  const evergreen = [0x386753, 0x588356, 0x267966, 0x618250].map(color => new THREE.Color(color));
  for (let i = 0; i < trees.length; i += 1) {
    const { x, y, z, size } = trees[i];
    temporary.position.set(x, y + size * 0.26, z);
    temporary.scale.set(size, size, size);
    temporary.updateMatrix();
    trunks.setMatrixAt(i, temporary.matrix);

    temporary.position.set(x + size * 0.03, y + size * 0.63, z);
    temporary.scale.set(size * 0.22, size * 0.33, size * 0.21);
    temporary.updateMatrix();
    crowns.setMatrixAt(i * 2, temporary.matrix);
    crowns.setColorAt(i * 2, evergreen[i % evergreen.length]);
    temporary.position.set(x - size * 0.10, y + size * 0.47, z + size * 0.055);
    temporary.scale.set(size * 0.15, size * 0.25, size * 0.16);
    temporary.updateMatrix();
    crowns.setMatrixAt(i * 2 + 1, temporary.matrix);
    crowns.setColorAt(i * 2 + 1, evergreen[(i + 1) % evergreen.length]);

    temporary.position.set(x, y + 0.02, z);
    temporary.scale.set(size, size * 0.16, size);
    temporary.updateMatrix();
    stumps.setMatrixAt(TREE_COUNT - i - 1, temporary.matrix);
  }
  for (const mesh of [trunks, crowns, stumps]) {
    mesh.frustumCulled = false;
    model.add(mesh);
  }
  return cover => {
    const visible = Math.round(cover * TREE_COUNT);
    trunks.count = visible;
    crowns.count = visible * 2;
    stumps.count = TREE_COUNT - visible;
  };
}

function flow(model, random, waterMaterial, conservation) {
  const geometry = new THREE.SphereGeometry(0.036, 6, 4);
  const clearMaterial = new THREE.MeshBasicMaterial({ color: 0xb4f8fa, transparent: true, opacity: 0.58 });
  const sedimentMaterial = new THREE.MeshBasicMaterial({ color: 0xdbad70 });
  const droplets = Array.from({ length: 38 }, (_, index) => {
    const sediment = index >= 10;
    const mesh = new THREE.Mesh(geometry, sediment ? sedimentMaterial : clearMaterial);
    mesh.scale.set(sediment ? 0.55 : 1.78, 0.30, sediment ? 0.55 : 0.72);
    model.add(mesh);
    return { mesh, lateral: (random() - 0.5) * 0.63, phase: random(), speed: 0.12 + random() * 0.05, sediment };
  });
  return (time, reading) => {
    const mud = conservation ? 0.17 : reading;
    waterMaterial.color.copy(waterClear).lerp(waterMuddy, mud * 0.84);
    for (let index = 0; index < droplets.length; index += 1) {
      const { mesh, lateral, phase, speed, sediment } = droplets[index];
      mesh.visible = !sediment || index - 10 < Math.round(28 * mud);
      const x = THREE.MathUtils.lerp(STREAM_START + 0.04, STREAM_END - 0.04, (phase + time * speed) % 1);
      mesh.position.set(x, streamY(x) + 0.016, streamZ(x) + lateral);
    }
  };
}

function habitatMarkers(model, random) {
  const markerShape = new THREE.OctahedronGeometry(0.10);
  const markerMaterials = [0xc0d681, 0xffd586, 0x6ae5eb].map(color => new THREE.MeshBasicMaterial({ color }));
  const markers = Array.from({ length: 22 }, (_, index) => {
    const marker = new THREE.Mesh(markerShape, markerMaterials[index % markerMaterials.length]);
    const side = index % 2 ? 1 : -1;
    const x = THREE.MathUtils.lerp(-2.7, 2.7, index / 22);
    const z = streamZ(x) + side * (0.53 + random() * 0.26);
    const height = terrainY(x, z) + 0.35 + random() * 0.20;
    marker.position.set(x, height, z);
    model.add(marker);
    return { marker, height, phase: random() * 6 };
  });
  return (time, reading) => {
    const count = Math.round(5 + 17 * reading);
    for (let index = 0; index < markers.length; index += 1) {
      const { marker, height, phase } = markers[index];
      marker.visible = index < count;
      marker.position.y = height + Math.sin(time * 1.8 + phase) * 0.065;
      marker.rotation.y = time * 0.75 + phase;
    }
  };
}

function habitatBoundary(model) {
  const boundary = new THREE.Group();
  const stakes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 0.24, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xc5e39b }),
    40,
  );
  const coordinates = [];
  const transform = new THREE.Object3D();
  for (let section = 0; section < 20; section += 1) {
    const x = THREE.MathUtils.lerp(-2.85, 2.85, section / 19);
    for (const z of [-1.72, 1.72]) {
      transform.position.set(x, terrainY(x, z) + 0.12, z);
      transform.updateMatrix();
      stakes.setMatrixAt(coordinates.length, transform.matrix);
      coordinates.push(transform.position.clone().add(new THREE.Vector3(0, 0.08, 0)));
    }
  }
  stakes.frustumCulled = false;
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(38 * 2 * 3), 3));
  const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: 0xc5e39b }));
  wire.frustumCulled = false;
  boundary.add(stakes, wire);
  model.add(boundary);
  return setting => {
    const segments = Math.round(setting * 19);
    stakes.count = segments ? (segments + 1) * 2 : 0;
    const positions = wireGeometry.getAttribute('position');
    let index = 0;
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < 2; side += 1) {
        const from = coordinates[segment * 2 + side];
        const to = coordinates[(segment + 1) * 2 + side];
        positions.setXYZ(index++, from.x, from.y, from.z);
        positions.setXYZ(index++, to.x, to.y, to.z);
      }
    }
    positions.needsUpdate = true;
    wireGeometry.setDrawRange(0, index);
  };
}

export function createWatershedScene(mission) {
  const model = new THREE.Group();
  model.position.y = 0.585;
  const conservation = mission.id === 'B19.2';
  const random = randomSequence(6154);
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(6.04, 0.19, 3.94),
    new THREE.MeshStandardMaterial({ color: 0x34334a, roughness: 0.86 }),
  );
  foundation.position.y = -0.49;
  const cutaway = new THREE.Mesh(earthSides(),
    new THREE.MeshStandardMaterial({ color: 0x684a3c, roughness: 0.91, side: THREE.DoubleSide }));
  const terrain = new THREE.Mesh(terrainGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true }));
  const waterMaterial = new THREE.MeshStandardMaterial({ color: waterClear, roughness: 0.26, metalness: 0.17, side: THREE.DoubleSide });
  model.add(foundation, cutaway, terrain, new THREE.Mesh(streamGeometry(), waterMaterial));

  const updateForest = forest(model, random);
  const updateFlow = flow(model, random, waterMaterial, conservation);
  const updateMarkers = conservation ? habitatMarkers(model, random) : null;
  const updateBoundary = conservation ? habitatBoundary(model) : null;
  updateForest(conservation ? 0.72 : 0.5);
  let previousSetting;

  return {
    model,
    update(time, setting, reading) {
      if (setting !== previousSetting) {
        if (conservation) updateBoundary(setting);
        else updateForest(setting);
        previousSetting = setting;
      }
      updateFlow(time, reading);
      updateMarkers?.(time, reading);
    },
  };
}
