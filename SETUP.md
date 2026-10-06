# SETUP — le azioni che solo il proprietario può fare

Tutto il resto (codice, contenuti, aggiornamenti, SEO tecnico) lo fa l'operatore automatico.
Queste azioni richiedono la tua identità, un pagamento o un account a tuo nome. In ordine:

## 1. Dominio e hosting definitivo (15 minuti, ~11 €/anno) — BLOCCANTE

Finché non fai questo passo il sito non è online. Due strade:

- **Vercel (meno lavoro per te)**: riconnetti il connettore Vercel su <https://claude.ai/customize/connectors>
  con i permessi di scrittura e apri una nuova sessione: Claude compra il dominio (con la tua conferma sul
  prezzo), crea il progetto e collega il dominio. Limite: il piano gratuito Vercel vieta l'uso commerciale,
  quindi prima di attivare pubblicità o affiliazioni bisogna passare a Cloudflare Pages (gratuito, basta
  cambiare il DNS) o a Vercel Pro (20 $/mese).
- **Cloudflare Pages (subito definitivo)**: i passi sotto. Gratuito, uso commerciale consentito.

In entrambi i casi, se una build fallisce non viene pubblicata e resta online la versione precedente.

1. Compra il dominio. Disponibile al 6/10/2026: `nettochiaro.com` (11,25 $/anno su Vercel; su Cloudflare
   Registrar costa circa uguale). Per un `.it` usa un registrar italiano: Vercel e Cloudflare non lo vendono.
2. Crea un account su <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → scheda **Pages** →
   **Connect to Git** → autorizza GitHub → scegli `Acci4i0/income`.
3. Impostazioni build: Framework preset **None**, Build command `node build.mjs`, Build output `dist`.
   Production branch: il branch di default del repo. Salva e fai il deploy.
4. Nel progetto Pages → **Custom domains** → aggiungi il dominio e segui le istruzioni DNS.
5. Apri una issue nel repo con titolo `dominio: nettochiaro.com` (o il tuo dominio) e label `owner`.
   Nella stessa issue indica il titolare del sito (nome e cognome o ragione sociale, con indirizzo di
   domicilio o sede) e un'email di contatto. Questi dati compaiono in pubblico nell'informativa privacy e in
   Chi siamo: li chiedono l'art. 13 GDPR e, con la pubblicità, l'art. 7 del D.Lgs. 70/2003.
   L'operatore li inserisce in `site.config.json` (`titolare`, `contactEmail`), aggiorna `baseUrl`, attiva
   l'indicizzazione e pubblica.

## 2. Google Search Console (5 minuti, subito dopo il punto 1)

1. <https://search.google.com/search-console> → **Aggiungi proprietà** → **Dominio** → verifica via DNS
   (con Cloudflare è quasi automatico).
2. **Sitemap** → invia `https://<dominio>/sitemap.xml`.

Senza questo passo Google ci mette molto di più a trovare il sito.

## 3. Google AdSense (20 minuti, dopo 4-8 settimane di contenuti indicizzati)

Prima di attivare AdSense controlla che titolare ed email (sezione 1, punto 5) siano in `site.config.json`
(`titolare`, `contactEmail`): con il publisher ID impostato e senza questi dati la build si ferma con un
errore.

1. <https://adsense.google.com> → registrati con il dominio.
2. Copia il publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`) e mettilo in una issue `owner`: l'operatore lo inserisce
   in `site.config.json` → `monetization.adsenseClient`, così vengono generati lo script e `ads.txt`.
3. In AdSense → **Privacy e messaggi**: aggiungi l'URL della privacy policy del sito
   (`https://<dominio>/privacy/`). Nel messaggio **Normative europee** del sito (crealo, oppure controlla
   quello che AdSense crea in automatico con **Massimizza la copertura dei messaggi**), in **Scelte
   dell'utente** imposta **Non acconsentire** su ON per tutti i paesi (almeno per l'Italia) e attiva
   **Chiudi (non acconsentire)**. Disattiva **Ottimizza il messaggio di consenso** (attivo per impostazione
   predefinita dal 7/5/2026), che ad alcuni utenti può mostrare un messaggio non bloccante al posto di quello
   con Accetta/Rifiuta, oppure verifica che ogni variante offra il rifiuto. Lascia attivo il link per
   rivedere le scelte e pubblica il messaggio prima di attivare gli annunci.
4. Attiva gli **Annunci automatici**.

AdSense può rifiutare siti giovani o con poco traffico: in quel caso si riprova dopo qualche settimana.

## 4. Affiliazioni (facoltativo, 10 minuti per programma)

Il sito ha già tre spazi pronti in `site.config.json` → `monetization.offers` (conto business per partita
IVA, commercialista online, prodotto digitale). Compaiono solo quando hanno un URL.

1. Iscriviti al programma di affiliazione di un servizio che useresti davvero (molti conti business e
   servizi per partite IVA ne hanno uno, diretto o tramite reti come Awin).
2. Mettilo in una issue `owner` con il link di affiliazione e a quale spazio associarlo.

## 5. Statistiche (facoltativo, 2 minuti)

Nel progetto Cloudflare Pages → **Metrics** → attiva **Web Analytics**. Sono anonime e senza cookie.

## 6. Fisco

I guadagni di pubblicità e affiliazioni sono reddito da dichiarare. Se diventano un'attività abituale serve
la partita IVA: il calcolatore del forfettario del sito ti dice quanto pagheresti.

---

## Ogni settimana (facoltativo)

Il lunedì l'operatore apre una PR e, se test, CI e verifiche delle fonti sono verdi, ne fa il merge da
solo: il merge pubblica il sito. Se una PR resta aperta, c'è un controllo fallito o il merge è stato
bloccato: guarda il riassunto e fai tu **Squash and merge**, oppure commenta. Per annullare una modifica
già pubblicata usa **Revert** sulla PR.

## Come dare istruzioni all'operatore

Apri una issue nel repo con label `owner` (o semplicemente da tuo account). La sessione settimanale
le legge per prime. Per fermare tutto: disattiva la Routine da claude.ai/code → Routines.
