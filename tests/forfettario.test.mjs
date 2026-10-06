import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcolaForfettario } from '../src/lib/forfettario.js';
import { FORFETTARIO, INPS } from '../src/lib/params.js';
import { euro } from '../src/lib/format.js';
import pagina from '../src/pages/calcolo-tasse-forfettario.mjs';

const vicino = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const soglia = FORFETTARIO.sogliaUscitaImmediata;

test('forfettario: oltre la soglia di uscita immediata il regime non si applica', () => {
  // 200.000 € al 78% in GS: i numeri del forfettario restano calcolati ma sono segnalati come non dovuti.
  const r = calcolaForfettario({ ricavi: 200000, coefficiente: 0.78, gestione: 'separata' });
  assert.equal(r.fuoriRegime, true);
  assert.equal(r.avvisi.length, 1);
  const [avviso] = r.avvisi;
  assert.match(avviso, /già quest'anno/);
  assert.match(avviso, /l'IVA si applica dall'operazione che fa superare la soglia/);
  assert.match(avviso, /reddito dell'intero anno si tassa con IRPEF ordinaria e costi reali/);
  assert.match(avviso, /L'imposta sostitutiva calcolata qui non è dovuta/);
  assert.ok(!avviso.includes('regime ordinario'), 'IVA e imposte sui redditi non partono dalla stessa data');
});

test('forfettario: la soglia di uscita immediata è esclusa (ricavi pari alla soglia)', () => {
  const r = calcolaForfettario({ ricavi: soglia, coefficiente: 0.78, gestione: 'separata' });
  assert.equal(r.fuoriRegime, false);
  assert.match(r.avvisi[0], /dal prossimo passi al regime ordinario/);
  assert.equal(calcolaForfettario({ ricavi: soglia + 0.01, coefficiente: 0.78 }).fuoriRegime, true);
});

test('forfettario: fino a 85.000 € compresi nessun avviso sulle soglie', () => {
  const r = calcolaForfettario({ ricavi: FORFETTARIO.sogliaRicavi, coefficiente: 0.78, gestione: 'separata' });
  assert.equal(r.fuoriRegime, false);
  assert.equal(r.avvisi.length, 0);
});

test('forfettario: avviso minimale coerente con la riduzione del 35%', () => {
  // Artigiano, 20.000 € al 67%: reddito 13.400 € < minimale 18.808 €.
  // Fissi ridotti: (4.521,36 - 7,44) × 0,65 + 7,44 = 2.941,49 €.
  const ridotto = calcolaForfettario({ ricavi: 20000, coefficiente: 0.67, gestione: 'artigiani', riduzione35: true });
  vicino(ridotto.contributi.totale, 2941.49);
  const avvisoRidotto = ridotto.avvisi.find((a) => a.includes('minimale'));
  assert.ok(avvisoRidotto);
  assert.match(avvisoRidotto, /ridotti del 35%/);
  assert.ok(!avvisoRidotto.includes('per intero'));

  const pieno = calcolaForfettario({ ricavi: 20000, coefficiente: 0.67, gestione: 'artigiani' });
  vicino(pieno.contributi.totale, INPS.artigiani.contributoFisso);
  assert.ok(pieno.avvisi.find((a) => a.includes('minimale')).includes('per intero'));
});

test('forfettario: avviso minimale anche per i commercianti', () => {
  const r = calcolaForfettario({ ricavi: 20000, coefficiente: 0.40, gestione: 'commercianti' });
  vicino(r.contributi.totale, INPS.commercianti.contributoFisso);
  assert.ok(r.avvisi.some((a) => a.includes('minimale')));
  // In Gestione Separata non ci sono minimali.
  assert.ok(!calcolaForfettario({ ricavi: 10000, coefficiente: 0.78 }).avvisi.some((a) => a.includes('minimale')));
});

test('pagina forfettario: testi generati dal codice e codici ATECO 2007', () => {
  const testo = pagina.content + pagina.faq.map((f) => f.a).join('');
  assert.match(pagina.content, /Codici ATECO 2007/);
  assert.match(pagina.content, /95\.31, ex 45\.20/);
  assert.ok(!pagina.content.includes('Verifica sempre il tuo codice nella visura'));
  // Primo anno in GS: imposta sul reddito lordo intero (40.000 × 78% × 15% = 4.680 €) contro la stima a regime.
  const es = calcolaForfettario({ ricavi: 40000, coefficiente: 0.78, gestione: 'separata' });
  vicino(es.redditoLordo * es.aliquotaImposta, 4680);
  assert.ok(pagina.content.includes(`${euro(4680)} invece di ${euro(es.imposta)}`));
  assert.match(testo, /tra giugno e novembre/);
  assert.match(testo, /lavoratore dipendente o autonomo/);
  assert.match(testo, /entro il 28 febbraio/);
  assert.match(testo, /non abbia percepito anche una pensione/);
});
