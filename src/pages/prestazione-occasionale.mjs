import { ANNO, AGGIORNATO, OCCASIONALE, INPS, BOLLO } from '../lib/params.js';
import { calcolaOccasionale } from '../lib/occasionale.js';
import { euro, perc, numero } from '../lib/format.js';

const es = calcolaOccasionale({ lordo: 1000 });
const esInps = calcolaOccasionale({ lordo: 2000, giaPercepito: 4000 });

export default {
  order: 4,
  kind: 'tool',
  slug: 'prestazione-occasionale',
  navLabel: 'Prestazione occasionale',
  cardText: 'Netto e lordo della ricevuta, ritenuta del 20% e INPS oltre 5.000 €.',
  title: `Prestazione occasionale ${ANNO}: calcolo netto e ritenuta`,
  description: `Calcola netto e lordo di una prestazione occasionale ${ANNO}: ritenuta d'acconto 20%, contributi INPS oltre 5.000 €, marca da bollo. Gratis.`,
  h1: `Calcolo prestazione occasionale ${ANNO}`,
  year: ANNO,
  updated: AGGIORNATO,
  script: 'occasionale.js',
  intro: '<p>Lavori senza partita IVA e devi fare una ricevuta? Inserisci il compenso lordo, o il netto che vuoi incassare, e il calcolatore ricava ritenuta d\'acconto, eventuali contributi INPS e marca da bollo.</p>',
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
        <option value="sostituto">Azienda, professionista o ente (trattiene la ritenuta)</option>
        <option value="privato">Privato cittadino (nessuna ritenuta)</option>
      </select>
    </label>
    <label>Compensi occasionali già incassati nell'anno (€)
      <input name="gia" data-num inputmode="decimal" autocomplete="off" value="0">
      <span class="hint">Serve per capire se superi la franchigia INPS di ${numero(OCCASIONALE.franchigiaInps)} €.</span>
    </label>
    <label class="check"><input type="checkbox" name="altraForma"> <span>Sono pensionato o già iscritto a un'altra forma di previdenza obbligatoria</span></label>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto che ricevi</span><strong data-out="netto">–</strong></div>
      <div class="kpi"><span>Compenso lordo</span><strong data-out="lordo">–</strong></div>
    </div>
    <div class="bar" data-bar></div>
    <ul class="legend" data-legend></ul>
    <table class="breakdown">
      <tr><th>Compenso lordo</th><td data-out="lordo"></td></tr>
      <tr><th>Ritenuta d'acconto 20%</th><td data-out="ritenuta"></td></tr>
      <tr data-inps hidden><th>INPS a tuo carico (1/3 del <span data-out="aliquota"></span>)</th><td data-out="inpsLavoratore"></td></tr>
      <tr class="total"><th>Netto</th><td data-out="netto"></td></tr>
      <tr data-inps hidden><th>INPS a carico del committente (2/3)</th><td data-out="inpsCommittente"></td></tr>
      <tr><th>Costo totale per il committente</th><td data-out="costoCommittente"></td></tr>
      <tr><th>Marca da bollo</th><td data-out="bollo"></td></tr>
    </table>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Come funziona la ritenuta sulla prestazione occasionale</h2>
<p>Se il committente è un'azienda, un professionista o un ente (sostituto d'imposta), trattiene il ${perc(OCCASIONALE.ritenuta)} del compenso lordo e lo versa allo Stato a tuo nome. È un <strong>acconto</strong>: nella dichiarazione dei redditi il compenso si somma agli altri redditi e la ritenuta si scala dall'IRPEF dovuta. Se il tuo reddito totale è basso puoi avere un rimborso; se è alto paghi la differenza.</p>
<div class="example">
  <p><strong>Esempio:</strong> ricevuta da ${euro(es.lordo)} lordi a un'azienda. Ritenuta ${euro(es.ritenuta)}, netto <strong>${euro(es.netto)}</strong>. Marca da bollo da ${euro(BOLLO.importo)} sull'originale perché l'importo supera ${euro(BOLLO.soglia)}.</p>
</div>
<p>Se il committente è un privato cittadino non c'è ritenuta: incassi il lordo e dichiari tu il compenso nel 730 o nel modello Redditi.</p>

<h2>Il limite dei 5.000 € e i contributi INPS</h2>
<p>I 5.000 € non sono un tetto alla prestazione occasionale ma una <strong>franchigia contributiva</strong>: finché i compensi occasionali dell'anno, da tutti i committenti, restano sotto questa cifra non si pagano contributi. Sulla parte che supera i 5.000 € scatta l'iscrizione alla Gestione Separata INPS, con aliquota del ${perc(INPS.gestioneSeparata.aliquotaCollaboratori)} (${perc(INPS.gestioneSeparata.aliquotaPensionati)} se pensionato o già iscritto ad altra previdenza). Un terzo è a tuo carico, due terzi a carico del committente.</p>
<div class="example">
  <p><strong>Esempio:</strong> hai già incassato 4.000 € e fai una ricevuta da ${euro(esInps.lordo)}. L'eccedenza è ${euro(esInps.eccedenza)}: contributi totali ${euro(esInps.inpsTotale)}, di cui ${euro(esInps.inpsLavoratore)} a tuo carico. Netto: ${euro(esInps.netto)}.</p>
</div>
<p>Devi comunicare ai committenti quando superi la soglia, così possono calcolare e versare i contributi.</p>

<h2>Cosa scrivere nella ricevuta</h2>
<ul>
  <li>Dati tuoi (nome, indirizzo, codice fiscale) e del committente.</li>
  <li>Numero e data della ricevuta, descrizione della prestazione.</li>
  <li>Compenso lordo, ritenuta d'acconto del 20% e netto a pagare.</li>
  <li>La dicitura "Prestazione occasionale ai sensi dell'art. 2222 c.c., esclusa dal campo IVA ai sensi dell'art. 5 DPR 633/1972".</li>
  <li>Marca da bollo da ${euro(BOLLO.importo)} se l'importo supera ${euro(BOLLO.soglia)}, con la dicitura "Imposta di bollo assolta sull'originale".</li>
</ul>

<h2>Quando non è più occasionale</h2>
<p>La prestazione occasionale è per lavori saltuari, senza coordinamento con il committente e senza continuità. Non conta solo l'importo: se lavori in modo abituale, anche con compensi bassi, serve la partita IVA. In quel caso valuta il <a href="/calcolo-tasse-forfettario/">regime forfettario</a>.</p>
`,
  faq: [
    {
      q: 'Quanto si prende netto con una prestazione occasionale da 1.000 €?',
      a: `<p>Se il committente è un sostituto d'imposta e sei sotto i 5.000 € annui, ${euro(es.netto)}: il 20% (${euro(es.ritenuta)}) è trattenuto come ritenuta d'acconto. Se il committente è un privato incassi i 1.000 € interi e paghi l'IRPEF in dichiarazione.</p>`,
    },
    {
      q: 'Come si calcola il lordo partendo dal netto?',
      a: '<p>Sotto la franchigia INPS e con ritenuta al 20% si divide il netto per 0,8: per ricevere 800 € netti la ricevuta deve essere di 1.000 € lordi. Oltre i 5.000 € il calcolatore tiene conto anche dei contributi.</p>',
    },
    {
      q: 'Chi paga la marca da bollo?',
      a: '<p>Per legge la marca da bollo va applicata da chi emette la ricevuta, ma le parti possono accordarsi perché il costo sia addebitato al committente. In quel caso va indicata nella ricevuta.</p>',
    },
    {
      q: 'Si possono superare i 5.000 € con la prestazione occasionale?',
      a: '<p>Sì. La soglia riguarda solo i contributi INPS: oltre i 5.000 € annui si pagano contributi in Gestione Separata sull\'eccedenza. Resta il requisito che il lavoro sia davvero saltuario.</p>',
    },
  ],
  related: ['calcolo-tasse-forfettario', 'calcolo-fattura', 'calcolo-stipendio-netto'],
};
