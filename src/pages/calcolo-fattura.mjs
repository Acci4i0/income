import { ANNO, AGGIORNATO, BOLLO, INPS, RITENUTA_ACCONTO } from '../lib/params.js';
import { calcolaFattura } from '../lib/fattura.js';
import { euro, perc } from '../lib/format.js';

const forf = calcolaFattura({ importo: 1000, regime: 'forfettario', rivalsa: 'inps' });
const ord = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'inps' });

export default {
  order: 5,
  kind: 'tool',
  slug: 'calcolo-fattura',
  navLabel: 'Calcolo fattura',
  cardText: 'Totale fattura e netto a pagare: forfettario o ordinario, rivalsa, IVA e ritenuta.',
  title: 'Calcolo fattura: forfettario, ritenuta d\'acconto e IVA',
  description: 'Calcola gli importi della fattura: rivalsa INPS 4%, cassa, IVA, ritenuta d\'acconto 20% e bollo. Per forfettari e regime ordinario.',
  h1: 'Calcolo fattura per professionisti e forfettari',
  year: ANNO,
  updated: AGGIORNATO,
  script: 'fattura.js',
  intro: '<p>Scegli il regime fiscale e inserisci il compenso: ottieni imponibile, IVA, ritenuta d\'acconto, bollo e il netto che il cliente ti bonifica. Funziona anche al contrario, partendo dalla cifra che vuoi incassare.</p>',
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <fieldset class="segmented">
      <legend>Regime</legend>
      <label><input type="radio" name="regime" value="forfettario" checked> Forfettario</label>
      <label><input type="radio" name="regime" value="ordinario"> Ordinario</label>
    </fieldset>
    <fieldset class="segmented">
      <legend>Parto da</legend>
      <label><input type="radio" name="modo" value="compenso" checked> Compenso</label>
      <label><input type="radio" name="modo" value="netto"> Netto da incassare</label>
    </fieldset>
    <label>Importo (€)
      <input name="importo" data-num inputmode="decimal" autocomplete="off" value="1.000">
    </label>
    <label>Rivalsa o contributo previdenziale
      <select name="rivalsa">
        <option value="nessuna">Nessuno</option>
        <option value="inps">Rivalsa INPS 4% (Gestione Separata)</option>
        <option value="cassa">Contributo integrativo cassa professionale</option>
      </select>
    </label>
    <label data-show-if="rivalsa=cassa">Percentuale contributo integrativo (%)
      <input name="percCassa" data-num="perc" inputmode="decimal" value="4">
      <span class="hint">4% per avvocati e ingegneri, 2% per psicologi: verifica con la tua cassa.</span>
    </label>
    <label data-show-if="regime=ordinario">Aliquota IVA
      <select name="aliquotaIva">
        <option value="0.22" selected>22%</option>
        <option value="0.1">10%</option>
        <option value="0.05">5%</option>
        <option value="0.04">4%</option>
      </select>
    </label>
    <label class="check" data-show-if="regime=ordinario"><input type="checkbox" name="ritenuta" checked> <span>Cliente sostituto d'imposta: applica ritenuta d'acconto 20%</span></label>
    <label class="check" data-show-if="regime=forfettario"><input type="checkbox" name="bolloCliente" checked> <span>Addebita la marca da bollo al cliente</span></label>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto che ricevi</span><strong data-out="nettoAPagare">–</strong></div>
      <div class="kpi"><span>Totale fattura</span><strong data-out="totale">–</strong></div>
    </div>
    <table class="breakdown">
      <tr><th>Compenso</th><td data-out="importo"></td></tr>
      <tr data-riv><th>Rivalsa / contributo integrativo</th><td data-out="rivalsa"></td></tr>
      <tr><th>Imponibile</th><td data-out="imponibile"></td></tr>
      <tr data-ord hidden><th>IVA (<span data-out="aliquotaIva"></span>)</th><td data-out="iva"></td></tr>
      <tr data-forf><th>Marca da bollo</th><td data-out="bollo"></td></tr>
      <tr><th>Totale documento</th><td data-out="totale"></td></tr>
      <tr data-ord hidden><th>Ritenuta d'acconto</th><td data-out="ritenuta"></td></tr>
      <tr class="total"><th>Netto a pagare</th><td data-out="nettoAPagare"></td></tr>
    </table>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Fattura nel regime forfettario</h2>
<p>Il forfettario non applica IVA e non subisce ritenuta d'acconto. Il professionista iscritto alla Gestione Separata può addebitare al cliente la rivalsa INPS del 4%, che fa parte del compenso. Sopra ${euro(BOLLO.soglia)} si applica la marca da bollo da ${euro(BOLLO.importo)}, che può essere riaddebitata al cliente.</p>
<div class="example">
  <p><strong>Esempio:</strong> compenso di ${euro(forf.importo)} + rivalsa INPS ${euro(forf.quotaRivalsa)} + bollo ${euro(forf.bollo)} = <strong>${euro(forf.totale)}</strong> da incassare.</p>
</div>
<p>Diciture da riportare in fattura:</p>
<ul>
  <li>"Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, della Legge n. 190/2014, regime forfettario: senza applicazione dell'IVA e non soggetta a ritenuta d'acconto ai sensi dell'art. 1, comma 67, L. 190/2014".</li>
  <li>Per la rivalsa: "Rivalsa contributo INPS 4% ai sensi dell'art. 1, comma 212, L. 662/1996".</li>
  <li>Per il bollo (fattura elettronica): "Imposta di bollo assolta in modo virtuale". Il bollo sulle fatture elettroniche si paga ogni trimestre con F24 o dal portale Fatture e Corrispettivi.</li>
</ul>
<p>Quello che incassi non è tutto tuo: una parte va accantonata per imposta e contributi. Calcola quanto con il <a href="/calcolo-tasse-forfettario/">calcolatore del forfettario</a>.</p>

<h2>Fattura con ritenuta d'acconto (regime ordinario)</h2>
<p>Nel regime ordinario si applica l'IVA (di solito al 22%) e, se il cliente è un sostituto d'imposta, la ritenuta d'acconto del ${perc(RITENUTA_ACCONTO)}. Il cliente trattiene la ritenuta e la versa con F24 entro il 16 del mese successivo al pagamento.</p>
<ul>
  <li>L'IVA si calcola sull'imponibile comprensivo della rivalsa o del contributo integrativo.</li>
  <li>La ritenuta si calcola sul compenso. La rivalsa INPS 4% della Gestione Separata è parte del compenso, quindi è soggetta a ritenuta; il contributo integrativo delle casse professionali no.</li>
</ul>
<div class="example">
  <p><strong>Esempio:</strong> compenso ${euro(ord.importo)} + rivalsa INPS ${euro(ord.quotaRivalsa)} = imponibile ${euro(ord.imponibile)}. IVA 22%: ${euro(ord.iva)}. Totale fattura ${euro(ord.totale)}. Ritenuta 20% su ${euro(ord.imponibile)}: ${euro(ord.ritenuta)}. Netto a pagare: <strong>${euro(ord.nettoAPagare)}</strong>.</p>
</div>

<h2>Partire dal netto che vuoi incassare</h2>
<p>Se hai concordato un importo netto, scegli "Netto da incassare": il calcolatore trova il compenso da indicare in fattura perché, dopo IVA, rivalse e ritenute, il bonifico sia esattamente quella cifra.</p>
`,
  faq: [
    {
      q: 'Il forfettario deve applicare la ritenuta d\'acconto?',
      a: '<p>No. I compensi dei forfettari non sono soggetti a ritenuta (art. 1, comma 67, L. 190/2014). In fattura va indicata la dicitura di esonero, così il cliente non trattiene nulla.</p>',
    },
    {
      q: 'La rivalsa INPS 4% è obbligatoria?',
      a: `<p>No, è facoltativa: puoi addebitarla al cliente oppure no. Non cambia i contributi che devi versare, che restano il ${perc(INPS.gestioneSeparata.aliquota)} del tuo reddito imponibile. Nel forfettario la rivalsa è un ricavo, quindi entra anche nel calcolo delle tasse.</p>`,
    },
    {
      q: 'Quando si mette la marca da bollo in fattura?',
      a: '<p>Quando la fattura non ha IVA (forfettari, operazioni esenti o fuori campo) e l\'importo supera 77,47 €. Costa 2 €. Con la fattura elettronica si paga in modo virtuale, a trimestre.</p>',
    },
    {
      q: 'Su cosa si calcola la ritenuta d\'acconto?',
      a: '<p>Sul compenso al netto dell\'IVA. Comprende la rivalsa INPS 4% della Gestione Separata ma non il contributo integrativo delle casse professionali, né le spese anticipate in nome e per conto del cliente.</p>',
    },
  ],
  related: ['calcolo-tasse-forfettario', 'scorporo-iva', 'prestazione-occasionale'],
};
