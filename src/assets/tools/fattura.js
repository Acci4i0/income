import { calcolatore, out, euro, perc } from '/assets/app.js';
import { calcolaFattura, importoDaNetto } from '/assets/lib/fattura.js';

calcolatore('#calc', (v) => {
  const opzioni = {
    regime: v.regime,
    rivalsa: v.rivalsa,
    percCassa: v.percCassa,
    aliquotaIva: Number(v.aliquotaIva),
    ritenuta: v.ritenuta,
    bolloACliente: v.bolloCliente,
  };
  const importo = v.modo === 'netto' ? importoDaNetto(v.importo, opzioni) : v.importo;
  return calcolaFattura({ ...opzioni, importo });
}, (form, r) => {
  const ord = r.regime === 'ordinario';
  out(form, 'importo', euro(r.importo));
  out(form, 'rivalsa', euro(r.quotaRivalsa));
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'iva', euro(r.iva));
  out(form, 'bollo', r.bollo ? euro(r.bollo) + (r.bolloACliente ? '' : ' (a tuo carico)') : 'non dovuta');
  out(form, 'totale', euro(r.totale));
  out(form, 'ritenuta', `− ${euro(r.ritenuta)}`);
  out(form, 'nettoAPagare', euro(r.nettoAPagare));
  out(form, 'aliquotaIva', perc(r.imponibile ? r.iva / r.imponibile : 0));
  form.querySelectorAll('[data-ord]').forEach((el) => { el.hidden = !ord; });
  form.querySelectorAll('[data-forf]').forEach((el) => { el.hidden = ord; });
  form.querySelectorAll('[data-riv]').forEach((el) => { el.hidden = r.quotaRivalsa === 0; });
});
