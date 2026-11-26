import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor/addons/controls', { recursive: true });

const files = (await readdir('.')).filter(name => /.(js|css|html)$/.test(name));
await Promise.all([
  ...[...files, 'assets', 'curriculum'].map(name => cp(name, `dist/${name}`, { recursive: true })),
  ...['three.core.js', 'three.module.js'].map(name => cp(`node_modules/three/build/${name}`, `dist/vendor/${name}`)),
  cp('node_modules/three/examples/jsm/controls/OrbitControls.js', 'dist/vendor/addons/controls/OrbitControls.js'),
  cp('node_modules/three/LICENSE', 'dist/vendor/LICENSE-three.txt')
]);
console.log('Built FIELDWORK in dist/');
