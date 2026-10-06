import { DIPENDENTE, ADDIZIONALI_DEFAULT } from './params.js';
import { irpefLorda } from './irpef.js';

export function contributiDipendente(ral) {
  const { inpsAliquota, inpsAliquotaAggiuntiva, inpsSogliaAggiuntiva } = DIPENDENTE;
  return ral * inpsAliquota + Math.max(0, ral - inpsSogliaAggiuntiva) * inpsAliquotaAggiuntiva;
}

// Detrazione per lavoro dipendente, art. 13 c.1 e c.1.1 TUIR, anno intero.
export function detrazioneLavoro(reddito) {
  const d = DIPENDENTE.detrazione;
  let detrazione;
  if (reddito <= 15000) detrazione = d.fino15000;
  else if (reddito <= 28000) detrazione = d.base + d.extra15_28 * (28000 - reddito) / 13000;
  else if (reddito <= 50000) detrazione = d.base * (50000 - reddito) / 22000;
  else detrazione = 0;
  if (reddito > 25000 && reddito <= 35000) detrazione += d.bonus25_35;
  return detrazione;
}

// Taglio del cuneo: somma esente fino a 20.000 €, ulteriore detrazione tra 20.000 e 40.000 €.
export function cuneoFiscale(reddito) {
  const c = DIPENDENTE.cuneo;
  const fascia = c.sommaNonImponibile.find(({ fino }) => reddito <= fino);
  if (fascia) return { sommaEsente: reddito * fascia.perc, ulterioreDetrazione: 0 };
  if (reddito <= c.pienaFino) return { sommaEsente: 0, ulterioreDetrazione: c.ulterioreDetrazione };
  if (reddito <= c.azzeramento) {
    return {
      sommaEsente: 0,
      ulterioreDetrazione: c.ulterioreDetrazione * (c.azzeramento - reddito) / (c.azzeramento - c.pienaFino),
    };
  }
  return { sommaEsente: 0, ulterioreDetrazione: 0 };
}

// Stima del netto annuo e mensile partendo dalla RAL, senza familiari a carico né altri redditi.
export function calcolaStipendio({
  ral,
  mensilita = 13,
  addRegionale = ADDIZIONALI_DEFAULT.regionale,
  addComunale = ADDIZIONALI_DEFAULT.comunale,
}) {
  const inps = contributiDipendente(ral);
  const imponibile = Math.max(0, ral - inps);
  const lorda = irpefLorda(imponibile);
  const detrLavoro = detrazioneLavoro(imponibile);
  const cuneo = cuneoFiscale(imponibile);
  const detrazioni = detrLavoro + cuneo.ulterioreDetrazione;
  const irpefNetta = Math.max(0, lorda - detrazioni);

  const ti = DIPENDENTE.trattamentoIntegrativo;
  const trattamentoIntegrativo = imponibile <= ti.sogliaReddito && lorda > detrLavoro - ti.franchigia ? ti.importo : 0;

  const addizionali = imponibile * (addRegionale + addComunale);
  const netto = ral - inps - irpefNetta - addizionali + cuneo.sommaEsente + trattamentoIntegrativo;

  return {
    ral,
    mensilita,
    inps,
    imponibile,
    irpefLorda: lorda,
    detrazioneLavoro: detrLavoro,
    ulterioreDetrazione: cuneo.ulterioreDetrazione,
    irpefNetta,
    addizionali,
    sommaEsente: cuneo.sommaEsente,
    trattamentoIntegrativo,
    netto,
    nettoMensile: netto / mensilita,
    aliquotaMedia: ral > 0 ? (ral - netto) / ral : 0,
  };
}
