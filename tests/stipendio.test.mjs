import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcolaStipendio, contributiDipendente } from '../src/lib/stipendio.js';
import { DIPENDENTE } from '../src/lib/params.js';

const vicino = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('stipendio: addizionali azzerate se l\'IRPEF netta è zero (RAL 8.000)', () => {
  // INPS 8.000 x 9,19% = 735,20 -> imponibile 7.264,80.
  // IRPEF lorda 7.264,80 x 23% = 1.670,90 < detrazione 1.955 -> IRPEF netta 0, quindi niente addizionali.
  // Trattamento integrativo: 1.670,90 non supera 1.955 - 75 = 1.880 -> non spetta.
  // Somma esente 7.264,80 x 7,1% = 515,80. Netto 8.000 - 735,20 + 515,80 = 7.780,60.
  const r = calcolaStipendio({ ral: 8000 });
  vicino(r.imponibile, 7264.8);
  assert.equal(r.irpefNetta, 0);
  assert.equal(r.addizionali, 0);
  assert.equal(r.trattamentoIntegrativo, 0);
  vicino(r.sommaEsente, 515.8);
  vicino(r.netto, 7780.6);
});

test('stipendio: addizionali dovute appena l\'IRPEF netta è positiva (RAL 10.000)', () => {
  // INPS 919 -> imponibile 9.081. IRPEF lorda 2.088,63 - 1.955 = IRPEF netta 133,63.
  // Addizionali 9.081 x (1,73% + 0,8%) = 229,75. Trattamento integrativo 1.200 (2.088,63 > 1.880).
  // Somma esente 9.081 x 5,3% = 481,29.
  // Netto 10.000 - 919 - 133,63 - 229,75 + 481,29 + 1.200 = 10.398,91.
  const r = calcolaStipendio({ ral: 10000 });
  vicino(r.irpefNetta, 133.63);
  vicino(r.addizionali, 229.75);
  assert.equal(r.trattamentoIntegrativo, 1200);
  vicino(r.netto, 10398.91);
});

test('stipendio: soglia in cui l\'IRPEF netta diventa positiva (RAL 9.360 e 9.400)', () => {
  // RAL 9.360: INPS 860,18 -> imponibile 8.499,82. IRPEF lorda 1.954,96 < 1.955 -> IRPEF netta 0, niente addizionali.
  // Somma esente 7,1% = 603,49; trattamento integrativo 1.200 (1.954,96 > 1.880).
  // Netto 9.360 - 860,18 + 603,49 + 1.200 = 10.303,30.
  const sotto = calcolaStipendio({ ral: 9360 });
  assert.equal(sotto.irpefNetta, 0);
  assert.equal(sotto.addizionali, 0);
  vicino(sotto.netto, 10303.3);
  // RAL 9.400: INPS 863,86 -> imponibile 8.536,14. IRPEF lorda 1.963,31 -> IRPEF netta 8,31.
  // Addizionali 8.536,14 x 2,53% = 215,96; somma esente 5,3% = 452,42; trattamento integrativo 1.200.
  // Netto 9.400 - 863,86 - 8,31 - 215,96 + 452,42 + 1.200 = 9.964,28.
  const sopra = calcolaStipendio({ ral: 9400 });
  vicino(sopra.irpefNetta, 8.31);
  vicino(sopra.addizionali, 215.96);
  vicino(sopra.netto, 9964.28);
});

test('stipendio: RAL 30.000 con addizionali di default', () => {
  // Imponibile 27.243; IRPEF netta 6.265,89 - 2.044,29 - 1.000 = 3.221,60.
  // Addizionali 27.243 x 2,53% = 689,25. Netto 30.000 - 2.757 - 3.221,60 - 689,25 = 23.332,16.
  const r = calcolaStipendio({ ral: 30000 });
  vicino(r.irpefNetta, 3221.6);
  vicino(r.addizionali, 689.25);
  vicino(r.netto, 23332.16);
  vicino(r.nettoMensile, 1794.78);
});

test('stipendio: massimale contributivo per chi ha il primo contributo dal 1996 (RAL 150.000)', () => {
  // Senza tetto: 150.000 x 9,19% + (150.000 - 56.224) x 1% = 13.785 + 937,76 = 14.722,76.
  // Con tetto: 122.295 x 9,19% + (122.295 - 56.224) x 1% = 11.238,91 + 660,71 = 11.899,62.
  // Imponibile 138.100,38: IRPEF 6.440 + 7.260 + 88.100,38 x 43% = 51.583,16; addizionali 3.493,94.
  // Netto 150.000 - 11.899,62 - 51.583,16 - 3.493,94 = 83.023,28 (circa 1.538 € in più).
  const ordinario = calcolaStipendio({ ral: 150000 });
  const puro = calcolaStipendio({ ral: 150000, contributivoPuro: true });
  vicino(ordinario.inps, 14722.76);
  vicino(puro.inps, 11899.62);
  vicino(puro.imponibile, 138100.38);
  vicino(puro.irpefLorda, 51583.16);
  vicino(puro.addizionali, 3493.94);
  vicino(puro.netto, 83023.28);
  vicino(puro.netto - ordinario.netto, 1537.76);
});

test('stipendio: il massimale non cambia nulla sotto la soglia e blocca i contributi sopra', () => {
  assert.equal(DIPENDENTE.massimale, 122295);
  assert.equal(contributiDipendente(60000, { contributivoPuro: true }), contributiDipendente(60000));
  assert.equal(calcolaStipendio({ ral: 60000, contributivoPuro: true }).netto, calcolaStipendio({ ral: 60000 }).netto);
  const alMassimale = contributiDipendente(DIPENDENTE.massimale, { contributivoPuro: true });
  vicino(contributiDipendente(200000, { contributivoPuro: true }), alMassimale);
  vicino(contributiDipendente(DIPENDENTE.massimale), alMassimale);
});

test('stipendio: RAL zero', () => {
  const r = calcolaStipendio({ ral: 0 });
  assert.equal(r.netto, 0);
  assert.equal(r.addizionali, 0);
  assert.equal(r.aliquotaMedia, 0);
});

test('stipendio con massimale: il netto cresce con la RAL', () => {
  let prec = -Infinity;
  for (let ral = 5000; ral <= 250000; ral += 250) {
    const n = calcolaStipendio({ ral, contributivoPuro: true }).netto;
    // Stessa tolleranza del test generale: scalini di cuneo, trattamento integrativo e addizionali.
    assert.ok(n > prec - 1300, `RAL ${ral}: netto ${n} < ${prec}`);
    prec = Math.max(prec, n);
  }
});
