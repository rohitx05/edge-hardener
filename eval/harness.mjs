// Oracle. Primary metric = survival rate over (case × viewport).
// Survival requires ALL THREE: no crash, no overflow, content still present & reachable.
// The third check is the anti-gaming heart of the project — do not weaken it.
//
// Run:  node eval/harness.mjs --component corpus/restaurant-card.mjs --cases results/cases.json
// Deps: npm i -D playwright  (then: npx playwright install chromium)

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname } from 'node:path';

const VIEWPORTS = [
  // 320 is the real floor for the stacked cases — it is where a text column that forgot
  // min-width:0 stops shrinking and starts spilling.
  { name: 'mobile-sm', width: 320, height: 568 },
  { name: 'mobile', width: 360, height: 640 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const arg = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };

const componentPath = arg('--component');
const casesPath = arg('--cases');
const cases = JSON.parse(readFileSync(casesPath, 'utf8')); // [{ id, props, mustContain: [strings] }]

// Test page: imports the component's render(props) -> HTMLElement into a fixed-width host.
const pageHtml = (compUrl) => `<!doctype html><html><head><meta charset="utf-8">
<style>#host{width:var(--w);border:1px solid #ccc;box-sizing:border-box}*{margin:0}</style>
</head><body><div id="host"></div>
<script type="module">
  import { render } from '${compUrl}';
  window.__mount = (props) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    host.appendChild(render(props));
  };
</script></body></html>`;

// Chromium refuses to import a file:// module from a setContent page ("Not allowed to load
// local resource"), which left window.__mount undefined and scored every case as a crash.
// The component is served over loopback instead. Loader detail only — the three checks below
// are unchanged.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json',
  '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
};
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
// 1x1 transparent PNG, served for image paths with no file on disk. A case that supplies a
// VALID image (e.g. 'ok.jpg') must not fail on a 404 console error — `image: null` is the
// adversarial case here, not a broken URL.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64');

const compUrlPath = '/' + String(componentPath).replace(/\\/g, '/').replace(/^\.?\//, '');

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/__host') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(pageHtml(compUrlPath));
  }
  const abs = normalize(join(ROOT, urlPath));
  const ext = extname(abs).toLowerCase();
  if (abs.startsWith(ROOT) && existsSync(abs)) {
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    return res.end(readFileSync(abs));
  }
  if (IMG_EXT.has(ext)) {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(PLACEHOLDER_PNG);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// Registered once on the page (below) and reset per (case × viewport); registering inside
// scoreOne leaked a listener pair per call.
let errors = [];

async function scoreOne(page, kase, vp) {
  errors = [];

  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.evaluate((w) => document.getElementById('host').style.setProperty('--w', w + 'px'),
    Math.min(vp.width, 420));

  // (1) CRASH: does it render at all?
  try { await page.evaluate((p) => window.__mount(p), kase.props); }
  catch (e) { return { pass: false, reason: 'crash', detail: String(e) }; }
  // Let this render's own image requests settle. Without this a broken-image 404 resolves
  // after scoreOne returns and is charged to the NEXT case — a flaky phantom failure.
  await page.evaluate(() => Promise.all(
    [...document.querySelectorAll('#host img')].map((im) => im.complete ? null
      : new Promise((r) => { im.onload = im.onerror = r; }))));
  if (errors.length) return { pass: false, reason: 'console-error', detail: errors[0] };

  // (2) OVERFLOW: does any node spill its container?
  const overflow = await page.evaluate(() => {
    const host = document.getElementById('host');
    const hb = host.getBoundingClientRect();
    return [...host.querySelectorAll('*')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.right > hb.right + 1 || el.scrollWidth > el.clientWidth + 1;
    });
  });
  if (overflow) return { pass: false, reason: 'overflow' };

  // (3) CONTENT PRESENCE — the anti-gaming check.
  // Every mustContain string has to be (a) in the accessible text and (b) not hidden
  // and (c) if visually truncated, the FULL value must be exposed via title/aria-label.
  const missing = await page.evaluate((must) => {
    const bad = [];
    for (const s of must) {
      if (!s) continue;
      const el = [...document.querySelectorAll('*')].find((n) => {
        const full = (n.getAttribute?.('title') || n.getAttribute?.('aria-label') || n.textContent || '');
        return full.includes(s);
      });
      if (!el) { bad.push({ s, why: 'absent' }); continue; }
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')
        bad.push({ s, why: 'hidden' });
    }
    return bad;
  }, kase.mustContain || []);
  if (missing.length) return { pass: false, reason: 'content-lost', detail: missing };

  return { pass: true };
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${origin}/__host`, { waitUntil: 'load' });

let pass = 0, total = 0; const fails = [];
for (const kase of cases) for (const vp of VIEWPORTS) {
  const r = await scoreOne(page, kase, vp);
  total++; if (r.pass) pass++; else fails.push({ case: kase.id, viewport: vp.name, ...r });
}
await browser.close();
server.close();

const rate = ((pass / total) * 100).toFixed(1);
console.log(JSON.stringify({ survival_rate: `${rate}%`, pass, total, fails }, null, 2));
