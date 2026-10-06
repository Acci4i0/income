// Build statico: src/pages/*.mjs -> dist/. Nessuna dipendenza esterna.
// Fallisce (exit 1) se trova problemi SEO o link interni rotti: protegge i deploy automatici.
// Variabili d'ambiente per i test: PRODUCTS_DIR (cartella prodotti, default products/) e DIST_DIR
// (cartella di uscita, default dist/).

import { readFile, writeFile, mkdir, rm, readdir, cp, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPage, urlFor } from './src/layout.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(process.env.DIST_DIR || path.join(root, 'dist'));
const productsDir = path.resolve(process.env.PRODUCTS_DIR || path.join(root, 'products'));
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
// baseUrl: variabile d'ambiente > config > URL del deploy Cloudflare Pages > locale.
config.baseUrl = process.env.SITE_BASE_URL || config.baseUrl || process.env.CF_PAGES_URL || 'http://localhost:4321';

// dist/ viene cancellata: dentro il progetto può essere solo dist/, fuori non deve contenere il progetto.
// "fuori" = il percorso relativo risale (".." o "../x"); "..x" è una cartella interna.
const fuori = (da, a) => {
  const rel = path.relative(da, a);
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
};
const inRoot = !fuori(root, dist);
if (inRoot ? dist !== path.join(root, 'dist') : !fuori(dist, root)) {
  console.error(`DIST_DIR non valida: ${dist}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const shown = (file) => (path.relative(root, file).startsWith('..') ? file : path.relative(root, file));

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

// Prodotti digitali (products/README.md): products/<slug>/listing.json più lo stato su Etsy scritto dalla
// sincronizzazione in products/etsy-listings.json. Sul sito compare solo un prodotto in italiano, con
// "publish" non false, inserzione "active" e link Etsy valido. JSON malformato = errore di build;
// cartelle senza listing.json = ignorate.
async function readJson(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    errors.push(`${shown(file)}: JSON malformato (${e.message})`);
    return undefined;
  }
}

function etsyUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'etsy.com' || u.hostname.endsWith('.etsy.com')) ? u.href : null;
  } catch {
    return null;
  }
}

// Nome breve per il sito: il titolo Etsy fino al primo separatore (virgola, due punti, barra verticale o
// trattino tra spazi): dopo seguono le parole chiave.
function nomeBreve(title) {
  const head = title.split(/\s*[,:|]\s*|\s+[-–—]\s+/)[0].trim() || title.trim();
  return head.length <= 90 ? head : `${head.slice(0, 90).replace(/\s+\S*$/, '')}…`;
}

async function loadProducts() {
  let dirs = [];
  try {
    dirs = (await readdir(productsDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const listingsFile = path.join(productsDir, 'etsy-listings.json');
  let etsy = (await readJson(listingsFile)) ?? {};
  if (!etsy || typeof etsy !== 'object' || Array.isArray(etsy)) {
    errors.push(`${shown(listingsFile)}: atteso un oggetto { slug: { listing_id, url, state } }`);
    etsy = {};
  }

  const out = [];
  for (const dir of dirs) {
    const file = path.join(productsDir, dir, 'listing.json');
    const l = await readJson(file);
    if (l === undefined) continue;
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      warnings.push(`${shown(file)}: non è un oggetto JSON, prodotto ignorato`);
      continue;
    }
    const e = etsy[dir] && typeof etsy[dir] === 'object' ? etsy[dir] : {};
    const url = etsyUrl(e.url);
    if (e.state === 'active' && !url) warnings.push(`${dir}: inserzione attiva senza un link Etsy valido, non compare sul sito`);
    if (e.state !== 'active' || !url || l.publish === false || (l.language ?? 'it') !== 'it') continue;

    // Attivo su Etsy: i dati per il sito devono esserci, altrimenti la build si ferma.
    const problems = [];
    if (!/^[a-z0-9-]+$/.test(dir)) problems.push('nome della cartella non valido');
    if (l.slug !== dir) problems.push(`slug "${l.slug}" diverso dal nome della cartella`);
    for (const k of ['title', 'short']) if (typeof l[k] !== 'string' || !l[k].trim()) problems.push(`manca "${k}"`);
    if (typeof l.price !== 'number' || !(l.price > 0)) problems.push('"price" non valido');
    const sitePages = [];
    for (const s of Array.isArray(l.site_pages) ? l.site_pages : []) {
      const target = pages.find((p) => p.slug === s);
      if (!target) problems.push(`site_pages: la pagina "${s}" non esiste`);
      // /prodotti/ elenca già tutto; 404 e pagine tecniche (noindex) non sono pagine di contenuto.
      else if (target.noindex || s === 'prodotti') warnings.push(`${dir}: site_pages "${s}" ignorata (non è una pagina di contenuto)`);
      else sitePages.push(s);
    }
    const card = path.join(productsDir, dir, 'images/card.jpg');
    if (!existsSync(card)) problems.push('manca images/card.jpg');
    if (problems.length) {
      for (const p of problems) errors.push(`${shown(file)} (inserzione attiva su Etsy): ${p}`);
      continue;
    }
    out.push({
      slug: dir,
      name: nomeBreve(l.title),
      title: l.title,
      short: l.short,
      description: typeof l.description === 'string' ? l.description : '',
      price: l.price,
      url,
      sitePages,
      card,
    });
  }
  return out;
}

const products = await loadProducts();

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// Asset con hash per cache busting
await cp(path.join(root, 'src/assets'), path.join(dist, 'assets'), { recursive: true });
await cp(path.join(root, 'src/lib'), path.join(dist, 'assets/lib'), { recursive: true });
await cp(path.join(root, 'public'), dist, { recursive: true });
if (products.length) {
  await mkdir(path.join(dist, 'assets/products'), { recursive: true });
  for (const p of products) await copyFile(p.card, path.join(dist, 'assets/products', `${p.slug}.jpg`));
}

const hashes = {};
for (const file of await walk(path.join(dist, 'assets'))) {
  const rel = path.relative(path.join(dist, 'assets'), file).split(path.sep).join('/');
  hashes[rel] = createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 10);
}
const asset = (rel) => {
  if (!hashes[rel]) errors.push(`asset mancante: ${rel}`);
  return `/assets/${rel}?v=${hashes[rel]}`;
};
for (const p of products) p.image = asset(`products/${p.slug}.jpg`);

// Pagine che dipendono dai dati della build (es. /prodotti/): prepare() restituisce i campi da sovrascrivere.
for (const p of pages) {
  if (typeof p.prepare === 'function') Object.assign(p, p.prepare({ products, config }));
}

// Segnaposto nei testi: {{titolare}} e {{contatto}} vengono da site.config.json.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const segnaposto = {
  titolare: config.titolare ? esc(config.titolare) : 'il gestore del sito NettoChiaro',
  contatto: config.contactEmail
    ? `<a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>`
    : "l'indirizzo email del titolare, che verrà indicato qui prima della pubblicazione del sito",
};
for (const p of pages) {
  for (const k of ['content', 'intro']) {
    if (typeof p[k] === 'string') p[k] = p[k].replace(/\{\{(titolare|contatto)\}\}/g, (_, n) => segnaposto[n]);
  }
}

// Validazione
if ((config.indexable || config.monetization?.adsenseClient) && (!config.titolare || !config.contactEmail)) {
  errors.push('site.config.json: per pubblicare (indexable) o attivare AdSense servono "titolare" e "contactEmail" (informativa privacy, art. 13 GDPR)');
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

for (const p of pages) {
  const html = renderPage(p, { config, pages, asset, products });
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

for (const w of warnings) console.warn(`Avviso: ${w}`);
if (errors.length) {
  console.error(`Build fallita, ${errors.length} problemi:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const size = (await Promise.all((await walk(dist)).map((f) => stat(f).then((s) => s.size)))).reduce((a, b) => a + b, 0);
console.log(`OK: ${pages.length} pagine, ${Object.keys(hashes).length} asset, ${products.length} prodotti sul sito, ${(size / 1024).toFixed(0)} KB in ${shown(dist)}/ (indexable=${config.indexable})`);
