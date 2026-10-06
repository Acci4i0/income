// Renders the listing images: every NN-name.html in this folder becomes images/NN-name.png (2000x1500),
// and 01-cover.html also becomes images/card.jpg (1200x900, max 200 KB) for the site.
// Usage (from the product folder): python3 verify.py (updates data.js) && node images/src/render.mjs
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
  // anything wider than the canvas or cut at the bottom edge is a layout bug
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > 1001 || r.bottom > 751) && !el.closest('[data-clip]')) bad.push(el.className || el.tagName);
    }
    return bad.slice(0, 5);
  });
  await page.screenshot({ path: target, ...opts });
  await ctx.close();
  if (errors.length) throw new Error(`${file}: ${errors.join('; ')}`);
  if (overflow.length) console.warn(`warning: ${file} has elements outside the 1000x750 canvas: ${overflow.join(', ')}`);
}

const pages = (await readdir(here)).filter((f) => /^\d\d-.+\.html$/.test(f)).sort();
for (const f of pages) {
  const target = path.join(out, f.replace(/\.html$/, '.png'));
  await shot(f, 2, target);
  console.log(`${path.relative(out, target)} (${Math.round((await stat(target)).size / 1024)} KB)`);
}
const card = path.join(out, 'card.jpg');
for (const quality of [82, 75, 68, 60, 50]) {
  await shot('01-cover.html', 1.2, card, { type: 'jpeg', quality });
  const kb = (await stat(card)).size / 1024;
  if (kb <= 200) { console.log(`card.jpg (${Math.round(kb)} KB, quality ${quality})`); break; }
}
await browser.close();
