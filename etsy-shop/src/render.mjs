// Rigenera le immagini del negozio: node etsy-shop/src/render.mjs
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href));
}
const b = await chromium.launch();
for (const [file, w, h, out] of [['icon.html', 500, 500, 'icon.png'], ['banner.html', 3360, 840, 'banner-grande.png'], ['banner-mini.html', 1200, 300, 'banner-mini.png']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(pathToFileURL(path.join(dir, file)).href, { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(dir, '..', out) });
  await p.close();
}
await b.close();
console.log('ok');
