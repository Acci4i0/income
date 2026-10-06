import { AGGIORNATO, ANNO } from '../lib/params.js';
import { scorporaIva } from '../lib/iva.js';
import { euro } from '../lib/format.js';

const es = scorporaIva(1000, 0.22);
const righe = [0.22, 0.10, 0.05, 0.04].map((a) => {
  const r = scorporaIva(100, a);
  return `<tr><td class="num">${Math.round(a * 100)}%</td><td class="num">${(1 + a).toFixed(2).replace('.', ',')}</td><td class="num">${euro(r.imponibile)}</td><td class="num">${euro(r.iva)}</td></tr>`;
}).join('');

export default {
  order: 3,
  kind: 'tool',
  slug: 'scorporo-iva',
  navLabel: 'Scorporo IVA',
  cardText: 'Togli o aggiungi l\'IVA al 22%, 10%, 5% o 4% a qualsiasi importo.',
  title: 'Scorporo IVA online: calcolo IVA 22%, 10%, 5% e 4%',
  description: 'Scorpora l\'IVA da un prezzo ivato o aggiungila a un imponibile. Aliquote 22%, 10%, 5% e 4%, con formula ed esempi pratici.',
  h1: 'Scorporo IVA e calcolo IVA',
  year: ANNO,
  updated: AGGIORNATO,
  script: 'iva.js',
  intro: '<p>Hai un prezzo IVA inclusa e vuoi sapere l\'imponibile? Oppure devi aggiungere l\'IVA a un preventivo? Scegli l\'operazione, l\'aliquota e inserisci l\'importo.</p>',
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <fieldset class="segmented">
      <legend>Operazione</legend>
      <label><input type="radio" name="modo" value="scorpora" checked> Scorpora (ho il prezzo ivato)</label>
      <label><input type="radio" name="modo" value="aggiungi"> Aggiungi (ho l'imponibile)</label>
    </fieldset>
    <label>Importo (€)
      <input name="importo" data-num inputmode="decimal" autocomplete="off" value="1.000">
    </label>
    <fieldset class="segmented">
      <legend>Aliquota IVA</legend>
      <label><input type="radio" name="aliquota" value="0.22" checked> 22%</label>
      <label><input type="radio" name="aliquota" value="0.1"> 10%</label>
      <label><input type="radio" name="aliquota" value="0.05"> 5%</label>
      <label><input type="radio" name="aliquota" value="0.04"> 4%</label>
    </fieldset>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Imponibile</span><strong data-out="imponibile">–</strong></div>
      <div class="kpi"><span>IVA</span><strong data-out="iva">–</strong></div>
    </div>
    <table class="breakdown">
      <tr><th>Imponibile (senza IVA)</th><td data-out="imponibile"></td></tr>
      <tr><th>IVA</th><td data-out="iva"></td></tr>
      <tr class="total"><th>Totale IVA inclusa</th><td data-out="lordo"></td></tr>
    </table>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Formula dello scorporo IVA</h2>
<p>Per togliere l'IVA da un prezzo ivato si divide per 1 più l'aliquota: con l'IVA al 22% si divide per 1,22.</p>
<p><code>imponibile = prezzo ivato ÷ (1 + aliquota)</code> e <code>IVA = prezzo ivato − imponibile</code></p>
<div class="example">
  <p><strong>Esempio:</strong> ${euro(es.lordo)} IVA inclusa al 22% → ${euro(es.lordo)} ÷ 1,22 = <strong>${euro(es.imponibile)}</strong> di imponibile e <strong>${euro(es.iva)}</strong> di IVA.</p>
</div>
<p>Un errore frequente è calcolare il 22% del prezzo ivato e sottrarlo: su 1.000 € darebbe 780 €, cioè 39,67 € in meno del valore corretto.</p>

<h2>Tabella divisori per aliquota</h2>
<table>
  <thead><tr><th class="num">Aliquota</th><th class="num">Divisore</th><th class="num">Imponibile su 100 € ivati</th><th class="num">IVA su 100 € ivati</th></tr></thead>
  <tbody>${righe}</tbody>
</table>

<h2>Quale aliquota si applica</h2>
<ul>
  <li><strong>22%</strong>: aliquota ordinaria, si applica a tutto ciò che non ha un'aliquota ridotta (servizi professionali, elettronica, abbigliamento).</li>
  <li><strong>10%</strong>: tra gli altri, ristoranti e bar, alberghi, alcuni alimenti, ristrutturazioni edilizie, energia elettrica e gas per uso domestico (con limiti).</li>
  <li><strong>5%</strong>: alcune prestazioni sociosanitarie ed educative rese dalle cooperative sociali, alcune erbe aromatiche fresche come basilico, rosmarino e salvia.</li>
  <li><strong>4%</strong>: beni di prima necessità come pane, latte, frutta e verdura, libri e giornali, prima casa da costruttore.</li>
</ul>
<p>Le liste complete sono nelle tabelle allegate al DPR 633/1972. Nel regime forfettario l'IVA non si applica in fattura: vedi il <a href="/calcolo-fattura/">calcolo fattura</a>.</p>
`,
  faq: [
    {
      q: 'Come si scorpora l\'IVA al 22%?',
      a: '<p>Dividi il prezzo IVA inclusa per 1,22. Il risultato è l\'imponibile; la differenza tra prezzo e imponibile è l\'IVA. Esempio: 244 € ÷ 1,22 = 200 € di imponibile e 44 € di IVA.</p>',
    },
    {
      q: 'Come si aggiunge l\'IVA a un prezzo?',
      a: '<p>Moltiplica l\'imponibile per 1 più l\'aliquota: per il 22% moltiplica per 1,22. Per l\'IVA da sola moltiplica per 0,22.</p>',
    },
    {
      q: 'Perché non basta togliere il 22% dal prezzo ivato?',
      a: '<p>Perché il 22% si calcola sull\'imponibile, non sul totale. Togliere il 22% dal totale sottrae troppo: su 122 € toglieresti 26,84 € invece di 22 €.</p>',
    },
  ],
  related: ['calcolo-fattura', 'calcolo-tasse-forfettario', 'prestazione-occasionale'],
};
