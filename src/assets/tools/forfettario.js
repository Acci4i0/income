import { calcolatore, out, lista, barra, euro, perc } from '/assets/app.js';
import { calcolaForfettario } from '/assets/lib/forfettario.js';

const NON_APPLICABILE = 'non applicabile';

// Oltre la soglia di uscita immediata il reddito dell'anno si tassa con le regole ordinarie:
// i valori del forfettario non sono dovuti e non vanno mostrati come risultato.
function mostraFuoriRegime(form) {
  for (const chiave of ['netto', 'nettoMensile', 'redditoLordo', 'contributi', 'imponibile', 'imposta', 'totale', 'incidenza']) {
    out(form, chiave, NON_APPLICABILE);
  }
  barra(form, []);
}

function visibilitaBarra(form, visibile) {
  form.querySelectorAll('[data-bar], [data-legend]').forEach((el) => { el.hidden = !visibile; });
}

calcolatore('#calc', (v) => calcolaForfettario({
  ricavi: v.ricavi,
  coefficiente: Number(v.coeff),
  gestione: v.gestione,
  startup: v.startup,
  riduzione35: v.riduzione,
  aliquotaCassa: v.aliquotaCassa,
  costiReali: v.costi,
}), (form, r) => {
  out(form, 'ricavi', euro(r.ricavi));
  out(form, 'coeffPerc', perc(r.coefficiente));
  out(form, 'aliquota', perc(r.aliquotaImposta));
  lista(form, 'avvisi', r.avvisi);
  visibilitaBarra(form, !r.fuoriRegime);
  if (r.fuoriRegime) {
    mostraFuoriRegime(form);
    return;
  }
  out(form, 'netto', euro(r.netto));
  out(form, 'nettoMensile', euro(r.nettoMensile));
  out(form, 'redditoLordo', euro(r.redditoLordo));
  out(form, 'contributi', euro(r.contributi.totale));
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'imposta', euro(r.imposta));
  out(form, 'totale', euro(r.totaleTasse));
  out(form, 'incidenza', perc(r.incidenza));
  barra(form, [
    { etichetta: 'Netto', valore: r.netto, classe: 'net' },
    { etichetta: 'INPS', valore: r.contributi.totale, classe: 'inps' },
    { etichetta: 'Imposta', valore: r.imposta, classe: 'tax' },
    ...(r.costiReali > 0 ? [{ etichetta: 'Costi', valore: r.costiReali, classe: 'cost' }] : []),
  ]);
});
