// Prodotti Etsy sul sito: build.mjs con prodotti finti in una cartella temporanea (PRODUCTS_DIR) e uscita
// in un'altra cartella temporanea (DIST_DIR). Non tocca products/ né dist/ del repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { descrizioneHtml } from '../src/pages/prodotti.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const CARD = Buffer.from('finto jpeg per il test');
const URL_ETSY = 'https://www.etsy.com/listing/123/foglio-di-prova';

function listing(slug, overrides = {}) {
  return {
    slug,
    language: 'it',
    title: `Foglio di prova ${slug} Excel e Google Sheets, registro, riepilogo mensile`,
    short: `Frase breve del prodotto ${slug} per il sito.`,
    description: 'Descrizione di prova.\n\nCosa ricevi\n- un file .xlsx',
    price: 4.9,
    site_pages: ['calcolo-tasse-forfettario'],
    publish: true,
    ...overrides,
  };
}

/** Cartella temporanea con products/<slug>/ (listing.json + images/card.jpg) ed etsy-listings.json. */
async function makeProducts(products, etsy) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'nettochiaro-site-'));
  const dir = path.join(tmp, 'products');
  await mkdir(dir, { recursive: true });
  for (const [slug, data] of Object.entries(products)) {
    await mkdir(path.join(dir, slug, 'images'), { recursive: true });
    if (data === null) continue; // cartella senza listing.json
    const { senzaCard, ...json } = typeof data === 'string' ? {} : data;
    await writeFile(path.join(dir, slug, 'listing.json'), typeof data === 'string' ? data : JSON.stringify(json));
    if (!senzaCard) await writeFile(path.join(dir, slug, 'images/card.jpg'), CARD);
  }
  if (etsy !== undefined) await writeFile(path.join(dir, 'etsy-listings.json'), typeof etsy === 'string' ? etsy : JSON.stringify(etsy));
  return tmp;
}

function build(tmp) {
  const dist = path.join(tmp, 'dist');
  const r = spawnSync(process.execPath, [path.join(root, 'build.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PRODUCTS_DIR: path.join(tmp, 'products'), DIST_DIR: dist },
  });
  const page = (slug) => readFile(path.join(dist, slug, 'index.html'), 'utf8');
  return { ...r, dist, page };
}

const robotsNoindex = '<meta name="robots" content="noindex">';
const etsyLinks = (html) => [...html.matchAll(/<a [^>]*href="https:\/\/www\.etsy\.com[^"]*"[^>]*>/g)].map((m) => m[0]);

test('prodotto attivo: box nelle pagine di site_pages, immagine con hash, link nel footer e /prodotti/', async () => {
  const tmp = await makeProducts({
    'prova-attiva': listing('prova-attiva'),
    'prova-bozza': listing('prova-bozza', { site_pages: ['calcolo-fattura'] }),
    'prova-ritirata': listing('prova-ritirata', { publish: false, site_pages: ['calcolo-fattura'] }),
    'prova-en': listing('prova-en', { language: 'en', site_pages: [] }),
    'senza-listing': null,
  }, {
    'prova-attiva': { listing_id: 123, url: URL_ETSY, state: 'active' },
    'prova-bozza': { listing_id: 124, url: 'https://www.etsy.com/listing/124/bozza', state: 'draft' },
    'prova-ritirata': { listing_id: 125, url: 'https://www.etsy.com/listing/125/ritirata', state: 'active' },
    'prova-en': { listing_id: 126, url: 'https://www.etsy.com/listing/126/en', state: 'active' },
  });
  try {
    const r = build(tmp);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 prodotti sul sito/);

    const forf = await r.page('calcolo-tasse-forfettario');
    const box = forf.indexOf('<aside class="products"');
    assert.ok(box > forf.indexOf('<section class="tool"'), 'box sotto il calcolatore');
    assert.ok(box < forf.indexOf('<article class="prose">'), 'box prima dei contenuti');
    const offers = forf.indexOf('<aside class="offers"');
    if (offers !== -1) assert.ok(box < offers, 'box prima delle offerte partner');
    assert.ok(forf.includes('>Foglio di prova prova-attiva Excel e Google Sheets</h3>'), 'nome = titolo fino alla prima virgola');
    assert.ok(forf.includes('Frase breve del prodotto prova-attiva per il sito.'));
    assert.match(forf, /4,90\s€/);

    const links = etsyLinks(forf);
    assert.equal(links.length, 1);
    assert.ok(links[0].includes(`href="${URL_ETSY}"`));
    assert.ok(links[0].includes('rel="noopener"') && links[0].includes('target="_blank"'));
    assert.ok(!links[0].includes('sponsored'), 'prodotto del sito, non affiliazione');
    assert.ok(forf.includes('>Disponibile su Etsy</a>'));

    const img = forf.match(/src="\/assets\/products\/prova-attiva\.jpg\?v=([0-9a-f]{10})"/);
    assert.ok(img, 'immagine card con hash');
    assert.deepEqual(await readFile(path.join(r.dist, 'assets/products/prova-attiva.jpg')), CARD);
    assert.deepEqual(await readdir(path.join(r.dist, 'assets/products')), ['prova-attiva.jpg']);

    const fattura = await r.page('calcolo-fattura');
    assert.ok(!fattura.includes('class="products"'), 'bozza e publish:false non compaiono');
    for (const html of [forf, fattura, await readFile(path.join(r.dist, 'index.html'), 'utf8')]) {
      assert.ok(html.includes('<a href="/prodotti/">Fogli Excel</a>'), 'link nel footer');
    }

    const prodotti = await r.page('prodotti');
    assert.ok(prodotti.includes('Foglio di prova prova-attiva Excel e Google Sheets'));
    for (const s of ['prova-bozza', 'prova-ritirata', 'prova-en']) assert.ok(!prodotti.includes(s), `${s} non elencato`);
    assert.equal(prodotti.includes(robotsNoindex), !config.indexable);
    assert.ok(!prodotti.includes('saranno disponibili a breve'));
    assert.ok(prodotti.includes('<h3>Cosa ricevi</h3>'));
    assert.match(await readFile(path.join(r.dist, 'sitemap.xml'), 'utf8'), /\/prodotti\/<\/loc>/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('nessun prodotto attivo: niente box né link, /prodotti/ noindex e fuori sitemap', async () => {
  const tmp = await makeProducts({
    'prova-bozza': listing('prova-bozza'),
    'prova-link-strano': listing('prova-link-strano'),
    'prova-senza-stato': listing('prova-senza-stato'),
  }, {
    'prova-bozza': { listing_id: 1, url: URL_ETSY, state: 'draft' },
    'prova-link-strano': { listing_id: 2, url: 'https://example.com/listing/2', state: 'active' },
  });
  try {
    const r = build(tmp);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /prova-link-strano: inserzione attiva senza un link Etsy valido/);
    const dirs = (await readdir(r.dist, { withFileTypes: true })).filter((d) => d.isDirectory() && d.name !== 'assets');
    for (const d of dirs) {
      const html = await r.page(d.name);
      assert.ok(!html.includes('class="products"'), `${d.name}: nessun box`);
      assert.ok(!html.includes('href="/prodotti/"'), `${d.name}: nessun link a /prodotti/`);
      assert.equal(etsyLinks(html).length, 0, `${d.name}: nessun link Etsy`);
    }
    const prodotti = await r.page('prodotti');
    assert.ok(prodotti.includes(robotsNoindex));
    assert.ok(prodotti.includes('I fogli di calcolo saranno disponibili a breve.'));
    assert.ok(!(await readFile(path.join(r.dist, 'sitemap.xml'), 'utf8')).includes('/prodotti/'));
    await assert.rejects(readdir(path.join(r.dist, 'assets/products')));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('nome breve al primo separatore; site_pages verso pagine non di contenuto ignorate', async () => {
  const tmp = await makeProducts({
    'prova-due-punti': listing('prova-due-punti', {
      title: 'Gestionale di prova 2026 Excel e Google Sheets: registro, riepilogo',
      site_pages: ['calcolo-fattura', 'prodotti', '404'],
    }),
  }, { 'prova-due-punti': { listing_id: 7, url: URL_ETSY, state: 'active' } });
  try {
    const r = build(tmp);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /site_pages "prodotti" ignorata/);
    assert.match(r.stderr, /site_pages "404" ignorata/);
    const fattura = await r.page('calcolo-fattura');
    assert.ok(fattura.includes('>Gestionale di prova 2026 Excel e Google Sheets</h3>'), 'nome fino ai due punti');
    const prodotti = await r.page('prodotti');
    assert.ok(!prodotti.includes('class="products"'), 'niente box duplicato in /prodotti/');
    assert.equal(etsyLinks(prodotti).length, 1, 'un solo link per prodotto in /prodotti/');
    assert.match(prodotti, /<img class="product-img"[^>]*loading="eager"/, 'prima immagine senza lazy loading');
    assert.ok(!(await readFile(path.join(r.dist, '404.html'), 'utf8')).includes('class="products"'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('DIST_DIR dentro il progetto diversa da dist/ viene rifiutata', async () => {
  const tmp = await makeProducts({});
  const vietata = path.join(root, `..dist-prova-${process.pid}`); // cartella interna che inizia con ".."
  try {
    const r = spawnSync(process.execPath, [path.join(root, 'build.mjs')], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PRODUCTS_DIR: path.join(tmp, 'products'), DIST_DIR: vietata },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /DIST_DIR non valida/);
    await assert.rejects(readdir(vietata), 'la cartella non viene creata');
  } finally {
    await rm(vietata, { recursive: true, force: true });
    await rm(tmp, { recursive: true, force: true });
  }
});

test('JSON malformato e prodotto attivo incompleto fermano la build', async () => {
  const casi = [
    [{ 'prova-rotta': '{ "slug": "prova-rotta", ' }, undefined, /prova-rotta\/listing\.json: JSON malformato/],
    [{ 'prova-ok': listing('prova-ok') }, '{ non json', /etsy-listings\.json: JSON malformato/],
    [{ 'prova-ok': { ...listing('prova-ok'), senzaCard: true } }, { 'prova-ok': { listing_id: 1, url: URL_ETSY, state: 'active' } }, /manca images\/card\.jpg/],
    [{ 'prova-ok': listing('prova-ok', { site_pages: ['pagina-inesistente'] }) }, { 'prova-ok': { listing_id: 1, url: URL_ETSY, state: 'active' } }, /la pagina "pagina-inesistente" non esiste/],
  ];
  for (const [products, etsy, atteso] of casi) {
    const tmp = await makeProducts(products, etsy);
    try {
      const r = build(tmp);
      assert.equal(r.status, 1, `atteso errore ${atteso}`);
      assert.match(r.stderr, atteso);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
});

test('descrizioneHtml: sottotitoli, elenchi ed escape', () => {
  const html = descrizioneHtml('Intro <b>.\n\nCosa ricevi\n- uno\n• due\nNota finale.\n\nI fogli\n1. primo\n2) secondo');
  assert.equal(html, [
    '<p>Intro &lt;b&gt;.</p>',
    '<h3>Cosa ricevi</h3>',
    '<ul><li>uno</li><li>due</li></ul>',
    '<p>Nota finale.</p>',
    '<h3>I fogli</h3>',
    '<ol><li>primo</li><li>secondo</li></ol>',
  ].join('\n'));
  assert.equal(descrizioneHtml(''), '');
});
