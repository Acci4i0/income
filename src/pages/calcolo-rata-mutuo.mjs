import { ANNO, AGGIORNATO, MUTUO } from '../lib/params.js';
import { calcolaMutuo, rataMensile } from '../lib/mutuo.js';
import { euro, numero, perc } from '../lib/format.js';

const es = calcolaMutuo({ capitale: 150000, tassoAnnuo: 0.03, anni: 25 });
// Sostenibilità: rata massima pari a un terzo del reddito netto (stessa soglia dell'avviso in mutuo.js).
const redditoEs = 2400;
const rataMaxEs = redditoEs / 3;
const mutuoMaxEs = Math.round(rataMaxEs / rataMensile(1, 0.03, 25) / 1000) * 1000;
const tassi = [0.025, 0.03, 0.035, 0.04];
const durate = [15, 20, 25, 30];
const tabella = `
<table>
  <thead><tr><th>Durata</th>${tassi.map((t) => `<th class="num">TAN ${(t * 100).toFixed(1).replace('.', ',')}%</th>`).join('')}</tr></thead>
  <tbody>${durate.map((d) => `<tr><td>${d} anni</td>${tassi.map((t) => `<td class="num">${euro(rataMensile(100000, t, d))}</td>`).join('')}</tr>`).join('')}</tbody>
</table>`;

export default {
  order: 6,
  kind: 'tool',
  slug: 'calcolo-rata-mutuo',
  navLabel: 'Rata mutuo',
  cardText: 'Rata mensile, interessi totali e piano di ammortamento anno per anno.',
  title: 'Calcolo rata mutuo e piano di ammortamento',
  description: 'Calcola la rata del mutuo con ammortamento alla francese: rata mensile, interessi totali, piano anno per anno e rapporto rata/reddito.',
  h1: 'Calcolo rata mutuo',
  year: ANNO,
  updated: AGGIORNATO,
  script: 'mutuo.js',
  intro: '<p>Inserisci importo, tasso (TAN) e durata: ottieni la rata mensile, quanto paghi di interessi in totale e come scende il debito anno per anno. Aggiungi il reddito netto mensile per vedere se la rata è sostenibile.</p>',
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <label>Importo del mutuo (€)
      <input name="capitale" data-num inputmode="decimal" autocomplete="off" value="150.000">
    </label>
    <label>Tasso annuo nominale, TAN (%)
      <input name="tasso" data-num="perc" inputmode="decimal" value="3">
    </label>
    <label>Durata
      <select name="anni">
        ${[5, 10, 15, 20, 25, 30, 35, 40].map((a) => `<option value="${a}"${a === 25 ? ' selected' : ''}>${a} anni</option>`).join('')}
      </select>
    </label>
    <label>Reddito netto mensile del nucleo (€, facoltativo)
      <input name="reddito" data-num inputmode="decimal" autocomplete="off" value="">
    </label>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Rata mensile</span><strong data-out="rata">–</strong></div>
      <div class="kpi"><span>Interessi totali</span><strong data-out="totaleInteressi">–</strong></div>
    </div>
    <div class="bar" data-bar></div>
    <ul class="legend" data-legend></ul>
    <table class="breakdown">
      <tr><th>Numero di rate</th><td data-out="rate"></td></tr>
      <tr><th>Totale rimborsato</th><td data-out="totalePagato"></td></tr>
      <tr><th>Rata / reddito</th><td data-out="rapporto"></td></tr>
    </table>
    <ul class="avvisi" data-warn-rapporto hidden><li>La rata supera un terzo del reddito: molte banche considerano questo limite il massimo sostenibile.</li></ul>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>
<details class="piano">
  <summary>Piano di ammortamento anno per anno</summary>
  <div class="prose"><table>
    <thead><tr><th>Anno</th><th class="num">Quota capitale</th><th class="num">Quota interessi</th><th class="num">Debito residuo</th></tr></thead>
    <tbody data-piano></tbody>
  </table></div>
</details>`,
  content: `
<h2>Come si calcola la rata del mutuo</h2>
<p>Quasi tutti i mutui in Italia usano l'<strong>ammortamento alla francese</strong>: la rata resta uguale per tutta la durata (a tasso fisso), ma all'inizio è fatta soprattutto di interessi e alla fine soprattutto di capitale.</p>
<p><code>rata = C × i ÷ (1 − (1 + i)<sup>−n</sup>)</code>, dove C è il capitale, i il tasso mensile (TAN ÷ 12) e n il numero di rate.</p>
<div class="example">
  <p><strong>Esempio:</strong> ${euro(150000)} al 3% per 25 anni → rata di <strong>${euro(es.rata)}</strong> per ${es.rate} mesi. In totale restituisci ${euro(es.totalePagato)}, di cui <strong>${euro(es.totaleInteressi)}</strong> di interessi. Nel primo anno paghi ${euro(es.piano[0].interessi)} di interessi e solo ${euro(es.piano[0].capitale)} di capitale.</p>
</div>

<h2>Rata mensile ogni 100.000 € di mutuo</h2>
<p>Moltiplica per l'importo che ti serve: per 180.000 € moltiplica per 1,8.</p>
${tabella}

<h2>TAN, TAEG e costi che la rata non mostra</h2>
<ul>
  <li><strong>TAN</strong>: il tasso puro, usato per calcolare la rata.</li>
  <li><strong>TAEG</strong>: include istruttoria, perizia, assicurazioni obbligatorie e imposta sostitutiva. È il numero giusto per confrontare offerte diverse.</li>
  <li><strong>Imposta sostitutiva</strong>: ${perc(MUTUO.impostaSostitutiva)} dell'importo; ${perc(MUTUO.impostaSostitutivaNoPrimaCasa)} se il mutuo serve ad acquistare, costruire o ristrutturare un'abitazione senza i requisiti prima casa (art. 18 DPR 601/1973).</li>
  <li><strong>Assicurazione incendio e scoppio</strong>: obbligatoria; quelle sulla vita o sull'impiego sono facoltative anche se spesso proposte insieme.</li>
</ul>

<h2>Quanto mutuo posso permettermi</h2>
<p>La regola usata dalle banche è che la rata non superi il 30–35% del reddito netto mensile del nucleo. Con ${numero(redditoEs)} € netti al mese la rata non dovrebbe superare un terzo del reddito, cioè circa ${numero(Math.round(rataMaxEs))} €: a 25 anni e al 3% corrisponde a un mutuo di circa ${numero(mutuoMaxEs)} €. Per sapere il tuo netto parti dal <a href="/calcolo-stipendio-netto/">calcolo dello stipendio netto</a>.</p>
`,
  faq: [
    {
      q: 'Quanto è la rata di un mutuo di 100.000 € a 20 anni?',
      a: `<p>Al 3% di TAN circa ${euro(rataMensile(100000, 0.03, 20))} al mese; al 4% circa ${euro(rataMensile(100000, 0.04, 20))}. Con 30 anni la rata scende, ma gli interessi totali aumentano molto.</p>`,
    },
    {
      q: 'Conviene un mutuo più lungo o più corto?',
      a: `<p>Più è lungo, più la rata è bassa ma più interessi paghi. Su 150.000 € al 3%: a 20 anni paghi ${euro(calcolaMutuo({ capitale: 150000, tassoAnnuo: 0.03, anni: 20 }).totaleInteressi)} di interessi, a 30 anni ${euro(calcolaMutuo({ capitale: 150000, tassoAnnuo: 0.03, anni: 30 }).totaleInteressi)}.</p>`,
    },
    {
      q: 'Il calcolo vale per il mutuo a tasso variabile?',
      a: '<p>Vale per la rata iniziale. Con il tasso variabile la rata viene ricalcolata quando cambia l\'indice di riferimento (Euribor), quindi il totale degli interessi non è prevedibile.</p>',
    },
  ],
  related: ['calcolo-stipendio-netto', 'calcolo-tasse-forfettario', 'scorporo-iva'],
};
