import { BOLLO, INPS, RITENUTA_ACCONTO } from './params.js';
import { euro, risolvi, round2 } from './format.js';

// rivalsa: 'nessuna' | 'inps' (rivalsa 4% Gestione Separata) | 'cassa' (contributo integrativo cassa professionale)
// aliquotaIva = 0 nel regime ordinario indica un'operazione esente (art. 10 DPR 633/72, es. prestazioni sanitarie).
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
  // Bollo da 2 € sui documenti senza IVA sopra 77,47 € (DPR 642/1972): forfettario e operazioni esenti.
  const bolloSe = (senzaIva) => (senzaIva && imponibile > BOLLO.soglia ? BOLLO.importo : 0);

  if (regime === 'forfettario') {
    const bollo = bolloSe(true);
    const totale = imponibile + (bolloACliente ? bollo : 0);
    return {
      regime, importo, quotaRivalsa, imponibile,
      aliquotaIva: 0, ivaEsente: false,
      iva: 0, ritenuta: 0, bollo, bolloACliente,
      totale, nettoAPagare: totale,
    };
  }

  const ivaEsente = aliquotaIva === 0;
  const iva = imponibile * aliquotaIva;
  const bollo = bolloSe(ivaEsente);
  // La rivalsa INPS 4% è parte del compenso e subisce la ritenuta; il contributo integrativo delle casse no.
  // Il bollo riaddebitato non entra nella base della ritenuta.
  const baseRitenuta = rivalsa === 'inps' ? imponibile : importo;
  const quotaRitenuta = ritenuta ? baseRitenuta * RITENUTA_ACCONTO : 0;
  const totale = imponibile + iva + (bolloACliente ? bollo : 0);
  return {
    regime, importo, quotaRivalsa, imponibile,
    aliquotaIva, ivaEsente,
    iva, ritenuta: quotaRitenuta, bollo, bolloACliente,
    totale, nettoAPagare: totale - quotaRitenuta,
  };
}

// Primo compenso (al centesimo) il cui imponibile supera la soglia del bollo.
function primoImportoConBollo(opzioni) {
  const quota = calcolaFattura({ ...opzioni, importo: 1 }).quotaRivalsa;
  let imp = Math.floor((BOLLO.soglia / (1 + quota)) * 100) / 100;
  for (let i = 0; i < 100 && !(calcolaFattura({ ...opzioni, importo: imp }).imponibile > BOLLO.soglia); i++) {
    imp = round2(imp + 0.01);
  }
  return imp;
}

// Trova il compenso da fatturare per ricevere un certo netto a pagare dal cliente.
// Restituisce { importo, nettoOttenuto, esatto, avviso }. Se il bollo è addebitato al cliente, oltre la soglia
// il netto sale di colpo di 2 €: i netti in quel salto non si possono ottenere e si usa il primo compenso con bollo.
// L'avviso compare solo in quel caso; esatto è falso anche se il netto differisce di un centesimo o più per arrotondamento.
export function compensoDaNetto(netto, opzioni) {
  const fattura = (importo) => calcolaFattura({ ...opzioni, importo });
  let importo = round2(risolvi((imp) => fattura(imp).nettoAPagare, netto, 0, Math.max(10, netto * 2)));
  if (fattura(importo).nettoAPagare < netto - 0.005) {
    const sopra = primoImportoConBollo(opzioni);
    const conBollo = fattura(sopra);
    if (importo === round2(sopra - 0.01) && conBollo.bollo > 0 && conBollo.bolloACliente) importo = sopra;
  }
  const r = fattura(importo);
  const prima = fattura(round2(importo - 0.01));
  // Netto chiesto dentro il salto: il centesimo prima è senza bollo e dà meno, questo compenso dà almeno 1 cent in più.
  const salto = r.bollo > 0 && r.bolloACliente && prima.bollo === 0
    && r.nettoAPagare - netto >= 0.01 && prima.nettoAPagare < netto - 0.005;
  const nettoOttenuto = r.nettoAPagare;
  const esatto = Math.abs(nettoOttenuto - netto) < 0.01;
  const avviso = salto
    ? `Un netto di ${euro(netto)} non si può ottenere: quando l'imponibile supera ${euro(BOLLO.soglia)} scatta la marca da bollo da ${euro(BOLLO.importo)} addebitata al cliente. Il calcolo usa il primo compenso con il bollo, che porta il netto a ${euro(nettoOttenuto)}.`
    : null;
  return { importo, nettoOttenuto, esatto, avviso };
}

export function importoDaNetto(netto, opzioni) {
  return compensoDaNetto(netto, opzioni).importo;
}
