// Test della sincronizzazione Etsy con un Etsy finto in memoria (scripts/etsy/fake.mjs): PKCE, cifratura,
// client con retry e rinnovo del token, autorizzazione, idempotenza della sync, report vendite senza dati
// personali, segreti mancanti, DRY_RUN, archivio git del token e assenza di segreti nell'output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, mkdtemp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifierFromState, challengeFromVerifier, newState, authorizeUrl, encryptJson, decryptJson, readSecrets,
  EtsyClient, EtsyError, createOutput, memoryStore, gitStore, tokenFromResponse, SCOPES, REDIRECT_URI,
} from '../scripts/etsy/lib.mjs';
import { createFakeEtsy, taxonomyFromPaths } from '../scripts/etsy/fake.mjs';
import { runSync, resolveTaxonomy, LISTINGS_FILE } from '../scripts/etsy/sync.mjs';
import { runReport, aggregateSales, SALES_FILE } from '../scripts/etsy/report.mjs';
import { runAuth, parseCallbackInput, dispatchInputs } from '../scripts/etsy/auth.mjs';
import { makeRoot, writeProduct, png, TAXONOMY_PATH } from '../scripts/etsy/testkit.mjs';

const KEYSTRING = 'k3ystr1ngABCDEF0123456789';
const SECRET = 'sh4redSECRETzyx987';
const ENV = { ETSY_KEYSTRING: KEYSTRING, ETSY_SHARED_SECRET: SECRET };
const noSleep = async () => {};

/** Output catturato: tutto ciò che gli script stampano o scrivono nel summary. */
function capture(env = {}) {
  const lines = [];
  const out = createOutput({ env, write: (s) => lines.push(s), summaryFile: null });
  return { out, text: () => lines.join('') };
}

function fakeEtsy(opts = {}) {
  return createFakeEtsy({ keystring: KEYSTRING, sharedSecret: SECRET, taxonomy: taxonomyFromPaths([TAXONOMY_PATH]), ...opts });
}

function tokenStore(fake, { expired = false } = {}) {
  return memoryStore(encryptJson(SECRET, {
    access_token: fake.state.accessToken,
    refresh_token: fake.state.refreshToken,
    user_id: fake.state.userId,
    expires_at: new Date(Date.now() + (expired ? -60_000 : 3_600_000)).toISOString(),
  }));
}

async function setup(slugs = ['prova-uno']) {
  const root = await makeRoot(slugs);
  const fake = fakeEtsy();
  const store = tokenStore(fake);
  const sync = (extra = {}) => {
    const cap = capture();
    return runSync({ root, env: ENV, fetch: fake.fetch, store, out: cap.out, sleep: noSleep, ...extra }).then((r) => ({ ...r, output: cap.text() }));
  };
  const listings = async () => JSON.parse(await readFile(path.join(root, LISTINGS_FILE), 'utf8'));
  return { root, fake, store, sync, listings };
}

// --- PKCE e URL di autorizzazione -----------------------------------------------------------------

test('PKCE: challenge S256 secondo RFC 7636 (appendice B)', () => {
  assert.equal(challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('PKCE: verifier ricavato dallo state, deterministico e valido', () => {
  const state = newState();
  assert.match(state, /^[A-Za-z0-9_-]{32}$/);
  const v = verifierFromState(SECRET, state);
  assert.equal(v, verifierFromState(SECRET, state));
  assert.match(v, /^[A-Za-z0-9_-]{43,128}$/);
  assert.notEqual(v, verifierFromState(SECRET, newState()));
  assert.notEqual(v, verifierFromState(`${SECRET}x`, state));
  assert.throws(() => verifierFromState(SECRET, 'corto'), EtsyError);
  assert.throws(() => verifierFromState(SECRET, 'state con spazi e simboli!!'), EtsyError);
});

test('URL di autorizzazione: parametri corretti, client_id codificato, nessuna shared secret', () => {
  const state = newState();
  const url = authorizeUrl({ keystring: KEYSTRING, sharedSecret: SECRET, state });
  const u = new URL(url);
  assert.equal(`${u.origin}${u.pathname}`, 'https://www.etsy.com/oauth/connect');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), KEYSTRING);
  assert.equal(u.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(u.searchParams.get('scope'), SCOPES.join(' '));
  assert.equal(u.searchParams.get('state'), state);
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('code_challenge'), challengeFromVerifier(verifierFromState(SECRET, state)));
  // Il keystring non compare in chiaro (GitHub lo maschererebbe nel summary), la shared secret per niente.
  assert.ok(!url.includes(KEYSTRING));
  assert.ok(!url.includes(SECRET) && !decodeURIComponent(url).includes(SECRET));
  assert.ok(!decodeURIComponent(url).includes(verifierFromState(SECRET, state)));
});

test('parseCallbackInput accetta code e state o l\'URL intero', () => {
  assert.deepEqual(parseCallbackInput(' abc ', ' def '), { code: 'abc', state: 'def' });
  assert.deepEqual(parseCallbackInput('https://nettochiaro.com/etsy-callback/?code=C0D3&state=S7AT3', ''), { code: 'C0D3', state: 'S7AT3' });
});

// --- Cifratura e segreti ---------------------------------------------------------------------------

test('cifratura AES-256-GCM: andata e ritorno, IV casuale, niente testo in chiaro', () => {
  const token = { access_token: '777.access-segreto-123456', refresh_token: '777.refresh-segreto-654321' };
  const a = encryptJson(SECRET, token);
  const b = encryptJson(SECRET, token);
  assert.notEqual(a, b);
  assert.match(a, /^v1\.[\w-]+\.[\w-]+\.[\w-]+\n$/);
  assert.ok(!a.includes('segreto') && !Buffer.from(a, 'utf8').toString('latin1').includes('777.'));
  assert.deepEqual(decryptJson(SECRET, a), token);
});

test('cifratura: shared secret sbagliata o file manomesso → errore chiaro', () => {
  const enc = encryptJson(SECRET, { x: 1 });
  assert.throws(() => decryptJson('altra-secret', enc), /shared secret è cambiata/);
  const parts = enc.trim().split('.');
  parts[2] = Buffer.from('manomesso').toString('base64url');
  assert.throws(() => decryptJson(SECRET, parts.join('.')), EtsyError);
  assert.throws(() => decryptJson(SECRET, 'testo qualsiasi'), /formato non riconosciuto/);
});

test('readSecrets: servono entrambi i segreti', () => {
  assert.equal(readSecrets({}), null);
  assert.equal(readSecrets({ ETSY_KEYSTRING: KEYSTRING }), null);
  assert.equal(readSecrets({ ETSY_SHARED_SECRET: SECRET, ETSY_KEYSTRING: '  ' }), null);
  assert.deepEqual(readSecrets(ENV), { keystring: KEYSTRING, sharedSecret: SECRET });
  assert.throws(() => readSecrets({ ETSY_KEYSTRING: `${KEYSTRING}:${SECRET}`, ETSY_SHARED_SECRET: SECRET }), /solo il keystring/);
});

test('tokenFromResponse ricava user_id e scadenza', () => {
  const t = tokenFromResponse({ access_token: '12345.abc', refresh_token: '12345.def', expires_in: 3600 }, 0);
  assert.equal(t.user_id, 12345);
  assert.equal(t.expires_at, new Date(3600 * 1000).toISOString());
});

// --- Client HTTP -----------------------------------------------------------------------------------

test('client: header x-api-key "keystring:secret" e Bearer', async () => {
  const fake = fakeEtsy();
  const client = new EtsyClient({ keystring: KEYSTRING, sharedSecret: SECRET, token: { access_token: fake.state.accessToken, refresh_token: fake.state.refreshToken, expires_at: '9999-01-01T00:00:00Z' }, fetch: fake.fetch, sleep: noSleep, out: capture().out });
  assert.deepEqual(await client.request('GET', '/users/me'), { user_id: 777, shop_id: 4242 });
  const call = fake.state.calls.at(-1);
  assert.equal(call.headers['x-api-key'], `${KEYSTRING}:${SECRET}`);
  assert.equal(call.headers.authorization, `Bearer ${fake.state.accessToken}`);
});

test('client: retry su 429 (rispetta retry-after) e su 5xx per GET, non per la creazione', async () => {
  const fake = fakeEtsy();
  const sleeps = [];
  const client = new EtsyClient({ keystring: KEYSTRING, sharedSecret: SECRET, token: { access_token: fake.state.accessToken, refresh_token: fake.state.refreshToken, expires_at: '9999-01-01T00:00:00Z' }, fetch: fake.fetch, sleep: async (ms) => sleeps.push(ms), out: capture().out, minInterval: 0 });
  fake.failNext('GET', /^\/users\/me$/, 429, 2, { 'retry-after': '3' });
  assert.equal((await client.request('GET', '/users/me')).shop_id, 4242);
  assert.deepEqual(sleeps, [3000, 3000]);
  fake.failNext('GET', /^\/users\/me$/, 503, 1);
  assert.equal((await client.request('GET', '/users/me')).shop_id, 4242);
  fake.failNext('POST', /^\/shops\/4242\/listings$/, 500, 1);
  const before = fake.state.calls.length;
  await assert.rejects(client.request('POST', '/shops/4242/listings', { form: { title: 'x' } }), (e) => e.status === 500);
  assert.equal(fake.state.calls.length - before, 1, 'POST non idempotente: un solo tentativo');
  // 429 anche per POST: la richiesta non è stata eseguita, quindi si ripete (qui l'endpoint poi risponde
  // 400 perché mancano i campi obbligatori).
  fake.failNext('POST', /^\/shops\/4242\/listings$/, 429, 1);
  const before429 = fake.state.calls.length;
  await assert.rejects(client.request('POST', '/shops/4242/listings', { form: { title: 'x' } }), (e) => e.status === 400);
  assert.equal(fake.state.calls.length - before429, 2);
});

test('client: token scaduto → rinnovo, salvataggio del nuovo token, richiesta ripetuta su 401', async () => {
  const fake = fakeEtsy();
  const saved = [];
  const client = new EtsyClient({ keystring: KEYSTRING, sharedSecret: SECRET, token: { access_token: fake.state.accessToken, refresh_token: fake.state.refreshToken, expires_at: new Date(Date.now() - 1000).toISOString() }, fetch: fake.fetch, sleep: noSleep, out: capture().out, onToken: async (t) => saved.push(t) });
  await client.request('GET', '/users/me');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].refresh_token, fake.state.refreshToken);
  assert.equal(saved[0].user_id, 777);
  // Token revocato lato Etsy: 401 → un rinnovo e un nuovo tentativo.
  fake.state.accessToken = 'revocato';
  fake.state.refreshToken = client.token.refresh_token;
  await client.request('GET', '/users/me');
  assert.equal(saved.length, 2);
  // Refresh token non più valido → errore con istruzioni.
  fake.state.refreshToken = 'altro';
  fake.state.accessToken = 'revocato-di-nuovo';
  await assert.rejects(client.request('GET', '/users/me'), (e) => e.code === 'invalid_grant' && /Rifai l'autorizzazione/.test(e.hint));
});

// --- Autorizzazione --------------------------------------------------------------------------------

test('autorizzazione: avvia → link, completa → token cifrato salvato', async () => {
  const fake = fakeEtsy();
  const store = memoryStore();
  const a = capture();
  const avvia = await runAuth({ passo: 'avvia', env: ENV, fetch: fake.fetch, store, out: a.out });
  assert.equal(avvia.status, 'ok');
  assert.ok(a.text().includes('[Autorizza NettoChiaro su Etsy](https://www.etsy.com/oauth/connect?'));
  assert.equal(fake.state.calls.length, 0, 'avvia non chiama Etsy');

  // L'utente autorizza: Etsy emette un code legato al code_challenge del link.
  const u = new URL(avvia.url);
  fake.authorize('codice-monouso-123', u.searchParams.get('code_challenge'));
  const c = capture();
  const completa = await runAuth({ passo: 'completa', env: { ...ENV, ETSY_CODE: 'codice-monouso-123', ETSY_STATE: avvia.state }, fetch: fake.fetch, store, out: c.out, sleep: noSleep });
  assert.equal(completa.status, 'ok');
  assert.equal(completa.shopId, 4242);
  const token = decryptJson(SECRET, store.content);
  assert.equal(token.access_token, fake.state.accessToken);
  assert.equal(token.refresh_token, fake.state.refreshToken);
  assert.ok(c.text().includes('NegozioDiProva'));
  for (const s of [KEYSTRING, SECRET, token.access_token, token.refresh_token, 'codice-monouso-123', verifierFromState(SECRET, avvia.state)]) {
    assert.ok(!a.text().includes(s) && !c.text().includes(s), `segreto nell'output: ${s.slice(0, 4)}…`);
  }
});

test('autorizzazione: state sbagliato → Etsy rifiuta, nessun token salvato', async () => {
  const fake = fakeEtsy();
  const store = memoryStore();
  const avvia = await runAuth({ passo: 'avvia', env: ENV, store, out: capture().out });
  fake.authorize('codice-x-123456', new URL(avvia.url).searchParams.get('code_challenge'));
  await assert.rejects(
    runAuth({ passo: 'completa', env: { ...ENV, ETSY_CODE: 'codice-x-123456', ETSY_STATE: newState() }, fetch: fake.fetch, store, out: capture().out, sleep: noSleep }),
    (e) => e.code === 'invalid_grant',
  );
  assert.equal(store.content, null);
});

test('autorizzazione: segreti o input mancanti → errore spiegato, nessuna chiamata', async () => {
  const fail = async () => { throw new Error('nessuna rete'); };
  const a = capture();
  assert.equal((await runAuth({ passo: 'avvia', env: {}, fetch: fail, store: memoryStore(), out: a.out })).status, 'error');
  assert.match(a.text(), /ETSY_KEYSTRING/);
  assert.equal((await runAuth({ passo: 'completa', env: ENV, fetch: fail, store: memoryStore(), out: capture().out })).reason, 'input');
});

test('autorizzazione: in GitHub Actions code e state arrivano dal payload dell\'evento, mai stampati', async () => {
  const fake = fakeEtsy();
  const store = memoryStore();
  const avvia = await runAuth({ passo: 'avvia', env: ENV, store, out: capture().out });
  fake.authorize('codice-dal-payload-77', new URL(avvia.url).searchParams.get('code_challenge'));
  const tmp = await mkdtemp(path.join(tmpdir(), 'nettochiaro-event-'));
  const eventPath = path.join(tmp, 'event.json');
  // L'utente incolla nel campo code l'intero indirizzo della pagina di callback.
  const pasted = `https://nettochiaro.com/etsy-callback/?code=codice-dal-payload-77&state=${avvia.state}`;
  await writeFile(eventPath, JSON.stringify({ inputs: { passo: 'completa', code: pasted, state: '' } }));
  const env = { ...ENV, GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: eventPath };
  assert.deepEqual(dispatchInputs(env), { passo: 'completa', code: pasted, state: '' });
  assert.deepEqual(dispatchInputs({}), {});
  const cap = capture(env);
  const r = await runAuth({ passo: 'completa', env, fetch: fake.fetch, store, out: cap.out, sleep: noSleep });
  assert.equal(r.status, 'ok');
  assert.equal(decryptJson(SECRET, store.content).access_token, fake.state.accessToken);
  const lines = cap.text().split('\n');
  // Il code e l'indirizzo incollato sono mascherati prima di qualsiasi altro output.
  assert.equal(lines[0].startsWith('::add-mask::'), true);
  assert.ok(lines.includes(`::add-mask::${pasted}`));
  assert.ok(lines.includes('::add-mask::codice-dal-payload-77'));
  const visible = lines.filter((l) => !l.startsWith('::add-mask::')).join('\n');
  assert.ok(!visible.includes('codice-dal-payload-77'));
  await rm(tmp, { recursive: true, force: true });
});

// --- Sincronizzazione ------------------------------------------------------------------------------

test('sync: senza segreti termina con successo e un avviso, senza rete', async () => {
  const root = await makeRoot(['prova-uno']);
  const cap = capture();
  const r = await runSync({ root, env: {}, fetch: async () => { throw new Error('nessuna rete'); }, store: memoryStore(), out: cap.out });
  assert.deepEqual(r, { status: 'skipped', reason: 'secrets' });
  assert.match(cap.text(), /mancano i segreti ETSY_KEYSTRING ed ETSY_SHARED_SECRET/);
  assert.ok(!existsSync(path.join(root, LISTINGS_FILE)));
  await rm(root, { recursive: true, force: true });
});

test('sync: senza autorizzazione termina con successo e un avviso', async () => {
  const root = await makeRoot(['prova-uno']);
  const cap = capture();
  const r = await runSync({ root, env: ENV, fetch: async () => { throw new Error('nessuna rete'); }, store: memoryStore(), out: cap.out });
  assert.deepEqual(r, { status: 'skipped', reason: 'token' });
  assert.match(cap.text(), /manca l'autorizzazione/);
  await rm(root, { recursive: true, force: true });
});

test('sync: crea bozza → immagini → file → attiva, poi è idempotente', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno', 'prova-due']);
  const r1 = await sync();
  assert.equal(r1.status, 'ok', r1.output);
  const l1 = await listings();
  assert.deepEqual(Object.keys(l1), ['prova-due', 'prova-uno']);
  for (const e of Object.values(l1)) {
    const listing = fake.state.listings.get(e.listing_id);
    assert.equal(listing.state, 'active');
    assert.equal(listing.type, 'download');
    assert.equal(listing.images.length, 5);
    assert.equal(listing.files.length, 1);
    assert.equal(listing.tags.length, 13);
    assert.equal(listing.taxonomy_id, resolveTaxonomy(taxonomyFromPaths([TAXONOMY_PATH]), TAXONOMY_PATH).id);
    assert.equal(e.state, 'active');
    assert.match(e.url, /^https:\/\/www\.etsy\.com\/listing\//);
    assert.match(e.hash, /^[0-9a-f]{16}$/);
    assert.deepEqual(Object.keys(e.parti), ['dati', 'prezzo', 'immagini', 'file']);
  }
  // Ordine dei passi per una nuova inserzione.
  const order = fake.writes().filter((c) => c.path.includes(`/${l1['prova-uno'].listing_id}`) || c.path === '/shops/4242/listings').map((c) => `${c.method} ${c.path.replace(/\d{6,}/g, 'ID')}`);
  assert.equal(order[0], 'POST /shops/4242/listings');
  assert.equal(order.at(-1), 'PATCH /shops/4242/listings/ID');

  const writesBefore = fake.writes().length;
  const fileBefore = await readFile(path.join(root, LISTINGS_FILE), 'utf8');
  const r2 = await sync();
  assert.equal(r2.status, 'ok');
  assert.equal(fake.writes().length, writesBefore, 'secondo run: nessuna scrittura su Etsy');
  assert.equal(await readFile(path.join(root, LISTINGS_FILE), 'utf8'), fileBefore, 'secondo run: file invariato');
  assert.ok(r2.rows.every((row) => row.actions[0] === 'nessuna modifica'));
  await rm(root, { recursive: true, force: true });
});

test('sync: aggiorna solo la parte cambiata', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno']);
  await sync();
  const id = (await listings())['prova-uno'].listing_id;
  const dir = path.join(root, 'products/prova-uno');
  const listingPath = path.join(dir, 'listing.json');
  const base = JSON.parse(await readFile(listingPath, 'utf8'));
  const newWrites = async (fn) => { const n = fake.writes().length; await fn(); const r = await sync(); assert.equal(r.status, 'ok', r.output); return fake.writes().slice(n).map((c) => `${c.method} ${c.path.replace(String(id), 'ID').replace(/\/\d{6,}$/, '/X')}`); };

  // Descrizione → solo PATCH dei dati.
  let w = await newWrites(() => writeFile(listingPath, JSON.stringify({ ...base, description: `${base.description}\nNuova riga.` })));
  assert.deepEqual(w, ['PATCH /shops/4242/listings/ID']);
  assert.ok(fake.state.listings.get(id).description.endsWith('Nuova riga.'));

  // Prezzo → solo inventory.
  w = await newWrites(() => writeFile(listingPath, JSON.stringify({ ...base, description: `${base.description}\nNuova riga.`, price: 6.9 })));
  assert.deepEqual(w, ['PUT /listings/ID/inventory']);
  assert.equal(fake.state.listings.get(id).price, 6.9);

  // Un'immagine → ricarica le immagini, niente dati né file.
  w = await newWrites(() => writeFile(path.join(dir, 'images/03.png'), png(2000, 1500, 'nuova')));
  assert.ok(w.length && w.every((x) => /\/images/.test(x)), w.join('\n'));
  assert.equal(fake.state.listings.get(id).images.length, 5);

  // Un file → ricarica i file senza mai lasciare l'inserzione senza file.
  w = await newWrites(() => writeFile(path.join(dir, 'files/prova.xlsx'), 'versione 2'));
  assert.ok(w.length && w.every((x) => /\/files/.test(x)), w.join('\n'));
  assert.equal(fake.state.lastFileDeletedOnListing, false);
  assert.equal(fake.state.listings.get(id).type, 'download');
  assert.equal(fake.state.listings.get(id).files.length, 1);
  assert.equal(fake.state.listings.get(id).files[0].size_bytes, 'versione 2'.length);

  // publish: false → disattiva.
  w = await newWrites(() => writeFile(listingPath, JSON.stringify({ ...base, description: `${base.description}\nNuova riga.`, price: 6.9, publish: false })));
  assert.equal(fake.state.listings.get(id).state, 'inactive');
  assert.equal(fake.state.listings.get(id).should_auto_renew, false);
  assert.equal((await listings())['prova-uno'].state, 'inactive');
  await rm(root, { recursive: true, force: true });
});

test('sync: senza etsy-listings.json ritrova l\'inserzione per titolo e non la duplica', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno']);
  await sync();
  const id = (await listings())['prova-uno'].listing_id;
  await rm(path.join(root, LISTINGS_FILE));
  const creates = () => fake.state.calls.filter((c) => c.method === 'POST' && c.path === '/shops/4242/listings').length;
  const before = creates();
  const r = await sync();
  assert.equal(r.status, 'ok', r.output);
  assert.equal(creates(), before);
  assert.equal((await listings())['prova-uno'].listing_id, id);
  assert.equal(fake.state.listings.size, 1);
  await rm(root, { recursive: true, force: true });
});

test('sync: un errore a metà viene ripreso al run successivo senza duplicati', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno']);
  fake.failNext('POST', /\/images$/, 400, 1);
  const r1 = await sync();
  assert.equal(r1.status, 'error');
  const e1 = (await listings())['prova-uno'];
  assert.ok(e1.listing_id, 'listing_id salvato subito dopo la creazione');
  assert.equal(e1.parti.immagini, undefined);
  assert.equal(e1.state, 'draft');
  const r2 = await sync();
  assert.equal(r2.status, 'ok', r2.output);
  assert.equal(fake.state.listings.size, 1);
  const e2 = (await listings())['prova-uno'];
  assert.equal(e2.listing_id, e1.listing_id);
  assert.equal(e2.state, 'active');
  assert.equal(fake.state.listings.get(e2.listing_id).images.length, 5);
  await rm(root, { recursive: true, force: true });
});

test('sync: inserzione cancellata su Etsy → segnata, non ricreata', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno']);
  await sync();
  const id = (await listings())['prova-uno'].listing_id;
  fake.state.listings.delete(id);
  const r = await sync();
  assert.equal(r.status, 'ok');
  assert.equal((await listings())['prova-uno'].state, 'deleted');
  assert.equal(fake.state.listings.size, 0);
  await sync();
  assert.equal(fake.state.listings.size, 0);
  await rm(root, { recursive: true, force: true });
});

test('sync: un 404 isolato di getListing non segna cancellata un\'inserzione che esiste nel negozio', async () => {
  const { root, fake, sync, listings } = await setup(['prova-uno']);
  await sync();
  const id = (await listings())['prova-uno'].listing_id;
  fake.failNext('GET', new RegExp(`^/listings/${id}$`), 404, 1);
  const r = await sync();
  assert.equal(r.status, 'ok', r.output);
  assert.equal((await listings())['prova-uno'].state, 'active');
  assert.match(r.output, /ha risposto 404, ma l'inserzione è nel negozio/);
  assert.equal(fake.state.listings.size, 1);
  await rm(root, { recursive: true, force: true });
});

test('sync: negozio con valuta diversa dall\'euro → nessuna scrittura, errore spiegato', async () => {
  const root = await makeRoot(['prova-uno']);
  const fake = fakeEtsy({ currency: 'USD' });
  await assert.rejects(
    runSync({ root, env: ENV, fetch: fake.fetch, store: tokenStore(fake), out: capture().out, sleep: noSleep }),
    (e) => /valuta USD/.test(e.message) && /euro/.test(e.hint),
  );
  assert.equal(fake.writes().length, 0);
  assert.ok(!existsSync(path.join(root, LISTINGS_FILE)));
  await rm(root, { recursive: true, force: true });
});

test('sync: prodotti non validi saltati, gli altri sincronizzati', async () => {
  const { root, fake, sync } = await setup(['prova-uno']);
  await writeProduct(root, 'prova-rotta', { tags: ['solo un tag'] });
  const r = await sync();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.invalid, ['prova-rotta']);
  assert.equal(fake.state.listings.size, 1);
  assert.match(r.output, /prova-rotta: non sincronizzato/);
  await rm(root, { recursive: true, force: true });
});

test('sync: token scaduto rinnovato e salvato cifrato', async () => {
  const root = await makeRoot(['prova-uno']);
  const fake = fakeEtsy();
  const store = tokenStore(fake, { expired: true });
  const oldRefresh = fake.state.refreshToken;
  const r = await runSync({ root, env: ENV, fetch: fake.fetch, store, out: capture().out, sleep: noSleep });
  assert.equal(r.status, 'ok');
  assert.equal(store.writes, 1);
  const saved = decryptJson(SECRET, store.content);
  assert.notEqual(saved.refresh_token, oldRefresh);
  assert.equal(saved.refresh_token, fake.state.refreshToken);
  await rm(root, { recursive: true, force: true });
});

test('sync: DRY_RUN stampa le chiamate senza rete e senza scrivere file', async () => {
  const root = await makeRoot(['prova-uno']);
  const cap = capture();
  const r = await runSync({ root, env: { DRY_RUN: '1' }, fetch: async () => { throw new Error('rete usata in DRY_RUN'); }, out: cap.out });
  assert.equal(r.status, 'ok');
  assert.match(cap.text(), /\[DRY_RUN\] POST \/shops\/\d+\/listings/);
  assert.match(cap.text(), /\[DRY_RUN\] PATCH \/shops\/\d+\/listings\/\d+ {2}campi: state/);
  assert.ok(!existsSync(path.join(root, LISTINGS_FILE)));
  await rm(root, { recursive: true, force: true });
});

test('resolveTaxonomy: percorso esatto, ripiego sulla foglia, errore con le voci disponibili', () => {
  const tree = taxonomyFromPaths([TAXONOMY_PATH, ['Paper & Party Supplies', 'Party Supplies']]);
  const exact = resolveTaxonomy(tree, TAXONOMY_PATH);
  assert.ok(exact.id && !exact.warning);
  assert.equal(resolveTaxonomy(tree, TAXONOMY_PATH.map((s) => s.toLowerCase())).id, exact.id);
  const leaf = resolveTaxonomy(tree, ['Carta', 'Bookkeeping Templates']);
  assert.equal(leaf.id, exact.id);
  assert.ok(leaf.warning);
  assert.throws(() => resolveTaxonomy(tree, ['Paper & Party Supplies', 'Inesistente']), /Voci disponibili: Paper, Party Supplies/);
});

// --- Report vendite --------------------------------------------------------------------------------

const DAY = 86400;
const NOW = Date.UTC(2026, 9, 6, 5, 0, 0);
function receipt(id, daysAgo, items, extra = {}) {
  return {
    receipt_id: id, buyer_user_id: 5550000 + id, buyer_email: `cliente${id}@example.com`, name: `Mario Rossi ${id}`,
    first_line: 'Via Roma 1', city: 'Milano', zip: '20100', formatted_address: 'Via Roma 1, 20100 Milano', message_from_buyer: 'Grazie, saluti a tutti',
    status: 'paid', is_paid: true, created_timestamp: NOW / 1000 - daysAgo * DAY,
    transactions: items.map(([listing_id, quantity, cents]) => ({ listing_id, quantity, buyer_user_id: 5550000 + id, price: { amount: cents, divisor: 100, currency_code: 'EUR' } })),
    ...extra,
  };
}

test('report: aggregati corretti, ultimi 30 giorni, annullati e rimborsati esclusi', () => {
  const receipts = [
    receipt(1, 2, [[101, 1, 990]]),
    receipt(2, 10, [[101, 2, 990], [202, 1, 590]]),
    receipt(3, 45, [[202, 1, 590]]),
    receipt(4, 5, [[101, 1, 990]], { status: 'Canceled' }),
    receipt(5, 5, [[202, 1, 590]], { status: 'fully refunded' }),
    receipt(6, 1, [[999, 1, 1500]]),
  ];
  const r = aggregateSales(receipts, new Map([[101, 'gestionale'], [202, 'budget']]), { now: NOW, slugs: ['gestionale', 'budget', 'nuovo'] });
  assert.deepEqual(r.prodotti, {
    'altre-inserzioni': { vendite: 1, ricavi: 15, vendite_30_giorni: 1, ricavi_30_giorni: 15 },
    budget: { vendite: 2, ricavi: 11.8, vendite_30_giorni: 1, ricavi_30_giorni: 5.9 },
    gestionale: { vendite: 3, ricavi: 29.7, vendite_30_giorni: 3, ricavi_30_giorni: 29.7 },
    nuovo: { vendite: 0, ricavi: 0, vendite_30_giorni: 0, ricavi_30_giorni: 0 },
  });
  assert.deepEqual(r.totale, { vendite: 6, ricavi: 56.5 });
  assert.deepEqual(r.ultimi_30_giorni, { vendite: 5, ricavi: 50.6 });
  assert.equal(r.valuta, 'EUR');
  assert.equal(r.aggiornato, '2026-10-06');
});

test('report: nessun dato personale degli acquirenti nel file', async () => {
  const receipts = [receipt(1, 2, [[101, 1, 990]]), receipt(2, 3, [[101, 1, 990]])];
  const text = JSON.stringify(aggregateSales(receipts, new Map([[101, 'gestionale']]), { now: NOW }));
  for (const bad of ['Mario', 'Rossi', '@example.com', 'Via Roma', 'Milano', '20100', 'Grazie', '555000', 'receipt', 'buyer']) {
    assert.ok(!text.includes(bad), `dato personale nel report: ${bad}`);
  }
});

test('report: scrive products/etsy-sales.json dalle vendite di Etsy', async () => {
  const { root, fake, store, sync, listings } = await setup(['prova-uno']);
  await sync();
  const id = (await listings())['prova-uno'].listing_id;
  const receipts = [receipt(1, 1, [[id, 1, 490]])];
  const fake2 = createFakeEtsy({ keystring: KEYSTRING, sharedSecret: SECRET, receipts, accessToken: fake.state.accessToken, refreshToken: fake.state.refreshToken });
  const r = await runReport({ root, env: ENV, fetch: fake2.fetch, store, out: capture().out, sleep: noSleep });
  assert.equal(r.status, 'ok');
  const file = JSON.parse(await readFile(path.join(root, SALES_FILE), 'utf8'));
  assert.deepEqual(file.prodotti['prova-uno'], { vendite: 1, ricavi: 4.9, vendite_30_giorni: 1, ricavi_30_giorni: 4.9 });
  const q = fake2.state.calls.find((c) => c.path === '/shops/4242/receipts').query;
  assert.equal(q.was_paid, 'true');
  assert.equal(q.was_canceled, 'false');
  // Senza segreti: nessun file, nessun errore.
  const root2 = await makeRoot();
  assert.equal((await runReport({ root: root2, env: {}, store: memoryStore(), out: capture().out })).status, 'skipped');
  assert.ok(!existsSync(path.join(root2, SALES_FILE)));
  await rm(root, { recursive: true, force: true });
  await rm(root2, { recursive: true, force: true });
});

// --- Nessun segreto nell'output --------------------------------------------------------------------

test('nessun segreto in log, summary e file del repository (anche in GitHub Actions)', async () => {
  const root = await makeRoot(['prova-uno']);
  const fake = fakeEtsy();
  const store = memoryStore();
  const env = { ...ENV, GITHUB_ACTIONS: 'true' };
  const cap = capture(env);
  const avvia = await runAuth({ passo: 'avvia', env, store, out: cap.out });
  fake.authorize('code-segretissimo-42', new URL(avvia.url).searchParams.get('code_challenge'));
  await runAuth({ passo: 'completa', env: { ...env, ETSY_CODE: 'code-segretissimo-42', ETSY_STATE: avvia.state }, fetch: fake.fetch, store, out: cap.out, sleep: noSleep });
  const firstToken = decryptJson(SECRET, store.content);
  // Forza un rinnovo durante la sync e un errore Etsy che finisce nel log.
  fake.state.tokenExpiresAt = 0;
  fake.failNext('POST', /\/files$/, 400, 1);
  await runSync({ root, env, fetch: fake.fetch, store, out: cap.out, sleep: noSleep });
  await runReport({ root, env, fetch: fake.fetch, store, out: cap.out, sleep: noSleep });
  const lastToken = decryptJson(SECRET, store.content);

  const secrets = [KEYSTRING, SECRET, `${KEYSTRING}:${SECRET}`, 'code-segretissimo-42', verifierFromState(SECRET, avvia.state),
    firstToken.access_token, firstToken.refresh_token, lastToken.access_token, lastToken.refresh_token];
  assert.notEqual(firstToken.refresh_token, lastToken.refresh_token);
  const all = cap.text();
  const visible = all.split('\n').filter((l) => !l.startsWith('::add-mask::')).join('\n');
  for (const s of secrets) assert.ok(!visible.includes(s), `segreto visibile nell'output: ${s.slice(0, 5)}…`);
  for (const s of [KEYSTRING, SECRET, lastToken.access_token, lastToken.refresh_token]) assert.ok(all.includes(`::add-mask::${s}\n`), 'segreto non mascherato con ::add-mask::');
  // File che finiscono nel repository pubblico e stato cifrato sul branch etsy-state.
  const files = (await readdir(path.join(root, 'products'))).filter((f) => f.endsWith('.json')).map((f) => path.join(root, 'products', f));
  assert.ok(files.length >= 1);
  for (const f of [...files]) {
    const text = await readFile(f, 'utf8');
    for (const s of secrets) assert.ok(!text.includes(s), `segreto in ${path.basename(f)}`);
  }
  for (const s of secrets) assert.ok(!store.content.includes(s), 'segreto in chiaro in etsy-token.enc');
  await rm(root, { recursive: true, force: true });
});

// --- Archivio git del token (branch orfano etsy-state) ---------------------------------------------

test('gitStore: crea il branch orfano etsy-state, legge e riscrive senza toccare il working tree', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'nettochiaro-git-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = path.join(tmp, 'origin.git');
  const work = path.join(tmp, 'work');
  git(tmp, 'init', '-q', '--bare', origin);
  git(tmp, 'init', '-q', work);
  git(work, 'remote', 'add', 'origin', origin);
  await writeFile(path.join(work, 'file.txt'), 'ciao');
  git(work, 'add', '.');
  git(work, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'primo');
  git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/main');

  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  const s1 = gitStore({ cwd: work, env });
  assert.equal(await s1.read(), null);
  await s1.write('v1.contenuto.uno.tag\n', 'Etsy: prova');
  const first = git(origin, 'rev-parse', 'etsy-state');
  // Cloudflare Pages salta la build solo se [skip ci] è all'inizio del messaggio.
  assert.match(git(origin, 'log', '--format=%s', '-1', 'etsy-state'), /^\[skip ci\] Etsy: prova$/);
  assert.equal(git(origin, 'log', '--format=%P', '-1', 'etsy-state'), '', 'primo commit senza genitori (branch orfano)');
  assert.deepEqual(git(origin, 'ls-tree', '--name-only', 'etsy-state').split('\n').sort(), ['README.md', 'etsy-token.enc']);

  const s2 = gitStore({ cwd: work, env });
  assert.equal(await s2.read(), 'v1.contenuto.uno.tag\n');
  await s2.write('v1.contenuto.due.tag\n', 'Etsy: token rinnovato');
  assert.equal(git(origin, 'log', '--format=%P', '-1', 'etsy-state'), first);
  assert.equal(await gitStore({ cwd: work, env }).read(), 'v1.contenuto.due.tag\n');
  assert.equal(git(work, 'status', '--porcelain'), '', 'working tree invariato');
  assert.equal(git(work, 'rev-parse', '--abbrev-ref', 'HEAD') !== 'etsy-state', true);
  await rm(tmp, { recursive: true, force: true });
});

// --- Workflow: niente input nello shell, niente cicli di commit, permessi minimi --------------------

const WF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.github/workflows');

test('workflow Etsy: input mai interpolati nei comandi, code e state fuori da env, permessi minimi', async () => {
  const auth = await readFile(path.join(WF, 'etsy-auth.yml'), 'utf8');
  const sync = await readFile(path.join(WF, 'etsy-sync.yml'), 'utf8');
  for (const [name, text] of [['etsy-auth.yml', auth], ['etsy-sync.yml', sync]]) {
    // Ogni blocco run: (riga singola o multilinea) senza espressioni ${{ }}: i valori passano da env.
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/^(\s*)(- )?run:\s*(.*)$/);
      if (!m) return;
      const indent = m[1].length + (m[2] ? 2 : 0);
      const block = [m[3]];
      for (let j = i + 1; j < lines.length && (!lines[j].trim() || lines[j].search(/\S/) > indent); j++) block.push(lines[j]);
      assert.ok(!block.join('\n').includes('${{'), `${name}:${i + 1}: espressione \${{ }} dentro run:`);
    });
    assert.ok(!/permissions:\s*write-all/.test(text) && !/id-token|pull-requests|packages/.test(text), `${name}: permessi in eccesso`);
    assert.ok(!/pull_request_target/.test(text), `${name}: pull_request_target`);
  }
  assert.ok(!/inputs\.(code|state)/.test(auth), 'etsy-auth.yml: code e state non devono passare da env (finirebbero nel log)');
  assert.match(sync, /permissions:\n {2}contents: write #/);
  assert.match(auth, /permissions:\n {2}contents: write #[^\n]*\n {2}actions: write #/);
  // Il commit della sync tocca solo questi due file, esclusi dal trigger push.
  assert.match(sync, /- "!products\/etsy-listings\.json"/);
  assert.match(sync, /- "!products\/etsy-sales\.json"/);
  assert.match(sync, /git add "\$f"/);
  assert.match(sync, /for f in products\/etsy-listings\.json products\/etsy-sales\.json; do/);
});
