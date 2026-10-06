// Build statico: src/pages/*.mjs -> dist/. Nessuna dipendenza esterna.
// Fallisce (exit 1) se trova problemi SEO o link interni rotti: protegge i deploy automatici.

import { readFile, writeFile, mkdir, rm, readdir, cp, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPage, urlFor } from './src/layout.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
// baseUrl: variabile d'ambiente > config > URL del deploy Cloudflare Pages > locale.
config.baseUrl = process.env.SITE_BASE_URL || config.baseUrl || process.env.CF_PAGES_URL || 'http://localhost:4321';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

// Pagine
const pageFiles = (await readdir(path.join(root, 'src/pages'))).filter((f) => f.endsWith('.mjs')).sort();
const pages = [];
for (const file of pageFiles) {
  const mod = await import(pathToFileURL(path.join(root, 'src/pages', file)).href);
  pages.push({ ...mod.default, file });
}
pages.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

// Segnaposto nei testi: {{titolare}} e {{contatto}} vengono da site.config.json.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const segnaposto = {
  titolare: config.titolare ? esc(config.titolare) : 'il gestore del sito NettoChiaro',
  contatto: config.contactEmail
    ? `<a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>`
    : 'il link di segnalazione in fondo alla pagina',
};
for (const p of pages) {
  for (const k of ['content', 'intro']) {
    if (typeof p[k] === 'string') p[k] = p[k].replace(/\{\{(titolare|contatto)\}\}/g, (_, n) => segnaposto[n]);
  }
}

// Validazione
const errors = [];
if (config.monetization?.adsenseClient && (!config.titolare || !config.contactEmail)) {
  errors.push('site.config.json: con AdSense attivo servono "titolare" e "contactEmail" (informativa privacy, art. 13 GDPR)');
}
const slugs = new Set();
for (const p of pages) {
  const where = p.file;
  if (slugs.has(p.slug)) errors.push(`${where}: slug duplicato "${p.slug}"`);
  slugs.add(p.slug);
  if (p.slug && !/^[a-z0-9-]+$/.test(p.slug)) errors.push(`${where}: slug non valido "${p.slug}"`);
  for (const k of ['title', 'description', 'h1', 'content']) if (!p[k]) errors.push(`${where}: manca "${k}"`);
  const fullTitle = p.slug ? `${p.title} | ${config.name}` : p.title;
  if (fullTitle.length > 70) errors.push(`${where}: title troppo lungo (${fullTitle.length} > 70)`);
  if (p.description && (p.description.length < 70 || p.description.length > 160)) errors.push(`${where}: description di ${p.description.length} caratteri (70-160)`);
  if (p.kind === 'tool') {
    for (const k of ['navLabel', 'tool', 'script', 'updated', 'intro']) if (!p[k]) errors.push(`${where}: tool senza "${k}"`);
    if (!p.faq?.length) errors.push(`${where}: tool senza FAQ`);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// Asset con hash per cache busting
await cp(path.join(root, 'src/assets'), path.join(dist, 'assets'), { recursive: true });
await cp(path.join(root, 'src/lib'), path.join(dist, 'assets/lib'), { recursive: true });
await cp(path.join(root, 'public'), dist, { recursive: true });

const hashes = {};
for (const file of await walk(path.join(dist, 'assets'))) {
  const rel = path.relative(path.join(dist, 'assets'), file).split(path.sep).join('/');
  hashes[rel] = createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 10);
}
const asset = (rel) => {
  if (!hashes[rel]) errors.push(`asset mancante: ${rel}`);
  return `/assets/${rel}?v=${hashes[rel]}`;
};

for (const p of pages) {
  const html = renderPage(p, { config, pages, asset });
  const out = p.slug === '404' ? path.join(dist, '404.html') : path.join(dist, p.slug, 'index.html');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);

  // Link interni: ogni href="/x/" deve esistere
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
    if (href.startsWith('/assets/') || href === '/favicon.svg') continue;
    const slug = href.replace(/^\/|\/$/g, '');
    if (!slugs.has(slug)) errors.push(`${p.file}: link interno rotto ${href}`);
  }
}

// sitemap, robots, ads.txt
const indexable = pages.filter((p) => p.slug !== '404' && !p.noindex);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((p) => `  <url><loc>${urlFor(config, p.slug)}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
await writeFile(path.join(dist, 'sitemap.xml'), sitemap);
await writeFile(path.join(dist, 'robots.txt'), config.indexable
  ? `User-agent: *\nAllow: /\n\nSitemap: ${urlFor(config, '')}sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n');
const pub = config.monetization?.adsenseClient?.replace(/^ca-/, '');
if (pub) await writeFile(path.join(dist, 'ads.txt'), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);

if (errors.length) {
  console.error(`Build fallita, ${errors.length} problemi:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const size = (await Promise.all((await walk(dist)).map((f) => stat(f).then((s) => s.size)))).reduce((a, b) => a + b, 0);
console.log(`OK: ${pages.length} pagine, ${Object.keys(hashes).length} asset, ${(size / 1024).toFixed(0)} KB in dist/ (indexable=${config.indexable})`);
