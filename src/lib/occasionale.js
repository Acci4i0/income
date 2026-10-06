import { OCCASIONALE, INPS, BOLLO } from './params.js';
import { risolvi } from './format.js';

// Prestazione occasionale: ritenuta del 20% se il committente è sostituto d'imposta,
// contributi in Gestione Separata solo sulla parte di compensi annui oltre 5.000 €.
export function calcolaOccasionale({ lordo, giaPercepito = 0, sostituto = true, iscrittoAltraForma = false }) {
  const f = OCCASIONALE.franchigiaInps;
  const eccedenza = Math.max(0, giaPercepito + lordo - f) - Math.max(0, giaPercepito - f);
  const aliquota = iscrittoAltraForma ? INPS.gestioneSeparata.aliquotaPensionati : INPS.gestioneSeparata.aliquotaCollaboratori;
  const inpsTotale = eccedenza * aliquota;
  const inpsLavoratore = inpsTotale * OCCASIONALE.quotaLavoratore;
  const inpsCommittente = inpsTotale - inpsLavoratore;
  const ritenuta = sostituto ? lordo * OCCASIONALE.ritenuta : 0;
  const bollo = lordo > BOLLO.soglia ? BOLLO.importo : 0;
  const netto = lordo - ritenuta - inpsLavoratore;
  return {
    lordo,
    eccedenza,
    aliquota,
    inpsTotale,
    inpsLavoratore,
    inpsCommittente,
    ritenuta,
    bollo,
    netto,
    costoCommittente: lordo + inpsCommittente,
    superaFranchigia: giaPercepito + lordo > f,
  };
}

export function lordoDaNetto({ netto, ...opzioni }) {
  const lordo = risolvi((x) => calcolaOccasionale({ lordo: x, ...opzioni }).netto, netto, 0, Math.max(10, netto * 3));
  return Math.round(lordo * 100) / 100;
}
