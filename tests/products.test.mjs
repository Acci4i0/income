// Valida tutti i prodotti in products/ (schema in products/README.md, regole Etsy) e verifica il validatore
// su prodotti finti. Passa anche se products/ non contiene prodotti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, readFile, symlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll, validateProduct, listProducts, pageSlugs, imageSize, formatResult } from '../scripts/etsy/validate.mjs';
import { makeRoot, writeProduct, png, jpeg } from '../scripts/etsy/testkit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- Prodotti reali del repository -------------------------------------------------------------------

const results = await validateAll(root);

test(`products/: ${results.length} prodotti trovati`, () => {
  assert.ok(Array.isArray(results));
});

for (const r of results) {
  test(`prodotto ${r.slug} valido`, () => {
    assert.equal(r.errors.length, 0, `\n${formatResult(r)}\n(dettagli: node scripts/etsy/validate.mjs ${r.slug})`);
  });
}

test('products/etsy-listings.json, se presente, ha la forma attesa', async () => {
  let data;
  try { data = JSON.parse(await readFile(path.join(root, 'products/etsy-listings.json'), 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const [slug, e] of Object.entries(data)) {
    assert.ok(Number.isInteger(e.listing_id), `${slug}: listing_id`);
    assert.ok(typeof e.state === 'string', `${slug}: state`);
  }
});

// --- Validatore su prodotti finti ------------------------------------------------------------------

async function check(overrides, setup) {
  const tmp = await makeRoot();
  const { dir } = await writeProduct(tmp, 'prova-2026', overrides);
  if (setup) await setup(dir);
  const r = await validateProduct(dir, { pages: await pageSlugs(tmp) });
  await rm(tmp, { recursive: true, force: true });
  return r;
}
const hasError = (r, re) => r.errors.some((e) => re.test(e));

test('validatore: un prodotto completo è valido', async () => {
  const r = await check({});
  assert.deepEqual(r.errors, []);
});

test('validatore: products/ vuota o assente non è un errore', async () => {
  const tmp = await makeRoot();
  assert.deepEqual(await validateAll(tmp), []);
  await rm(path.join(tmp, 'products'), { recursive: true });
  assert.deepEqual(await listProducts(tmp), []);
  await rm(tmp, { recursive: true, force: true });
});

test('validatore: titolo', async () => {
  assert.ok(hasError(await check({ title: 'x'.repeat(141) }), /141 caratteri/));
  assert.ok(hasError(await check({ title: 'FOGLIO EXCEL PER FORFETTARI 2026' }), /tutto in maiuscolo/));
  assert.ok(hasError(await check({ title: 'Foglio IVA INPS IRPEF TARI per forfettari' }), /4 parole tutte in maiuscolo/));
  assert.ok(hasError(await check({ title: 'Foglio 50% sconto, 100% utile' }), /"%" compare 2 volte/));
  assert.ok(hasError(await check({ title: 'Foglio da 5$ per forfettari' }), /caratteri non ammessi/));
  assert.ok(hasError(await check({ title: 'Foglio Microsoft Excel per forfettari' }), /marchio di terzi/));
  assert.deepEqual((await check({ title: 'Gestionale Partita IVA 2026 Excel e Google Sheets, calcolo INPS e scadenze F24' })).errors, []);
});

test('validatore: tag', async () => {
  const tags = (t) => ({ tags: t });
  const base = (await check({})).listing.tags;
  assert.ok(hasError(await check(tags(base.slice(0, 12))), /12 tag/));
  assert.ok(hasError(await check(tags([...base.slice(0, 12), 'tag molto molto lungo'])), /21 caratteri/));
  assert.ok(hasError(await check(tags([...base.slice(0, 12), 'f24/iva'])), /solo lettere, numeri e spazi/));
  assert.ok(hasError(await check(tags([...base.slice(0, 12), base[0].toUpperCase()])), /duplicato/));
});

test('validatore: descrizione, trasparenza AI e promesse', async () => {
  assert.ok(hasError(await check({ description: 'Un foglio di calcolo.' }), /trasparenza sull'AI/));
  const ok = (await check({})).listing.description;
  assert.ok(hasError(await check({ description: `${ok}\nOffriamo consulenza fiscale personalizzata.` }), /consulenza fiscale/));
  assert.ok(hasError(await check({ description: `${ok}\nCon questo foglio il guadagno garantito è assicurato.` }), /promessa di guadagno/));
  // Apostrofo tipografico accettato.
  assert.deepEqual((await check({ description: ok.replace("l'aiuto", 'l’aiuto') })).errors, []);
  // Prodotto in inglese: frase di trasparenza in inglese.
  const en = await check({ language: 'en', description: 'A spreadsheet.\n\nDesigned by NettoChiaro with the help of AI tools; formulas verified with tests.' });
  assert.ok(!hasError(en, /trasparenza/), en.errors.join('\n'));
  assert.ok(hasError(await check({ language: 'en', description: 'We provide tax advice.\nDesigned by NettoChiaro with the help of AI tools.' }), /tax advice/));
  assert.ok(!hasError(await check({ language: 'en', description: 'This is not tax advice.\nDesigned by NettoChiaro with the help of AI tools.' }), /tax advice/));
});

test('validatore: prezzo, quantità e attributi Etsy', async () => {
  assert.ok(hasError(await check({ price: 0.2 }), /maggiore di 0,20/));
  assert.ok(hasError(await check({ price: '9.90' }), /numero/));
  assert.ok(hasError(await check({ price: 9.999 }), /2 decimali/));
  assert.ok(hasError(await check({ quantity: 1000 }), /quantity/));
  assert.ok(hasError(await check({ who_made: 'someone_else' }), /i_did/));
  assert.ok(hasError(await check({ when_made: 'ieri' }), /when_made/));
  assert.ok(hasError(await check({ when_made: '2030_2040' }), /when_made/));
  assert.ok(!hasError(await check({ when_made: '2020_2026' }), /when_made/));
  assert.ok(hasError(await check({ taxonomy_path: [] }), /taxonomy_path/));
  assert.ok(hasError(await check({ publish: 'si' }), /publish/));
  assert.ok(hasError(await check({ slug: 'altro' }), /diverso dal nome della cartella/));
  assert.ok(hasError(await check({ site_pages: ['pagina-inesistente'] }), /non esiste/));
});

test('validatore: file e immagini', async () => {
  assert.ok(hasError(await check({ files: [] }), /files: 0 elementi/));
  assert.ok(hasError(await check({ files: ['files/a.xlsx', 'files/b.xlsx', 'files/c.xlsx', 'files/d.xlsx', 'files/e.xlsx', 'files/f.xlsx'] }), /files: 6 elementi/));
  assert.ok(hasError(await check({ files: ['../segreto.txt'] }), /percorso non valido/));
  assert.ok(hasError(await check({}, (dir) => rm(path.join(dir, 'files/prova.xlsx'))), /file mancante files\/prova.xlsx/));
  assert.ok(hasError(await check({ images: ['images/01-cover.png', 'images/02.png'] }), /images: 2 elementi/));
  assert.ok(hasError(await check({}, (dir) => writeFile(path.join(dir, 'images/02.png'), png(1000, 750))), /lato lungo/));
  assert.ok(hasError(await check({}, (dir) => writeFile(path.join(dir, 'images/03.png'), png(2000, 2000))), /4:3/));
  assert.ok(hasError(await check({}, (dir) => writeFile(path.join(dir, 'images/04.png'), 'non è un png')), /non è un PNG o JPEG/));
  assert.ok(hasError(await check({}, (dir) => writeFile(path.join(dir, 'images/card.jpg'), jpeg(800, 600))), /card.jpg è 800×600/));
  assert.ok(hasError(await check({}, (dir) => rm(path.join(dir, 'build.py'))), /manca build.py/));
  // Collegamenti simbolici (anche dentro files/ o tramite una cartella collegata) rifiutati.
  assert.ok(hasError(await check({}, async (dir) => {
    await rm(path.join(dir, 'files/prova.xlsx'));
    await symlink(path.join(dir, 'listing.json'), path.join(dir, 'files/prova.xlsx'));
  }), /collegamento simbolico/));
  assert.ok(hasError(await check({}, async (dir) => {
    const fuori = await mkdtemp(path.join(tmpdir(), 'nettochiaro-fuori-'));
    await writeFile(path.join(fuori, 'prova.xlsx'), 'segreto');
    await rm(path.join(dir, 'files'), { recursive: true });
    await symlink(fuori, path.join(dir, 'files'));
  }), /fuori dalla cartella del prodotto/));
});

test('validatore: listing.json mancante o non valido', async () => {
  assert.ok(hasError(await check({}, (dir) => rm(path.join(dir, 'listing.json'))), /manca listing.json/));
  assert.ok(hasError(await check({}, (dir) => writeFile(path.join(dir, 'listing.json'), '{ non json')), /non è JSON valido/));
});

test('validatore: due prodotti con lo stesso titolo sono un errore (la sync li confonderebbe)', async () => {
  const tmp = await makeRoot();
  await writeProduct(tmp, 'prova-a', { title: 'Foglio di prova Excel e Google Sheets, registro mensile' });
  await writeProduct(tmp, 'prova-b', { title: 'Foglio di prova  excel e Google Sheets, registro mensile' });
  await writeProduct(tmp, 'prova-c');
  const r = Object.fromEntries((await validateAll(tmp)).map((x) => [x.slug, x]));
  assert.ok(hasError(r['prova-a'], /uguale a quello di prova-b/));
  assert.ok(hasError(r['prova-b'], /uguale a quello di prova-a/));
  assert.deepEqual(r['prova-c'].errors, []);
  await rm(tmp, { recursive: true, force: true });
});

test('imageSize legge PNG e JPEG', () => {
  assert.deepEqual(imageSize(png(2000, 1500)), { type: 'png', width: 2000, height: 1500 });
  assert.deepEqual(imageSize(jpeg(1200, 900)), { type: 'jpeg', width: 1200, height: 900 });
  assert.equal(imageSize(Buffer.from('ciao')), null);
});
