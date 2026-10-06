// Formattazione e parsing numeri in stile italiano. Usato sia nel browser sia nei test.

const fmtEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const fmtNum = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' });
const fmtPerc = new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const euro = (n) => fmtEuro.format(Number.isFinite(n) ? n : 0);
export const numero = (n) => fmtNum.format(Number.isFinite(n) ? n : 0);
export const perc = (n) => fmtPerc.format(Number.isFinite(n) ? n : 0);

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Accetta "1.234,56", "1234,56", "1234.56", "1.500" (migliaia), "  2 000 ".
export function parseNumero(value) {
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  let s = String(value).trim().replace(/\s|€|%/g, '');
  if (s === '') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Inverte una funzione monotona crescente f su [lo, hi] per bisezione.
export function risolvi(f, target, lo = 0, hi = 1e7, tolleranza = 0.001) {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
    if (hi - lo < tolleranza) break;
  }
  return (lo + hi) / 2;
}
