// Funzioni comuni alle pagine delle immagini. I dati arrivano da dati.js (window.DATI).
const D = window.DATI;
const nf = (dec) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' });
const eur = (v, dec = 2) => (typeof v === 'number' ? `${nf(dec).format(v)} €` : (v ?? ''));
const pct = (v, dec = 0) => `${nf(dec).format(v * 100)}%`;
const SHEETS = ['Istruzioni', 'Impostazioni', `Parametri ${D.anno}`, 'Fatture', 'Spese', 'Riepilogo mensile', 'Dashboard', 'Scadenze'];
const tabs = (on, list = SHEETS) => `<div class="tabs">${list.map((s) => `<div class="tab${s === on ? ' on' : ''}">${s}</div>`).join('')}</div>`;
const $ = (sel) => document.querySelector(sel);
const brand = () => document.body.querySelector('.canvas').insertAdjacentHTML('beforeend', '<div class="brand">NettoChiaro <span>· Excel e Google Sheets</span></div>');

// Grafico a colonne SVG degli incassi mensili (e quota da accantonare), stessi colori del foglio.
function grafico(width, height, { accantonare = true, font = 22 } = {}) {
  const pad = { l: 92, r: 16, t: 20, b: 46 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.ceil(Math.max(...D.mesi.map((m) => m.incassato)) / 1000) * 1000;
  const step = max / 4;
  const gw = w / 12;
  const bw = accantonare ? gw * 0.34 : gw * 0.6;
  let s = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Arial" font-size="${font}">`;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + h - (h * i) / 4;
    s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}" stroke="#e5e7eb" stroke-width="2"/>`;
    s += `<text x="${pad.l - 12}" y="${y + 7}" text-anchor="end" fill="#64748b">${nf(0).format(step * i)}</text>`;
  }
  D.mesi.forEach((m, i) => {
    const x = pad.l + gw * i + (gw - (accantonare ? bw * 2 + 6 : bw)) / 2;
    const h1 = (h * m.incassato) / max;
    s += `<rect x="${x}" y="${pad.t + h - h1}" width="${bw}" height="${h1}" rx="4" fill="#0f766e"/>`;
    if (accantonare) {
      const h2 = (h * m.accantonare) / max;
      s += `<rect x="${x + bw + 6}" y="${pad.t + h - h2}" width="${bw}" height="${h2}" rx="4" fill="#f59e0b"/>`;
    }
    s += `<text x="${pad.l + gw * i + gw / 2}" y="${height - 12}" text-anchor="middle" fill="#475569">${m.mese.slice(0, 3)}</text>`;
  });
  return `${s}</svg>`;
}
