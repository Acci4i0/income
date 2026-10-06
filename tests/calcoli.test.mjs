import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseNumero, euro } from '../src/lib/format.js';
import { irpefLorda } from '../src/lib/irpef.js';
import { calcolaForfettario } from '../src/lib/forfettario.js';
import { calcolaStipendio, detrazioneLavoro, cuneoFiscale } from '../src/lib/stipendio.js';
import { scorporaIva, aggiungiIva } from '../src/lib/iva.js';
import { calcolaOccasionale, lordoDaNetto } from '../src/lib/occasionale.js';
import { calcolaFattura, importoDaNetto } from '../src/lib/fattura.js';
import { calcolaMutuo, rataMensile } from '../src/lib/mutuo.js';

const vicino = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('parseNumero formati italiani', () => {
  assert.equal(parseNumero('1.234,56'), 1234.56);
  assert.equal(parseNumero('1234,5'), 1234.5);
  assert.equal(parseNumero('1.500'), 1500);
  assert.equal(parseNumero('12.5'), 12.5);
  assert.equal(parseNumero('30 000 €'), 30000);
  assert.ok(Number.isNaN(parseNumero('abc')));
  assert.ok(Number.isNaN(parseNumero('')));
  assert.match(euro(1234.5), /1\.234,50/);
});

test('IRPEF 2026 per scaglioni 23/33/43', () => {
  vicino(irpefLorda(20000), 4600);
  vicino(irpefLorda(28000), 6440);
  vicino(irpefLorda(40000), 6440 + 12000 * 0.33);
  vicino(irpefLorda(60000), 6440 + 22000 * 0.33 + 10000 * 0.43);
  assert.equal(irpefLorda(0), 0);
});

test('forfettario: professionista in Gestione Separata, 40.000 €', () => {
  const r = calcolaForfettario({ ricavi: 40000, coefficiente: 0.78, gestione: 'separata' });
  vicino(r.redditoLordo, 31200);
  vicino(r.contributi.totale, 8133.84);
  vicino(r.imponibile, 23066.16);
  vicino(r.imposta, 3459.92);
  vicino(r.netto, 28406.24);
  assert.equal(r.avvisi.length, 0);
});

test('forfettario: startup al 5%', () => {
  const r = calcolaForfettario({ ricavi: 40000, coefficiente: 0.78, gestione: 'separata', startup: true });
  vicino(r.imposta, 23066.16 * 0.05);
});

test('forfettario: commerciante, 50.000 € al 40%', () => {
  const r = calcolaForfettario({ ricavi: 50000, coefficiente: 0.40, gestione: 'commercianti' });
  vicino(r.redditoLordo, 20000);
  // 4.611,64 fissi + 24,48% su (20.000 - 18.808)
  vicino(r.contributi.totale, 4611.64 + 1192 * 0.2448);
  vicino(r.imposta, (20000 - r.contributi.totale) * 0.15);
});

test('forfettario: artigiano con riduzione 35% (maternità esclusa)', () => {
  const r = calcolaForfettario({ ricavi: 30000, coefficiente: 0.67, gestione: 'artigiani', riduzione35: true });
  const fissi = (4521.36 - 7.44) * 0.65 + 7.44;
  const variabili = (20100 - 18808) * 0.24 * 0.65;
  vicino(r.contributi.totale, fissi + variabili);
});

test('forfettario: sotto il minimale i fissi sono dovuti per intero', () => {
  const r = calcolaForfettario({ ricavi: 10000, coefficiente: 0.67, gestione: 'artigiani' });
  vicino(r.contributi.totale, 4521.36);
  assert.ok(r.avvisi.some((a) => a.includes('minimale')));
});

test('forfettario: avvisi soglie 85k e 100k', () => {
  assert.ok(calcolaForfettario({ ricavi: 90000, coefficiente: 0.78 }).avvisi[0].includes('prossimo'));
  assert.ok(calcolaForfettario({ ricavi: 110000, coefficiente: 0.78 }).avvisi[0].includes('anno in corso'));
});

test('forfettario: cassa professionale con aliquota personalizzata', () => {
  const r = calcolaForfettario({ ricavi: 50000, coefficiente: 0.78, gestione: 'cassa', aliquotaCassa: 0.17 });
  vicino(r.contributi.totale, 39000 * 0.17);
});

test('detrazioni lavoro dipendente e cuneo', () => {
  vicino(detrazioneLavoro(10000), 1955);
  vicino(detrazioneLavoro(27243), 1910 + 1190 * 757 / 13000 + 65);
  vicino(detrazioneLavoro(40000), 1910 * 10000 / 22000 + 0);
  vicino(detrazioneLavoro(30000), 1910 * 20000 / 22000 + 65);
  assert.equal(detrazioneLavoro(60000), 0);
  vicino(cuneoFiscale(8000).sommaEsente, 8000 * 0.071);
  vicino(cuneoFiscale(12000).sommaEsente, 12000 * 0.053);
  vicino(cuneoFiscale(19000).sommaEsente, 19000 * 0.048);
  assert.equal(cuneoFiscale(25000).ulterioreDetrazione, 1000);
  vicino(cuneoFiscale(36000).ulterioreDetrazione, 500);
  assert.equal(cuneoFiscale(45000).ulterioreDetrazione, 0);
});

test('stipendio netto: RAL 30.000 senza addizionali', () => {
  const r = calcolaStipendio({ ral: 30000, mensilita: 13, addRegionale: 0, addComunale: 0 });
  vicino(r.inps, 2757);
  vicino(r.imponibile, 27243);
  vicino(r.irpefLorda, 6265.89);
  // 6.265,89 - (1.910 + 1.190*757/13.000 + 65) - 1.000
  vicino(r.irpefNetta, 6265.89 - (1910 + 1190 * 757 / 13000 + 65) - 1000);
  vicino(r.netto, 30000 - 2757 - r.irpefNetta);
  assert.equal(r.trattamentoIntegrativo, 0);
});

test('stipendio netto: RAL bassa con trattamento integrativo e somma esente', () => {
  const r = calcolaStipendio({ ral: 14000, addRegionale: 0, addComunale: 0 });
  // imponibile 12.713,40: IRPEF lorda 2.924,08 > 1.955 - 75 -> spetta il trattamento integrativo
  assert.equal(r.trattamentoIntegrativo, 1200);
  vicino(r.sommaEsente, r.imponibile * 0.053);
  vicino(r.irpefNetta, r.irpefLorda - 1955);
});

test('stipendio netto: contributo aggiuntivo 1% oltre la prima fascia', () => {
  const r = calcolaStipendio({ ral: 70000, addRegionale: 0, addComunale: 0 });
  vicino(r.inps, 70000 * 0.0919 + (70000 - 56224) * 0.01);
  assert.equal(r.detrazioneLavoro, 0);
});

test('stipendio netto cresce sempre con la RAL (nessun buco fiscale grave)', () => {
  let prec = -Infinity;
  for (let ral = 5000; ral <= 150000; ral += 250) {
    const n = calcolaStipendio({ ral }).netto;
    // Le soglie di cuneo e trattamento integrativo creano piccoli scalini: tolleranza 1.300 €.
    assert.ok(n > prec - 1300, `RAL ${ral}: netto ${n} < ${prec}`);
    prec = Math.max(prec, n);
  }
});

test('IVA: scorporo e aggiunta', () => {
  const s = scorporaIva(122, 0.22);
  vicino(s.imponibile, 100);
  vicino(s.iva, 22);
  const a = aggiungiIva(100, 0.10);
  vicino(a.lordo, 110);
});

test('prestazione occasionale sotto i 5.000 €', () => {
  const r = calcolaOccasionale({ lordo: 1000 });
  vicino(r.ritenuta, 200);
  vicino(r.netto, 800);
  assert.equal(r.inpsTotale, 0);
  assert.equal(r.bollo, 2);
});

test('prestazione occasionale oltre la franchigia', () => {
  const r = calcolaOccasionale({ lordo: 2000, giaPercepito: 4000 });
  vicino(r.eccedenza, 1000);
  vicino(r.inpsTotale, 337.2);
  vicino(r.inpsLavoratore, 112.4);
  vicino(r.inpsCommittente, 224.8);
  vicino(r.netto, 2000 - 400 - 112.4);
});

test('prestazione occasionale: committente privato, nessuna ritenuta', () => {
  const r = calcolaOccasionale({ lordo: 500, sostituto: false });
  assert.equal(r.ritenuta, 0);
  vicino(r.netto, 500);
});

test('prestazione occasionale: lordo da netto', () => {
  vicino(lordoDaNetto({ netto: 800 }), 1000, 0.02);
});

test('fattura forfettario con rivalsa INPS e bollo', () => {
  const r = calcolaFattura({ importo: 1000, regime: 'forfettario', rivalsa: 'inps' });
  vicino(r.imponibile, 1040);
  assert.equal(r.iva, 0);
  assert.equal(r.bollo, 2);
  vicino(r.totale, 1042);
  vicino(r.nettoAPagare, 1042);
});

test('fattura forfettario sotto soglia bollo', () => {
  const r = calcolaFattura({ importo: 70, regime: 'forfettario' });
  assert.equal(r.bollo, 0);
});

test('fattura ordinaria con IVA, rivalsa 4% e ritenuta', () => {
  const r = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'inps' });
  vicino(r.imponibile, 1040);
  vicino(r.iva, 228.8);
  vicino(r.totale, 1268.8);
  vicino(r.ritenuta, 208);
  vicino(r.nettoAPagare, 1060.8);
});

test('fattura ordinaria con cassa: contributo integrativo fuori ritenuta', () => {
  const r = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'cassa', percCassa: 0.04 });
  vicino(r.ritenuta, 200);
  vicino(r.iva, 228.8);
});

test('fattura: importo da netto desiderato', () => {
  const opz = { regime: 'ordinario', rivalsa: 'inps' };
  const imp = importoDaNetto(1060.8, opz);
  vicino(imp, 1000, 0.02);
});

test('mutuo: 150.000 € al 3% per 25 anni', () => {
  vicino(rataMensile(150000, 0.03, 25), 711.32);
  const r = calcolaMutuo({ capitale: 150000, tassoAnnuo: 0.03, anni: 25, redditoMensile: 2500 });
  assert.equal(r.piano.length, 25);
  vicino(r.piano.at(-1).residuo, 0);
  vicino(r.piano.reduce((s, a) => s + a.capitale, 0), 150000, 0.05);
  vicino(r.totaleInteressi, 711.32 * 300 - 150000, 2);
  vicino(r.rapportoRataReddito, 711.32 / 2500, 0.001);
});

test('mutuo a tasso zero', () => {
  vicino(rataMensile(12000, 0, 1), 1000);
});
