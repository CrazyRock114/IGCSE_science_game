import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createReadStream, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const built = process.argv.includes('--dist');
const qa = !built && process.argv.includes('--qa') && Number(process.env.PORT) === 4174;
const qaPaths = {
  '/__qa/objectives': 'scripts/objective-browser-check.html',
  '/__qa/objectives.js': 'scripts/objective-browser-check.js',
  '/__qa/round1': 'scripts/round1-browser-check.html',
  '/__qa/round1.js': 'scripts/round1-browser-check.js',
  '/__qa/round2': 'scripts/round2-browser-check.html',
  '/__qa/round2.js': 'scripts/round2-browser-check.js',
  '/__qa/round3': 'scripts/round3-browser-check.html',
  '/__qa/round3.js': 'scripts/round3-browser-check.js'
};
const root = built ? resolve(project, 'dist') : project;
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8'
};

let legacyBuild;
function legacyBuildRoot() {
  if (legacyBuild) return legacyBuild;
  const source = mkdtempSync(resolve(tmpdir(), 'fieldwork-c921a82-'));
  try {
    const archive = execFileSync('git', ['archive', 'c921a82281e00897d60f51082b8f2159ccb8f0f4'], { cwd: project, maxBuffer: 32 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', source], { input: archive });
    if (!readFileSync(resolve(source, 'package-lock.json')).equals(readFileSync(resolve(project, 'package-lock.json')))) {
      throw new Error('The mixed-build fixture needs the dependencies from c921a82.');
    }
    symlinkSync(resolve(project, 'node_modules'), resolve(source, 'node_modules'), 'dir');
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: source });
    process.once('exit', () => rmSync(source, { recursive: true, force: true }));
    legacyBuild = resolve(source, 'dist');
    return legacyBuild;
  } catch (error) {
    rmSync(source, { recursive: true, force: true });
    console.error('Could not build the c921a82 QA fixture:', error.message);
    throw error;
  }
}

createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const qaBuild = qa && path.match(/^\/__qa\/builds\/(c921a82|candidate)(\/.*)$/);
    if (qaBuild) path = qaBuild[2];
    if (path === '/') path = '/index.html';
    if (qa && path === '/__qa/no-webgl') {
      const source = await readFile(resolve(root, 'index.html'), 'utf8');
      const html = source.replaceAll('"assets/', '"/assets/')
        .replace('href="style.css"', 'href="/style.css"')
        .replace('src="app.js"', 'src="/app.js"')
        .replaceAll('"./vendor/', '"/vendor/')
        .replace('<head>', `<head>
        <script>
          const getCanvasContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
            if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) return null;
            return getCanvasContext.call(this, kind, ...options);
          };
        </script>`);
      res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }
    const qaFile = qa && !qaBuild && qaPaths[path];
    if (!qaFile && (!/^\/(?:index\.html|[\w-]+\.(?:js|css)|(?:assets|curriculum|vendor)\/[\w./-]+)$/.test(path) || path.includes('..'))) {
      res.writeHead(404).end('Not found');
      return;
    }
    const fileRoot = !qaBuild ? root : qaBuild[1] === 'c921a82' ? legacyBuildRoot() : resolve(project, 'dist');
    let file = resolve(fileRoot, qaFile || '.' + path);
    if (!built && !qaBuild && path.startsWith('/vendor/')) {
      const three = resolve(project, 'node_modules/three');
      file = path.startsWith('/vendor/addons/')
        ? resolve(three, 'examples/jsm', path.slice('/vendor/addons/'.length))
        : resolve(three, 'build', path.slice('/vendor/'.length));
      if (!file.startsWith(three + sep)) throw new Error('Invalid path');
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Invalid file');
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': info.size, 'Cache-Control': built ? 'public, max-age=60' : 'no-store'
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`FIELDWORK ready at http://127.0.0.1:${port}`));
