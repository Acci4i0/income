// Valida i prodotti in products/<slug>/ secondo products/README.md e le regole Etsy.
// Uso: node scripts/etsy/validate.mjs [slug ...]   (exit 1 se c'è almeno un errore)
//
// Regole Etsy (reference createDraftListing, consultata il 6/10/2026:
// https://developers.etsy.com/documentation/reference#operation/createDraftListing):
// - title: max 140 caratteri; solo lettere, numeri, punteggiatura, simboli matematici, spazi, ™ © ®
//   (regex /[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/u); %, :, & e + al massimo una volta ciascuno;
//   non più di 3 parole tutte in maiuscolo (linee guida Etsy sui titoli).
// - tags: max 13, ciascuno max 20 caratteri (products/README.md: solo lettere, numeri e spazi).
// - price: minimo 0,20 USD; quantity: 1-999; file digitali: max 5, ciascuno max 20 MB.

import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AI_PHRASE_IT = "Progettato da NettoChiaro con l'aiuto di strumenti di intelligenza artificiale; formule verificate con test.";
export const AI_PHRASE_EN = 'Designed by NettoChiaro with the help of artificial intelligence tools; formulas verified with tests.';

const KNOWN_FIELDS = ['slug', 'language', 'title', 'short', 'description', 'tags', 'price', 'quantity', 'who_made',
  'when_made', 'is_supply', 'taxonomy_path', 'files', 'images', 'site_pages', 'publish'];
// Enum di when_made (createDraftListing). Il primo intervallo cambia ogni anno ("2020_2026" nel 2026):
// si accetta 2020_20xx.
const WHEN_MADE = new Set(['made_to_order', '2020_2026', '2010_2019', '2007_2009', 'before_2007', '2000_2006', '1990s', '1980s',
  '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', '1910s', '1900s', '1800s', '1700s', 'before_1700']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const OTHER_BRANDS = /\b(microsoft|apple|notion|canva|airtable|libreoffice|openoffice|etsy|chatgpt|openai)\b/i;
const EARNING_PROMISES = /(guadagn\w*\s+(garantit|sicur|facil|assicurat)\w*|guadagno passivo|reddito passivo|diventa(re)? ricc\w+|soldi facili|earn money|make money|passive income|get rich|guaranteed (income|profit|earnings))/i;

/** Dimensioni di un PNG o JPEG letti dall'intestazione, senza dipendenze. */
export function imageSize(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** Slug delle pagine del sito, letti da src/pages/*.mjs. */
export async function pageSlugs(root) {
  const dir = path.join(root, 'src/pages');
  if (!existsSync(dir)) return new Set();
  const slugs = new Set();
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.mjs')) continue;
    const m = (await readFile(path.join(dir, f), 'utf8')).match(/\bslug:\s*['"`]([^'"`]*)['"`]/);
    if (m) slugs.add(m[1]);
  }
  return slugs;
}

/** Cartelle prodotto in products/ (ignora file e cartelle che iniziano con "." o "_"). */
export async function listProducts(root) {
  const dir = path.join(root, 'products');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !/^[._]/.test(e.name))
    .map((e) => ({ slug: e.name, dir: path.join(dir, e.name) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const normQuotes = (s) => String(s).replace(/[’‘`´]/g, "'");

function checkTitle(title, errors, warnings) {
  if (!isStr(title)) { errors.push('title: obbligatorio'); return; }
  if (title !== title.trim()) errors.push('title: spazi iniziali o finali');
  if ([...title].length > 140) errors.push(`title: ${[...title].length} caratteri (max 140)`);
  const bad = [...new Set(title.match(/[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/gu) || [])];
  if (bad.length) errors.push(`title: caratteri non ammessi da Etsy: ${bad.map((c) => JSON.stringify(c)).join(' ')}`);
  for (const c of ['%', ':', '&', '+']) {
    const n = title.split(c).length - 1;
    if (n > 1) errors.push(`title: il carattere "${c}" compare ${n} volte (Etsy lo ammette una volta sola)`);
  }
  const letters = title.replace(/[^\p{L}]/gu, '');
  if (letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) errors.push('title: tutto in maiuscolo');
  const caps = title.split(/[^\p{L}\p{Nd}]+/u).filter((w) => {
    const l = w.replace(/[^\p{L}]/gu, '');
    return l.length >= 2 && l === l.toUpperCase() && l !== l.toLowerCase();
  });
  if (caps.length > 3) errors.push(`title: ${caps.length} parole tutte in maiuscolo (${caps.join(', ')}); Etsy ne ammette al massimo 3`);
  if (OTHER_BRANDS.test(title)) errors.push(`title: marchio di terzi "${title.match(OTHER_BRANDS)[0]}" (ammessi solo Excel e Google Sheets per la compatibilità)`);
  const words = title.split(/\s+/).filter(Boolean).length;
  if (words > 15) warnings.push(`title: ${words} parole, Etsy consiglia titoli brevi (meno di 15 parole)`);
}

function checkDescription(listing, errors, warnings) {
  const d = listing.description;
  if (!isStr(d)) { errors.push('description: obbligatoria'); return; }
  const text = normQuotes(d);
  if (listing.language === 'en') {
    const ok = /NettoChiaro[^.\n]*\b(artificial intelligence|AI)\b/i.test(text) || /\b(artificial intelligence|AI)\b[^.\n]*NettoChiaro/i.test(text);
    if (!ok) errors.push(`description: manca la frase di trasparenza sull'AI, per esempio "${AI_PHRASE_EN}"`);
  } else if (!text.includes(normQuotes(AI_PHRASE_IT))) {
    errors.push(`description: manca la frase di trasparenza sull'AI: "${AI_PHRASE_IT}"`);
  }
  // "consulenza fiscale" / "tax advice" sono ammesse solo in negativo ("non è consulenza fiscale").
  for (const m of text.matchAll(/consulenz[ae] fiscal[ei]|tax advice/gi)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    if (!/(?:^|[^\p{L}])(non|né|senza|not|no|nor|without)(?=[^\p{L}])[^.\n]*$/u.test(before)) errors.push(`description: non offrire "${m[0]}" (va bene solo in negativo, es. "non è consulenza fiscale")`);
  }
  const promise = text.match(EARNING_PROMISES);
  if (promise) errors.push(`description: promessa di guadagno non ammessa ("${promise[0]}")`);
  if (d.length < 300) warnings.push(`description: solo ${d.length} caratteri, poco per un'inserzione Etsy`);
}

function checkTags(tags, errors) {
  if (!Array.isArray(tags)) { errors.push('tags: deve essere un elenco di 13 tag'); return; }
  if (tags.length !== 13) errors.push(`tags: ${tags.length} tag (ne servono 13)`);
  const seen = new Set();
  tags.forEach((t, i) => {
    if (typeof t !== 'string' || !t.trim()) { errors.push(`tags[${i}]: vuoto`); return; }
    if (t !== t.trim() || /\s{2,}/.test(t)) errors.push(`tags[${i}] "${t}": spazi in eccesso`);
    if ([...t].length > 20) errors.push(`tags[${i}] "${t}": ${[...t].length} caratteri (max 20)`);
    if (!/^[\p{L}\p{Nd} ]+$/u.test(t)) errors.push(`tags[${i}] "${t}": solo lettere, numeri e spazi`);
    const k = t.trim().toLowerCase();
    if (seen.has(k)) errors.push(`tags[${i}] "${t}": duplicato`);
    seen.add(k);
  });
}

async function checkPaths(dir, list, field, { min, max, prefix, exts }, errors) {
  if (!Array.isArray(list)) { errors.push(`${field}: deve essere un elenco di percorsi`); return []; }
  if (list.length < min || list.length > max) errors.push(`${field}: ${list.length} elementi (da ${min} a ${max})`);
  const found = [];
  const names = new Set();
  for (const rel of list) {
    if (typeof rel !== 'string' || !rel.startsWith(prefix) || rel.includes('..') || path.isAbsolute(rel) || rel.includes('\\')) {
      errors.push(`${field}: percorso non valido ${JSON.stringify(rel)} (deve iniziare con "${prefix}")`);
      continue;
    }
    const base = path.posix.basename(rel).toLowerCase();
    if (names.has(base)) errors.push(`${field}: nome ripetuto ${base}`);
    names.add(base);
    if (exts && !exts.includes(path.extname(rel).toLowerCase())) errors.push(`${field}: ${rel} deve essere ${exts.join(' o ')}`);
    const full = path.join(dir, rel);
    let st;
    try { st = await lstat(full); } catch { errors.push(`${field}: file mancante ${rel}`); continue; }
    // Niente collegamenti simbolici: la sync carica su Etsy, in un'inserzione pubblica, il file a cui
    // puntano (per esempio .git/config, che in GitHub Actions contiene il token del workflow).
    if (st.isSymbolicLink()) { errors.push(`${field}: ${rel} è un collegamento simbolico (serve un file vero)`); continue; }
    if (!st.isFile()) { errors.push(`${field}: ${rel} non è un file`); continue; }
    const real = await realpath(full).catch(() => '');
    const root = await realpath(dir).catch(() => dir);
    if (!real.startsWith(`${root}${path.sep}`)) { errors.push(`${field}: ${rel} è fuori dalla cartella del prodotto`); continue; }
    if (st.size === 0) errors.push(`${field}: ${rel} è vuoto`);
    found.push({ rel, full, size: st.size });
  }
  return found;
}

/** Valida una cartella prodotto. Restituisce { slug, listing, errors, warnings }. */
export async function validateProduct(dir, { pages } = {}) {
  const slug = path.basename(dir);
  const errors = [];
  const warnings = [];
  let listing = null;
  const listingPath = path.join(dir, 'listing.json');
  if (!existsSync(listingPath)) {
    errors.push('manca listing.json');
    return { slug, dir, listing, errors, warnings };
  }
  try {
    listing = JSON.parse(await readFile(listingPath, 'utf8'));
  } catch (e) {
    errors.push(`listing.json non è JSON valido: ${e.message}`);
    return { slug, dir, listing, errors, warnings };
  }
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
    errors.push('listing.json deve contenere un oggetto');
    return { slug, dir, listing: null, errors, warnings };
  }

  for (const k of Object.keys(listing)) if (!KNOWN_FIELDS.includes(k)) warnings.push(`campo sconosciuto "${k}" (schema in products/README.md)`);
  for (const f of ['README.md', 'build.py']) if (!existsSync(path.join(dir, f))) errors.push(`manca ${f} nella cartella del prodotto`);

  if (listing.slug !== slug) errors.push(`slug "${listing.slug}" diverso dal nome della cartella "${slug}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push(`nome cartella "${slug}": solo minuscole, numeri e trattini`);
  if (!['it', 'en'].includes(listing.language)) errors.push(`language: "${listing.language}" (ammessi "it" ed "en")`);

  checkTitle(listing.title, errors, warnings);
  if (!isStr(listing.short)) errors.push('short: obbligatorio');
  else if ([...listing.short].length > 160) errors.push(`short: ${[...listing.short].length} caratteri (max 160)`);
  checkDescription(listing, errors, warnings);
  checkTags(listing.tags, errors);

  const { price, quantity } = listing;
  if (typeof price !== 'number' || !Number.isFinite(price)) errors.push('price: deve essere un numero (EUR)');
  else {
    if (!(price > 0.2)) errors.push(`price: ${price} (deve essere maggiore di 0,20)`);
    if (price > 50000) errors.push(`price: ${price} troppo alto`);
    if (Math.round(price * 100) !== Math.round(price * 1e6) / 1e4) errors.push(`price: ${price} ha più di 2 decimali`);
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.push(`quantity: ${quantity} (intero da 1 a 999)`);
  if (listing.who_made !== 'i_did') errors.push(`who_made: "${listing.who_made}" (serve "i_did", "Designed by seller")`);
  if (!(WHEN_MADE.has(listing.when_made) || /^2020_20\d\d$/.test(String(listing.when_made)))) errors.push(`when_made: "${listing.when_made}" non ammesso da Etsy (usa "made_to_order")`);
  if (typeof listing.is_supply !== 'boolean') errors.push('is_supply: deve essere true o false');
  else if (listing.is_supply) warnings.push('is_supply: true indica materiale per creare altri prodotti, non un prodotto finito');
  if (!Array.isArray(listing.taxonomy_path) || !listing.taxonomy_path.length || !listing.taxonomy_path.every(isStr)) {
    errors.push('taxonomy_path: elenco dei nomi della categoria Etsy, dalla radice alla foglia');
  }
  if (typeof listing.publish !== 'boolean') errors.push('publish: deve essere true o false');

  await checkPaths(dir, listing.files, 'files', { min: 1, max: 5, prefix: 'files/' }, errors).then((files) => {
    for (const f of files) if (f.size > MAX_FILE_BYTES) errors.push(`files: ${f.rel} pesa ${(f.size / 1048576).toFixed(1)} MB (max 20 MB)`);
  });

  const images = await checkPaths(dir, listing.images, 'images', { min: 5, max: 10, prefix: 'images/', exts: ['.png', '.jpg', '.jpeg'] }, errors);
  for (const img of images) {
    const size = imageSize(await readFile(img.full));
    if (!size) { errors.push(`images: ${img.rel} non è un PNG o JPEG leggibile`); continue; }
    const long = Math.max(size.width, size.height);
    if (long < 2000) errors.push(`images: ${img.rel} è ${size.width}×${size.height}, il lato lungo deve essere almeno 2000 px`);
    if (Math.abs(size.width / size.height - 4 / 3) > 0.01) errors.push(`images: ${img.rel} è ${size.width}×${size.height}, serve la proporzione 4:3`);
    // Etsy accetta file grandi, ma avvisa che le immagini oltre 1 MB possono non completare il caricamento.
    if (img.size > 1024 * 1024) warnings.push(`images: ${img.rel} pesa ${(img.size / 1048576).toFixed(1)} MB: oltre 1 MB il caricamento su Etsy può non riuscire, conviene comprimerla`);
  }

  const card = path.join(dir, 'images/card.jpg');
  if (!existsSync(card)) errors.push('manca images/card.jpg (1200×900, max 200 KB) per il sito');
  else if ((await lstat(card)).isSymbolicLink()) errors.push('images/card.jpg è un collegamento simbolico (serve un file vero)');
  else {
    const buf = await readFile(card);
    const size = imageSize(buf);
    if (!size || size.type !== 'jpeg') errors.push('images/card.jpg non è un JPEG');
    else if (size.width !== 1200 || size.height !== 900) errors.push(`images/card.jpg è ${size.width}×${size.height} (serve 1200×900)`);
    if (buf.length > 200 * 1024) errors.push(`images/card.jpg pesa ${Math.round(buf.length / 1024)} KB (max 200 KB)`);
  }

  if (!Array.isArray(listing.site_pages) || !listing.site_pages.every(isStr)) errors.push('site_pages: elenco di slug di pagine del sito');
  else if (pages) for (const p of listing.site_pages) if (!pages.has(p)) errors.push(`site_pages: la pagina "${p}" non esiste in src/pages`);

  return { slug, dir, listing, errors, warnings };
}

export async function validateAll(root, only = []) {
  const pages = await pageSlugs(root);
  const results = [];
  for (const p of await listProducts(root)) {
    if (only.length && !only.includes(p.slug)) continue;
    results.push(await validateProduct(p.dir, { pages }));
  }
  // La sync ritrova un'inserzione dal titolo se products/etsy-listings.json va perso: due prodotti con lo
  // stesso titolo finirebbero sulla stessa inserzione.
  const byTitle = new Map();
  for (const r of results) {
    if (!isStr(r.listing?.title)) continue;
    const k = r.listing.title.replace(/\s+/g, ' ').trim().toLowerCase();
    byTitle.set(k, [...(byTitle.get(k) || []), r]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    for (const r of group) r.errors.push(`title: uguale a quello di ${group.filter((x) => x !== r).map((x) => x.slug).join(', ')} (ogni prodotto deve avere un titolo diverso)`);
  }
  return results;
}

export function formatResult(r) {
  const lines = [`${r.errors.length ? '✗' : '✓'} ${r.slug}${r.errors.length ? ` — ${r.errors.length} errori` : ''}`];
  for (const e of r.errors) lines.push(`    errore: ${e}`);
  for (const w of r.warnings) lines.push(`    avviso: ${w}`);
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const results = await validateAll(root, process.argv.slice(2));
  if (!results.length) console.log('Nessun prodotto in products/.');
  for (const r of results) console.log(formatResult(r));
  const bad = results.filter((r) => r.errors.length);
  if (bad.length) {
    console.error(`\n${bad.length} prodotti non validi su ${results.length}.`);
    process.exit(1);
  }
  if (results.length) console.log(`\n${results.length} prodotti validi.`);
}
