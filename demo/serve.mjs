// Static file server for the side-by-side demo page. Zero dependencies, read-only.
//
// Run from the repo root:  node demo/serve.mjs   (then open the printed URL)
//
// Why a server at all: Chromium refuses to `import` a file:// ES module from a file:// page
// ("Not allowed to load local resource"), which is the same reason eval/harness.mjs serves
// the component over loopback. This file mirrors that loader — including the 1x1 placeholder
// PNG for image paths with no file on disk, so a case whose props say `image: "ok.jpg"` does
// not fail on a 404 the harness would never have shown it.
//
// It serves the repo read-only over 127.0.0.1 and never writes anything.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const OPEN = process.argv.includes('--open');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

// Same 1x1 transparent PNG eval/harness.mjs serves for absent image files.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64');

const server = createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); return res.end('bad request'); }

  if (urlPath === '/') urlPath = '/demo/index.html';
  else if (urlPath.endsWith('/')) urlPath += 'index.html';   // /demo/ -> /demo/index.html

  const abs = normalize(join(ROOT, urlPath));
  const ext = extname(abs).toLowerCase();

  // Path traversal guard — nothing outside the repo is reachable.
  if (!abs.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  if (existsSync(abs) && statSync(abs).isFile()) {
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    return res.end(readFileSync(abs));
  }
  if (IMG_EXT.has(ext)) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return res.end(PLACEHOLDER_PNG);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`port ${PORT} is busy — retry with:  PORT=4174 node demo/serve.mjs`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/demo/`;
  console.log(`edge-hardener demo  ->  ${url}`);
  console.log('serving the repo read-only; Ctrl-C to stop');
  if (OPEN) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    import('node:child_process').then(({ spawn }) => {
      spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
    });
  }
});
