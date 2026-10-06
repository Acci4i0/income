import { IRPEF } from './params.js';

// IRPEF lorda per scaglioni sull'imponibile.
export function irpefLorda(imponibile) {
  let imposta = 0;
  let precedente = 0;
  for (const { fino, aliquota } of IRPEF.scaglioni) {
    if (imponibile <= precedente) break;
    imposta += (Math.min(imponibile, fino) - precedente) * aliquota;
    precedente = fino;
  }
  return imposta;
}

// Aliquota marginale applicata all'ultimo euro di imponibile.
export function aliquotaMarginale(imponibile) {
  const s = IRPEF.scaglioni.find(({ fino }) => imponibile <= fino);
  return s ? s.aliquota : IRPEF.scaglioni.at(-1).aliquota;
}
