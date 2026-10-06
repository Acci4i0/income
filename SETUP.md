# SETUP — le azioni che solo il proprietario può fare

Tutto il resto (codice, contenuti, aggiornamenti, SEO tecnico) lo fa l'operatore automatico.
Queste azioni richiedono la tua identità, un pagamento o un account a tuo nome. In ordine:

## 1. Dominio e hosting su Cloudflare Pages (15 minuti, ~10 $/anno) — BLOCCANTE

Finché non fai questo passo il sito non è online. Cloudflare Pages è gratuito e consente l'uso
commerciale. Se una build fallisce non viene pubblicata e resta online la versione precedente.
Dominio, titolare (Andrea Lando) ed email sono già configurati in `site.config.json`.

1. Entra su <https://dash.cloudflare.com> dal browser (l'app "1.1.1.1"/WARP sul telefono non mostra i
   domini). Usa **un solo account** per dominio e progetto Pages: se hai più account (email diverse),
   il dominio sta in quello con cui l'hai comprato. Lo vedi in **Domain Registration** → **Manage Domains**.
2. **Domain Registration** → **Register Domains** → cerca `nettochiaro.com` → acquista (prezzo di costo,
   circa 10 $/anno; serve la carta). `and-re.com` (tuo dal 3/8/2026) ospita già il sito "andre": non usarlo
   per NettoChiaro, oppure usa il sottodominio `nettochiaro.and-re.com` e scrivimelo (gratis, ma per la
   pubblicità `ads.txt` andrebbe messo anche sul sito principale).
3. **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git** → autorizza GitHub → scegli
   `Acci4i0/income`.
4. Impostazioni build: Framework preset **None**, Build command `node build.mjs`, Build output directory
   `dist`, Production branch `claude/income-generator-project-jphcdt` (il branch di default del repo).
   In **Environment variables** aggiungi `NODE_VERSION` = `22`. **Save and Deploy**.
5. Nel progetto Pages → **Custom domains** → **Set up a custom domain** → `nettochiaro.com` (il DNS si
   configura da solo perché il dominio è su Cloudflare). Ripeti per `www.nettochiaro.com`.
6. Scrivimi "fatto" (o apri una issue con label `owner`): verifico che sia tutto online.

Con la pubblicità attiva, l'art. 7 del D.Lgs. 70/2003 chiede anche un recapito geografico del titolare:
basta il comune, da indicare quando attivi AdSense.

## 2. Google Search Console (5 minuti, subito dopo il punto 1)

1. <https://search.google.com/search-console> → **Aggiungi proprietà** → **Dominio** → verifica via DNS
   (con Cloudflare è quasi automatico).
2. **Sitemap** → invia `https://<dominio>/sitemap.xml`.

Senza questo passo Google ci mette molto di più a trovare il sito.

## 3. Google AdSense (20 minuti, dopo 4-8 settimane di contenuti indicizzati)

Titolare ed email sono già in `site.config.json`: senza, la build si ferma con un errore.

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

## 4. Negozio Etsy (30 minuti una volta, poi automatico)

I prodotti (fogli Excel) li crea e li pubblica l'operatore: una GitHub Action sincronizza
`products/` con il tuo negozio. Tu fai solo l'apertura del negozio e un'autorizzazione una tantum.
Guida passo per passo: [`products/ETSY.md`](products/ETSY.md).

Costi Etsy: 0,20 $ per inserzione ogni 4 mesi, 6,5% sulla vendita, 4% + 0,30 € di pagamento, più la
commissione regolamentare. Su un prodotto da 5,90 € ti restano circa 4 €.

## 5. Affiliazioni (facoltativo, 10 minuti per programma)

Il sito ha già due spazi pronti in `site.config.json` → `monetization.offers` (conto business per partita
IVA, commercialista online). Compaiono solo quando hanno un URL.

1. Iscriviti al programma di affiliazione di un servizio che useresti davvero (molti conti business e
   servizi per partite IVA ne hanno uno, diretto o tramite reti come Awin).
2. Mettilo in una issue `owner` con il link di affiliazione e a quale spazio associarlo.

## 6. Statistiche (facoltativo, 2 minuti)

Nel progetto Cloudflare Pages → **Metrics** → attiva **Web Analytics**. Sono anonime e senza cookie.

## 7. Fisco

I guadagni di pubblicità, affiliazioni ed Etsy sono reddito da dichiarare. Se diventano un'attività abituale serve
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
