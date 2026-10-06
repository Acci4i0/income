// Autorizzazione una tantum del negozio Etsy, eseguita da .github/workflows/etsy-auth.yml.
// Uso: node scripts/etsy/auth.mjs avvia
//      ETSY_CODE=… ETSY_STATE=… node scripts/etsy/auth.mjs completa
//      (in GitHub Actions code e state arrivano dagli input del workflow_dispatch, letti da $GITHUB_EVENT_PATH)
//
// "avvia" genera uno state casuale e scrive nel job summary il link di autorizzazione Etsy (OAuth 2.0
// con PKCE). Il code_verifier non si salva da nessuna parte: è l'HMAC dello state con una chiave derivata
// da ETSY_SHARED_SECRET. "completa" lo ricalcola dallo state, scambia il code con i token, li cifra e li
// salva in etsy-token.enc sul branch "etsy-state".
// Docs: https://developers.etsy.com/documentation/essentials/authentication

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createOutput, readSecrets, newState, authorizeUrl, exchangeCode, EtsyClient, encryptJson, storeFromEnv,
  REDIRECT_URI, SCOPES, EtsyError,
} from './lib.mjs';

/** Accetta code e state separati, oppure l'intero URL della pagina di callback incollato nel campo code. */
export function parseCallbackInput(codeInput, stateInput) {
  let code = String(codeInput || '').trim();
  let state = String(stateInput || '').trim();
  if (/[?&]code=/.test(code)) {
    const q = new URLSearchParams(code.slice(code.indexOf('?') + 1));
    code = (q.get('code') || '').trim();
    state = state || (q.get('state') || '').trim();
  }
  return { code, state };
}

/**
 * Input del workflow_dispatch letti dal payload dell'evento ($GITHUB_EVENT_PATH). Il workflow non passa code e
 * state con `env:` perché GitHub stampa in chiaro nel log del passo le variabili di `env:` (il log di un
 * repository pubblico è visibile a tutti): qui il code viene mascherato prima di qualsiasi output.
 */
export function dispatchInputs(env = process.env) {
  const file = env.GITHUB_EVENT_PATH;
  if (!file || !existsSync(file)) return {};
  try {
    const inputs = JSON.parse(readFileSync(file, 'utf8'))?.inputs;
    return inputs && typeof inputs === 'object' ? inputs : {};
  } catch {
    return {};
  }
}

export async function runAuth({ passo, env = process.env, fetch = globalThis.fetch, store, out, now = () => Date.now(), sleep, cwd = process.cwd() } = {}) {
  out = out || createOutput({ env });
  const secrets = readSecrets(env);
  if (!secrets) {
    const msg = 'Mancano i segreti ETSY_KEYSTRING ed ETSY_SHARED_SECRET: aggiungili in Settings → Secrets and variables → Actions (passi in products/ETSY.md), poi rilancia.';
    out.error(msg);
    out.summary(`## Etsy: autorizzazione\n\n${msg}`);
    return { status: 'error', reason: 'secrets' };
  }
  out.secret(secrets.keystring);
  out.secret(secrets.sharedSecret);

  if (passo === 'avvia') {
    const state = newState();
    const url = authorizeUrl({ ...secrets, state });
    out.summary([
      '## Etsy: collega il negozio',
      '',
      `1. Apri questo link con il browser in cui sei entrato su Etsy con l'account del negozio: **[Autorizza NettoChiaro su Etsy](${url})**`,
      `2. Controlla i permessi richiesti (${SCOPES.join(', ')}: inserzioni, negozio, vendite) e conferma.`,
      `3. Etsy ti porta su ${REDIRECT_URI}: la pagina mostra **code** e **state** con i pulsanti per copiarli.`,
      '4. Torna in Actions → **Etsy: autorizzazione** → **Run workflow**: scegli il passo **completa**, incolla code e state, poi **Run workflow**.',
      '',
      `State di questa richiesta: \`${state}\` (deve coincidere con quello della pagina).`,
      '',
      'Il link resta valido: se il code scade, riaprilo e ripeti il passo 4. Il link contiene l\'identificativo pubblico dell\'app, non la shared secret.',
    ].join('\n'));
    out.log('Link di autorizzazione scritto nel riepilogo del run (Summary).');
    return { status: 'ok', state, url };
  }

  if (passo === 'completa') {
    const inputs = dispatchInputs(env);
    const rawCode = env.ETSY_CODE || inputs.code || '';
    out.secret(String(rawCode).trim());
    const { code, state } = parseCallbackInput(rawCode, env.ETSY_STATE || inputs.state);
    if (!code || !state) {
      const msg = 'Per "completa" servono code e state: copiali dalla pagina nettochiaro.com/etsy-callback/ dopo aver autorizzato su Etsy.';
      out.error(msg);
      out.summary(`## Etsy: autorizzazione\n\n${msg}`);
      return { status: 'error', reason: 'input' };
    }
    out.secret(code);
    const token = await exchangeCode({ ...secrets, code, state, fetch, out, now, sleep });
    store = store || storeFromEnv({ env, cwd });
    // Salvato subito: il code è monouso, se un passo successivo fallisce non si deve rifare tutto.
    await store.write(encryptJson(secrets.sharedSecret, token), 'Etsy: autorizzazione salvata (cifrata)');
    const client = new EtsyClient({ ...secrets, token, fetch, out, now, sleep, onToken: async (t) => store.write(encryptJson(secrets.sharedSecret, t), 'Etsy: token rinnovato (cifrato)') });
    // getMe: https://developers.etsy.com/documentation/reference#operation/getMe
    const me = await client.request('GET', '/users/me');
    let shop = '';
    if (me?.shop_id) {
      // getShop: https://developers.etsy.com/documentation/reference#operation/getShop
      const s = await client.request('GET', `/shops/${me.shop_id}`).catch(() => null);
      shop = s?.shop_name ? ` "${s.shop_name}"` : '';
    }
    const lines = ['## Etsy: negozio collegato', ''];
    if (me?.shop_id) {
      lines.push(`Autorizzazione salvata (cifrata) sul branch \`etsy-state\` per il negozio${shop} (id ${me.shop_id}).`, '',
        'La sincronizzazione parte da sola tra poco, poi a ogni modifica di `products/` e ogni lunedì. Puoi lanciarla anche da Actions → **Etsy: sincronizzazione** → **Run workflow**.');
    } else {
      lines.push('Autorizzazione salvata, ma questo account Etsy non ha ancora un negozio aperto. Completa l\'apertura del negozio su Etsy: la sincronizzazione partirà da sola al primo run utile.');
      out.warn('Account Etsy senza negozio: apri il negozio prima della sincronizzazione.');
    }
    out.summary(lines.join('\n'));
    out.log(`Autorizzazione salvata${me?.shop_id ? ` per il negozio ${me.shop_id}` : ''}.`);
    return { status: 'ok', shopId: me?.shop_id || null };
  }

  throw new EtsyError(`Passo sconosciuto "${passo}": usa "avvia" o "completa".`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = createOutput();
  try {
    const r = await runAuth({ passo: process.argv[2] || process.env.PASSO, out, cwd: root });
    process.exitCode = r.status === 'ok' ? 0 : 1;
  } catch (e) {
    out.error(`${e.message}${e.hint ? ` ${e.hint}` : ''}`);
    out.summary(`## Etsy: autorizzazione\n\nErrore: ${e.message}${e.hint ? `\n\n${e.hint}` : ''}`);
    process.exitCode = 1;
  }
}
