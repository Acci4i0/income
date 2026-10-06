// Sincronizza products/*/listing.json con il negozio Etsy. Eseguito da .github/workflows/etsy-sync.yml.
// Uso: node scripts/etsy/sync.mjs            (DRY_RUN=1 per stampare le chiamate senza rete)
//
// Per ogni prodotto valido: crea la bozza (o ritrova l'inserzione con lo stesso titolo), aggiorna solo le
// parti cambiate (dati, prezzo, immagini, file, stato) confrontando gli hash salvati in
// products/etsy-listings.json, che viene riscritto dopo ogni passo: se un passo fallisce, il run
// successivo riparte da lì senza duplicare l'inserzione.
//
// Endpoint usati (reference: https://developers.etsy.com/documentation/reference):
// - getMe                 GET    /users/me                                   #operation/getMe
// - getShop               GET    /shops/{shop_id} (currency_code)            #operation/getShop
// - getSellerTaxonomyNodes GET   /seller-taxonomy/nodes                      #operation/getSellerTaxonomyNodes
// - getListingsByShop     GET    /shops/{shop_id}/listings?state=…           #operation/getListingsByShop
// - getListing            GET    /listings/{listing_id}                      #operation/getListing
// - createDraftListing    POST   /shops/{shop_id}/listings (urlencoded)      #operation/createDraftListing
// - updateListing         PATCH  /shops/{shop_id}/listings/{listing_id}      #operation/updateListing
// - updateListingInventory PUT   /listings/{listing_id}/inventory (JSON)     #operation/updateListingInventory
// - uploadListingImage    POST   /shops/{shop_id}/listings/{id}/images       #operation/uploadListingImage
// - getListingImages      GET    /listings/{listing_id}/images               #operation/getListingImages
// - deleteListingImage    DELETE /shops/{shop_id}/listings/{id}/images/{img} #operation/deleteListingImage
// - uploadListingFile     POST   /shops/{shop_id}/listings/{id}/files        #operation/uploadListingFile
// - getAllListingFiles    GET    /shops/{shop_id}/listings/{id}/files        #operation/getAllListingFiles
// - deleteListingFile     DELETE /shops/{shop_id}/listings/{id}/files/{file} #operation/deleteListingFile

import { readFile, appendFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from './validate.mjs';
import { createOutput, openSession, setupMessage, sha256, isDryRun, storeFromEnv, memoryStore, encryptJson, EtsyError } from './lib.mjs';
import { createFakeEtsy, taxonomyFromPaths } from './fake.mjs';

export const LISTINGS_FILE = 'products/etsy-listings.json';

const shortHash = (value) => sha256(JSON.stringify(value)).slice(0, 16);

/** Hash delle parti di un prodotto: cambia solo la parte modificata. */
export async function productHashes({ dir, listing: l }) {
  const filesHash = async (list) => shortHash(await Promise.all(list.map(async (rel) => [rel, sha256(await readFile(path.join(dir, rel)))])));
  const parti = {
    dati: shortHash({ title: l.title, description: l.description, tags: l.tags, taxonomy_path: l.taxonomy_path, who_made: l.who_made, when_made: l.when_made, is_supply: l.is_supply, publish: l.publish }),
    prezzo: shortHash({ price: l.price, quantity: l.quantity }),
    immagini: await filesHash(l.images),
    file: await filesHash(l.files),
  };
  return { parti, hash: shortHash(parti) };
}

const normName = (s) => String(s).toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const normTitle = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim().toLowerCase();

/** Trova il taxonomy_id dal percorso di nomi (confronto senza maiuscole). */
export function resolveTaxonomy(tree, names) {
  let level = tree;
  let node = null;
  let depth = 0;
  for (; depth < names.length; depth++) {
    const next = (level || []).find((n) => normName(n.name) === normName(names[depth]));
    if (!next) break;
    node = next;
    level = next.children || [];
  }
  if (depth === names.length && node) return { id: node.id };
  // Ripiego: una sola categoria in tutto l'albero con il nome della foglia.
  const all = [];
  const walk = (nodes) => { for (const n of nodes || []) { all.push(n); walk(n.children); } };
  walk(tree);
  const leaf = all.filter((n) => normName(n.name) === normName(names.at(-1)));
  if (leaf.length === 1) return { id: leaf[0].id, warning: `taxonomy_path non trovato alla lettera, uso l'unica categoria "${leaf[0].name}" (id ${leaf[0].id})` };
  const options = (level || []).map((n) => n.name).slice(0, 40).join(', ');
  throw new EtsyError(`taxonomy_path: "${names[depth]}" non trovato${depth ? ` sotto "${names.slice(0, depth).join(' > ')}"` : ''}. Voci disponibili: ${options || 'nessuna'}`);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pdf': 'application/pdf', '.zip': 'application/zip' };
async function blobFor(dir, rel) {
  const buf = await readFile(path.join(dir, rel));
  return { blob: new Blob([buf], { type: MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream' }), filename: path.posix.basename(rel) };
}

function entryOut(e) {
  // Ordine fisso delle chiavi: diff leggibili nel repository.
  return { listing_id: e.listing_id, url: e.url ?? null, state: e.state ?? null, hash: e.hash ?? null, parti: e.parti ?? {}, aggiornato: e.aggiornato ?? null };
}

async function syncProduct(ctx, product, prev) {
  const { client, shopId } = ctx;
  const { slug, dir, listing: l } = product;
  const { parti, hash } = await productHashes(product);
  const actions = [];
  let entry = prev ? { ...prev, parti: { ...(prev.parti || {}) } } : null;
  const save = () => ctx.save(slug, entry);
  const base = `/shops/${shopId}/listings`;

  if (entry?.state === 'deleted') {
    return { slug, entry, actions: [`saltato: l'inserzione ${entry.listing_id} è stata cancellata su Etsy (per ricrearla togli "${slug}" da ${LISTINGS_FILE})`] };
  }

  let listing = null;
  if (entry?.listing_id) {
    try {
      listing = await client.request('GET', `/listings/${entry.listing_id}`);
    } catch (e) {
      if (e.status !== 404) throw e;
      // Prima di segnarla cancellata (stato definitivo: la sync non la tocca più) cerca l'id tra le
      // inserzioni del negozio in tutti gli stati: un 404 isolato di getListing non deve fermare il prodotto.
      listing = (await ctx.shopListings()).byId.get(Number(entry.listing_id)) || null;
      if (!listing) {
        entry = { ...entry, state: 'deleted', aggiornato: ctx.today };
        save();
        return { slug, entry, actions: [`inserzione ${entry.listing_id} non trovata su Etsy: segnata come cancellata, non la ricreo`] };
      }
      ctx.warn(`${slug}: getListing ${entry.listing_id} ha risposto 404, ma l'inserzione è nel negozio (stato ${listing.state}): continuo.`);
    }
  } else {
    const found = (await ctx.shopListings()).byTitle.get(normTitle(l.title));
    if (found) {
      listing = found;
      entry = { listing_id: found.listing_id, url: found.url, state: found.state, hash: null, parti: {} };
      save();
      actions.push(`ritrovata su Etsy (${found.listing_id})`);
    }
  }

  const dataFields = async () => ({
    title: l.title,
    description: l.description,
    tags: l.tags,
    taxonomy_id: await ctx.taxonomyId(l.taxonomy_path),
    who_made: l.who_made,
    when_made: l.when_made,
    is_supply: l.is_supply,
    should_auto_renew: l.publish,
  });

  if (!listing) {
    listing = await client.request('POST', base, {
      form: { ...(await dataFields()), quantity: l.quantity, price: l.price, type: 'download' },
    });
    entry = { listing_id: listing.listing_id, url: listing.url, state: listing.state, hash: null, parti: { dati: parti.dati, prezzo: parti.prezzo } };
    save();
    actions.push('bozza creata');
  }
  const id = entry.listing_id;
  const done = entry.parti;

  if (done.dati !== parti.dati) {
    listing = await client.request('PATCH', `${base}/${id}`, { form: await dataFields() });
    done.dati = parti.dati;
    save();
    actions.push('dati aggiornati');
  }

  const lowStock = l.publish && Number.isFinite(listing.quantity) && listing.quantity < Math.min(l.quantity, 50);
  if (done.prezzo !== parti.prezzo || lowStock) {
    await client.request('PUT', `/listings/${id}/inventory`, {
      json: { products: [{ property_values: [], offerings: [{ price: l.price, quantity: l.quantity, is_enabled: true, readiness_state_id: null }] }] },
    });
    done.prezzo = parti.prezzo;
    save();
    actions.push(lowStock ? 'quantità ripristinata' : 'prezzo e quantità aggiornati');
  }

  if (done.immagini !== parti.immagini) {
    // Carica con overwrite alla posizione giusta, poi elimina le immagini in più: l'inserzione non
    // resta mai senza immagini (un'inserzione attiva deve averne almeno una).
    const uploaded = [];
    for (const [i, rel] of l.images.entries()) {
      const res = await client.request('POST', `${base}/${id}/images`, {
        multipart: { image: await blobFor(dir, rel), rank: i + 1, overwrite: true, alt_text: `${l.title.slice(0, 450)} (${i + 1}/${l.images.length})` },
        retryUnsafe: true,
      });
      uploaded.push(res.listing_image_id);
    }
    const current = (await client.request('GET', `/listings/${id}/images`))?.results || [];
    for (const img of current) {
      if (!uploaded.includes(img.listing_image_id)) await client.request('DELETE', `${base}/${id}/images/${img.listing_image_id}`);
    }
    done.immagini = parti.immagini;
    save();
    actions.push(`${uploaded.length} immagini caricate`);
  }

  if (done.file !== parti.file) {
    // Se si elimina l'ultimo file, Etsy trasforma l'inserzione in fisica: ne teniamo uno vecchio finché
    // il primo nuovo non è caricato, poi lo eliminiamo. Massimo 5 file in ogni momento.
    const existing = (await client.request('GET', `${base}/${id}/files`))?.results || [];
    const anchor = existing.at(-1);
    for (const f of existing.slice(0, -1)) await client.request('DELETE', `${base}/${id}/files/${f.listing_file_id}`);
    const uploaded = [];
    for (const [i, rel] of l.files.entries()) {
      const file = await blobFor(dir, rel);
      const res = await client.request('POST', `${base}/${id}/files`, { multipart: { file, name: file.filename, rank: i + 1 }, retryUnsafe: true });
      uploaded.push(res.listing_file_id);
      if (i === 0 && anchor) await client.request('DELETE', `${base}/${id}/files/${anchor.listing_file_id}`);
    }
    const current = (await client.request('GET', `${base}/${id}/files`))?.results || [];
    for (const f of current) if (!uploaded.includes(f.listing_file_id)) await client.request('DELETE', `${base}/${id}/files/${f.listing_file_id}`);
    done.file = parti.file;
    save();
    actions.push(`${uploaded.length} file caricati`);
  }

  if (l.publish && listing.state !== 'active') {
    listing = await client.request('PATCH', `${base}/${id}`, { form: { state: 'active' } });
    actions.push('attivata');
  } else if (!l.publish && listing.state === 'active') {
    listing = await client.request('PATCH', `${base}/${id}`, { form: { state: 'inactive' } });
    actions.push('disattivata (publish: false)');
  }

  entry.state = listing.state || entry.state;
  entry.url = listing.url || entry.url;
  entry.hash = hash;
  if (actions.length || !entry.aggiornato) entry.aggiornato = ctx.today;
  save();
  return { slug, entry, actions: actions.length ? actions : ['nessuna modifica'] };
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { throw new EtsyError(`${path.basename(file)} non è JSON valido: ${e.message}`); }
}

/** Prepara Etsy finto, segreti e token finti per DRY_RUN: le chiamate vengono stampate, non inviate. */
export function dryRunSetup({ env, out, products = [], listings = {}, receipts = [] }) {
  const keystring = 'dry-run-keystring';
  const sharedSecret = 'dry-run-shared-secret';
  const fake = createFakeEtsy({
    keystring,
    sharedSecret,
    taxonomy: taxonomyFromPaths(products.map((p) => p.listing.taxonomy_path)),
    listings: Object.values(listings).filter((e) => e?.listing_id && e.state !== 'deleted').map((e) => ({ listing_id: e.listing_id, state: e.state || 'draft', title: '' })),
    receipts,
    log: (line) => out.log(`[DRY_RUN] ${line}`),
  });
  const token = { access_token: fake.state.accessToken, refresh_token: fake.state.refreshToken, expires_at: '9999-12-31T00:00:00.000Z' };
  return {
    fake,
    env: { ...env, ETSY_KEYSTRING: keystring, ETSY_SHARED_SECRET: sharedSecret },
    store: memoryStore(encryptJson(sharedSecret, token)),
    fetch: fake.fetch,
    sleep: async () => {},
  };
}

export async function runSync({ root, env = process.env, fetch = globalThis.fetch, store, out, now = () => Date.now(), sleep } = {}) {
  out = out || createOutput({ env });
  const dryRun = isDryRun(env);
  const listingsPath = path.join(root, LISTINGS_FILE);
  const results = await validateAll(root);
  const valid = results.filter((r) => !r.errors.length);
  const invalid = results.filter((r) => r.errors.length);
  const listings = await readJson(listingsPath, {});

  if (dryRun) ({ env, store, fetch, sleep } = dryRunSetup({ env, out, products: valid, listings }));
  store = store || storeFromEnv({ env, cwd: root });

  const session = await openSession({ env, store, fetch, out, now, sleep });
  if (session.skipped) {
    const msg = setupMessage(session.skipped);
    out.warn(msg);
    out.summary(`## Etsy: sincronizzazione\n\n${msg}`);
    return { status: 'skipped', reason: session.skipped };
  }
  const { client, shopId } = session;

  // I prezzi di listing.json sono in EUR (products/README.md) e Etsy li interpreta nella valuta del negozio:
  // con un'altra valuta ogni prezzo sarebbe sbagliato, quindi la sync si ferma prima di scrivere.
  // getShop: https://developers.etsy.com/documentation/reference#operation/getShop (campo currency_code).
  const shop = await client.request('GET', `/shops/${shopId}`);
  if (shop?.currency_code && shop.currency_code !== 'EUR') {
    throw new EtsyError(`Il negozio Etsy usa la valuta ${shop.currency_code}, ma i prezzi in products/ sono in euro: nessuna inserzione modificata.`, {
      hint: 'Imposta l\'euro come valuta del negozio (Etsy → Gestione negozio → Impostazioni → Info e aspetto), poi rilancia la sincronizzazione.',
    });
  }

  let taxonomyTree = null;
  let shopIndex = null;
  const taxonomyCache = new Map();
  const ctx = {
    client,
    shopId,
    warn: (msg) => out.warn(msg),
    today: new Date(now()).toISOString().slice(0, 10),
    async taxonomyId(names) {
      const key = JSON.stringify(names);
      if (!taxonomyCache.has(key)) {
        taxonomyTree = taxonomyTree || (await client.request('GET', '/seller-taxonomy/nodes'))?.results || [];
        const r = resolveTaxonomy(taxonomyTree, names);
        if (r.warning) out.warn(r.warning);
        taxonomyCache.set(key, r.id);
      }
      return taxonomyCache.get(key);
    },
    /** Tutte le inserzioni del negozio (ogni stato), indicizzate per titolo normalizzato e per id. */
    async shopListings() {
      if (!shopIndex) {
        shopIndex = { byTitle: new Map(), byId: new Map() };
        for (const state of ['active', 'draft', 'inactive', 'expired', 'sold_out']) {
          for (const item of await client.paginate(`/shops/${shopId}/listings`, { state })) {
            const k = normTitle(item.title);
            if (k && !shopIndex.byTitle.has(k)) shopIndex.byTitle.set(k, item);
            if (item.listing_id) shopIndex.byId.set(Number(item.listing_id), item);
          }
        }
      }
      return shopIndex;
    },
    // Sincrono: ogni passo riuscito è su disco prima del successivo.
    save(slug, entry) {
      listings[slug] = entryOut(entry);
      if (dryRun) return;
      const sorted = Object.fromEntries(Object.keys(listings).sort().map((k) => [k, listings[k]]));
      writeFileSync(listingsPath, `${JSON.stringify(sorted, null, 2)}\n`);
    },
  };

  const rows = [];
  const failures = [];
  for (const product of valid) {
    try {
      const r = await syncProduct(ctx, product, listings[product.slug]);
      rows.push(r);
      out.log(`${product.slug}: ${r.actions.join(', ')}`);
    } catch (e) {
      failures.push({ slug: product.slug, error: e });
      out.error(`${product.slug}: ${e.message}${e.hint ? ` ${e.hint}` : ''}`);
    }
  }
  for (const r of invalid) out.warn(`${r.slug}: non sincronizzato, ${r.errors.length} errori di validazione (node scripts/etsy/validate.mjs ${r.slug})`);
  const present = new Set(results.map((r) => r.slug));
  for (const slug of Object.keys(listings)) {
    if (!present.has(slug) && listings[slug]?.state === 'active') out.warn(`${slug}: la cartella non esiste più ma l'inserzione ${listings[slug].listing_id} resta attiva su Etsy. Per ritirarla imposta "publish": false prima di togliere la cartella, o disattivala da Etsy.`);
  }

  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const lines = ['## Etsy: sincronizzazione', ''];
  if (dryRun) lines.push('Modalità **DRY_RUN**: nessuna chiamata inviata, nessun file modificato.', '');
  lines.push('| Prodotto | Esito | Inserzione |', '|---|---|---|');
  for (const r of rows) lines.push(`| ${r.slug} | ${cell(r.actions.join(', '))} | ${r.entry?.url && !dryRun ? `[${r.entry.state}](${r.entry.url})` : cell(r.entry?.state || '')} |`);
  for (const f of failures) lines.push(`| ${f.slug} | errore: ${cell(f.error.message)} | ${cell(listings[f.slug]?.state || '')} |`);
  for (const r of invalid) lines.push(`| ${r.slug} | non valido: ${cell(r.errors.slice(0, 3).join('; '))}${r.errors.length > 3 ? ' …' : ''} | |`);
  if (!results.length) lines.push('| – | nessun prodotto in products/ | |');
  lines.push('', `Chiamate API: ${client.requests}.`);
  out.summary(lines.join('\n'));

  const notes = rows.filter((r) => r.actions[0] !== 'nessuna modifica').map((r) => `- ${r.slug}: ${r.actions.join(', ')}`);
  if (env.ETSY_COMMIT_NOTES && notes.length && !dryRun) await appendFile(env.ETSY_COMMIT_NOTES, `${notes.join('\n')}\n`);
  if (dryRun) out.log(`[DRY_RUN] ${LISTINGS_FILE} non modificato. Risultato previsto:\n${JSON.stringify(listings, null, 2)}`);

  return { status: failures.length ? 'error' : 'ok', rows, failures, invalid: invalid.map((r) => r.slug), listings, requests: client.requests };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = createOutput();
  try {
    const r = await runSync({ root, out });
    process.exitCode = r.status === 'error' ? 1 : 0;
  } catch (e) {
    out.error(`${e.message}${e.hint ? ` ${e.hint}` : ''}`);
    out.summary(`## Etsy: sincronizzazione\n\nErrore: ${e.message}${e.hint ? `\n\n${e.hint}` : ''}`);
    process.exitCode = 1;
  }
}
