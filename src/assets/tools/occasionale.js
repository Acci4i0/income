import { calcolatore, out, barra, euro, perc } from '/assets/app.js';
import { calcolaOccasionale, lordoDaNetto } from '/assets/lib/occasionale.js';

calcolatore('#calc', (v) => {
  const opzioni = { giaPercepito: v.gia, sostituto: v.committente === 'sostituto', iscrittoAltraForma: v.altraForma };
  const lordo = v.modo === 'netto' ? lordoDaNetto({ netto: v.importo, ...opzioni }) : v.importo;
  return calcolaOccasionale({ lordo, ...opzioni });
}, (form, r) => {
  out(form, 'netto', euro(r.netto));
  out(form, 'lordo', euro(r.lordo));
  out(form, 'ritenuta', `− ${euro(r.ritenuta)}`);
  out(form, 'inpsLavoratore', `− ${euro(r.inpsLavoratore)}`);
  out(form, 'inpsCommittente', euro(r.inpsCommittente));
  out(form, 'costoCommittente', euro(r.costoCommittente));
  out(form, 'bollo', r.bollo ? euro(r.bollo) : 'non dovuta');
  out(form, 'aliquota', perc(r.aliquota));
  form.querySelectorAll('[data-inps]').forEach((el) => { el.hidden = !r.superaFranchigia; });
  barra(form, [
    { etichetta: 'Netto', valore: r.netto, classe: 'net' },
    { etichetta: 'Ritenuta', valore: r.ritenuta, classe: 'tax' },
    { etichetta: 'INPS', valore: r.inpsLavoratore, classe: 'inps' },
  ]);
});
