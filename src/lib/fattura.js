import { BOLLO, INPS, RITENUTA_ACCONTO } from './params.js';
import { risolvi } from './format.js';

// rivalsa: 'nessuna' | 'inps' (rivalsa 4% Gestione Separata) | 'cassa' (contributo integrativo cassa professionale)
export function calcolaFattura({
  importo,
  regime = 'forfettario',
  rivalsa = 'nessuna',
  percCassa = 0.04,
  aliquotaIva = 0.22,
  ritenuta = true,
  bolloACliente = true,
}) {
  const quotaRivalsa = rivalsa === 'inps' ? importo * INPS.gestioneSeparata.rivalsa : rivalsa === 'cassa' ? importo * percCassa : 0;
  const imponibile = importo + quotaRivalsa;

  if (regime === 'forfettario') {
    const bollo = imponibile > BOLLO.soglia ? BOLLO.importo : 0;
    const totale = imponibile + (bolloACliente ? bollo : 0);
    return {
      regime, importo, quotaRivalsa, imponibile,
      iva: 0, ritenuta: 0, bollo, bolloACliente,
      totale, nettoAPagare: totale,
    };
  }

  const iva = imponibile * aliquotaIva;
  // La rivalsa INPS 4% è parte del compenso e subisce la ritenuta; il contributo integrativo delle casse no.
  const baseRitenuta = rivalsa === 'inps' ? imponibile : importo;
  const quotaRitenuta = ritenuta ? baseRitenuta * RITENUTA_ACCONTO : 0;
  const totale = imponibile + iva;
  return {
    regime, importo, quotaRivalsa, imponibile,
    iva, ritenuta: quotaRitenuta, bollo: 0, bolloACliente: false,
    totale, nettoAPagare: totale - quotaRitenuta,
  };
}

// Trova l'importo da fatturare per ricevere un certo netto a pagare dal cliente.
export function importoDaNetto(netto, opzioni) {
  const x = risolvi((imp) => calcolaFattura({ ...opzioni, importo: imp }).nettoAPagare, netto, 0, Math.max(10, netto * 2));
  return Math.round(x * 100) / 100;
}
