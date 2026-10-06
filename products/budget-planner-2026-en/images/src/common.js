// Shared helpers of the listing images. Numbers come from data.js (written by verify.py).
const D = window.DATA;
const SHEETS = ['Start Here', 'Settings', 'Categories', 'Transactions', 'Monthly Budget', 'Monthly Summary',
  'Annual Dashboard', 'Savings Goals', 'Sinking Funds', 'Debt Payoff', 'Debt Schedule'];

function fmt(v, dec = 2) {
  const neg = v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -dec);
  const [i, d] = Math.abs(v).toFixed(dec).split('.');
  return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
}
const num = (v, dec = 2) => (v === null || v === undefined || v === '' ? '' : Math.abs(v) < 0.005 ? '–' : fmt(v, dec));
const numZ = (v, dec = 2) => fmt(v || 0, dec);
const pct = (v, dec = 0) => fmt(v * 100, dec) + '%';
const cat = (name) => D.categories.find((c) => c.name === name);
const ym = (iso) => (iso ? String(iso).slice(0, 7) : '');

function bar(title) {
  return `<div class="wbar"><i></i><i></i><i></i><span>${title || D.file}</span></div>`;
}
function tabs(active) {
  return `<div class="tabs" data-clip>${SHEETS.map((s) => `<b class="${s === active ? 'on' : ''}">${s}</b>`).join('')}</div>`;
}
// red = worse than planned, green = better (expenses: above plan is worse; income and savings: below plan is worse)
function diffClass(type, diff) {
  if (Math.abs(diff) < 0.005) return '';
  const expense = type === 'Fixed bills' || type === 'Variable expenses' || type === 'All expenses';
  return (expense ? diff > 0 : diff < 0) ? 'bad' : 'good';
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}
function roundedTop(x, y, w, h, r, color) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `<path d="M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z" fill="${color}"/>`;
}
// clustered columns: income vs expenses by month
function chartMonths(w, h) {
  const inc = D.rows.income.act, exp = D.rows.expenses.act;
  const max = niceMax(Math.max(...inc, ...exp));
  const left = 50, bottom = 24, top = 8, ph = h - bottom - top, pw = w - left - 4;
  const step = pw / 12, bw = step * 0.34;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter, Arial" font-size="12">`;
  for (let k = 0; k <= 4; k++) {
    const y = top + ph - (ph * k) / 4;
    s += `<line x1="${left}" x2="${w - 4}" y1="${y}" y2="${y}" stroke="#e3e8e5"/>`;
    s += `<text x="${left - 7}" y="${y + 4}" text-anchor="end" fill="#5b6862">${fmt((max * k) / 4, 0)}</text>`;
  }
  D.months.forEach((m, i) => {
    const x0 = left + step * i + step / 2 - bw - 1;
    const hi = (inc[i] / max) * ph, he = (exp[i] / max) * ph;
    s += roundedTop(x0, top + ph - hi, bw, hi, 3, 'var(--inc)');
    s += roundedTop(x0 + bw + 2, top + ph - he, bw, he, 3, 'var(--exp)');
    s += `<text x="${left + step * i + step / 2}" y="${h - 6}" text-anchor="middle" fill="#5b6862" font-weight="600">${m}</text>`;
  });
  return s + '</svg>';
}
// horizontal bars: top spending categories
function chartTop(w, n, rowH) {
  const items = D.top.slice(0, n);
  const max = items[0].value;
  const lw = 132, vw = 72;
  let s = `<svg width="${w}" height="${n * rowH}" viewBox="0 0 ${w} ${n * rowH}" font-family="Inter, Arial" font-size="14">`;
  items.forEach((it, i) => {
    const y = i * rowH;
    const bw = ((w - lw - vw - 8) * it.value) / max;
    s += `<text x="0" y="${y + rowH / 2 + 5}" fill="#17201c" font-weight="600">${it.name}</text>`;
    s += `<rect x="${lw}" y="${y + rowH * 0.2}" width="${bw}" height="${rowH * 0.6}" rx="4" fill="var(--teal)" opacity="${1 - i * 0.06}"/>`;
    s += `<text x="${lw + bw + 7}" y="${y + rowH / 2 + 5}" fill="#5b6862" font-weight="600">${fmt(it.value, 0)}</text>`;
  });
  return s + '</svg>';
}
// lines: total debt balance over time (minimums only, snowball, avalanche)
function chartDebt(w, h) {
  const pts = D.chart;
  const max = niceMax(Math.max(...pts.map((p) => p.min)));
  const left = 52, bottom = 26, top = 10, ph = h - bottom - top, pw = w - left - 10;
  const X = (i) => left + (pw * i) / (pts.length - 1);
  const Y = (v) => top + ph - (ph * v) / max;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter, Arial" font-size="12">`;
  for (let k = 0; k <= 4; k++) {
    const y = top + ph - (ph * k) / 4;
    s += `<line x1="${left}" x2="${w - 10}" y1="${y}" y2="${y}" stroke="#e3e8e5"/>`;
    s += `<text x="${left - 7}" y="${y + 4}" text-anchor="end" fill="#5b6862">${fmt((max * k) / 4, 0)}</text>`;
  }
  pts.forEach((p, i) => {
    const anchor = i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle';
    if (i % 6 === 0) s += `<text x="${X(i) + (i === 0 ? -4 : 0)}" y="${h - 6}" text-anchor="${anchor}" fill="#5b6862" font-weight="600">${p.label}</text>`;
  });
  const line = (key, color, width, dash) =>
    `<polyline fill="none" stroke="${color}" stroke-width="${width}" ${dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" ` +
    `points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ')}"/>`;
  s += line('min', 'var(--grey)', 2.5, true) + line('aval', 'var(--teal)', 5) + line('snow', 'var(--exp)', 2);
  return s + '</svg>';
}
function kpiTiles() {
  const k = D.kpi;
  const t = [['Income', num(k.income), k.notes[0]], ['Expenses', num(k.expenses), k.notes[1]],
    ['Savings & debt', num(k.savings), k.notes[2]], ['Savings rate', pct(k.rate, 1), k.notes[3]],
    ['Left over', num(k.left), k.notes[4]], ['Total debt', num(k.debt), k.notes[5]]];
  return t.map(([l, v, n]) => `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="tn">${n}</div></div>`).join('');
}
