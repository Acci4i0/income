import { calcolatore, out, barra, euro, perc } from '/assets/app.js';
import { calcolaStipendio } from '/assets/lib/stipendio.js';

calcolatore('#calc', (v) => calcolaStipendio({
  ral: v.ral,
  mensilita: Number(v.mensilita),
  addRegionale: v.addRegionale,
  addComunale: v.addComunale,
  contributivoPuro: Boolean(v.contributivoPuro),
}), (form, r) => {
  out(form, 'nettoMensile', euro(r.nettoMensile));
  out(form, 'netto', euro(r.netto));
  out(form, 'mensilita', String(r.mensilita));
  out(form, 'ral', euro(r.ral));
  out(form, 'inps', `− ${euro(r.inps)}`);
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'irpefLorda', euro(r.irpefLorda));
  out(form, 'detrazioni', `− ${euro(r.detrazioneLavoro + r.ulterioreDetrazione)}`);
  out(form, 'irpefNetta', `− ${euro(r.irpefNetta)}`);
  out(form, 'addizionali', `− ${euro(r.addizionali)}`);
  out(form, 'bonus', `+ ${euro(r.sommaEsente + r.trattamentoIntegrativo)}`);
  out(form, 'aliquotaMedia', perc(r.aliquotaMedia));
  barra(form, [
    { etichetta: 'Netto', valore: r.netto, classe: 'net' },
    { etichetta: 'INPS', valore: r.inps, classe: 'inps' },
    { etichetta: 'IRPEF e addizionali', valore: r.irpefNetta + r.addizionali, classe: 'tax' },
  ]);
});
