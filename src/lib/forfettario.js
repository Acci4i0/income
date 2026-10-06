import { FORFETTARIO, INPS } from './params.js';

export const GESTIONI = [
  { id: 'separata', label: 'Gestione Separata INPS (professionisti senza cassa)' },
  { id: 'separata-pensionati', label: 'Gestione Separata, già pensionato o iscritto ad altra cassa' },
  { id: 'artigiani', label: 'INPS Artigiani' },
  { id: 'commercianti', label: 'INPS Commercianti' },
  { id: 'cassa', label: 'Cassa professionale (aliquota personalizzata)' },
];

function contributiArtCom(reddito, p, riduzione35) {
  const base = Math.min(Math.max(reddito, 0), p.massimale);
  const fasciaUno = Math.max(0, Math.min(base, p.sogliaAggiuntiva) - p.minimale) * p.aliquota;
  const fasciaDue = Math.max(0, base - p.sogliaAggiuntiva) * p.aliquotaOltre;
  const fattore = riduzione35 ? 1 - INPS.riduzioneForfettari : 1;
  // La quota di maternità non è soggetta alla riduzione.
  const fissi = (p.contributoFisso - p.maternita) * fattore + p.maternita;
  const variabili = (fasciaUno + fasciaDue) * fattore;
  return { fissi, variabili, totale: fissi + variabili };
}

export function contributiForfettario({ reddito, gestione, riduzione35 = false, aliquotaCassa = 0 }) {
  const gs = INPS.gestioneSeparata;
  switch (gestione) {
    case 'separata':
    case 'separata-pensionati': {
      const aliquota = gestione === 'separata' ? gs.aliquota : gs.aliquotaPensionati;
      const totale = Math.min(Math.max(reddito, 0), gs.massimale) * aliquota;
      return { fissi: 0, variabili: totale, totale, aliquota };
    }
    case 'artigiani':
      return { ...contributiArtCom(reddito, INPS.artigiani, riduzione35), aliquota: INPS.artigiani.aliquota };
    case 'commercianti':
      return { ...contributiArtCom(reddito, INPS.commercianti, riduzione35), aliquota: INPS.commercianti.aliquota };
    case 'cassa': {
      const totale = Math.max(reddito, 0) * aliquotaCassa;
      return { fissi: 0, variabili: totale, totale, aliquota: aliquotaCassa };
    }
    default:
      throw new Error(`Gestione sconosciuta: ${gestione}`);
  }
}

// Stima "a regime": i contributi dell'anno sono dedotti dal reddito dello stesso anno.
// Nella realtà si deducono i contributi effettivamente versati nell'anno (saldo + acconti).
export function calcolaForfettario({
  ricavi,
  coefficiente,
  gestione = 'separata',
  startup = false,
  riduzione35 = false,
  aliquotaCassa = 0,
  costiReali = 0,
}) {
  const redditoLordo = ricavi * coefficiente;
  const contributi = contributiForfettario({ reddito: redditoLordo, gestione, riduzione35, aliquotaCassa });
  const imponibile = Math.max(0, redditoLordo - contributi.totale);
  const aliquotaImposta = startup ? FORFETTARIO.impostaStartup : FORFETTARIO.impostaOrdinaria;
  const imposta = imponibile * aliquotaImposta;
  const totaleTasse = imposta + contributi.totale;
  const netto = ricavi - totaleTasse - costiReali;

  const avvisi = [];
  if (ricavi > FORFETTARIO.sogliaUscitaImmediata) {
    avvisi.push(`Oltre ${FORFETTARIO.sogliaUscitaImmediata.toLocaleString('it-IT')} € di ricavi esci dal forfettario già nell'anno in corso: dall'operazione che supera la soglia si applicano IVA e regime ordinario.`);
  } else if (ricavi > FORFETTARIO.sogliaRicavi) {
    avvisi.push(`Oltre ${FORFETTARIO.sogliaRicavi.toLocaleString('it-IT')} € di ricavi resti forfettario per quest'anno, ma dal prossimo passi al regime ordinario.`);
  }
  if (gestione === 'artigiani' || gestione === 'commercianti') {
    if (redditoLordo < INPS.artigiani.minimale) {
      avvisi.push('Il reddito è sotto il minimale INPS: i contributi fissi sono dovuti comunque, per intero.');
    }
  }

  return {
    ricavi,
    coefficiente,
    redditoLordo,
    contributi,
    imponibile,
    aliquotaImposta,
    imposta,
    totaleTasse,
    costiReali,
    netto,
    nettoMensile: netto / 12,
    incidenza: ricavi > 0 ? totaleTasse / ricavi : 0,
    avvisi,
  };
}
