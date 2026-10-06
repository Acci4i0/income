import { ANNO, AGGIORNATO, FORFETTARIO, INPS } from '../lib/params.js';
import { calcolaForfettario, GESTIONI } from '../lib/forfettario.js';
import { euro, perc, numero } from '../lib/format.js';

const coeff = (id) => FORFETTARIO.coefficienti.find((c) => c.id === id).coeff;
const coeffProf = coeff('professionisti');
const coeffAltre = coeff('altre');
const coeffComm = coeff('commercio');
const aliquota = perc(FORFETTARIO.impostaOrdinaria);
const aliquotaStartup = perc(FORFETTARIO.impostaStartup);
const riduzione = perc(INPS.riduzioneForfettari);

const es = calcolaForfettario({ ricavi: 40000, coefficiente: coeffProf, gestione: 'separata' });
const esComm = calcolaForfettario({ ricavi: 50000, coefficiente: coeffComm, gestione: 'commercianti' });
const es30 = calcolaForfettario({ ricavi: 30000, coefficiente: coeffProf, gestione: 'separata' });
// Primo anno in Gestione Separata: nessun contributo versato, quindi nessuna deduzione.
const impostaPrimoAnno = es.redditoLordo * es.aliquotaImposta;

const cella = (r) => `${euro(r.totaleTasse)} <span class="muted">(${perc(r.incidenza)})</span>`;
const righeAccantonamento = [15000, 25000, 35000, 50000, 70000, 85000].map((ricavi) => {
  const gs = calcolaForfettario({ ricavi, coefficiente: coeffProf, gestione: 'separata' });
  const gs5 = calcolaForfettario({ ricavi, coefficiente: coeffProf, gestione: 'separata', startup: true });
  const art = calcolaForfettario({ ricavi, coefficiente: coeffAltre, gestione: 'artigiani' });
  return `<tr><td class="num">${euro(ricavi)}</td><td class="num">${cella(gs)}</td><td class="num">${cella(gs5)}</td><td class="num">${cella(art)}</td></tr>`;
}).join('');

const opzioniAttivita = FORFETTARIO.coefficienti
  .map((c) => `<option value="${c.coeff}"${c.id === 'professionisti' ? ' selected' : ''}>${c.label} (${Math.round(c.coeff * 100)}%)</option>`)
  .join('');
const opzioniGestione = GESTIONI.map((g) => `<option value="${g.id}">${g.label}</option>`).join('');

export default {
  order: 1,
  kind: 'tool',
  slug: 'calcolo-tasse-forfettario',
  navLabel: 'Forfettario',
  cardText: 'Imposta sostitutiva, contributi INPS e netto reale per la partita IVA forfettaria.',
  title: `Calcolo tasse regime forfettario ${ANNO}: netto e INPS`,
  description: `Calcola gratis tasse e contributi INPS nel regime forfettario ${ANNO}: imposta al ${aliquota} o ${aliquotaStartup}, coefficienti aggiornati, netto annuo e mensile.`,
  h1: `Calcolo tasse regime forfettario ${ANNO}`,
  year: ANNO,
  updated: AGGIORNATO,
  script: 'forfettario.js',
  intro: `<p>Inserisci quanto incassi in un anno: il calcolatore stima imposta sostitutiva, contributi INPS e quanto ti resta in tasca. Usa i coefficienti di redditività in vigore e i valori INPS ${ANNO} (circolari n. 8/2026 e n. 14/2026).</p>`,
  tool: `
<form id="calc" class="calc" novalidate>
  <div class="fields">
    <label>Ricavi o compensi incassati nell'anno (€)
      <input name="ricavi" data-num inputmode="decimal" autocomplete="off" value="40.000">
    </label>
    <label>Attività (coefficiente di redditività)
      <select name="coeff">${opzioniAttivita}</select>
    </label>
    <label>Previdenza
      <select name="gestione">${opzioniGestione}</select>
    </label>
    <label data-show-if="gestione=cassa">Aliquota della tua cassa (%)
      <input name="aliquotaCassa" data-num="perc" inputmode="decimal" value="14,5">
      <span class="hint">Es. Cassa Forense, Inarcassa, ENPAP: controlla l'aliquota soggettiva della tua cassa.</span>
    </label>
    <label class="check"><input type="checkbox" name="startup"> <span>Aliquota agevolata ${aliquotaStartup} (primi 5 anni di una nuova attività)</span></label>
    <label class="check" data-show-if="gestione=artigiani|commercianti"><input type="checkbox" name="riduzione"> <span>Ho chiesto la riduzione contributiva del ${riduzione}<br><span class="hint">Spunta solo se la riduzione vale per il ${ANNO}. Chi era già in attività doveva fare domanda entro il 28 febbraio.</span></span></label>
    <label>Costi reali sostenuti nell'anno (€, facoltativo)
      <input name="costi" data-num inputmode="decimal" autocomplete="off" value="0">
      <span class="hint">Nel forfettario non si deducono, ma servono a capire quanto ti resta davvero.</span>
    </label>
  </div>
  <div class="results" aria-live="polite">
    <div class="kpis">
      <div class="kpi main"><span>Netto annuo</span><strong data-out="netto">–</strong></div>
      <div class="kpi"><span>Netto al mese (÷12)</span><strong data-out="nettoMensile">–</strong></div>
    </div>
    <div class="bar" data-bar></div>
    <ul class="legend" data-legend></ul>
    <table class="breakdown">
      <tr><th>Ricavi</th><td data-out="ricavi"></td></tr>
      <tr><th>Reddito imponibile lordo (<span data-out="coeffPerc"></span>)</th><td data-out="redditoLordo"></td></tr>
      <tr><th>Contributi previdenziali</th><td data-out="contributi"></td></tr>
      <tr><th>Base per l'imposta</th><td data-out="imponibile"></td></tr>
      <tr><th>Imposta sostitutiva (<span data-out="aliquota"></span>)</th><td data-out="imposta"></td></tr>
      <tr class="total"><th>Totale tasse e contributi</th><td data-out="totale"></td></tr>
      <tr><th>Da accantonare su ogni incasso</th><td data-out="incidenza"></td></tr>
    </table>
    <ul class="avvisi" data-list="avvisi" hidden></ul>
    <button type="button" class="btn-link" data-share>Copia link a questo calcolo</button>
  </div>
</form>`,
  content: `
<h2>Come si calcolano le tasse nel regime forfettario</h2>
<p>Nel forfettario non si sottraggono i costi reali: lo Stato presume che una parte fissa dei ricavi sia reddito, in base al tipo di attività. Il calcolo segue tre passaggi.</p>
<ol>
  <li><strong>Reddito imponibile lordo</strong> = ricavi incassati × coefficiente di redditività del tuo codice ATECO.</li>
  <li><strong>Contributi INPS</strong> calcolati su quel reddito, con le regole della tua gestione (Gestione Separata, Artigiani, Commercianti o cassa professionale).</li>
  <li><strong>Imposta sostitutiva</strong> del ${aliquota} (o del ${aliquotaStartup} per le nuove attività) sul reddito lordo meno i contributi versati.</li>
</ol>
<div class="example">
  <p><strong>Esempio: consulente con ${euro(es.ricavi)} di compensi, Gestione Separata.</strong></p>
  <p>Reddito lordo: ${euro(es.ricavi)} × ${perc(es.coefficiente)} = ${euro(es.redditoLordo)}. Contributi INPS: ${euro(es.redditoLordo)} × ${perc(INPS.gestioneSeparata.aliquota)} = ${euro(es.contributi.totale)}. Imposta: (${euro(es.redditoLordo)} − ${euro(es.contributi.totale)}) × ${perc(es.aliquotaImposta)} = ${euro(es.imposta)}.</p>
  <p>Totale da versare: <strong>${euro(es.totaleTasse)}</strong>, pari al ${perc(es.incidenza)} dei ricavi. Netto: <strong>${euro(es.netto)}</strong> all'anno, circa ${euro(es.nettoMensile)} al mese.</p>
</div>

<h2>Coefficienti di redditività ${ANNO}</h2>
<p>Il coefficiente dipende dal codice ATECO principale con cui hai aperto la partita IVA. I valori sono fissati dall'allegato 4 della L. 190/2014.</p>
<table>
  <thead><tr><th>Attività</th><th>Codici ATECO 2007</th><th class="num">Coefficiente</th></tr></thead>
  <tbody>
    ${FORFETTARIO.coefficienti.map((c) => `<tr><td>${c.label}</td><td>${c.ateco}</td><td class="num">${Math.round(c.coeff * 100)}%</td></tr>`).join('')}
  </tbody>
</table>
<p>Uno sviluppatore software (ATECO 2007 62) rientra nelle "altre attività" al ${perc(coeffAltre)}, non nelle attività professionali al ${perc(coeffProf)}: con ricavi uguali paga meno tasse.</p>
<p>Dal 2025 la visura riporta il codice ATECO 2025, ma per il coefficiente conta ancora il corrispondente codice ATECO 2007 (tabella di raccordo ISTAT). Ad esempio la riparazione di auto (ATECO 2025 95.31, ex 45.20) e la vendita di ricambi auto (ATECO 2025 47.82, ex 45.32) restano al ${perc(coeffComm)}. Prima di usare la tabella, quindi, risali dal codice della visura o del cassetto fiscale al codice ATECO 2007.</p>

<h2>Contributi INPS ${ANNO} per i forfettari</h2>
<h3>Gestione Separata (professionisti senza cassa)</h3>
<p>Si paga il ${perc(INPS.gestioneSeparata.aliquota)} sul reddito imponibile lordo, senza contributi minimi fissi: se un anno incassi poco, paghi poco. L'aliquota scende al ${perc(INPS.gestioneSeparata.aliquotaPensionati)} se sei già pensionato o iscritto a un'altra forma di previdenza obbligatoria (ad esempio perché sei anche dipendente). Massimale ${ANNO}: ${euro(INPS.gestioneSeparata.massimale)}.</p>
<h3>Artigiani e commercianti</h3>
<p>Qui esiste un minimale: anche con reddito basso si pagano contributi fissi calcolati su ${euro(INPS.artigiani.minimale)} di reddito.</p>
<table>
  <thead><tr><th></th><th class="num">Artigiani</th><th class="num">Commercianti</th></tr></thead>
  <tbody>
    <tr><td>Contributi fissi annui (sul minimale di ${euro(INPS.artigiani.minimale)})</td><td class="num">${euro(INPS.artigiani.contributoFisso)}</td><td class="num">${euro(INPS.commercianti.contributoFisso)}</td></tr>
    <tr><td>Aliquota sul reddito oltre il minimale, fino a ${euro(INPS.artigiani.sogliaAggiuntiva)}</td><td class="num">${perc(INPS.artigiani.aliquota)}</td><td class="num">${perc(INPS.commercianti.aliquota)}</td></tr>
    <tr><td>Aliquota oltre ${euro(INPS.artigiani.sogliaAggiuntiva)}</td><td class="num">${perc(INPS.artigiani.aliquotaOltre)}</td><td class="num">${perc(INPS.commercianti.aliquotaOltre)}</td></tr>
  </tbody>
</table>
<p>I forfettari iscritti ad Artigiani o Commercianti possono chiedere all'INPS una <strong>riduzione del ${riduzione}</strong> dei contributi. Si paga meno subito, ma si matura anche meno pensione. La domanda si presenta online nel Cassetto previdenziale.</p>
<p>La domanda va presentata entro il 28 febbraio (chi avvia l'attività in corso d'anno la invia subito dopo l'iscrizione all'INPS): se arriva dopo, la riduzione parte dal 1° gennaio dell'anno successivo. Una volta concessa vale anche per gli anni seguenti, finché restano i requisiti.</p>
<p>Chi si è iscritto per la prima volta ad Artigiani o Commercianti nel 2025 può invece avere, per 36 mesi dall'avvio dell'attività, la riduzione del 50% dei contributi IVS (L. 207/2024, art. 1 c. 186; circ. INPS 83/2025). È alternativa e non cumulabile con quella del ${riduzione}. Il calcolatore non la considera: in quel caso i contributi effettivi sono più bassi della stima.</p>
<div class="example">
  <p><strong>Esempio: negozio online con ${euro(esComm.ricavi)} di ricavi (commercio, ${perc(esComm.coefficiente)}).</strong></p>
  <p>Reddito lordo ${euro(esComm.redditoLordo)}. Contributi: ${euro(INPS.commercianti.contributoFisso)} fissi + ${perc(INPS.commercianti.aliquota)} sulla parte oltre il minimale = ${euro(esComm.contributi.totale)}. Imposta sostitutiva: ${euro(esComm.imposta)}. Netto: ${euro(esComm.netto)} prima dei costi della merce, che nel forfettario restano a tuo carico.</p>
</div>

<h2>Imposta sostitutiva: ${aliquota} o ${aliquotaStartup}</h2>
<p>L'aliquota ordinaria è il ${aliquota}. Per i primi cinque anni scende al ${aliquotaStartup} se:</p>
<ul>
  <li>non hai esercitato attività d'impresa, arte o professione nei tre anni precedenti;</li>
  <li>la nuova attività non è la semplice prosecuzione di un'attività svolta prima come lavoratore dipendente o autonomo, ad esempio con gli stessi clienti e gli stessi mezzi (fa eccezione il periodo di pratica obbligatoria);</li>
  <li>se rilevi un'attività altrui, i ricavi dell'anno precedente rientravano nella soglia del forfettario.</li>
</ul>

<h2>Quanto accantonare per le tasse</h2>
<p>Una regola pratica: metti da parte una percentuale fissa di ogni incasso. In Gestione Separata la percentuale è costante perché non ci sono minimi; da artigiano o commerciante pesa di più con ricavi bassi, per via dei contributi fissi.</p>
<table>
  <thead><tr><th class="num">Ricavi annui</th><th class="num">Professionista GS, ${aliquota}</th><th class="num">Professionista GS, ${aliquotaStartup}</th><th class="num">Artigiano (${perc(coeffAltre)}), ${aliquota}</th></tr></thead>
  <tbody>${righeAccantonamento}</tbody>
</table>
<p>Attenzione al secondo anno: oltre al saldo dell'anno prima paghi gli acconti per l'anno in corso. Chi non ha accantonato si trova a versare, tra giugno e novembre, quasi due anni di tasse: a giugno saldo più metà degli acconti, a novembre il resto.</p>

<h2>Limiti di questo calcolo</h2>
<ul>
  <li>È una stima "a regime": deduce i contributi dello stesso anno. In realtà si deducono i contributi effettivamente <em>versati</em> nell'anno. In Gestione Separata il primo anno non si versano contributi (saldo e acconti arrivano l'anno dopo), quindi l'imposta si calcola sull'intero reddito lordo: nell'esempio del consulente ${euro(impostaPrimoAnno)} invece di ${euro(es.imposta)}. Il secondo anno, invece, l'imposta risulta più bassa perché si deducono saldo e acconti.</li>
  <li>Oltre ${numero(FORFETTARIO.sogliaUscitaImmediata)} € di ricavi non stima imposte e contributi: il reddito di quell'anno si calcola con le regole ordinarie.</li>
  <li>Non considera la riduzione del 50% per chi si è iscritto per la prima volta ad Artigiani o Commercianti nel 2025.</li>
  <li>Le casse professionali hanno spesso contributi minimi e un contributo integrativo: inserisci l'aliquota soggettiva e verifica i minimi con la tua cassa.</li>
  <li>Non considera altri redditi, che nel forfettario non cambiano l'imposta ma possono contare per i requisiti di accesso.</li>
</ul>
`,
  faq: [
    {
      q: `Quanto si paga di tasse con ${numero(es30.ricavi)} € nel forfettario?`,
      a: `<p>Per un professionista in Gestione Separata (coefficiente ${perc(es30.coefficiente)}, imposta al ${perc(es30.aliquotaImposta)}) circa ${euro(es30.totaleTasse)} tra INPS e imposta sostitutiva, cioè il ${perc(es30.incidenza)} dei compensi. Il netto è di circa ${euro(es30.netto)} all'anno. Con l'aliquota startup al ${aliquotaStartup} il carico scende sensibilmente.</p>`,
    },
    {
      q: 'I contributi INPS si possono dedurre nel forfettario?',
      a: '<p>Sì. I contributi previdenziali obbligatori versati nell\'anno si sottraggono dal reddito su cui si calcola l\'imposta sostitutiva. È l\'unica deduzione rilevante: gli altri costi sono già "forfettizzati" dal coefficiente.</p>',
    },
    {
      q: `Cosa succede se supero ${numero(FORFETTARIO.sogliaRicavi)} € di ricavi?`,
      a: `<p>Se resti entro ${numero(FORFETTARIO.sogliaUscitaImmediata)} € applichi il forfettario fino a fine anno e passi al regime ordinario dall'anno successivo. Se superi ${numero(FORFETTARIO.sogliaUscitaImmediata)} € esci subito: dalla fattura che fa superare la soglia devi applicare l'IVA, e il reddito dell'intero anno si tassa con IRPEF ordinaria e costi reali.</p>`,
    },
    {
      q: 'Si possono scaricare le spese nel regime forfettario?',
      a: '<p>No. Telefono, auto, computer o affitto dello studio non riducono le tasse: il coefficiente di redditività presume già una quota di costi. Per questo il forfettario conviene a chi ha costi reali inferiori a quelli presunti.</p>',
    },
    {
      q: 'Posso aprire la partita IVA forfettaria se sono già dipendente?',
      a: `<p>Sì, se nell'anno precedente il reddito da lavoro dipendente o pensione non ha superato ${numero(FORFETTARIO.limiteRedditoDipendente)} € (il limite non conta se il rapporto di lavoro è cessato nell'anno precedente, purché in quell'anno tu non abbia percepito anche una pensione e non abbia iniziato un nuovo lavoro dipendente ancora in corso al 31 dicembre). Il limite di ${numero(FORFETTARIO.limiteRedditoDipendente)} € vale per il ${ANNO}; per il ${ANNO + 1}, salvo proroga, torna a ${numero(FORFETTARIO.limiteRedditoDipendenteOrdinario)} € (verificato sui redditi ${ANNO}). Non puoi però fatturare in prevalenza al datore di lavoro attuale o a quello degli ultimi due anni.</p>`,
    },
    {
      q: 'Come si pagano le tasse del forfettario?',
      a: '<p>Con il modello F24: saldo dell\'anno precedente e primo acconto entro il 30 giugno, secondo acconto entro il 30 novembre. I contributi fissi di artigiani e commercianti si pagano invece in quattro rate (maggio, agosto, novembre, febbraio).</p>',
    },
  ],
  related: ['calcolo-fattura', 'prestazione-occasionale', 'calcolo-stipendio-netto'],
};
