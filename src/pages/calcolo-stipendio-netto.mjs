import { ANNO, AGGIORNATO, DIPENDENTE, IRPEF, ADDIZIONALI_DEFAULT } from '../lib/params.js';
import { calcolaStipendio } from '../lib/stipendio.js';
import { euro, perc, numero } from '../lib/format.js';

const es = calcolaStipendio({ ral: 30000 });
const righe = [15000, 20000, 25000, 28000, 30000, 35000, 40000, 50000, 60000].map((ral) => {
  const r13 = calcolaStipendio({ ral, mensilita: 13 });
  const r14 = calcolaStipendio({ ral, mensilita: 14 });
  return `<tr><td class="num">${euro(ral)}</td><td class="num">${euro(r13.netto)}</td><td class="num">${euro(r13.nettoMensile)}</td><td class="num">${euro(r14.nettoMensile)}</td></tr>`;
}).join('');
const s = IRPEF.scaglioni;
const pctAdd = (n) => numero(n * 100).replace('.', ',');

export default {
  order: 2,
  kind: 'tool',
  slug: 'calcolo-stipendio-netto',
  navLabel: 'Stipendio netto',
  cardText: 'Dalla RAL al netto in busta paga, con IRPEF 2026 e taglio del cuneo.',
  title: `Calcolo stipendio netto ${ANNO}: da RAL a netto mensile`,
  description: `Da RAL a stipendio netto ${ANNO}: IRPEF con secondo scaglione al 33%, contributi INPS, taglio del cuneo e addizionali. Netto su 13 o 14 mensilità.`,
  h1: `Calcolo stipendio netto ${ANNO} dalla RAL`,
  year: ANNO,
  updated: AGGIORNATO,
  script: 'stipendio.js',
  intro: `<p>Inserisci la retribuzione annua lorda (RAL) del contratto e ottieni il netto mensile stimato. Il calcolo applica gli scaglioni IRPEF ${ANNO} (23%, 33%, 43%), le detrazioni per lavoro dipendente e le misure strutturali di taglio del cuneo fiscale.</p>`,
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <label>RAL, retribuzione annua lorda (€)
      <input name="ral" data-num inputmode="decimal" autocomplete="off" value="30.000">
    </label>
    <fieldset class="segmented">
      <legend>Mensilità</legend>
      <label><input type="radio" name="mensilita" value="12"> 12</label>
      <label><input type="radio" name="mensilita" value="13" checked> 13</label>
      <label><input type="radio" name="mensilita" value="14"> 14</label>
    </fieldset>
    <label>Addizionale regionale (%)
      <input name="addRegionale" data-num="perc" inputmode="decimal" value="${pctAdd(ADDIZIONALI_DEFAULT.regionale)}">
      <span class="hint">Varia da regione a regione (da 1,23% a 3,33%). 1,73% è l'aliquota base.</span>
    </label>
    <label>Addizionale comunale (%)
      <input name="addComunale" data-num="perc" inputmode="decimal" value="${pctAdd(ADDIZIONALI_DEFAULT.comunale)}">
      <span class="hint">Massimo 0,8% (0,9% a Roma). Alcuni comuni hanno esenzioni.</span>
    </label>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto al mese (su <span data-out="mensilita">13</span>)</span><strong data-out="nettoMensile">–</strong></div>
      <div class="kpi"><span>Netto annuo</span><strong data-out="netto">–</strong></div>
    </div>
    <div class="bar" data-bar></div>
    <ul class="legend" data-legend></ul>
    <table class="breakdown">
      <tr><th>RAL</th><td data-out="ral"></td></tr>
      <tr><th>Contributi INPS a tuo carico</th><td data-out="inps"></td></tr>
      <tr><th>Imponibile IRPEF</th><td data-out="imponibile"></td></tr>
      <tr><th>IRPEF lorda</th><td data-out="irpefLorda"></td></tr>
      <tr><th>Detrazioni lavoro e cuneo</th><td data-out="detrazioni"></td></tr>
      <tr><th>IRPEF netta</th><td data-out="irpefNetta"></td></tr>
      <tr><th>Addizionali regionale e comunale</th><td data-out="addizionali"></td></tr>
      <tr><th>Somma esente e trattamento integrativo</th><td data-out="bonus"></td></tr>
      <tr class="total"><th>Peso totale su RAL</th><td data-out="aliquotaMedia"></td></tr>
    </table>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Come si passa dalla RAL al netto</h2>
<ol>
  <li><strong>Contributi INPS</strong>: il ${perc(DIPENDENTE.inpsAliquota)} della RAL resta all'INPS (più l'1% sulla parte oltre ${euro(DIPENDENTE.inpsSogliaAggiuntiva)}).</li>
  <li><strong>IRPEF lorda</strong> sull'imponibile, per scaglioni: ${perc(s[0].aliquota)} fino a ${euro(s[0].fino)}, ${perc(s[1].aliquota)} fino a ${euro(s[1].fino)}, ${perc(s[2].aliquota)} oltre.</li>
  <li><strong>Detrazioni</strong>: la detrazione per lavoro dipendente (fino a ${euro(DIPENDENTE.detrazione.fino15000)}) e, tra 20.000 € e 40.000 € di reddito, l'ulteriore detrazione fino a ${euro(DIPENDENTE.cuneo.ulterioreDetrazione)}.</li>
  <li><strong>Addizionali</strong> regionale e comunale sull'imponibile.</li>
  <li><strong>Bonus in busta</strong>: sotto i 20.000 € di reddito spetta una somma esente da tasse (dal 4,8% al 7,1% del reddito); sotto i 15.000 € anche il trattamento integrativo di ${euro(DIPENDENTE.trattamentoIntegrativo.importo)} l'anno.</li>
</ol>
<div class="example">
  <p><strong>Esempio: RAL di ${euro(es.ral)}, 13 mensilità.</strong></p>
  <p>INPS ${euro(es.inps)} → imponibile ${euro(es.imponibile)}. IRPEF lorda ${euro(es.irpefLorda)}, meno detrazioni per ${euro(es.detrazioneLavoro + es.ulterioreDetrazione)} = IRPEF netta ${euro(es.irpefNetta)}. Addizionali circa ${euro(es.addizionali)}.</p>
  <p>Netto annuo <strong>${euro(es.netto)}</strong>, cioè circa <strong>${euro(es.nettoMensile)} al mese</strong> su 13 mensilità.</p>
</div>

<h2>Cosa cambia nel ${ANNO}</h2>
<p>La Legge di Bilancio ${ANNO} ha abbassato l'aliquota del secondo scaglione IRPEF dal 35% al 33% per i redditi tra 28.000 € e 50.000 €. Il risparmio massimo è di 440 € l'anno, raggiunto da chi ha almeno 50.000 € di imponibile. Per i redditi oltre 200.000 € il beneficio viene recuperato con un taglio delle detrazioni. Restano invariate le detrazioni per lavoro dipendente e il taglio del cuneo introdotto dalla legge di bilancio 2025.</p>

<h2>Tabella RAL – netto ${ANNO}</h2>
<p>Valori calcolati con addizionali medie (${pctAdd(ADDIZIONALI_DEFAULT.regionale)}% regionale, ${pctAdd(ADDIZIONALI_DEFAULT.comunale)}% comunale), senza familiari a carico.</p>
<table>
  <thead><tr><th class="num">RAL</th><th class="num">Netto annuo</th><th class="num">Netto mensile (13)</th><th class="num">Netto mensile (14)</th></tr></thead>
  <tbody>${righe}</tbody>
</table>

<h2>Perché la busta paga reale può essere diversa</h2>
<ul>
  <li><strong>Familiari a carico</strong>: le detrazioni per coniuge e altri familiari aumentano il netto. Per i figli sotto i 21 anni c'è l'assegno unico, pagato dall'INPS e non in busta.</li>
  <li><strong>Addizionali a rate</strong>: in busta paga trattieni le addizionali dell'anno precedente, divise in rate, più un acconto della comunale.</li>
  <li><strong>Tredicesima e quattordicesima</strong> sono tassate senza detrazioni mensili: quel mese il netto è più basso della media.</li>
  <li><strong>Straordinari, premi, fringe benefit e welfare</strong> hanno regole proprie, spesso più favorevoli.</li>
  <li>Alcuni contratti (apprendisti, aziende con fondi speciali) hanno aliquote contributive diverse dal 9,19%.</li>
</ul>
`,
  faq: [
    {
      q: `Quanto è il netto di 30.000 € lordi nel ${ANNO}?`,
      a: `<p>Con 13 mensilità e addizionali medie circa ${euro(es.nettoMensile)} al mese, pari a ${euro(es.netto)} netti all'anno. Su 14 mensilità la rata mensile scende, ma il totale annuo è lo stesso.</p>`,
    },
    {
      q: 'Che differenza c\'è tra RAL e stipendio netto?',
      a: '<p>La RAL è il lordo annuo scritto nel contratto, prima di contributi e tasse. Il netto è quello che ricevi sul conto: in media tra il 70% e l\'80% della RAL per i redditi medi, meno per quelli alti.</p>',
    },
    {
      q: 'Il taglio del cuneo fiscale c\'è ancora nel 2026?',
      a: '<p>Sì. Dal 2025 è strutturale: fino a 20.000 € di reddito spetta una somma che non concorre al reddito (dal 7,1% al 4,8%), tra 20.000 € e 32.000 € un\'ulteriore detrazione di 1.000 €, che si riduce fino ad azzerarsi a 40.000 €.</p>',
    },
    {
      q: 'Cos\'è il trattamento integrativo (ex bonus Renzi)?',
      a: `<p>Sono ${euro(DIPENDENTE.trattamentoIntegrativo.importo)} l'anno (100 € al mese) per chi ha un reddito fino a 15.000 € e un'IRPEF lorda superiore alla detrazione per lavoro dipendente meno 75 €. Tra 15.000 € e 28.000 € spetta solo in casi particolari, legati ad altre detrazioni come quelle per mutuo o figli.</p>`,
    },
    {
      q: 'Perché il netto cambia in base alla regione?',
      a: '<p>Per le addizionali IRPEF: ogni regione e comune fissa la propria aliquota. Tra la regione più leggera e quella più cara la differenza su 30.000 € di RAL può superare i 400 € l\'anno.</p>',
    },
  ],
  related: ['calcolo-tasse-forfettario', 'calcolo-rata-mutuo', 'prestazione-occasionale'],
};
