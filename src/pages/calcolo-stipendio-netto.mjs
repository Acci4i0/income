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
const eur0 = (n) => `${numero(n)} €`;
const sne = DIPENDENTE.cuneo.sommaNonImponibile;
const cuneo = DIPENDENTE.cuneo;
const ti = DIPENDENTE.trattamentoIntegrativo;
// Esempio sopra il massimale contributivo, con e senza il tetto per chi ha il primo contributo dal 1996.
const esAlto = calcolaStipendio({ ral: 150000 });
const esAltoPuro = calcolaStipendio({ ral: 150000, contributivoPuro: true });

export default {
  order: 2,
  kind: 'tool',
  slug: 'calcolo-stipendio-netto',
  navLabel: 'Stipendio netto',
  cardText: `Dalla RAL al netto in busta paga, con IRPEF ${ANNO} e taglio del cuneo.`,
  title: `Calcolo stipendio netto ${ANNO}: da RAL a netto mensile`,
  description: `Da RAL a stipendio netto ${ANNO}: IRPEF con secondo scaglione al ${perc(s[1].aliquota)}, contributi INPS, taglio del cuneo e addizionali. Netto su 13 o 14 mensilità.`,
  h1: `Calcolo stipendio netto ${ANNO} dalla RAL`,
  year: ANNO,
  updated: AGGIORNATO,
  script: 'stipendio.js',
  intro: `<p>Inserisci la retribuzione annua lorda (RAL) del contratto e ottieni il netto mensile stimato. Il calcolo applica gli scaglioni IRPEF ${ANNO} (${s.map((x) => perc(x.aliquota)).join(', ')}), le detrazioni per lavoro dipendente e le misure strutturali di taglio del cuneo fiscale.</p>`,
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
      <span class="hint">Varia da regione a regione: l'aliquota base è 1,23% e le regioni possono arrivare al 3,33%. Alcune regioni a statuto speciale applicano meno (es. Friuli-Venezia Giulia 0,70% fino a 15.000 €). Il valore ${pctAdd(ADDIZIONALI_DEFAULT.regionale)}% è indicativo.</span>
    </label>
    <label>Addizionale comunale (%)
      <input name="addComunale" data-num="perc" inputmode="decimal" value="${pctAdd(ADDIZIONALI_DEFAULT.comunale)}">
      <span class="hint">Di norma massimo 0,8%. Roma arriva allo 0,9% e alcuni capoluoghi con forte disavanzo lo superano in deroga (es. Napoli 1%). Molti comuni prevedono soglie di esenzione.</span>
    </label>
    <label class="check"><input type="checkbox" name="contributivoPuro"> <span>Primo contributo versato dopo il 1995 (massimale di ${eur0(DIPENDENTE.massimale)})</span></label>
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
  <li><strong>Contributi INPS</strong>: il ${perc(DIPENDENTE.inpsAliquota)} della RAL resta all'INPS (più l'${perc(DIPENDENTE.inpsAliquotaAggiuntiva)} sulla parte oltre ${eur0(DIPENDENTE.inpsSogliaAggiuntiva)}). Chi ha il primo contributo dal 1996 non li paga sulla parte di RAL oltre il massimale di ${eur0(DIPENDENTE.massimale)} (opzione nel calcolatore).</li>
  <li><strong>IRPEF lorda</strong> sull'imponibile, per scaglioni: ${perc(s[0].aliquota)} fino a ${eur0(s[0].fino)}, ${perc(s[1].aliquota)} fino a ${eur0(s[1].fino)}, ${perc(s[2].aliquota)} oltre.</li>
  <li><strong>Detrazioni</strong>: la detrazione per lavoro dipendente (fino a ${eur0(DIPENDENTE.detrazione.fino15000)}) e, tra ${eur0(sne[sne.length - 1].fino)} e ${eur0(cuneo.azzeramento)} di reddito, l'ulteriore detrazione fino a ${eur0(cuneo.ulterioreDetrazione)}.</li>
  <li><strong>Addizionali</strong> regionale e comunale sull'imponibile. Non si pagano se l'IRPEF netta è zero.</li>
  <li><strong>Bonus in busta</strong>: sotto i ${eur0(sne[sne.length - 1].fino)} di reddito spetta una somma esente da tasse (dal ${perc(sne[sne.length - 1].perc)} al ${perc(sne[0].perc)} del reddito); sotto i ${eur0(ti.sogliaReddito)} anche il trattamento integrativo di ${eur0(ti.importo)} l'anno.</li>
</ol>
<div class="example">
  <p><strong>Esempio: RAL di ${eur0(es.ral)}, 13 mensilità.</strong></p>
  <p>INPS ${euro(es.inps)} → imponibile ${euro(es.imponibile)}. IRPEF lorda ${euro(es.irpefLorda)}, meno detrazioni per ${euro(es.detrazioneLavoro + es.ulterioreDetrazione)} = IRPEF netta ${euro(es.irpefNetta)}. Addizionali circa ${euro(es.addizionali)}.</p>
  <p>Netto annuo <strong>${euro(es.netto)}</strong>, cioè circa <strong>${euro(es.nettoMensile)} al mese</strong> su 13 mensilità.</p>
</div>

<h2>Cosa cambia nel ${ANNO}</h2>
<p>La Legge di Bilancio ${ANNO} ha abbassato l'aliquota del secondo scaglione IRPEF dal 35% al ${perc(s[1].aliquota)} per i redditi tra ${eur0(s[0].fino)} e ${eur0(s[1].fino)}. Il risparmio massimo è di 440 € l'anno, raggiunto da chi ha almeno ${eur0(s[1].fino)} di imponibile. Oltre 200.000 € di reddito le detrazioni per oneri al 19% (escluse spese sanitarie, erogazioni ai partiti e premi per rischi catastrofali) si riducono di 440 €: il beneficio viene neutralizzato solo se si hanno detrazioni di questo tipo. Il calcolatore assume che non ce ne siano. Restano invariate le detrazioni per lavoro dipendente e il taglio del cuneo introdotto dalla legge di bilancio 2025.</p>

<h2>Tabella RAL – netto ${ANNO}</h2>
<p>Valori calcolati senza familiari a carico e con addizionali indicative: ${pctAdd(ADDIZIONALI_DEFAULT.regionale)}% regionale e ${pctAdd(ADDIZIONALI_DEFAULT.comunale)}% comunale (il massimo ordinario, quindi una stima prudente).</p>
<table>
  <thead><tr><th class="num">RAL</th><th class="num">Netto annuo</th><th class="num">Netto mensile (13)</th><th class="num">Netto mensile (14)</th></tr></thead>
  <tbody>${righe}</tbody>
</table>

<h2>Perché la busta paga reale può essere diversa</h2>
<ul>
  <li><strong>Familiari a carico</strong>: le detrazioni per coniuge e altri familiari aumentano il netto. Per i figli sotto i 21 anni c'è l'assegno unico, pagato dall'INPS e non in busta.</li>
  <li><strong>Addizionali a rate</strong>: in busta paga trattieni le addizionali dell'anno precedente, divise in rate, più un acconto della comunale.</li>
  <li><strong>Tredicesima e quattordicesima</strong> sono tassate senza detrazioni. Il loro netto è più basso di una mensilità ordinaria, e le mensilità ordinarie sono un po' più alte della media mostrata.</li>
  <li><strong>Massimale contributivo</strong>: con il primo contributo dal 1996 non si versano contributi sulla RAL oltre ${eur0(DIPENDENTE.massimale)}. Con ${eur0(esAlto.ral)} di RAL l'INPS scende da ${euro(esAlto.inps)} a ${euro(esAltoPuro.inps)} e il netto sale di circa ${eur0(Math.round(esAltoPuro.netto - esAlto.netto))} l'anno. Il calcolatore applica il tetto solo se spunti l'opzione.</li>
  <li><strong>Straordinari, premi, fringe benefit e welfare</strong> hanno regole proprie, spesso più favorevoli.</li>
  <li>Alcuni contratti (apprendisti, aziende con fondi speciali) hanno aliquote contributive diverse dal ${perc(DIPENDENTE.inpsAliquota)}.</li>
</ul>
`,
  faq: [
    {
      q: `Quanto è il netto di ${eur0(es.ral)} lordi nel ${ANNO}?`,
      a: `<p>Con 13 mensilità e addizionali indicative (la comunale al massimo ordinario, una stima prudente) circa ${euro(es.nettoMensile)} al mese, pari a ${euro(es.netto)} netti all'anno. Su 14 mensilità la rata mensile scende, ma il totale annuo è lo stesso.</p>`,
    },
    {
      q: 'Che differenza c\'è tra RAL e stipendio netto?',
      a: '<p>La RAL è il lordo annuo scritto nel contratto, prima di contributi e tasse. Il netto è quello che ricevi sul conto: in media tra il 70% e l\'80% della RAL per i redditi medi, meno per quelli alti.</p>',
    },
    {
      q: `Il taglio del cuneo fiscale c'è ancora nel ${ANNO}?`,
      a: `<p>Sì. Dal 2025 è strutturale: fino a ${eur0(sne[sne.length - 1].fino)} di reddito spetta una somma che non concorre al reddito (dal ${perc(sne[0].perc)} al ${perc(sne[sne.length - 1].perc)}), tra ${eur0(sne[sne.length - 1].fino)} e ${eur0(cuneo.pienaFino)} un'ulteriore detrazione di ${eur0(cuneo.ulterioreDetrazione)}, che si riduce fino ad azzerarsi a ${eur0(cuneo.azzeramento)}.</p>`,
    },
    {
      q: 'Cos\'è il trattamento integrativo (ex bonus Renzi)?',
      a: `<p>Sono ${eur0(ti.importo)} l'anno (${eur0(ti.importo / 12)} al mese) per chi ha un reddito fino a ${eur0(ti.sogliaReddito)} e un'IRPEF lorda superiore alla detrazione per lavoro dipendente meno ${eur0(ti.franchigia)}. Tra ${eur0(ti.sogliaReddito)} e 28.000 € spetta solo se la somma di alcune detrazioni supera l'IRPEF lorda: familiari a carico, lavoro dipendente, interessi su mutui stipulati entro il 2021, rate di spese sostenute entro il 2021. L'importo è la differenza, fino a ${eur0(ti.importo)}. Il calcolatore considera solo la detrazione per lavoro dipendente, che in questa fascia da sola non basta.</p>`,
    },
    {
      q: 'Perché il netto cambia in base alla regione?',
      a: '<p>Per le addizionali IRPEF: ogni regione e comune fissa la propria aliquota. Tra la regione più leggera e quella più cara la differenza su 30.000 € di RAL può superare i 400 € l\'anno.</p>',
    },
  ],
  related: ['calcolo-tasse-forfettario', 'calcolo-rata-mutuo', 'prestazione-occasionale'],
};
