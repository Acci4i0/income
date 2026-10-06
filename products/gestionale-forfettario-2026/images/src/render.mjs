// Fotografa ogni pagina images/src/NN-*.html in images/NN-*.png (2000×1500).
// Uso: node images/src/render.mjs  (di solito lo lancia genera.py, dopo aver scritto dati.js)
import { execSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(src, '..');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 2000, height: 1500 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const pages = (await readdir(src)).filter((f) => /^\d\d-.+\.html$/.test(f)).sort();
for (const file of pages) {
  await page.goto(pathToFileURL(path.join(src, file)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.canvas, .window .body')]
    .map((el) => el.scrollHeight - el.clientHeight)));
  if (overflow > 0) errors.push(`${file}: il contenuto esce dal riquadro di ${overflow}px`);
  const name = file.replace(/\.html$/, '.png');
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: 2000, height: 1500 } });
  console.log(`images/${name}`);
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
