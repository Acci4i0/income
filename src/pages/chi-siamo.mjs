import { AGGIORNATO, ANNO } from '../lib/params.js';

// {{titolare}} e {{contatto}} vengono sostituiti in build con i dati di site.config.json.
export default {
  order: 90,
  kind: 'page',
  slug: 'chi-siamo',
  title: 'Chi siamo e metodo di calcolo',
  description: 'Come sono costruiti i calcolatori di NettoChiaro: fonti normative, aggiornamenti annuali, limiti delle stime e come segnalare un errore.',
  h1: 'Chi siamo e come calcoliamo',
  updated: AGGIORNATO,
  content: `
<p>NettoChiaro è un progetto indipendente che pubblica calcolatori fiscali gratuiti per lavoratori dipendenti, freelance e piccole partite IVA. L'obiettivo è uno solo: farti capire in pochi secondi quanto resta di un compenso dopo tasse e contributi, e perché.</p>

<h2>Metodo</h2>
<ul>
  <li><strong>Fonti primarie.</strong> Aliquote, soglie e coefficienti vengono da leggi e circolari ufficiali (TUIR, Legge di Bilancio, circolari INPS e Agenzia delle Entrate). Ogni parametro è indicato nella pagina del calcolatore.</li>
  <li><strong>Codice verificato.</strong> Le formule sono coperte da test automatici con esempi calcolati a mano. Gli esempi principali delle pagine sono generati dallo stesso codice che usa il calcolatore.</li>
  <li><strong>Aggiornamento annuale.</strong> All'inizio di ogni anno i parametri vengono aggiornati con la nuova Legge di Bilancio e le circolari INPS. I valori attuali si riferiscono al ${ANNO}.</li>
  <li><strong>Trasparenza sui limiti.</strong> Ogni pagina spiega le ipotesi semplificative del calcolo. Si tratta di stime: per decisioni importanti rivolgiti a un commercialista o a un CAF.</li>
</ul>

<h2>Come è realizzato il sito</h2>
<p>Il sito è sviluppato e mantenuto con l'aiuto di strumenti di intelligenza artificiale. Il codice è pubblico: chiunque può controllare come viene fatto ogni calcolo.</p>

<h2>Come si sostiene</h2>
<p>I calcolatori sono gratuiti. Il sito può mostrare pubblicità e link di affiliazione a servizi utili per chi lavora in proprio, sempre segnalati come tali. Le collaborazioni commerciali non influenzano mai i risultati dei calcoli.</p>

<h2>Chi gestisce il sito</h2>
<p>Gestore del sito e titolare del trattamento dei dati personali: {{titolare}}. Contatto: {{contatto}}. Come vengono trattati i dati è spiegato nella <a href="/privacy/">privacy e cookie policy</a>.</p>

<h2>Hai trovato un errore?</h2>
<p>Segnalalo usando questo contatto: {{contatto}}. Ogni correzione viene verificata e pubblicata con un test che impedisce all'errore di ripresentarsi.</p>
`,
};
