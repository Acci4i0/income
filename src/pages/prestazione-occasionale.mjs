import { ANNO, AGGIORNATO, OCCASIONALE, INPS, BOLLO } from '../lib/params.js';
import { calcolaOccasionale } from '../lib/occasionale.js';
import { euro, perc, numero } from '../lib/format.js';

const es = calcolaOccasionale({ lordo: 1000 });
const esGia = 4000;
const esInps = calcolaOccasionale({ lordo: 2000, giaPercepito: esGia });
const ritenuta = perc(OCCASIONALE.ritenuta);
const soglia = `${numero(OCCASIONALE.franchigiaInps)} €`;
const aliquotaGs = perc(INPS.gestioneSeparata.aliquotaCollaboratori);
const aliquotaGsPensionati = perc(INPS.gestioneSeparata.aliquotaPensionati);

// Quote del contributo come frazione semplice (1/3, 2/3), ricavate dal parametro.
function frazione(x) {
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return `${n}/${d}`;
  }
  return perc(x);
}
const quotaTua = frazione(OCCASIONALE.quotaLavoratore);
const quotaCommittente = frazione(1 - OCCASIONALE.quotaLavoratore);

export default {
  order: 4,
  kind: 'tool',
  slug: 'prestazione-occasionale',
  navLabel: 'Prestazione occasionale',
  cardText: `Netto e lordo della ricevuta, ritenuta del ${ritenuta} e INPS oltre ${soglia}.`,
  title: `Prestazione occasionale ${ANNO}: calcolo netto e ritenuta`,
  description: `Calcola netto e lordo di una prestazione occasionale ${ANNO}: ritenuta d'acconto ${ritenuta}, contributi INPS oltre ${soglia}, marca da bollo. Gratis.`,
  h1: `Calcolo prestazione occasionale ${ANNO}`,
  year: ANNO,
  updated: AGGIORNATO,
  script: 'occasionale.js',
  intro: '<p>Dal compenso lordo al netto della ricevuta, o al contrario.</p>',
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <fieldset class="segmented">
      <legend>Parto da</legend>
      <label><input type="radio" name="modo" value="lordo" checked> Compenso lordo</label>
      <label><input type="radio" name="modo" value="netto"> Netto che voglio ricevere</label>
    </fieldset>
    <label>Importo (€)
      <input name="importo" data-num inputmode="decimal" autocomplete="off" value="1.000">
    </label>
    <label>Committente
      <select name="committente">
        <option value="sostituto">Società, ente, condominio, impresa o professionista non forfettario (trattiene la ritenuta)</option>
        <option value="privato">Privato cittadino o committente forfettario/minimi (nessuna ritenuta)</option>
      </select>
      <span class="hint">I committenti forfettari o minimi non applicano la ritenuta sui compensi di lavoro autonomo.</span>
    </label>
    <details class="more"><summary>Altre opzioni</summary><div class="more-body">
    <label>Compensi occasionali già incassati nell'anno (€)
      <input name="gia" data-num inputmode="decimal" autocomplete="off" value="0">
      <span class="hint">Serve per capire se superi la franchigia INPS di ${soglia}.</span>
    </label>
    <label class="check"><input type="checkbox" name="altraForma"> <span>Sono pensionato o già iscritto a un'altra forma di previdenza obbligatoria</span></label>
    </div></details>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto che ricevi</span><strong data-out="netto">–</strong></div>
      <div class="kpi"><span>Compenso lordo</span><strong data-out="lordo">–</strong></div>
    </div>
    <div class="bar" data-bar></div>
    <ul class="legend" data-legend></ul>
    <details class="dettaglio"><summary>Dettaglio del calcolo</summary>
    <table class="breakdown">
      <tr><th>Compenso lordo</th><td data-out="lordo"></td></tr>
      <tr><th>Ritenuta d'acconto ${ritenuta}</th><td data-out="ritenuta"></td></tr>
      <tr data-inps hidden><th>INPS a tuo carico (${quotaTua} del <span data-out="aliquota"></span>)</th><td data-out="inpsLavoratore"></td></tr>
      <tr class="total"><th>Netto</th><td data-out="netto"></td></tr>
      <tr data-inps hidden><th>INPS a carico del committente (${quotaCommittente})</th><td data-out="inpsCommittente"></td></tr>
      <tr><th>Costo totale per il committente</th><td data-out="costoCommittente"></td></tr>
      <tr><th>Marca da bollo</th><td data-out="bollo"></td></tr>
    </table>
    </details>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Come funziona la ritenuta sulla prestazione occasionale</h2>
<p>Se il committente è un sostituto d'imposta (società, ente, condominio, impresa o professionista in regime ordinario o semplificato) trattiene il ${ritenuta} del compenso lordo e lo versa allo Stato a tuo nome. È un <strong>acconto</strong>: nella dichiarazione dei redditi il compenso si somma agli altri redditi e la ritenuta si scala dall'IRPEF dovuta. Se il tuo reddito totale è basso puoi avere un rimborso; se è alto paghi la differenza. I committenti in regime forfettario non applicano la ritenuta sui compensi di lavoro autonomo (art. 1 c. 69 L. 190/2014) e ti pagano il lordo. Lo stesso vale per chi è ancora nel vecchio regime dei minimi.</p>
<div class="example">
  <p><strong>Esempio:</strong> ricevuta da ${euro(es.lordo)} lordi a una società. Ritenuta ${euro(es.ritenuta)}, netto <strong>${euro(es.netto)}</strong>. Marca da bollo da ${euro(BOLLO.importo)} sull'originale perché l'importo supera ${euro(BOLLO.soglia)}.</p>
</div>
<p>Se il committente è un privato cittadino o un forfettario non c'è ritenuta: incassi il lordo e dichiari tu il compenso nel 730 o nel modello Redditi.</p>

<h2>Il limite dei ${soglia} e i contributi INPS</h2>
<p>I ${soglia} non sono un tetto alla prestazione occasionale ma una <strong>franchigia contributiva</strong>: finché i compensi occasionali dell'anno, da tutti i committenti, non superano questa cifra non si pagano contributi. Sulla parte che supera i ${soglia} si pagano contributi alla Gestione Separata INPS, con aliquota del ${aliquotaGs} (${aliquotaGsPensionati} se pensionato o già iscritto ad altra previdenza). Il contributo è a carico tuo per ${quotaTua} e del committente per ${quotaCommittente}. Il committente trattiene la tua quota dal compenso e versa tutto.</p>
<div class="example">
  <p><strong>Esempio:</strong> hai già incassato ${numero(esGia)} € e fai una ricevuta da ${euro(esInps.lordo)}. L'eccedenza è ${euro(esInps.eccedenza)}: contributi totali ${euro(esInps.inpsTotale)}, di cui ${euro(esInps.inpsLavoratore)} a tuo carico. Netto: ${euro(esInps.netto)}.</p>
</div>
<p>Quando superi la soglia hai due obblighi. Devi comunicarlo tempestivamente ai committenti, così possono trattenere e versare i contributi. Devi anche iscriverti alla Gestione Separata con domanda online all'INPS: basta farlo una volta, la prima volta che superi la soglia, se non sei già iscritto.</p>

<h2>Cosa scrivere nella ricevuta</h2>
<ul>
  <li>Dati tuoi (nome, indirizzo, codice fiscale) e del committente.</li>
  <li>Numero e data della ricevuta, descrizione della prestazione.</li>
  <li>Compenso lordo. Se il committente è sostituto d'imposta, la ritenuta d'acconto del ${ritenuta} (art. 25 DPR 600/1973). Se superi i ${soglia} nell'anno, la trattenuta INPS Gestione Separata a tuo carico: ${quotaTua} del contributo calcolato con l'aliquota del ${aliquotaGs} (${aliquotaGsPensionati} se pensionato o iscritto ad altra previdenza) sulla sola parte eccedente. Infine il netto a pagare.</li>
  <li>Una dichiarazione sui compensi occasionali già incassati nell'anno, che dica se hai superato la soglia di ${soglia}. Non è obbligatoria ma è consigliata: dà al committente l'informazione richiesta dalla circ. INPS 103/2004.</li>
  <li>La dicitura "Prestazione occasionale ai sensi dell'art. 2222 c.c., esclusa dal campo IVA ai sensi dell'art. 5 DPR 633/1972".</li>
  <li>Marca da bollo da ${euro(BOLLO.importo)} se l'importo supera ${euro(BOLLO.soglia)}, con la dicitura "Imposta di bollo assolta sull'originale".</li>
</ul>

<h2>Quando non è più occasionale</h2>
<p>La prestazione occasionale è per lavori saltuari, senza coordinamento con il committente e senza continuità. Non conta solo l'importo: se lavori in modo abituale, anche con compensi bassi, serve la partita IVA. In quel caso valuta il <a href="/calcolo-tasse-forfettario/">regime forfettario</a>.</p>
`,
  faq: [
    {
      q: `Quanto si prende netto con una prestazione occasionale da ${numero(es.lordo)} €?`,
      a: `<p>Se il committente è un sostituto d'imposta e sei sotto i ${soglia} annui, ${euro(es.netto)}: il ${ritenuta} (${euro(es.ritenuta)}) è trattenuto come ritenuta d'acconto. Se il committente è un privato o un forfettario incassi i ${numero(es.lordo)} € interi e paghi l'IRPEF in dichiarazione.</p>`,
    },
    {
      q: 'Come si calcola il lordo partendo dal netto?',
      a: `<p>Sotto la franchigia INPS e con ritenuta al ${ritenuta} si divide il netto per ${numero(1 - OCCASIONALE.ritenuta)}: per ricevere ${numero(es.netto)} € netti la ricevuta deve essere di ${numero(es.lordo)} € lordi. Oltre i ${soglia} il calcolatore tiene conto anche dei contributi.</p>`,
    },
    {
      q: 'Chi paga la marca da bollo?',
      a: '<p>Per legge la marca da bollo va applicata da chi emette la ricevuta, ma le parti possono accordarsi perché il costo sia addebitato al committente. In quel caso va indicata nella ricevuta.</p>',
    },
    {
      q: `Si possono superare i ${soglia} con la prestazione occasionale?`,
      a: `<p>Sì. La soglia riguarda solo i contributi INPS: oltre i ${soglia} annui si pagano contributi in Gestione Separata sull'eccedenza. Resta il requisito che il lavoro sia davvero saltuario.</p>`,
    },
  ],
  related: ['calcolo-tasse-forfettario', 'calcolo-fattura', 'calcolo-stipendio-netto'],
};
