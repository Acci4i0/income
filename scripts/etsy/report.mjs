// Scarica le vendite Etsy e scrive products/etsy-sales.json con SOLI aggregati per prodotto.
// Uso: node scripts/etsy/report.mjs           (DRY_RUN=1 per stampare le chiamate senza rete)
//
// Il repository è pubblico: dai receipt si leggono solo listing_id, quantità, prezzo unitario, data e
// stato. Nomi, email, indirizzi, messaggi e id degli acquirenti non vengono mai letti né salvati.
//
// Endpoint: getShopReceipts GET /shops/{shop_id}/receipts?was_paid=true&was_canceled=false
// https://developers.etsy.com/documentation/reference#operation/getShopReceipts (scope transactions_r).
// Ogni receipt contiene transactions[] con listing_id, quantity e price { amount, divisor, currency_code }.

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutput, openSession, setupMessage, isDryRun, storeFromEnv } from './lib.mjs';
import { dryRunSetup, LISTINGS_FILE } from './sync.mjs';

export const SALES_FILE = 'products/etsy-sales.json';
const DAY = 24 * 3600 * 1000;
const EXCLUDED_STATUS = new Set(['canceled', 'fully refunded']);
const OTHER = 'altre-inserzioni';

const euro = (cents) => Math.round(cents) / 100;

/**
 * Aggrega i receipt per prodotto. listingToSlug: Map listing_id → slug. Restituisce un oggetto che
 * contiene solo numeri, slug e date: nessun dato dell'acquirente.
 */
export function aggregateSales(receipts, listingToSlug, { now = Date.now(), days = 30, slugs = [] } = {}) {
  const since = now - days * DAY;
  const zero = () => ({ vendite: 0, ricavi_cent: 0, vendite_30: 0, ricavi_30_cent: 0 });
  const per = new Map(slugs.map((s) => [s, zero()]));
  let currency = null;
  let skippedCurrency = 0;
  for (const r of receipts || []) {
    if (EXCLUDED_STATUS.has(String(r?.status || '').toLowerCase())) continue;
    if (r?.is_paid === false) continue;
    const ts = Number(r?.created_timestamp ?? r?.create_timestamp) * 1000;
    const recent = Number.isFinite(ts) && ts >= since;
    for (const t of r?.transactions || []) {
      const qty = Number(t?.quantity) || 0;
      const price = t?.price || {};
      const divisor = Number(price.divisor) || 100;
      const unitCents = (Number(price.amount) || 0) * 100 / divisor;
      if (price.currency_code) {
        currency = currency || price.currency_code;
        if (price.currency_code !== currency) { skippedCurrency++; continue; }
      }
      const slug = listingToSlug.get(Number(t?.listing_id)) || OTHER;
      if (!per.has(slug)) per.set(slug, zero());
      const p = per.get(slug);
      p.vendite += qty;
      p.ricavi_cent += unitCents * qty;
      if (recent) { p.vendite_30 += qty; p.ricavi_30_cent += unitCents * qty; }
    }
  }
  const prodotti = {};
  const tot = zero();
  for (const slug of [...per.keys()].sort()) {
    const p = per.get(slug);
    prodotti[slug] = { vendite: p.vendite, ricavi: euro(p.ricavi_cent), vendite_30_giorni: p.vendite_30, ricavi_30_giorni: euro(p.ricavi_30_cent) };
    for (const k of Object.keys(tot)) tot[k] += p[k];
  }
  return {
    aggiornato: new Date(now).toISOString().slice(0, 10),
    valuta: currency || 'EUR',
    nota: 'Solo aggregati, nessun dato degli acquirenti. Ricavi lordi: prezzo degli articoli venduti, prima di sconti, commissioni Etsy e imposte. Esclusi ordini annullati e rimborsati per intero.',
    totale: { vendite: tot.vendite, ricavi: euro(tot.ricavi_cent) },
    ultimi_30_giorni: { vendite: tot.vendite_30, ricavi: euro(tot.ricavi_30_cent) },
    prodotti,
    ...(skippedCurrency ? { esclusi_altra_valuta: skippedCurrency } : {}),
  };
}

export async function runReport({ root, env = process.env, fetch = globalThis.fetch, store, out, now = () => Date.now(), sleep } = {}) {
  out = out || createOutput({ env });
  const dryRun = isDryRun(env);
  const listingsPath = path.join(root, LISTINGS_FILE);
  const listings = existsSync(listingsPath) ? JSON.parse(await readFile(listingsPath, 'utf8')) : {};

  if (dryRun) ({ env, store, fetch, sleep } = dryRunSetup({ env, out, listings }));
  store = store || storeFromEnv({ env, cwd: root });

  const session = await openSession({ env, store, fetch, out, now, sleep });
  if (session.skipped) {
    const msg = setupMessage(session.skipped, 'Il report delle vendite Etsy');
    out.warn(msg);
    out.summary(`## Etsy: vendite\n\n${msg}`);
    return { status: 'skipped', reason: session.skipped };
  }
  const { client, shopId } = session;
  const receipts = await client.paginate(`/shops/${shopId}/receipts`, { was_paid: true, was_canceled: false, sort_on: 'created', sort_order: 'desc' }, { limit: 100, maxPages: 50 });

  const listingToSlug = new Map(Object.entries(listings).filter(([, e]) => e?.listing_id).map(([slug, e]) => [Number(e.listing_id), slug]));
  const report = aggregateSales(receipts, listingToSlug, { now: now(), slugs: Object.keys(listings) });
  const text = `${JSON.stringify(report, null, 2)}\n`;

  const lines = ['## Etsy: vendite', '', `| Prodotto | Vendite 30 giorni | Ricavi 30 giorni | Vendite totali | Ricavi totali |`, '|---|---:|---:|---:|---:|'];
  const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const [slug, p] of Object.entries(report.prodotti)) lines.push(`| ${slug} | ${p.vendite_30_giorni} | ${fmt(p.ricavi_30_giorni)} | ${p.vendite} | ${fmt(p.ricavi)} |`);
  lines.push(`| **Totale** | ${report.ultimi_30_giorni.vendite} | ${fmt(report.ultimi_30_giorni.ricavi)} | ${report.totale.vendite} | ${fmt(report.totale.ricavi)} |`, '', `Valori in ${report.valuta}, lordi. ${receipts.length} ordini letti.`);
  out.summary(lines.join('\n'));

  if (dryRun) {
    out.log(`[DRY_RUN] ${SALES_FILE} non modificato. Contenuto previsto:\n${text}`);
    return { status: 'ok', report, changed: false };
  }
  const file = path.join(root, SALES_FILE);
  const prev = existsSync(file) ? await readFile(file, 'utf8') : null;
  if (prev !== text) {
    await writeFile(file, text);
    if (env.ETSY_COMMIT_NOTES) await appendFile(env.ETSY_COMMIT_NOTES, `- report vendite aggiornato (${report.ultimi_30_giorni.vendite} vendite negli ultimi 30 giorni)\n`);
  }
  return { status: 'ok', report, changed: prev !== text };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = createOutput();
  try {
    await runReport({ root, out });
  } catch (e) {
    out.error(`${e.message}${e.hint ? ` ${e.hint}` : ''}`);
    out.summary(`## Etsy: vendite\n\nErrore: ${e.message}${e.hint ? `\n\n${e.hint}` : ''}`);
    process.exitCode = 1;
  }
}
