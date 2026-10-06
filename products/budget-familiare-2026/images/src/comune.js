// Funzioni comuni delle immagini. I numeri arrivano da dati.js (generato da verifica.py).
const D = window.DATI;
const FOGLI = ['Istruzioni', 'Impostazioni', 'Categorie', 'Movimenti', 'Budget', 'Mensile', 'Dashboard', 'Obiettivi', 'Debiti'];

function fmt(v, dec = 0) {
  const neg = v < 0;
  const [i, d] = Math.abs(v).toFixed(dec).split('.');
  const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
  return (neg && Number(s.replace(/\./g, '').replace(',', '.')) !== 0 ? '−' : '') + s;
}
const eur = (v, dec = 0) => (Math.abs(v) < 0.005 ? '–' : fmt(v, dec) + ' €');
const eurZ = (v, dec = 0) => fmt(v, dec) + ' €';
const pct = (v, dec = 0) => fmt(v * 100, dec) + '%';
const cat = (nome) => D.categorie.find((c) => c.nome === nome);

function bar(titolo) {
  return `<div class="wbar"><i></i><i></i><i></i><span>${titolo}</span></div>`;
}
function tabs(attivo) {
  return `<div class="tabs">${FOGLI.map((f) => `<b class="${f === attivo ? 'on' : ''}">${f}</b>`).join('')}</div>`;
}
// colore della differenza: per le spese è male superare il budget, per entrate e risparmio è bene
function diffClass(tipo, diff) {
  if (Math.abs(diff) < 0.005) return '';
  const spesa = tipo.startsWith('Spesa');
  return (spesa ? diff > 0 : diff < 0) ? 'bad' : 'good';
}

function roundedBar(x, y, w, h, r, color) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `<path d="M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z" fill="${color}"/>`;
}

// grafico a colonne entrate/spese per mese
function chartMesi(w, h, opts = {}) {
  const e = D.summary.entrate.mesi, s = D.summary.spese.mesi;
  const padL = 58, padR = 10, padT = opts.legend === false ? 12 : 44, padB = 34;
  const iw = w - padL - padR, ih = h - padT - padB;
  const max = Math.max(...e, ...s);
  const step = max > 6000 ? 2000 : 1000;
  const top = Math.ceil(max / step) * step;
  const y = (v) => padT + ih - (v / top) * ih;
  let g = '';
  for (let v = 0; v <= top; v += step) {
    g += `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#9aa8a1' : '#e3e9e6'}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    g += `<text x="${padL - 10}" y="${y(v) + 5}" text-anchor="end" font-size="14" fill="#5b6862">${fmt(v)}</text>`;
  }
  const gw = iw / 12, bw = Math.min(16, (gw - 10) / 2);
  D.mesi.forEach((m, i) => {
    const cx = padL + gw * i + gw / 2;
    g += roundedBar(cx - bw - 1, y(e[i]), bw, y(0) - y(e[i]), 4, 'var(--entrate)');
    g += roundedBar(cx + 1, y(s[i]), bw, y(0) - y(s[i]), 4, 'var(--spese)');
    g += `<text x="${cx}" y="${h - 10}" text-anchor="middle" font-size="14" fill="#5b6862">${m}</text>`;
  });
  if (opts.legend !== false) {
    g += `<rect x="${padL}" y="8" width="14" height="14" rx="3" fill="var(--entrate)"/><text x="${padL + 20}" y="20" font-size="15" font-weight="600" fill="#17201c">Entrate</text>`;
    g += `<rect x="${padL + 110}" y="8" width="14" height="14" rx="3" fill="var(--spese)"/><text x="${padL + 130}" y="20" font-size="15" font-weight="600" fill="#17201c">Spese</text>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter">${g}</svg>`;
}

// barre orizzontali per le categorie di spesa più alte
function chartTop(w, n, rowH = 34) {
  const items = D.top.slice(0, n);
  const max = items[0].totale;
  const labelW = 170, valW = 76, bw = w - labelW - valW - 12;
  let g = '';
  items.forEach((t, i) => {
    const yy = i * rowH;
    const len = Math.max(4, (t.totale / max) * bw);
    g += `<text x="${labelW - 10}" y="${yy + rowH / 2 + 5}" text-anchor="end" font-size="15" fill="#17201c">${t.nome}</text>`;
    g += `<rect x="${labelW}" y="${yy + 7}" width="${len}" height="${rowH - 14}" rx="4" fill="var(--teal)"/>`;
    g += `<text x="${labelW + len + 8}" y="${yy + rowH / 2 + 5}" font-size="14.5" font-weight="700" fill="#17201c">${eurZ(t.totale)}</text>`;
  });
  return `<svg width="${w}" height="${n * rowH}" viewBox="0 0 ${w} ${n * rowH}" font-family="Inter">${g}</svg>`;
}

function kpiTiles(keys) {
  const k = D.kpi;
  const all = {
    entrate: ['Entrate', eurZ(k.entrate), pct(k.entrate_budget) + ' del budget annuo'],
    spese: ['Spese', eurZ(k.spese), pct(k.spese_budget) + ' del budget annuo'],
    risparmio: ['Risparmio', eurZ(k.risparmio), 'di cui versati: ' + eurZ(k.versati)],
    tasso: ['Tasso di risparmio', pct(k.tasso, 1), 'risparmio / entrate'],
    saldo: ['Saldo di cassa', eurZ(k.saldo), 'al 1° gennaio: ' + eurZ(k.saldo_iniziale)],
    debiti: ['Debiti residui', eurZ(k.debiti), 'rate: ' + eurZ(k.rate) + ' al mese'],
  };
  return keys.map((key) => {
    const [l, v, n] = all[key];
    return `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="tn">${n}</div></div>`;
  }).join('');
}
