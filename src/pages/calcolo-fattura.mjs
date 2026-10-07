import { ANNO, AGGIORNATO, BOLLO, FORFETTARIO, INPS, IVA, RITENUTA_ACCONTO } from '../lib/params.js';
import { calcolaFattura } from '../lib/fattura.js';
import { euro, numero, perc } from '../lib/format.js';

const rivalsaInps = perc(INPS.gestioneSeparata.rivalsa);
const ritenuta = perc(RITENUTA_ACCONTO);
const forf = calcolaFattura({ importo: 1000, regime: 'forfettario', rivalsa: 'inps' });
const ord = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'inps', aliquotaIva: IVA.aliquote[0] });
// Esempio: psicologo in attività clinica, contributo integrativo ENPAP 2% (aliquota 2026), prestazione esente.
const percEnpap = 0.02;
const esente = calcolaFattura({ importo: 1000, regime: 'ordinario', rivalsa: 'cassa', percCassa: percEnpap, aliquotaIva: 0 });

const opzioniIva = IVA.aliquote
  .map((a, i) => `<option value="${a}"${i === 0 ? ' selected' : ''}>${perc(a)}</option>`)
  .join('\n        ');

export default {
  order: 5,
  kind: 'tool',
  slug: 'calcolo-fattura',
  navLabel: 'Calcolo fattura',
  cardText: 'Totale fattura e netto a pagare: forfettario o ordinario, rivalsa, IVA e ritenuta.',
  title: 'Calcolo fattura: forfettario, ritenuta d\'acconto e IVA',
  description: `Calcola gli importi della fattura: rivalsa INPS ${rivalsaInps}, cassa, IVA, ritenuta d'acconto ${ritenuta} e bollo. Per forfettari, regime ordinario e prestazioni esenti IVA.`,
  h1: 'Calcolo fattura per professionisti e forfettari',
  year: ANNO,
  updated: AGGIORNATO,
  script: 'fattura.js',
  intro: '<p>Dal compenso al netto che ricevi, o al contrario.</p>',
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
    <label data-show-if="regime=ordinario">Aliquota IVA
      <select name="aliquotaIva">
        ${opzioniIva}
        <option value="0">Esente IVA (art. 10 DPR 633/72)</option>
      </select>
    </label>
    <details class="more"><summary>Altre opzioni</summary><div class="more-body">
    <label>Rivalsa o contributo previdenziale
      <select name="rivalsa">
        <option value="nessuna">Nessuno</option>
        <option value="inps">Rivalsa INPS ${rivalsaInps} (Gestione Separata)</option>
        <option value="cassa">Contributo integrativo cassa professionale</option>
      </select>
    </label>
    <label data-show-if="rivalsa=cassa">Percentuale contributo integrativo (%)
      <input name="percCassa" data-num="perc" inputmode="decimal" value="4">
      <span class="hint">4% per avvocati e ingegneri, 2% per psicologi: verifica con la tua cassa. Le prestazioni sanitarie, come quelle cliniche degli psicologi, sono esenti IVA: in regime ordinario scegli "Esente IVA".</span>
    </label>
    <label class="check" data-show-if="regime=ordinario"><input type="checkbox" name="ritenuta" checked> <span>Cliente sostituto d'imposta: applica ritenuta d'acconto ${ritenuta}</span></label>
    <label class="check" data-bollo><input type="checkbox" name="bolloCliente" checked> <span>Addebita la marca da bollo al cliente</span></label>
    </div></details>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto che ricevi</span><strong data-out="nettoAPagare">–</strong></div>
      <div class="kpi"><span>Totale fattura</span><strong data-out="totale">–</strong></div>
    </div>
    <details class="dettaglio"><summary>Dettaglio del calcolo</summary>
    <table class="breakdown">
      <tr><th>Compenso</th><td data-out="importo"></td></tr>
      <tr data-riv><th>Rivalsa / contributo integrativo</th><td data-out="rivalsa"></td></tr>
      <tr><th>Imponibile</th><td data-out="imponibile"></td></tr>
      <tr data-ord hidden><th>IVA (<span data-out="aliquotaIva"></span>)</th><td data-out="iva"></td></tr>
      <tr data-bollo><th>Marca da bollo</th><td data-out="bollo"></td></tr>
      <tr><th>Totale documento</th><td data-out="totale"></td></tr>
      <tr data-ord hidden><th>Ritenuta d'acconto</th><td data-out="ritenuta"></td></tr>
      <tr class="total"><th>Netto a pagare</th><td data-out="nettoAPagare"></td></tr>
    </table>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
    </details>
    <ul class="avvisi" data-list="avvisi" hidden></ul>
  </div>
</form>`,
  content: `
<h2>Fattura nel regime forfettario</h2>
<p>Il forfettario non applica IVA e non subisce ritenuta d'acconto. Il professionista iscritto alla Gestione Separata può addebitare al cliente la rivalsa INPS del ${rivalsaInps}, che fa parte del compenso. Sopra ${euro(BOLLO.soglia)} si applica la marca da bollo da ${euro(BOLLO.importo)}, che può essere riaddebitata al cliente.</p>
<div class="example">
  <p><strong>Esempio:</strong> compenso di ${euro(forf.importo)} + rivalsa INPS ${euro(forf.quotaRivalsa)} + bollo ${euro(forf.bollo)} = <strong>${euro(forf.totale)}</strong> da incassare.</p>
</div>
<p>Diciture da riportare in fattura:</p>
<ul>
  <li>"Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, della Legge n. 190/2014, regime forfettario: senza applicazione dell'IVA e non soggetta a ritenuta d'acconto ai sensi dell'art. 1, comma 67, L. 190/2014".</li>
  <li>Per la rivalsa: "Rivalsa contributo INPS ${rivalsaInps} ai sensi dell'art. 1, comma 212, L. 662/1996".</li>
  <li>Per il bollo (fattura elettronica): imposta a "SI" il campo "BolloVirtuale" del file XML (blocco DatiBollo, importo ${euro(BOLLO.importo)}). Puoi aggiungere anche la dicitura "Imposta di bollo assolta in modo virtuale ai sensi dell'art. 6 del DM 17 giugno 2014". Il bollo si versa per trimestre con F24 (codici tributo 2521-2524) o dal portale Fatture e Corrispettivi. Se l'imposta del primo trimestre è inferiore a 5.000 € si può versare entro il 30 settembre insieme al secondo; se primo e secondo trimestre insieme restano sotto 5.000 €, entro il 30 novembre insieme al terzo.</li>
</ul>
<p>Quello che incassi non è tutto tuo: una parte va accantonata per imposta e contributi. Calcola quanto con il <a href="/calcolo-tasse-forfettario/">calcolatore del forfettario</a>.</p>

<h2>Fattura con ritenuta d'acconto (regime ordinario)</h2>
<p>Nel regime ordinario si applica l'IVA (di solito al ${perc(IVA.aliquote[0])}), salvo le operazioni esenti come le prestazioni sanitarie. Se il cliente è un sostituto d'imposta si applica anche la ritenuta d'acconto del ${ritenuta}. Il cliente trattiene la ritenuta e la versa con F24 entro il 16 del mese successivo al pagamento.</p>
<ul>
  <li>L'IVA si calcola sull'imponibile comprensivo della rivalsa o del contributo integrativo.</li>
  <li>La ritenuta si calcola sul compenso. La rivalsa INPS ${rivalsaInps} della Gestione Separata è parte del compenso, quindi è soggetta a ritenuta; il contributo integrativo delle casse professionali no.</li>
</ul>
<div class="example">
  <p><strong>Esempio:</strong> compenso ${euro(ord.importo)} + rivalsa INPS ${euro(ord.quotaRivalsa)} = imponibile ${euro(ord.imponibile)}. IVA ${perc(ord.aliquotaIva)}: ${euro(ord.iva)}. Totale fattura ${euro(ord.totale)}. Ritenuta ${ritenuta} su ${euro(ord.imponibile)}: ${euro(ord.ritenuta)}. Netto a pagare: <strong>${euro(ord.nettoAPagare)}</strong>.</p>
</div>

<h2>Prestazioni sanitarie esenti IVA</h2>
<p>Le prestazioni sanitarie di diagnosi, cura e riabilitazione rese alla persona sono esenti IVA (art. 10, c. 1, n. 18, DPR 633/72). È il caso tipico di medici e psicologi in attività clinica. In regime ordinario scegli "Esente IVA" come aliquota.</p>
<ul>
  <li>In fattura va la dicitura "Operazione esente IVA ai sensi dell'art. 10, c. 1, n. 18, DPR 633/72".</li>
  <li>Senza IVA, sopra ${euro(BOLLO.soglia)} si applica la marca da bollo da ${euro(BOLLO.importo)}, che può essere riaddebitata al cliente.</li>
  <li>La ritenuta d'acconto resta dovuta se il cliente è un sostituto d'imposta e si calcola sul compenso, senza contributo integrativo e senza bollo. Se il paziente è un privato la ritenuta non si applica: togli la spunta "Cliente sostituto d'imposta".</li>
</ul>
<div class="example">
  <p><strong>Esempio:</strong> psicologo che fattura a un cliente sostituto d'imposta, compenso ${euro(esente.importo)} + contributo integrativo ENPAP ${perc(percEnpap)} (${euro(esente.quotaRivalsa)}) = imponibile ${euro(esente.imponibile)}. IVA esente, bollo ${euro(esente.bollo)} addebitato al cliente: totale fattura ${euro(esente.totale)}. Ritenuta ${ritenuta} su ${euro(esente.importo)}: ${euro(esente.ritenuta)}. Netto a pagare: <strong>${euro(esente.nettoAPagare)}</strong>.</p>
</div>

<h2>Partire dal netto che vuoi incassare</h2>
<p>Se hai concordato un importo netto, scegli "Netto da incassare": il calcolatore trova il compenso da indicare in fattura perché, dopo IVA, rivalse e ritenute, il bonifico sia quella cifra.</p>
<p>C'è un'eccezione. Se addebiti il bollo al cliente, quando l'imponibile supera ${euro(BOLLO.soglia)} il totale sale di colpo di ${euro(BOLLO.importo)}. Alcuni netti vicini alla soglia quindi non si possono ottenere. In quel caso il calcolatore lo segnala e usa il primo compenso con il bollo.</p>
`,
  faq: [
    {
      q: 'Il forfettario deve applicare la ritenuta d\'acconto?',
      a: '<p>No. I compensi dei forfettari non sono soggetti a ritenuta (art. 1, comma 67, L. 190/2014). In fattura va indicata la dicitura di esonero, così il cliente non trattiene nulla.</p>',
    },
    {
      q: `La rivalsa INPS ${rivalsaInps} è obbligatoria?`,
      a: `<p>No, è facoltativa: puoi addebitarla al cliente oppure no. Non è un contributo versato per tuo conto: i contributi restano a tuo carico, al ${perc(INPS.gestioneSeparata.aliquota)} del reddito (${perc(INPS.gestioneSeparata.aliquotaPensionati)} se sei pensionato o iscritto a un'altra previdenza obbligatoria). La rivalsa fa parte del compenso, quindi aumenta un po' il reddito su cui si calcolano imposte e contributi. Nel forfettario è un ricavo e conta anche per la soglia di ${numero(FORFETTARIO.sogliaRicavi)} €.</p>`,
    },
    {
      q: 'Quando si mette la marca da bollo in fattura?',
      a: `<p>Quando la fattura non ha IVA (forfettari, operazioni esenti o fuori campo) e l'importo supera ${euro(BOLLO.soglia)}. Costa ${euro(BOLLO.importo)}. Con la fattura elettronica si paga in modo virtuale, a trimestre.</p>`,
    },
    {
      q: 'Su cosa si calcola la ritenuta d\'acconto?',
      a: `<p>Sul compenso al netto dell'IVA. Comprende la rivalsa INPS ${rivalsaInps} della Gestione Separata ma non il contributo integrativo delle casse professionali, né le spese anticipate in nome e per conto del cliente. Dal 2025 sono esclusi dalla ritenuta anche i rimborsi delle spese sostenute per l'incarico e addebitati analiticamente al cliente (art. 54, c. 2, lett. b, TUIR, come modificato dal D.Lgs. 192/2024), che restano però soggetti a IVA. I rimborsi forfettari restano invece soggetti a ritenuta.</p>`,
    },
  ],
};
