import { AGGIORNATO, ANNO, IVA } from '../lib/params.js';
import { scorporaIva, aggiungiIva } from '../lib/iva.js';
import { euro, round2 } from '../lib/format.js';

// Formati delle aliquote: 0.22 -> "22%", divisore "1,22", moltiplicatore "0,22".
const pct = (a) => `${String(round2(a * 100)).replace('.', ',')}%`;
const virgola = (n) => n.toFixed(2).replace('.', ',');
const elenco = (xs, cong = 'e') => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${cong} ${xs.at(-1)}` : xs.join(''));

const aliquote = IVA.aliquote;
const ordinaria = Math.max(...aliquote);
const elencoAliquote = elenco(aliquote.map(pct));
const elencoAliquoteO = elenco(aliquote.map(pct), 'o');

// Esempio principale e confronto con l'errore di togliere la percentuale dal prezzo ivato.
const es = scorporaIva(1000, ordinaria);
const sbagliato = es.lordo - es.lordo * ordinaria;
// FAQ: prezzo ivato che corrisponde a 200 € di imponibile.
const faqScorporo = scorporaIva(round2(aggiungiIva(200, ordinaria).lordo), ordinaria);
// FAQ: 100 € di imponibile più IVA, poi la percentuale tolta dal totale per errore.
const faqErrore = scorporaIva(round2(aggiungiIva(100, ordinaria).lordo), ordinaria);

const righe = aliquote.map((a) => {
  const r = scorporaIva(100, a);
  return `<tr><td class="num">${pct(a)}</td><td class="num">${virgola(1 + a)}</td><td class="num">${euro(r.imponibile)}</td><td class="num">${euro(r.iva)}</td></tr>`;
}).join('');

const radio = aliquote.map((a) => `<label><input type="radio" name="aliquota" value="${a}"${a === ordinaria ? ' checked' : ''}> ${pct(a)}</label>`).join('\n      ');

// Ambiti di applicazione per aliquota (Tabella A allegata al DPR 633/1972).
const ambiti = {
  0.22: 'aliquota ordinaria, si applica a tutto ciò che non ha un\'aliquota ridotta (servizi professionali, elettronica, abbigliamento).',
  0.1: 'tra gli altri, ristoranti e bar, alberghi, alcuni alimenti, ristrutturazioni edilizie, energia elettrica e gas per uso domestico (con limiti).',
  0.05: 'alcune prestazioni sociosanitarie ed educative rese dalle cooperative sociali, alcune erbe aromatiche fresche come basilico, rosmarino e salvia.',
  0.04: 'beni di prima necessità come pane, latte, frutta e verdura, libri e giornali, prima casa da costruttore.',
};
const listaAmbiti = aliquote.map((a) => {
  if (!ambiti[a]) throw new Error(`scorporo-iva.mjs: manca la descrizione dell'aliquota ${pct(a)}`);
  return `  <li><strong>${pct(a)}</strong>: ${ambiti[a]}</li>`;
}).join('\n');

export default {
  order: 3,
  kind: 'tool',
  slug: 'scorporo-iva',
  navLabel: 'Scorporo IVA',
  cardText: `Togli o aggiungi l'IVA al ${elencoAliquoteO} a qualsiasi importo.`,
  title: `Scorporo IVA online: calcolo IVA ${elencoAliquote}`,
  description: `Scorpora l'IVA da un prezzo ivato o aggiungila a un imponibile. Aliquote ${elencoAliquote}, con formula ed esempi pratici.`,
  h1: 'Scorporo IVA e calcolo IVA',
  year: ANNO,
  updated: AGGIORNATO,
  script: 'iva.js',
  intro: '<p>Togli o aggiungi l\'IVA a qualsiasi importo.</p>',
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
      ${radio}
    </fieldset>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Imponibile</span><strong data-out="imponibile">–</strong></div>
      <div class="kpi"><span>IVA</span><strong data-out="iva">–</strong></div>
    </div>
    <details class="dettaglio"><summary>Dettaglio del calcolo</summary>
    <table class="breakdown">
      <tr><th>Imponibile (senza IVA)</th><td data-out="imponibile"></td></tr>
      <tr><th>IVA</th><td data-out="iva"></td></tr>
      <tr class="total"><th>Totale IVA inclusa</th><td data-out="lordo"></td></tr>
    </table>
    </details>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Formula dello scorporo IVA</h2>
<p>Per togliere l'IVA da un prezzo ivato si divide per 1 più l'aliquota: con l'IVA al ${pct(ordinaria)} si divide per ${virgola(1 + ordinaria)}.</p>
<p><code>imponibile = prezzo ivato ÷ (1 + aliquota)</code> e <code>IVA = prezzo ivato − imponibile</code></p>
<div class="example">
  <p><strong>Esempio:</strong> ${euro(es.lordo)} IVA inclusa al ${pct(ordinaria)} → ${euro(es.lordo)} ÷ ${virgola(1 + ordinaria)} = <strong>${euro(es.imponibile)}</strong> di imponibile e <strong>${euro(es.iva)}</strong> di IVA.</p>
</div>
<p>Un errore frequente è calcolare il ${pct(ordinaria)} del prezzo ivato e sottrarlo: su ${euro(es.lordo)} darebbe ${euro(sbagliato)}, cioè ${euro(es.imponibile - sbagliato)} in meno del valore corretto.</p>

<h2>Tabella divisori per aliquota</h2>
<table>
  <thead><tr><th class="num">Aliquota</th><th class="num">Divisore</th><th class="num">Imponibile su 100 € ivati</th><th class="num">IVA su 100 € ivati</th></tr></thead>
  <tbody>${righe}</tbody>
</table>

<h2>Quale aliquota si applica</h2>
<ul>
${listaAmbiti}
</ul>
<p>Le liste complete sono nelle tabelle allegate al DPR 633/1972. Nel regime forfettario l'IVA non si applica in fattura: vedi il <a href="/calcolo-fattura/">calcolo fattura</a>.</p>
`,
  faq: [
    {
      q: `Come si scorpora l'IVA al ${pct(ordinaria)}?`,
      a: `<p>Dividi il prezzo IVA inclusa per ${virgola(1 + ordinaria)}. Il risultato è l'imponibile; la differenza tra prezzo e imponibile è l'IVA. Esempio: ${euro(faqScorporo.lordo)} ÷ ${virgola(1 + ordinaria)} = ${euro(faqScorporo.imponibile)} di imponibile e ${euro(faqScorporo.iva)} di IVA.</p>`,
    },
    {
      q: 'Come si aggiunge l\'IVA a un prezzo?',
      a: `<p>Moltiplica l'imponibile per 1 più l'aliquota: per il ${pct(ordinaria)} moltiplica per ${virgola(1 + ordinaria)}. Per l'IVA da sola moltiplica per ${virgola(ordinaria)}.</p>`,
    },
    {
      q: `Perché non basta togliere il ${pct(ordinaria)} dal prezzo ivato?`,
      a: `<p>Perché il ${pct(ordinaria)} si calcola sull'imponibile, non sul totale. Togliere il ${pct(ordinaria)} dal totale sottrae troppo: su ${euro(faqErrore.lordo)} toglieresti ${euro(faqErrore.lordo * ordinaria)} invece di ${euro(faqErrore.iva)}.</p>`,
    },
  ],
  related: ['calcolo-fattura', 'calcolo-tasse-forfettario', 'prestazione-occasionale'],
};
