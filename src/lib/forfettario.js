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
// Con ricavi oltre sogliaUscitaImmediata il forfettario cessa già nell'anno: fuoriRegime = true e
// imposta, contributi e netto restano solo indicativi (non vanno mostrati come dovuti).
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

  // Circ. AdE 32/E/2023: oltre la soglia l'IVA si applica dall'operazione che la supera, mentre il
  // reddito dell'intero anno si determina con le regole ordinarie (IRPEF e costi reali).
  const fuoriRegime = ricavi > FORFETTARIO.sogliaUscitaImmediata;
  const avvisi = [];
  if (fuoriRegime) {
    avvisi.push(`Oltre ${FORFETTARIO.sogliaUscitaImmediata.toLocaleString('it-IT')} € di ricavi esci dal forfettario già quest'anno: l'IVA si applica dall'operazione che fa superare la soglia, e il reddito dell'intero anno si tassa con IRPEF ordinaria e costi reali. L'imposta sostitutiva calcolata qui non è dovuta.`);
  } else if (ricavi > FORFETTARIO.sogliaRicavi) {
    avvisi.push(`Oltre ${FORFETTARIO.sogliaRicavi.toLocaleString('it-IT')} € di ricavi resti forfettario per quest'anno, ma dal prossimo passi al regime ordinario.`);
  }
  if (gestione === 'artigiani' || gestione === 'commercianti') {
    if (redditoLordo < INPS[gestione].minimale) {
      avvisi.push(riduzione35
        ? `Il reddito è sotto il minimale INPS: i contributi fissi (ridotti del ${Math.round(INPS.riduzioneForfettari * 100)}%) sono dovuti comunque, anche se il reddito è più basso.`
        : 'Il reddito è sotto il minimale INPS: i contributi fissi sono dovuti comunque, per intero.');
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
    fuoriRegime,
    avvisi,
  };
}
