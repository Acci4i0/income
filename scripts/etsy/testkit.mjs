// Strumenti per i test (tests/etsy.test.mjs, tests/products.test.mjs): crea una cartella progetto
// temporanea con prodotti finti validi. Le immagini hanno solo l'intestazione: bastano al validatore.

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AI_PHRASE_IT } from './validate.mjs';

/** PNG minimo con intestazione IHDR (larghezza e altezza leggibili). */
export function png(width, height, salt = '') {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; buf[25] = 6;
  return Buffer.concat([buf, Buffer.from(`fine${salt}`)]);
}

/** JPEG minimo con segmento SOF0. */
export function jpeg(width, height) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'), sof, Buffer.from([0xff, 0xd9])]);
}

export const TAXONOMY_PATH = ['Paper & Party Supplies', 'Paper', 'Stationery', 'Design & Templates', 'Templates', 'Bookkeeping Templates'];

export function validListing(slug, overrides = {}) {
  return {
    slug,
    language: 'it',
    title: `Foglio di prova ${slug} Excel e Google Sheets, registro e riepilogo mensile`,
    short: 'Foglio di prova per i test automatici della sincronizzazione Etsy.',
    description: `Foglio di calcolo di prova.\n\nCosa ricevi\n- un file .xlsx\n\nCompatibilità: Excel, Google Sheets, LibreOffice.\n\nCome si scarica: dalla pagina degli acquisti di Etsy.\n\nLimiti: è una prova, non è consulenza fiscale.\n\n${AI_PHRASE_IT}`,
    tags: ['foglio excel', 'google sheets', 'registro fatture', 'partita iva', 'forfettario 2026', 'budget mensile',
      'modello excel', 'calcolo tasse', 'contributi inps', 'scadenze f24', 'finanze personali', 'foglio di calcolo', 'gestione spese'],
    price: 4.9,
    quantity: 999,
    who_made: 'i_did',
    when_made: 'made_to_order',
    is_supply: false,
    taxonomy_path: TAXONOMY_PATH,
    files: ['files/prova.xlsx'],
    images: ['images/01-cover.png', 'images/02.png', 'images/03.png', 'images/04.png', 'images/05.png'],
    site_pages: ['calcolo-tasse-forfettario'],
    publish: true,
    ...overrides,
  };
}

/** Scrive un prodotto completo in <root>/products/<slug>/. */
export async function writeProduct(root, slug, overrides = {}, { imageSalt = '' } = {}) {
  const listing = validListing(slug, overrides);
  const dir = path.join(root, 'products', slug);
  await mkdir(path.join(dir, 'files'), { recursive: true });
  await mkdir(path.join(dir, 'images'), { recursive: true });
  await writeFile(path.join(dir, 'listing.json'), `${JSON.stringify(listing, null, 2)}\n`);
  await writeFile(path.join(dir, 'README.md'), `# ${slug}\n`);
  await writeFile(path.join(dir, 'build.py'), '# rigenera i file\n');
  for (const rel of listing.files || []) if (typeof rel === 'string' && rel.startsWith('files/')) await writeFile(path.join(dir, rel), `contenuto ${slug} ${rel}`);
  for (const rel of listing.images || []) if (typeof rel === 'string' && rel.startsWith('images/')) await writeFile(path.join(dir, rel), png(2000, 1500, `${rel}${imageSalt}`));
  await writeFile(path.join(dir, 'images/card.jpg'), jpeg(1200, 900));
  return { dir, listing };
}

/** Cartella progetto temporanea con src/pages minimo e i prodotti indicati. */
export async function makeRoot(slugs = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'nettochiaro-etsy-'));
  await mkdir(path.join(root, 'src/pages'), { recursive: true });
  await writeFile(path.join(root, 'src/pages/calcolo-tasse-forfettario.mjs'), "export default { slug: 'calcolo-tasse-forfettario' };\n");
  await mkdir(path.join(root, 'products'), { recursive: true });
  for (const slug of slugs) await writeProduct(root, slug);
  return root;
}
