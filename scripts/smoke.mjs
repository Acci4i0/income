// Test end-to-end nel browser: ogni calcolatore si carica senza errori JS, mostra un risultato
// e non ha scroll orizzontale su mobile. Uso: node build.mjs && node scripts/smoke.mjs [cartella-screenshot]
import { spawn, execSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2];

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const { chromium } = await loadPlaywright();
const port = 4399;
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));

const slugs = [''];
for (const entry of await readdir(path.join(root, 'dist'), { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== 'assets') slugs.push(entry.name);
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' });
const failures = [];
for (const viewport of [{ width: 1280, height: 900, name: 'desktop' }, { width: 375, height: 800, name: 'mobile' }]) {
  const page = await browser.newPage({ viewport });
  for (const slug of slugs) {
    const errors = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const resp = await page.goto(`http://localhost:${port}/${slug ? `${slug}/` : ''}`, { waitUntil: 'networkidle' });
    if (resp.status() !== 200) failures.push(`${viewport.name} /${slug}: HTTP ${resp.status()}`);
    const hasCalc = await page.$('#calc');
    if (hasCalc) {
      const kpi = await page.textContent('.kpi.main strong');
      if (!kpi || kpi.trim() === '–' || !/\d/.test(kpi)) failures.push(`${viewport.name} /${slug}: risultato non calcolato ("${kpi}")`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) failures.push(`${viewport.name} /${slug}: scroll orizzontale di ${overflow}px`);
    for (const e of errors) failures.push(`${viewport.name} /${slug}: errore JS: ${e}`);
    if (shots) await page.screenshot({ path: path.join(shots, `${viewport.name}-${slug || 'home'}.png`), fullPage: true });
  }
  await page.close();
}
await browser.close();
server.kill();

if (failures.length) {
  console.error(`Smoke test fallito:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Smoke test OK: ${slugs.length} pagine x 2 viewport`);
