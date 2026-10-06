import { calcolatore, out, lista, barra, euro, perc } from '/assets/app.js';
import { calcolaForfettario } from '/assets/lib/forfettario.js';

calcolatore('#calc', (v) => calcolaForfettario({
  ricavi: v.ricavi,
  coefficiente: Number(v.coeff),
  gestione: v.gestione,
  startup: v.startup,
  riduzione35: v.riduzione,
  aliquotaCassa: v.aliquotaCassa,
  costiReali: v.costi,
}), (form, r) => {
  out(form, 'netto', euro(r.netto));
  out(form, 'nettoMensile', euro(r.nettoMensile));
  out(form, 'ricavi', euro(r.ricavi));
  out(form, 'coeffPerc', perc(r.coefficiente));
  out(form, 'redditoLordo', euro(r.redditoLordo));
  out(form, 'contributi', euro(r.contributi.totale));
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'aliquota', perc(r.aliquotaImposta));
  out(form, 'imposta', euro(r.imposta));
  out(form, 'totale', euro(r.totaleTasse));
  out(form, 'incidenza', perc(r.incidenza));
  lista(form, 'avvisi', r.avvisi);
  barra(form, [
    { etichetta: 'Netto', valore: r.netto, classe: 'net' },
    { etichetta: 'INPS', valore: r.contributi.totale, classe: 'inps' },
    { etichetta: 'Imposta', valore: r.imposta, classe: 'tax' },
    ...(r.costiReali > 0 ? [{ etichetta: 'Costi', valore: r.costiReali, classe: 'cost' }] : []),
  ]);
});
