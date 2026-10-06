import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcolaFattura, compensoDaNetto, importoDaNetto } from '../src/lib/fattura.js';
import { BOLLO, INPS, FORFETTARIO } from '../src/lib/params.js';
import { euro, numero, perc } from '../src/lib/format.js';
import pagina from '../src/pages/calcolo-fattura.mjs';

const vicino = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const psicologo = { regime: 'ordinario', rivalsa: 'cassa', percCassa: 0.02, aliquotaIva: 0 };

test('fattura ordinaria esente: psicologo, 1.000 € + ENPAP 2%, bollo addebitato', () => {
  // Imponibile 1.000 + 20 = 1.020. IVA esente (art. 10 n. 18): 0. Bollo 2 € (1.020 > 77,47).
  // Totale 1.020 + 2 = 1.022. Ritenuta 20% sul solo compenso: 200. Netto 1.022 - 200 = 822.
  const r = calcolaFattura({ ...psicologo, importo: 1000 });
  vicino(r.imponibile, 1020);
  assert.equal(r.iva, 0);
  assert.equal(r.ivaEsente, true);
  assert.equal(r.bollo, 2);
  vicino(r.totale, 1022);
  vicino(r.ritenuta, 200);
  vicino(r.nettoAPagare, 822);
});

test('fattura ordinaria esente: bollo a carico del professionista', () => {
  // Il bollo è dovuto ma non entra nel totale: totale 1.020, netto 1.020 - 200 = 820.
  const r = calcolaFattura({ ...psicologo, importo: 1000, bolloACliente: false });
  assert.equal(r.bollo, 2);
  assert.equal(r.bolloACliente, false);
  vicino(r.totale, 1020);
  vicino(r.nettoAPagare, 820);
});

test('fattura ordinaria esente con rivalsa INPS: ritenuta sulla rivalsa, non sul bollo', () => {
  // 1.000 + rivalsa 40 = 1.040; bollo 2; totale 1.042; ritenuta 20% di 1.040 = 208; netto 834.
  const r = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'inps', aliquotaIva: 0 });
  vicino(r.totale, 1042);
  vicino(r.ritenuta, 208);
  vicino(r.nettoAPagare, 834);
});

test('fattura ordinaria esente: soglia del bollo e nessun bollo con IVA', () => {
  const esente = (importo) => calcolaFattura({ importo, regime: 'ordinario', aliquotaIva: 0, ritenuta: false });
  assert.equal(esente(70).bollo, 0);
  assert.equal(esente(BOLLO.soglia).bollo, 0); // la soglia è esclusa
  assert.equal(esente(77.48).bollo, BOLLO.importo);
  const conIva = calcolaFattura({ importo: 1000, regime: 'ordinario', aliquotaIva: 0.22 });
  assert.equal(conIva.bollo, 0);
  assert.equal(conIva.ivaEsente, false);
  vicino(conIva.totale, 1220);
});

test('netto da incassare: 78 € nel forfettario non si può ottenere per il bollo', () => {
  // Sotto soglia il netto massimo è 77,47 €; il primo compenso con bollo (77,48) dà 77,48 + 2 = 79,48 €.
  const r = compensoDaNetto(78, { regime: 'forfettario' });
  assert.equal(r.importo, 77.48);
  vicino(r.nettoOttenuto, 79.48);
  assert.equal(r.esatto, false);
  assert.match(r.avviso, /non si può ottenere/);
  assert.ok(r.avviso.includes(euro(79.48)));
  assert.equal(importoDaNetto(78, { regime: 'forfettario' }), 77.48);
});

test('netto da incassare: 78 € nel forfettario con rivalsa INPS', () => {
  // Primo compenso con bollo: 74,50 × 1,04 = 77,48 > 77,47 (74,49 × 1,04 = 77,4696 resta sotto).
  // Netto 77,48 + 2 = 79,48 €.
  const r = compensoDaNetto(78, { regime: 'forfettario', rivalsa: 'inps' });
  assert.equal(r.importo, 74.5);
  vicino(r.nettoOttenuto, 79.48);
  assert.equal(r.esatto, false);
});

test('netto da incassare: netti ottenibili restano esatti', () => {
  const casi = [
    [79.48, { regime: 'forfettario' }, 77.48],
    [79.48, { regime: 'forfettario', rivalsa: 'inps' }, 74.5],
    [77.47, { regime: 'forfettario' }, 77.47],
    [78, { regime: 'forfettario', bolloACliente: false }, 78],
    [1042, { regime: 'forfettario', rivalsa: 'inps' }, 1000],
    [1060.8, { regime: 'ordinario', rivalsa: 'inps' }, 1000],
    [822, psicologo, 1000],
    [820, { ...psicologo, bolloACliente: false }, 1000],
  ];
  for (const [netto, opzioni, atteso] of casi) {
    const r = compensoDaNetto(netto, opzioni);
    vicino(r.importo, atteso);
    assert.equal(r.esatto, true, `${netto} ${JSON.stringify(opzioni)}`);
    assert.equal(r.avviso, null);
  }
});

test('netto da incassare: salto del bollo anche in ordinario esente con ritenuta', () => {
  // Senza rivalsa: sotto soglia netto massimo 77,47 × 0,8 = 61,98; con bollo 77,48 × 0,8 + 2 = 63,98.
  const r = compensoDaNetto(63, { regime: 'ordinario', aliquotaIva: 0 });
  assert.equal(r.importo, 77.48);
  vicino(r.nettoOttenuto, 63.98);
  assert.equal(r.esatto, false);
});

test('netto da incassare: nessun avviso sul bollo quando la fattura ha IVA', () => {
  // Contributo integrativo 100% e IVA 22%: ogni centesimo di compenso vale (2 × 1,22 − 0,2) = 2,24 cent di netto.
  // Netto 0,10 → compenso 0,0446 → 0,04 (netto 0,0896): non è esatto per arrotondamento, ma il bollo non c'entra.
  const r = compensoDaNetto(0.1, { regime: 'ordinario', rivalsa: 'cassa', percCassa: 1, aliquotaIva: 0.22 });
  assert.equal(r.importo, 0.04);
  assert.equal(r.esatto, false);
  assert.equal(r.avviso, null);
});

test('pagina fattura: opzione esente, FAQ e diciture aggiornate', () => {
  assert.match(pagina.tool, /<option value="0">Esente IVA \(art\. 10 DPR 633\/72\)<\/option>/);
  assert.ok(!pagina.tool.includes('data-show-if="regime=forfettario"'), 'checkbox del bollo gestita dallo script');
  assert.match(pagina.tool, /data-list="avvisi"/);
  assert.match(pagina.content, /BolloVirtuale/);
  assert.match(pagina.content, /art\. 10, c\. 1, n\. 18, DPR 633\/72/);
  const esempio = calcolaFattura({ ...psicologo, importo: 1000 });
  assert.ok(pagina.content.includes(euro(esempio.nettoAPagare)));
  const faq = Object.fromEntries(pagina.faq.map((f) => [f.q, f.a]));
  const rivalsa = faq[`La rivalsa INPS ${perc(INPS.gestioneSeparata.rivalsa)} è obbligatoria?`];
  assert.ok(rivalsa && !rivalsa.includes('Non cambia i contributi'));
  assert.ok(rivalsa.includes(perc(INPS.gestioneSeparata.aliquota)));
  assert.ok(rivalsa.includes(perc(INPS.gestioneSeparata.aliquotaPensionati)));
  assert.ok(rivalsa.includes(`${numero(FORFETTARIO.sogliaRicavi)} €`));
  assert.match(faq['Su cosa si calcola la ritenuta d\'acconto?'], /D\.Lgs\. 192\/2024/);
  assert.ok(faq['Quando si mette la marca da bollo in fattura?'].includes(euro(BOLLO.soglia)));
});
