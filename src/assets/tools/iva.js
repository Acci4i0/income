import { calcolatore, out, euro } from '/assets/app.js';
import { scorporaIva, aggiungiIva } from '/assets/lib/iva.js';

calcolatore('#calc', (v) => {
  const aliquota = Number(v.aliquota);
  return v.modo === 'scorpora' ? scorporaIva(v.importo, aliquota) : aggiungiIva(v.importo, aliquota);
}, (form, r) => {
  out(form, 'imponibile', euro(r.imponibile));
  out(form, 'iva', euro(r.iva));
  out(form, 'lordo', euro(r.lordo));
});
