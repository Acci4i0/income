// Etsy finto in memoria: usato dai test (tests/etsy.test.mjs) e da DRY_RUN=1, per eseguire la sync
// senza rete. Riproduce solo il comportamento che serve agli script: endpoint, header obbligatori,
// stati delle inserzioni, limiti di file e immagini, token in scadenza.

import { API_BASE, TOKEN_URL, challengeFromVerifier } from './lib.mjs';

const json = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});

/** Albero di tassonomia finto a partire da percorsi di nomi. */
export function taxonomyFromPaths(paths) {
  let next = 1000;
  const roots = [];
  for (const p of paths) {
    let level = roots;
    let parent = null;
    const ids = [];
    p.forEach((name, depth) => {
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { id: next++, level: depth, name, parent_id: parent, children: [], full_path_taxonomy_ids: [] };
        level.push(node);
      }
      ids.push(node.id);
      node.full_path_taxonomy_ids = [...ids];
      parent = node.id;
      level = node.children;
    });
  }
  return roots;
}

export function createFakeEtsy({
  keystring = 'fake-keystring',
  sharedSecret = 'fake-shared-secret',
  shopId = 4242,
  userId = 777,
  taxonomy = [],
  listings = [],
  receipts = [],
  currency = 'EUR',
  accessToken = `${userId}.fake-access-token-0`,
  refreshToken = `${userId}.fake-refresh-token-0`,
  tokenExpiresAt = Infinity,
  now = () => Date.now(),
  log = null,
} = {}) {
  const s = {
    shopId,
    userId,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    expectedChallenge: null,
    issuedCode: null,
    listings: new Map(),
    nextId: 900000,
    calls: [],
    failures: [],
    tokenCounter: 0,
    lastFileDeletedOnListing: false,
  };
  for (const l of listings) s.listings.set(Number(l.listing_id), { images: [], files: [], type: 'download', quantity: 999, price: 1, ...l });

  const view = (l) => {
    const { images, files, ...rest } = l;
    return { ...rest, shop_id: s.shopId, user_id: s.userId, url: `https://www.etsy.com/listing/${l.listing_id}/prova`, price: { amount: Math.round(l.price * 100), divisor: 100, currency_code: 'EUR' } };
  };

  /** Fa fallire le prossime `times` richieste che corrispondono a method e regex del percorso. */
  function failNext(method, pattern, status, times = 1, headers = {}) {
    s.failures.push({ method, pattern, status, times, headers });
  }

  async function fetch(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(url);
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init.body;
    const relPath = url.startsWith(API_BASE) ? u.pathname.replace(new URL(API_BASE).pathname, '') : u.pathname;
    const call = { method, path: relPath, query: Object.fromEntries(u.searchParams), headers, body };
    s.calls.push(call);
    if (log) log(describe(call));

    const fail = s.failures.find((f) => f.method === method && f.pattern.test(relPath) && f.times > 0);
    if (fail) { fail.times--; return json(fail.status, { error: `errore simulato ${fail.status}` }, fail.headers); }

    if (headers['x-api-key'] !== `${keystring}:${sharedSecret}`) return json(403, { error: 'Invalid API key: should be keystring:shared_secret' });

    if (url.split('?')[0] === TOKEN_URL) {
      if (method !== 'POST' || !String(headers['content-type']).includes('x-www-form-urlencoded')) return json(400, { error: 'invalid_request' });
      const p = new URLSearchParams(body);
      if (p.get('client_id') !== keystring) return json(400, { error: 'invalid_client' });
      if (p.get('grant_type') === 'refresh_token') {
        if (p.get('refresh_token') !== s.refreshToken) return json(400, { error: 'invalid_grant', error_description: 'refresh token non valido' });
      } else if (p.get('grant_type') === 'authorization_code') {
        if (!s.issuedCode || p.get('code') !== s.issuedCode) return json(400, { error: 'invalid_grant', error_description: 'code non valido' });
        if (challengeFromVerifier(p.get('code_verifier') || '') !== s.expectedChallenge) return json(400, { error: 'invalid_grant', error_description: 'code_verifier errato' });
        s.issuedCode = null;
      } else return json(400, { error: 'unsupported_grant_type' });
      s.tokenCounter++;
      s.accessToken = `${s.userId}.fake-access-token-${s.tokenCounter}`;
      s.refreshToken = `${s.userId}.fake-refresh-token-${s.tokenCounter}`;
      s.tokenExpiresAt = now() + 3600 * 1000;
      return json(200, { access_token: s.accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: s.refreshToken });
    }

    if (headers.authorization !== `Bearer ${s.accessToken}` || now() >= s.tokenExpiresAt) return json(401, { error: 'invalid_token' });

    const m = (re) => relPath.match(re);
    let r;
    if (method === 'GET' && relPath === '/users/me') return json(200, { user_id: s.userId, shop_id: s.shopId });
    if (method === 'GET' && (r = m(/^\/shops\/(\d+)$/))) return json(200, { shop_id: Number(r[1]), shop_name: 'NegozioDiProva', currency_code: currency });
    if (method === 'GET' && relPath === '/seller-taxonomy/nodes') return json(200, { count: taxonomy.length, results: taxonomy });

    if ((r = m(/^\/shops\/(\d+)\/listings$/))) {
      if (Number(r[1]) !== s.shopId) return json(403, { error: 'shop non tuo' });
      if (method === 'GET') {
        const state = call.query.state || 'active';
        const all = [...s.listings.values()].filter((l) => l.state === state).map(view);
        const offset = Number(call.query.offset || 0);
        const limit = Number(call.query.limit || 25);
        return json(200, { count: all.length, results: all.slice(offset, offset + limit) });
      }
      if (method === 'POST') {
        const p = new URLSearchParams(body);
        for (const k of ['quantity', 'title', 'description', 'price', 'who_made', 'when_made', 'taxonomy_id']) {
          if (!p.get(k)) return json(400, { error: `${k} obbligatorio` });
        }
        if (p.get('type') !== 'download') return json(400, { error: 'shipping_profile_id obbligatorio per le inserzioni fisiche' });
        const id = s.nextId++;
        const l = {
          listing_id: id, state: 'draft', title: p.get('title'), description: p.get('description'),
          price: Number(p.get('price')), quantity: Number(p.get('quantity')), tags: (p.get('tags') || '').split(',').filter(Boolean),
          taxonomy_id: Number(p.get('taxonomy_id')), who_made: p.get('who_made'), when_made: p.get('when_made'),
          is_supply: p.get('is_supply') === 'true', should_auto_renew: p.get('should_auto_renew') === 'true', type: 'download', images: [], files: [],
        };
        s.listings.set(id, l);
        return json(201, view(l));
      }
    }

    if ((r = m(/^\/listings\/(\d+)$/)) && method === 'GET') {
      const l = s.listings.get(Number(r[1]));
      return l ? json(200, view(l)) : json(404, { error: 'listing non trovato' });
    }

    if ((r = m(/^\/shops\/(\d+)\/listings\/(\d+)$/)) && method === 'PATCH') {
      const l = s.listings.get(Number(r[2]));
      if (!l) return json(404, { error: 'listing non trovato' });
      const p = new URLSearchParams(body);
      for (const [k, v] of p) {
        if (k === 'tags') l.tags = v.split(',');
        else if (k === 'state') {
          if (v === 'active' && !l.images.length) return json(400, { error: 'Listing must have an image to be active' });
          if (v === 'active' && l.type === 'download' && !l.files.length) return json(400, { error: 'Digital listing must have a file' });
          l.state = v;
        } else if (['taxonomy_id'].includes(k)) l[k] = Number(v);
        else if (['is_supply', 'should_auto_renew'].includes(k)) l[k] = v === 'true';
        else l[k] = v;
      }
      return json(200, view(l));
    }

    if ((r = m(/^\/listings\/(\d+)\/inventory$/)) && method === 'PUT') {
      const l = s.listings.get(Number(r[1]));
      if (!l) return json(404, { error: 'listing non trovato' });
      const inv = JSON.parse(body);
      const off = inv.products?.[0]?.offerings?.[0];
      if (!off || !('readiness_state_id' in off) || !Array.isArray(inv.products[0].property_values)) return json(400, { error: 'inventory non valido' });
      l.price = off.price;
      l.quantity = off.quantity;
      return json(200, inv);
    }

    if ((r = m(/^\/listings\/(\d+)\/images$/)) && method === 'GET') {
      const l = s.listings.get(Number(r[1]));
      if (!l) return json(404, { error: 'listing non trovato' });
      return json(200, { count: l.images.length, results: l.images.map((img, i) => ({ ...img, rank: i + 1 })) });
    }
    if ((r = m(/^\/shops\/(\d+)\/listings\/(\d+)\/images$/)) && method === 'POST') {
      const l = s.listings.get(Number(r[2]));
      if (!l) return json(404, { error: 'listing non trovato' });
      if (!(body instanceof FormData) || !(body.get('image') instanceof Blob)) return json(400, { error: 'image obbligatoria' });
      const file = body.get('image');
      const img = { listing_image_id: s.nextId++, name: file.name, bytes: file.size, alt_text: body.get('alt_text') || '' };
      const rank = Number(body.get('rank') || l.images.length + 1);
      if (body.get('overwrite') === 'true' && l.images[rank - 1]) l.images[rank - 1] = img;
      else l.images.splice(Math.min(rank - 1, l.images.length), 0, img);
      if (l.images.length > 20) return json(400, { error: 'max 20 immagini' });
      return json(201, { ...img, listing_id: l.listing_id, rank });
    }
    if ((r = m(/^\/shops\/(\d+)\/listings\/(\d+)\/images\/(\d+)$/)) && method === 'DELETE') {
      const l = s.listings.get(Number(r[2]));
      if (!l) return json(404, { error: 'listing non trovato' });
      l.images = l.images.filter((img) => img.listing_image_id !== Number(r[3]));
      return json(204, null);
    }

    if ((r = m(/^\/shops\/(\d+)\/listings\/(\d+)\/files$/))) {
      const l = s.listings.get(Number(r[2]));
      if (!l) return json(404, { error: 'listing non trovato' });
      if (method === 'GET') return json(200, { count: l.files.length, results: l.files.map((f, i) => ({ ...f, rank: i + 1 })) });
      if (method === 'POST') {
        if (!(body instanceof FormData) || !(body.get('file') instanceof Blob) || !body.get('name')) return json(400, { error: 'file e name obbligatori' });
        if (l.files.length >= 5) return json(400, { error: 'max 5 file' });
        const file = body.get('file');
        const f = { listing_file_id: s.nextId++, filename: body.get('name'), size_bytes: file.size };
        l.files.push(f);
        l.type = 'download';
        return json(201, { ...f, listing_id: l.listing_id });
      }
    }
    if ((r = m(/^\/shops\/(\d+)\/listings\/(\d+)\/files\/(\d+)$/)) && method === 'DELETE') {
      const l = s.listings.get(Number(r[2]));
      if (!l) return json(404, { error: 'listing non trovato' });
      l.files = l.files.filter((f) => f.listing_file_id !== Number(r[3]));
      // Come su Etsy: togliendo l'ultimo file l'inserzione diventa fisica.
      if (!l.files.length) { l.type = 'physical'; s.lastFileDeletedOnListing = true; }
      return json(200, { count: l.files.length, results: l.files });
    }

    if ((r = m(/^\/shops\/(\d+)\/receipts$/)) && method === 'GET') {
      const offset = Number(call.query.offset || 0);
      const limit = Number(call.query.limit || 25);
      return json(200, { count: receipts.length, results: receipts.slice(offset, offset + limit) });
    }

    return json(404, { error: `endpoint finto non gestito: ${method} ${relPath}` });
  }

  /** Prepara un'autorizzazione: il prossimo authorization_code valido è `code` con questo challenge. */
  function authorize(code, challenge) {
    s.issuedCode = code;
    s.expectedChallenge = challenge;
  }

  return { fetch, state: s, failNext, authorize, writes: () => s.calls.filter((c) => c.method !== 'GET' && !c.path.endsWith('/oauth/token')) };
}

/** Descrizione leggibile di una chiamata, senza header (che contengono chiave e token). */
export function describe(call) {
  let detail = '';
  if (call.body instanceof FormData) {
    detail = [...call.body.entries()].map(([k, v]) => (v instanceof Blob ? `${k}=<${v.name}, ${v.size} byte>` : `${k}=${String(v).slice(0, 40)}`)).join(' ');
  } else if (typeof call.body === 'string' && call.path.endsWith('/oauth/token')) {
    detail = `grant_type=${new URLSearchParams(call.body).get('grant_type')}`;
  } else if (typeof call.body === 'string') {
    const fields = call.body.trim().startsWith('{') ? Object.keys(JSON.parse(call.body)) : [...new URLSearchParams(call.body).keys()];
    detail = `campi: ${fields.join(', ')}`;
  }
  const q = Object.keys(call.query || {}).length ? `?${new URLSearchParams(call.query)}` : '';
  return `${call.method} ${call.path}${q}${detail ? `  ${detail}` : ''}`;
}
