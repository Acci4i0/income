import { calcolatore, out, lista, euro, perc } from '/assets/app.js';
import { calcolaFattura, compensoDaNetto } from '/assets/lib/fattura.js';

calcolatore('#calc', (v) => {
  const opzioni = {
    regime: v.regime,
    rivalsa: v.rivalsa,
    percCassa: v.percCassa,
    aliquotaIva: Number(v.aliquotaIva),
    ritenuta: v.ritenuta,
    bolloACliente: v.bolloCliente,
  };
  // Dal netto: il bollo addebitato può rendere impossibile il netto esatto (vedi compensoDaNetto).
  const inversa = v.modo === 'netto' ? compensoDaNetto(v.importo, opzioni) : null;
  const r = calcolaFattura({ ...opzioni, importo: inversa ? inversa.importo : v.importo });
  return { ...r, avvisi: inversa?.avviso ? [inversa.avviso] : [] };
}, (form, r) => {
  const ord = r.regime === 'ordinario';
  // Bollo solo sui documenti senza IVA: forfettario o ordinario esente. data-show-if gestisce un solo campo,
  // quindi la visibilità di checkbox e riga del bollo si decide qui.
  const senzaIva = !ord || r.ivaEsente;
  out(form, 'importo', euro(r.importo));
  out(form, 'rivalsa', euro(r.quotaRivalsa));
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'iva', euro(r.iva));
  out(form, 'bollo', r.bollo ? euro(r.bollo) + (r.bolloACliente ? '' : ' (a tuo carico)') : 'non dovuta');
  out(form, 'totale', euro(r.totale));
  out(form, 'ritenuta', `− ${euro(r.ritenuta)}`);
  out(form, 'nettoAPagare', euro(r.nettoAPagare));
  out(form, 'aliquotaIva', r.ivaEsente ? 'esente' : perc(r.aliquotaIva));
  form.querySelectorAll('[data-ord]').forEach((el) => { el.hidden = !ord; });
  form.querySelectorAll('[data-bollo]').forEach((el) => { el.hidden = !senzaIva; });
  form.querySelectorAll('[data-riv]').forEach((el) => { el.hidden = r.quotaRivalsa === 0; });
  lista(form, 'avvisi', r.avvisi);
});
