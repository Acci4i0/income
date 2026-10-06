import { AGGIORNATO } from '../lib/params.js';

// {{titolare}} e {{contatto}} vengono sostituiti in build con i dati di site.config.json.
export default {
  order: 91,
  kind: 'page',
  slug: 'privacy',
  title: 'Privacy e cookie policy',
  description: 'Informativa privacy e cookie di NettoChiaro: titolare, dati trattati, basi giuridiche, destinatari, conservazione, diritti e gestione del consenso.',
  h1: 'Privacy e cookie policy',
  updated: AGGIORNATO,
  content: `
<p>Questa informativa è resa ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) e del Codice privacy (D.Lgs. 196/2003). Spiega quali dati personali tratta il sito, perché e quali sono i tuoi diritti.</p>

<h2>Titolare del trattamento</h2>
<p>Il titolare del trattamento è {{titolare}}. Per qualsiasi richiesta sulla privacy, compreso l'esercizio dei tuoi diritti, usa questo contatto: {{contatto}}.</p>
<p>Non è nominato un responsabile della protezione dei dati (DPO): per questo sito non è obbligatorio.</p>

<h2>Dati inseriti nei calcolatori</h2>
<p>Tutti i calcoli avvengono nel tuo browser. Gli importi che inserisci non vengono inviati a server né salvati.</p>
<p>Se usi il pulsante "Copia link a questo calcolo", i valori vengono inseriti nell'indirizzo della pagina. Chi apre quel link li invia, come parte dell'indirizzo, al server che ospita il sito e, se gli annunci sono attivi, a Google con la richiesta dell'annuncio. Non inserire dati che non vuoi condividere.</p>

<h2>Dati di navigazione</h2>
<p>Il sito è ospitato da Cloudflare, Inc. con il servizio Cloudflare Pages. Come qualsiasi server web, registra dati tecnici delle richieste: indirizzo IP, data e ora, pagina richiesta, browser. Servono a far funzionare il sito e a proteggerlo da abusi, non a identificarti.</p>
<p>Base giuridica: legittimo interesse alla sicurezza e al funzionamento del sito (art. 6, par. 1, lett. f GDPR).</p>

<h2>Statistiche di visita</h2>
<p>Il sito può usare Cloudflare Web Analytics, che conta le visite in forma aggregata. Non usa cookie e non registra la parte dell'indirizzo che contiene i valori dei calcoli.</p>
<p>Base giuridica: legittimo interesse a capire quali pagine sono utili (art. 6, par. 1, lett. f GDPR).</p>

<h2>Pubblicità</h2>
<p>Il sito può mostrare annunci tramite Google AdSense, servizio di Google Ireland Ltd e Google LLC. Solo con il tuo consenso Google e i suoi partner usano cookie e identificatori simili per memorizzare informazioni sul dispositivo, misurare gli annunci e personalizzarli in base alle visite su questo e su altri siti. Se rifiuti, possono comparire solo annunci limitati e non personalizzati, senza cookie pubblicitari sul tuo dispositivo.</p>
<p>Base giuridica: consenso (art. 6, par. 1, lett. a GDPR e art. 122 del Codice privacy). Per questi trattamenti Google agisce come titolare autonomo.</p>
<p>Puoi approfondire come Google usa i dati su <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">policies.google.com/technologies/partner-sites</a> e disattivare la personalizzazione degli annunci da <a href="https://adssettings.google.com" rel="noopener">adssettings.google.com</a>.</p>

<h2>Cookie e gestione del consenso</h2>
<ul>
  <li><strong>Cookie tecnici</strong>: quelli necessari al funzionamento e alla sicurezza del sito e quello che memorizza le tue scelte sul consenso. Non richiedono il consenso (art. 122, comma 1, Codice privacy). Il sito non usa cookie propri di profilazione.</li>
  <li><strong>Cookie pubblicitari</strong>: quelli di Google e dei suoi partner descritti sopra. Vengono installati solo se acconsenti.</li>
</ul>
<p>Quando la pubblicità è attiva, alla prima visita compare il messaggio di consenso di Google, una piattaforma certificata e integrata con il Transparency and Consent Framework di IAB Europe. Puoi accettare, rifiutare o scegliere le singole finalità e i singoli fornitori. Nelle opzioni del messaggio trovi l'elenco dei fornitori, le finalità e la durata dei cookie.</p>
<p>Puoi cambiare le tue scelte in ogni momento dal link per le impostazioni privacy che il messaggio aggiunge alla pagina, oppure cancellando i cookie dal browser.</p>

<h2>Acquisti su Etsy</h2>
<p>I fogli di calcolo in vendita si acquistano su Etsy: il link del sito porta alla pagina del prodotto su Etsy e l'acquisto avviene lì. Il pagamento e la consegna dei file sono gestiti da Etsy, che tratta i dati come titolare autonomo secondo la propria informativa. Per evadere l'ordine e gestire eventuali richieste, {{titolare}} riceve da Etsy i dati dell'ordine (nome, indirizzo email e prodotto acquistato), li usa solo per questo scopo e li conserva per il tempo richiesto dagli obblighi fiscali. Questi dati non vengono pubblicati né usati per marketing.</p>

<h2>Link di affiliazione</h2>
<p>Alcuni link verso servizi esterni sono di affiliazione e sono contrassegnati come tali. Cliccandoli lasci questo sito: si applicano le informative privacy di quei servizi.</p>

<h2>Destinatari dei dati</h2>
<ul>
  <li><strong>Cloudflare, Inc.</strong>: hosting e, se attive, statistiche anonime. Tratta i dati per conto del titolare come responsabile del trattamento (art. 28 GDPR).</li>
  <li><strong>Google Ireland Ltd e Google LLC</strong>: pubblicità, solo se attiva. Google agisce come titolare autonomo, come i fornitori pubblicitari elencati nel messaggio di consenso.</li>
</ul>

<h2>Trasferimenti fuori dall'Unione europea</h2>
<p>Cloudflare, Inc. e Google LLC hanno sede negli Stati Uniti, quindi alcuni dati possono essere trasferiti lì. Entrambe le società aderiscono all'EU-US Data Privacy Framework. Il trasferimento si basa quindi sulla decisione di adeguatezza della Commissione europea del 10 luglio 2023 (art. 45 GDPR) e, in aggiunta, sulle clausole contrattuali tipo approvate dalla Commissione (art. 46 GDPR).</p>

<h2>Conservazione</h2>
<ul>
  <li>Importi inseriti nei calcolatori: non vengono conservati.</li>
  <li>Log tecnici del server: per il tempo necessario alla sicurezza del servizio, secondo le regole del fornitore di hosting.</li>
  <li>Scelte sul consenso: restano nel tuo browser finché non le modifichi, non cancelli i cookie o non scade il cookie che le registra.</li>
  <li>Dati trattati da Google per la pubblicità: per i tempi indicati nell'informativa di Google.</li>
</ul>

<h2>Conferimento dei dati e decisioni automatizzate</h2>
<p>Non devi fornire dati personali per usare i calcolatori. I dati di navigazione li trasmette il browser in automatico: senza di essi le pagine non possono arrivarti. Il sito non prende decisioni automatizzate che producono effetti giuridici su di te. Se acconsenti agli annunci personalizzati, Google ti associa a profili di interesse: è una forma di profilazione che puoi rifiutare o revocare.</p>

<h2>I tuoi diritti</h2>
<p>In base agli artt. 15-22 del GDPR hai diritto a:</p>
<ul>
  <li>accedere ai tuoi dati (art. 15);</li>
  <li>ottenerne la rettifica (art. 16) e la cancellazione (art. 17);</li>
  <li>ottenere la limitazione del trattamento (art. 18);</li>
  <li>ricevere i dati trattati in base al consenso in un formato di uso comune e trasmetterli a un altro titolare (portabilità, art. 20);</li>
  <li>opporti al trattamento basato sul legittimo interesse (art. 21);</li>
  <li>non essere sottoposto a decisioni basate solo su un trattamento automatizzato (art. 22).</li>
</ul>
<p>Puoi revocare il consenso in ogni momento, con la stessa facilità con cui l'hai dato (art. 7, par. 3 GDPR). La revoca non rende illecito il trattamento fatto prima.</p>
<p>Per esercitare i tuoi diritti usa il contatto del titolare: {{contatto}}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" rel="noopener">garanteprivacy.it</a>) o all'autorità di controllo del Paese UE in cui vivi o lavori (art. 77 GDPR).</p>

<h2>Modifiche</h2>
<p>Questa informativa viene aggiornata quando cambiano i servizi usati dal sito, per esempio quando si attiva la pubblicità. La data dell'ultimo aggiornamento è in fondo alla pagina.</p>
`,
};
