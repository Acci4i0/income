import { calcolatore, out, barra, euro, perc } from '/assets/app.js';
import { calcolaMutuo } from '/assets/lib/mutuo.js';

const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });

calcolatore('#calc', (v) => calcolaMutuo({
  capitale: v.capitale,
  tassoAnnuo: v.tasso,
  anni: Number(v.anni),
  redditoMensile: v.reddito,
}), (form, r) => {
  out(form, 'rata', euro(r.rata));
  out(form, 'totaleInteressi', euro(r.totaleInteressi));
  out(form, 'totalePagato', euro(r.totalePagato));
  out(form, 'rate', String(r.rate));
  out(form, 'rapporto', r.rapportoRataReddito == null ? 'inserisci il reddito' : perc(r.rapportoRataReddito));
  const warn = form.querySelector('[data-warn-rapporto]');
  if (warn) warn.hidden = !(r.rapportoRataReddito > 1 / 3);
  barra(form, [
    { etichetta: 'Capitale', valore: r.totalePagato - r.totaleInteressi, classe: 'net' },
    { etichetta: 'Interessi', valore: r.totaleInteressi, classe: 'tax' },
  ]);
  const tbody = document.querySelector('[data-piano]');
  if (tbody) {
    tbody.innerHTML = r.piano.map((a) => `<tr><td>${a.anno}</td><td class="num">${fmt.format(a.capitale)} €</td><td class="num">${fmt.format(a.interessi)} €</td><td class="num">${fmt.format(a.residuo)} €</td></tr>`).join('');
  }
});
