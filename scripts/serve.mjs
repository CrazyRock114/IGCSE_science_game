import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const built = process.argv.includes('--dist');
const qa = !built && process.argv.includes('--qa') && Number(process.env.PORT) === 4174;
const qaPaths = {
  '/__qa/objectives': 'scripts/objective-browser-check.html',
  '/__qa/objectives.js': 'scripts/objective-browser-check.js',
  '/__qa/round1': 'scripts/round1-browser-check.html',
  '/__qa/round1.js': 'scripts/round1-browser-check.js'
};
const root = built ? resolve(project, 'dist') : project;
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') path = '/index.html';
    if (qa && path === '/__qa/no-webgl') {
      const source = await readFile(resolve(root, 'index.html'), 'utf8');
      const html = source.replace('<head>', `<head><base href="/">
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
    const qaFile = qa && qaPaths[path];
    if (!qaFile && (!/^\/(?:index\.html|[\w-]+\.(?:js|css)|(?:assets|curriculum|vendor)\/[\w./-]+)$/.test(path) || path.includes('..'))) {
      res.writeHead(404).end('Not found');
      return;
    }
    let file = resolve(root, qaFile || '.' + path);
    if (!built && path.startsWith('/vendor/')) {
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
