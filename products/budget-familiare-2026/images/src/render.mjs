// Renderizza le immagini dell'inserzione: ogni NN-nome.html di questa cartella diventa images/NN-nome.png
// (2000x1500) e 01-cover.html diventa anche images/card.jpg (1200x900, max 200 KB) per il sito.
// Uso: python3 verifica.py (aggiorna dati.js) && node images/src/render.mjs
import { execSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' });

async function shot(file, scale, target, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 750 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(path.join(here, file)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 1000 || document.documentElement.scrollHeight > 750);
  await page.screenshot({ path: target, ...opts });
  await ctx.close();
  if (errors.length) throw new Error(`${file}: ${errors.join('; ')}`);
  if (overflow) console.warn(`attenzione: ${file} supera il canvas 1000x750`);
}

const pages = (await readdir(here)).filter((f) => /^\d\d-.+\.html$/.test(f)).sort();
for (const f of pages) {
  const target = path.join(out, f.replace(/\.html$/, '.png'));
  await shot(f, 2, target);
  console.log(`${path.relative(out, target)} (${Math.round((await stat(target)).size / 1024)} KB)`);
}
const card = path.join(out, 'card.jpg');
for (const quality of [82, 75, 68, 60]) {
  await shot('01-cover.html', 1.2, card, { type: 'jpeg', quality });
  const kb = (await stat(card)).size / 1024;
  if (kb <= 200) { console.log(`card.jpg (${Math.round(kb)} KB, qualità ${quality})`); break; }
}
await browser.close();
