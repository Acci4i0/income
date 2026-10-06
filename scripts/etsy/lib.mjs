// Client Etsy Open API v3 senza dipendenze (Node 22: fetch, FormData, Blob, crypto nativi).
//
// Documentazione di riferimento (consultata il 6/10/2026):
// - Autenticazione OAuth 2.0 con PKCE: https://developers.etsy.com/documentation/essentials/authentication
//   URL di connessione https://www.etsy.com/oauth/connect, token https://api.etsy.com/v3/public/oauth/token,
//   code_challenge_method=S256, access token di 3600 s, refresh token di 90 giorni.
// - Header x-api-key = "<keystring>:<shared secret>" obbligatorio dal 9/2/2026:
//   https://github.com/etsy/open-api/discussions/1529 e https://developers.etsy.com/documentation/essentials/requests
// - Limiti di frequenza (5 richieste/s, 5.000/giorno per le app personali, header retry-after):
//   https://developers.etsy.com/documentation/essentials/rate-limits
//
// Repository pubblico: nessun segreto deve finire in log, summary o file. Ogni valore sensibile passa da
// out.secret(), che lo maschera nei log di GitHub Actions (::add-mask::) e lo sostituisce con *** in ogni
// testo stampato da questi script.

import { createHash, createHmac, hkdfSync, scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export const API_BASE = 'https://api.etsy.com/v3/application';
export const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
export const CONNECT_URL = 'https://www.etsy.com/oauth/connect';
export const REDIRECT_URI = 'https://nettochiaro.com/etsy-callback/';
// listings_r/listings_w: bozze, immagini, file, attivazione. shops_r: getMe e negozio. transactions_r: vendite.
export const SCOPES = ['listings_r', 'listings_w', 'shops_r', 'transactions_r'];
export const STATE_BRANCH = 'etsy-state';
export const TOKEN_FILE = 'etsy-token.enc';
export const SKIP_CI = '[skip ci]';

const HKDF_SALT = 'nettochiaro/etsy/v1';
const TOKEN_AAD = Buffer.from('nettochiaro-etsy-token-v1');

export class EtsyError extends Error {
  constructor(message, { status = 0, code = '', hint = '' } = {}) {
    super(message);
    this.name = 'EtsyError';
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export const isDryRun = (env = process.env) => ['1', 'true', 'yes'].includes(String(env.DRY_RUN || '').toLowerCase());

// ---------------------------------------------------------------------------------------------------------
// Segreti e chiavi

/** Legge ETSY_KEYSTRING ed ETSY_SHARED_SECRET. Restituisce null se ne manca almeno uno. */
export function readSecrets(env = process.env) {
  const keystring = String(env.ETSY_KEYSTRING || '').trim();
  const sharedSecret = String(env.ETSY_SHARED_SECRET || '').trim();
  if (!keystring || !sharedSecret) return null;
  if (keystring.includes(':')) {
    throw new EtsyError('ETSY_KEYSTRING contiene ":". Metti nel segreto solo il keystring; la shared secret va in ETSY_SHARED_SECRET.');
  }
  return { keystring, sharedSecret };
}

// Il token cifrato (branch etsy-state) e il code_challenge (link di autorizzazione) sono pubblici, e la
// shared secret di Etsy è corta (circa 10 caratteri): una chiave derivata solo con HKDF si potrebbe
// cercare per forza bruta. Prima la shared secret passa da scrypt (lento e con 64 MB di memoria per
// tentativo), poi HKDF-SHA256 separa una chiave per ogni scopo.
const SCRYPT = { N: 2 ** 16, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const masterKeys = new Map();
function masterKey(sharedSecret) {
  if (!masterKeys.has(sharedSecret)) masterKeys.set(sharedSecret, scryptSync(Buffer.from(sharedSecret, 'utf8'), HKDF_SALT, 32, SCRYPT));
  return masterKeys.get(sharedSecret);
}

/** Chiave a 32 byte per uno scopo ("pkce", "token-state"): scrypt sulla shared secret, poi HKDF-SHA256. */
export function deriveKey(sharedSecret, purpose) {
  return Buffer.from(hkdfSync('sha256', masterKey(sharedSecret), HKDF_SALT, `nettochiaro-etsy:${purpose}`, 32));
}

export const b64url = (buf) => Buffer.from(buf).toString('base64url');

// ---------------------------------------------------------------------------------------------------------
// PKCE (RFC 7636). Il code_verifier non si salva: è l'HMAC dello state con una chiave derivata dalla
// shared secret, quindi "completa" lo ricalcola dallo state che Etsy rimanda alla pagina di callback.

export function newState() {
  return b64url(randomBytes(24)); // 32 caratteri base64url
}

export function verifierFromState(sharedSecret, state) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(state || ''))) {
    throw new EtsyError('Lo state non è valido: copialo per intero dalla pagina etsy-callback.');
  }
  // 32 byte in base64url = 43 caratteri, il minimo ammesso da RFC 7636 (43-128, caratteri non riservati).
  return b64url(createHmac('sha256', deriveKey(sharedSecret, 'pkce')).update(state).digest());
}

export const challengeFromVerifier = (verifier) => b64url(createHash('sha256').update(verifier).digest());

// Il client_id (keystring) è un identificativo pubblico OAuth: compare comunque nella barra degli
// indirizzi durante l'autorizzazione e da solo non dà accesso all'API (serve anche la shared secret).
// GitHub però lo maschera con *** nel job summary perché è salvato come segreto, e il link non
// funzionerebbe: lo codifichiamo byte per byte (%xx), che Etsy decodifica come qualsiasi query string.
const percentEncodeAll = (s) => [...Buffer.from(s, 'utf8')].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');

export function authorizeUrl({ keystring, sharedSecret, state, redirectUri = REDIRECT_URI, scopes = SCOPES }) {
  const challenge = challengeFromVerifier(verifierFromState(sharedSecret, state));
  const enc = encodeURIComponent;
  const query = [
    'response_type=code',
    `client_id=${percentEncodeAll(keystring)}`,
    `redirect_uri=${enc(redirectUri)}`,
    `scope=${scopes.map(enc).join('%20')}`,
    `state=${enc(state)}`,
    `code_challenge=${enc(challenge)}`,
    'code_challenge_method=S256',
  ].join('&');
  return `${CONNECT_URL}?${query}`;
}

// ---------------------------------------------------------------------------------------------------------
// Cifratura dello stato del token (AES-256-GCM, IV casuale di 12 byte, tag di 16 byte).
// Formato del file: "v1.<iv>.<ciphertext>.<tag>" in base64url.

export function encryptJson(sharedSecret, obj) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(sharedSecret, 'token-state'), iv, { authTagLength: 16 });
  cipher.setAAD(TOKEN_AAD);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return `v1.${b64url(iv)}.${b64url(ct)}.${b64url(cipher.getAuthTag())}\n`;
}

export function decryptJson(sharedSecret, text) {
  const parts = String(text || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new EtsyError(`${TOKEN_FILE}: formato non riconosciuto.`);
  const [, iv, ct, tag] = parts.map((p, i) => (i ? Buffer.from(p, 'base64url') : p));
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(sharedSecret, 'token-state'), iv, { authTagLength: 16 });
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
  } catch {
    throw new EtsyError(`Impossibile decifrare ${TOKEN_FILE}: la shared secret è cambiata o il file è danneggiato.`, {
      hint: 'Rifai l\'autorizzazione: Actions → "Etsy: autorizzazione" con passo "avvia", poi "completa".',
    });
  }
}

/** Normalizza la risposta dell'endpoint token. L'access token inizia con l'id utente: "12345678.xxxx". */
export function tokenFromResponse(data, now = Date.now()) {
  if (!data || typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
    throw new EtsyError('Risposta di Etsy senza access_token o refresh_token.');
  }
  const userId = Number(data.access_token.split('.')[0]);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    scope: data.scope || SCOPES.join(' '),
    user_id: Number.isFinite(userId) && userId > 0 ? userId : null,
    expires_at: new Date(now + (Number(data.expires_in) || 3600) * 1000).toISOString(),
    refreshed_at: new Date(now).toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Output: log, avvisi e job summary, con mascheramento dei segreti.

export function createOutput({ env = process.env, write = (s) => process.stdout.write(s), summaryFile } = {}) {
  const secrets = new Set();
  const actions = env.GITHUB_ACTIONS === 'true';
  const file = summaryFile === undefined ? env.GITHUB_STEP_SUMMARY : summaryFile;
  const scrub = (text) => {
    let s = String(text);
    for (const v of [...secrets].sort((a, b) => b.length - a.length)) s = s.split(v).join('***');
    return s;
  };
  // Valori dei comandi di workflow: %, \r e \n vanno codificati (docs GitHub "workflow commands").
  const cmd = (s) => scrub(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return {
    secret(value) {
      const v = String(value ?? '');
      if (v.length < 6 || secrets.has(v)) return;
      secrets.add(v);
      if (actions) write(`::add-mask::${v}\n`);
    },
    log: (...args) => write(`${scrub(args.join(' '))}\n`),
    warn: (msg) => write(actions ? `::warning::${cmd(msg)}\n` : `Avviso: ${scrub(msg)}\n`),
    error: (msg) => write(actions ? `::error::${cmd(msg)}\n` : `Errore: ${scrub(msg)}\n`),
    summary(markdown) {
      const s = `${scrub(markdown).trimEnd()}\n\n`;
      if (file) appendFileSync(file, s);
      else write(s);
    },
    scrub,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Client HTTP con retry su 429/5xx, rinnovo automatico del token e limite di frequenza.

const IDEMPOTENT = new Set(['GET', 'PUT', 'PATCH', 'DELETE']);

function formBody(fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    // Gli array (tags, materials) vanno come lista separata da virgole, come indica la reference.
    body.append(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return body;
}

function multipartBody(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (v && typeof v === 'object' && v.blob instanceof Blob) fd.append(k, v.blob, v.filename);
    else fd.append(k, String(v));
  }
  return fd;
}

async function readBody(res) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; }
}

function apiErrorMessage(body) {
  if (!body) return '';
  const parts = [body.error, body.error_description, body.message, body.raw].filter((x) => typeof x === 'string' && x);
  return parts.join(': ').slice(0, 500);
}

export class EtsyClient {
  constructor({ keystring, sharedSecret, token = null, fetch = globalThis.fetch, onToken = async () => {}, out = createOutput(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), minInterval = 250, maxAttempts = 5 }) {
    Object.assign(this, { keystring, sharedSecret, token, fetchImpl: fetch, onToken, out, sleep, now, minInterval, maxAttempts });
    this.lastRequestAt = 0;
    this.requests = 0;
    out.secret(keystring);
    out.secret(sharedSecret);
    out.secret(`${keystring}:${sharedSecret}`);
    if (token) { out.secret(token.access_token); out.secret(token.refresh_token); }
  }

  apiKey() { return `${this.keystring}:${this.sharedSecret}`; }

  async throttle() {
    const wait = this.lastRequestAt + this.minInterval - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
  }

  /** Esegue una richiesta con retry. Restituisce { status, body, headers }. */
  async send(method, url, { headers = {}, body, retryUnsafe = false } = {}) {
    const canRetry = IDEMPOTENT.has(method) || retryUnsafe;
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await this.throttle();
      this.requests++;
      let res;
      try {
        res = await this.fetchImpl(url, { method, headers, body: typeof body === 'function' ? body() : body, redirect: 'manual' });
      } catch (e) {
        lastError = new EtsyError(`Rete non raggiungibile (${method} ${url.split('?')[0]}): ${e.message}`);
        if (!canRetry || attempt === this.maxAttempts) throw lastError;
        await this.sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
        continue;
      }
      const status = res.status;
      // 429: la richiesta non è stata eseguita, si può sempre ripetere. 5xx e redirect (Etsy a volte
      // rimanda a una pagina HTML): si ripete solo se la richiesta è idempotente.
      const transient = status === 429 || status >= 500 || (status >= 300 && status < 400);
      if (transient && (status === 429 || canRetry) && attempt < this.maxAttempts) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, retryAfter) * 1000 : Math.min(30000, 1000 * 2 ** (attempt - 1));
        await res.body?.cancel?.().catch(() => {});
        this.out.log(`Etsy ha risposto ${status} a ${method} ${url.split('?')[0].replace(API_BASE, '')}: nuovo tentativo tra ${Math.round(delay / 1000)} s`);
        await this.sleep(delay);
        continue;
      }
      return { status, body: await readBody(res), headers: res.headers };
    }
    throw lastError || new EtsyError(`${method} ${url}: troppi tentativi`);
  }

  async refresh() {
    if (!this.token?.refresh_token) throw new EtsyError('Manca il refresh token.');
    const body = formBody({ grant_type: 'refresh_token', client_id: this.keystring, refresh_token: this.token.refresh_token }).toString();
    const res = await this.send('POST', TOKEN_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'x-api-key': this.apiKey() },
      body,
      retryUnsafe: true,
    });
    if (res.status !== 200) {
      throw new EtsyError(`Rinnovo del token rifiutato da Etsy (${res.status} ${apiErrorMessage(res.body)}).`, {
        status: res.status,
        code: res.body?.error || '',
        hint: res.status === 400 || res.status === 401
          ? 'Il refresh token scade dopo 90 giorni senza uso o se revochi l\'accesso. Rifai l\'autorizzazione: Actions → "Etsy: autorizzazione" → "avvia", poi "completa".'
          : 'Etsy non risponde: riprova più tardi (Actions → "Etsy: sincronizzazione" → Run workflow).',
      });
    }
    const token = tokenFromResponse(res.body, this.now());
    if (!token.user_id && this.token.user_id) token.user_id = this.token.user_id;
    this.out.secret(token.access_token);
    this.out.secret(token.refresh_token);
    this.token = token;
    // Il refresh token precedente può non valere più: il nuovo va salvato subito.
    await this.onToken(token);
    return token;
  }

  async accessToken() {
    if (!this.token) throw new EtsyError('Token mancante.');
    if (Date.parse(this.token.expires_at) - this.now() < 5 * 60 * 1000) await this.refresh();
    return this.token.access_token;
  }

  /**
   * Chiamata API. path relativo a API_BASE (es. "/users/me"). Opzioni: query (oggetto), form (urlencoded),
   * json, multipart (oggetto con { blob, filename } per i file), retryUnsafe (POST ripetibili senza danni).
   */
  async request(method, pathOrUrl, { query, form, json, multipart, retryUnsafe = false } = {}) {
    let url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
    if (query) {
      const q = formBody(query).toString();
      if (q) url += `${url.includes('?') ? '&' : '?'}${q}`;
    }
    let refreshed = false;
    for (;;) {
      const headers = { 'x-api-key': this.apiKey(), accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` };
      let body;
      if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = formBody(form).toString(); }
      else if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
      else if (multipart) body = () => multipartBody(multipart);
      const res = await this.send(method, url, { headers, body, retryUnsafe });
      if (res.status === 401 && !refreshed) { refreshed = true; await this.refresh(); continue; }
      if (res.status >= 200 && res.status < 300) return res.status === 204 ? null : res.body;
      throw new EtsyError(`Etsy ${method} ${url.replace(API_BASE, '').split('?')[0]}: ${res.status} ${apiErrorMessage(res.body)}`.trim(), {
        status: res.status,
        code: res.body?.error || '',
      });
    }
  }

  /** Raccoglie tutte le pagine di un endpoint che restituisce { count, results }. */
  async paginate(pathname, query = {}, { limit = 100, maxPages = 100 } = {}) {
    const all = [];
    for (let page = 0; page < maxPages; page++) {
      const res = await this.request('GET', pathname, { query: { ...query, limit, offset: page * limit } });
      const results = res?.results || [];
      all.push(...results);
      if (results.length < limit || (res.count !== undefined && all.length >= res.count)) break;
    }
    return all;
  }
}

/** Scambia il code dell'autorizzazione con i token (grant authorization_code + code_verifier). */
export async function exchangeCode({ keystring, sharedSecret, code, state, redirectUri = REDIRECT_URI, fetch = globalThis.fetch, out = createOutput(), now = () => Date.now(), sleep }) {
  const verifier = verifierFromState(sharedSecret, state);
  out.secret(code);
  out.secret(verifier);
  const client = new EtsyClient({ keystring, sharedSecret, fetch, out, now, sleep });
  const body = formBody({ grant_type: 'authorization_code', client_id: keystring, redirect_uri: redirectUri, code, code_verifier: verifier }).toString();
  // Il code è monouso: niente retry su 5xx (un secondo tentativo fallirebbe comunque con invalid_grant).
  const res = await client.send('POST', TOKEN_URL, {
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'x-api-key': client.apiKey() },
    body,
  });
  if (res.status !== 200) {
    throw new EtsyError(`Etsy ha rifiutato il codice (${res.status} ${apiErrorMessage(res.body)}).`, {
      status: res.status,
      code: res.body?.error || '',
      hint: 'Il codice vale pochi minuti e una volta sola. Riapri il link di "avvia" (resta valido), autorizza di nuovo e lancia subito "completa" con il nuovo code.',
    });
  }
  const token = tokenFromResponse(res.body, now());
  out.secret(token.access_token);
  out.secret(token.refresh_token);
  return token;
}

// ---------------------------------------------------------------------------------------------------------
// Archivio del token cifrato.
// - gitStore: file etsy-token.enc sul branch orfano "etsy-state" del repository (usato da GitHub Actions).
//   Usa solo comandi git di basso livello: non tocca il working tree e crea il branch se manca.
// - fileStore: file locale (variabile ETSY_STATE_FILE), per prove in locale.
// - memoryStore: per i test e per DRY_RUN.

const STATE_README = `# etsy-state

Branch tecnico scritto da GitHub Actions (scripts/etsy/). Contiene solo \`${TOKEN_FILE}\`: il token di accesso
al negozio Etsy, cifrato con AES-256-GCM e una chiave derivata dal segreto ETSY_SHARED_SECRET, che non è nel
repository. Non modificarlo a mano. Per revocare l'accesso: Etsy → Impostazioni → App collegate, oppure
cancella questo branch.
`;

export function gitStore({ cwd = process.cwd(), branch = STATE_BRANCH, file = TOKEN_FILE, remote = 'origin', env = process.env } = {}) {
  const ref = `refs/remotes/${remote}/${branch}`;
  const git = (args, input) => execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...env,
      GIT_AUTHOR_NAME: 'github-actions[bot]',
      GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'github-actions[bot]',
      GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    },
  });
  let tip;
  return {
    async read() {
      const heads = git(['ls-remote', '--heads', remote, branch]).trim();
      if (!heads) { tip = null; return null; }
      git(['fetch', '--no-tags', '--depth=1', remote, `+refs/heads/${branch}:${ref}`]);
      tip = git(['rev-parse', ref]).trim();
      try { return git(['show', `${tip}:${file}`]); } catch { return null; }
    },
    async write(content, message) {
      if (tip === undefined) await this.read();
      const blob = git(['hash-object', '-w', '--stdin'], content).trim();
      const readme = git(['hash-object', '-w', '--stdin'], STATE_README).trim();
      const tree = git(['mktree'], `100644 blob ${readme}\tREADME.md\n100644 blob ${blob}\t${file}\n`).trim();
      // [skip ci]: niente build di anteprima Cloudflare Pages (e niente CI) per questo branch tecnico.
      // Cloudflare Pages lo riconosce solo come PREFISSO del messaggio ("as a prefix in your commit
      // message", docs Pages → GitHub integration → Skipping a build via a commit message); GitHub Actions
      // in qualsiasi punto.
      const commit = git(['commit-tree', tree, ...(tip ? ['-p', tip] : []), '-m', `${SKIP_CI} ${message}`]).trim();
      try {
        git(['push', '--quiet', remote, `${commit}:refs/heads/${branch}`]);
      } catch (e) {
        throw new EtsyError(`Impossibile salvare il token sul branch ${branch}: ${String(e.stderr || e.message).trim().split('\n').pop()}`, {
          hint: 'Controlla che il workflow abbia "permissions: contents: write". Se il token è stato appena rinnovato, rifai l\'autorizzazione.',
        });
      }
      git(['update-ref', ref, commit]);
      tip = commit;
    },
  };
}

export function fileStore(file) {
  return {
    async read() { return existsSync(file) ? readFileSync(file, 'utf8') : null; },
    async write(content) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content); },
  };
}

export function memoryStore(initial = null) {
  const store = {
    content: initial,
    writes: 0,
    async read() { return store.content; },
    async write(content) { store.content = content; store.writes++; },
  };
  return store;
}

export function storeFromEnv({ env = process.env, cwd = process.cwd() } = {}) {
  return env.ETSY_STATE_FILE ? fileStore(path.resolve(cwd, env.ETSY_STATE_FILE)) : gitStore({ cwd, env });
}

// ---------------------------------------------------------------------------------------------------------
// Sessione: segreti + token + negozio. Restituisce { skipped } se manca qualcosa del setup.

export async function openSession({ env = process.env, store, fetch = globalThis.fetch, out = createOutput({ env }), now = () => Date.now(), sleep } = {}) {
  const secrets = readSecrets(env);
  if (!secrets) return { skipped: 'secrets' };
  out.secret(secrets.keystring);
  out.secret(secrets.sharedSecret);
  const text = await store.read();
  if (!text) return { skipped: 'token' };
  const token = decryptJson(secrets.sharedSecret, text);
  const client = new EtsyClient({
    ...secrets,
    token,
    fetch,
    out,
    now,
    sleep,
    onToken: async (t) => store.write(encryptJson(secrets.sharedSecret, t), 'Etsy: token rinnovato (cifrato)'),
  });
  // getMe: https://developers.etsy.com/documentation/reference#operation/getMe → { user_id, shop_id }
  const me = await client.request('GET', '/users/me');
  if (!me?.shop_id) return { skipped: 'shop', client };
  return { client, shopId: me.shop_id, userId: me.user_id };
}

/** Messaggio per il job summary quando il setup non è completo (il workflow termina comunque con successo). */
export function setupMessage(reason, what = 'La sincronizzazione con Etsy') {
  const guide = 'Passi in `products/ETSY.md`.';
  const text = {
    secrets: `${what} non è ancora attiva: mancano i segreti ETSY_KEYSTRING ed ETSY_SHARED_SECRET (Settings → Secrets and variables → Actions). ${guide}`,
    token: `${what} non è ancora attiva: manca l'autorizzazione del negozio. Lancia Actions → "Etsy: autorizzazione" con passo "avvia", poi "completa". ${guide}`,
    shop: `${what} non è ancora attiva: l'account Etsy autorizzato non ha un negozio aperto. ${guide}`,
  }[reason];
  return text || `${what} non è attiva (${reason}). ${guide}`;
}

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
