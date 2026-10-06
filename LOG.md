# LOG

Voci più recenti in alto. Formato in OPERATIONS.md.

## 2026-10-06 — Nuovo design del sito (richiesta del proprietario)
- Fatto: riscritti `src/assets/style.css` e la struttura di `src/layout.mjs` sul modello indicato dal
  proprietario (t1energy.com, on.energy, rauno.me): griglia a filetti, angoli vivi, un solo colore segnale
  arancio, Geist + Geist Mono ospitati nel sito (`src/assets/fonts/`, OFL, ~52 KB), quadrante dei risultati
  scuro, sezioni numerate con titolo fisso a sinistra, home e "Altri calcolatori" come indice numerato,
  piè di pagina con tutti i calcolatori, favicon nuova. Regole di stile in OPERATIONS.md.
- Verifiche: 105 test, build, smoke test desktop e mobile; screenshot chiaro/scuro di tutte le pagine;
  box prodotti e /prodotti/ provati con un'inserzione attiva simulata; contrasti WCAG AA (testo ≥ 4,5:1,
  bordi dei campi ≥ 3:1). I tre siti di riferimento non erano raggiungibili dal container (proxy).
- Prossimo: edizioni 2027 dei budget planner. Le immagini dei prodotti Etsy restano nei colori vecchi.

## 2026-10-06 — App Etsy in attesa di approvazione
- Fatto: il proprietario ha aperto il negozio, creato l'app Etsy e aggiunto i 2 segreti; "Etsy:
  autorizzazione" passo avvia riuscito (run 37539842598). Il link di Etsy risponde "application not
  recognized": l'app è in attesa di approvazione da parte di Etsy. Preparato `etsy-shop/inserzioni-manuali.md`
  per pubblicare a mano le 3 inserzioni nel frattempo (titoli identici: la sync le riconosce dal titolo).
- Prossimo: quando l'app è attiva, il proprietario riapre il link del run e lancia "completa"; poi verificare
  il primo run di "Etsy: sincronizzazione" (log) e products/etsy-listings.json.

## 2026-10-06 — Google Search Console
- Fatto: il proprietario ha verificato nettochiaro.com (proprietà Dominio, verifica DNS) e inviato
  https://nettochiaro.com/sitemap.xml. Stato dei passi del proprietario in cima a SETUP.md.
- Prossimo: negozio Etsy (proprietario); edizioni 2027 dei budget planner (operatore, 12/10).

## 2026-10-06 — Sito online su nettochiaro.com
- Fatto: il proprietario ha registrato nettochiaro.com su Cloudflare e collegato il repo a Cloudflare
  Pages con i domini nettochiaro.com e www. Workflow "Controllo sito" esteso: verifica ogni pagina della
  sitemap, gli asset e la 404.
- Verifiche: Controllo sito alle 21:34 UTC: 200 su /, robots.txt e sitemap.xml per entrambi i domini,
  titolo corretto, nameserver Cloudflare.
- In attesa del proprietario: Google Search Console + sitemap, negozio ed app Etsy (SETUP.md).
- Prossimo: edizioni 2027 dei budget planner.

## 2026-10-06 — Prodotti Etsy e sincronizzazione automatica
- Fatto: 3 prodotti in `products/` (gestionale forfettario 2026, budget familiare 2026, budget planner
  2026 EN) con file vuoti e di esempio, 8 immagini ciascuno, listing.json; sincronizzazione Etsy via
  GitHub Actions (`scripts/etsy/`, workflow etsy-auth e etsy-sync, token cifrato sul branch etsy-state,
  solo aggregati di vendita nel repo); pagina /prodotti/ e box prodotto nelle pagine collegate, visibili
  solo con inserzione attiva; pagina /etsy-callback/ per l'autorizzazione. Titolare ed email nella privacy,
  baseUrl nettochiaro.com, indicizzazione attiva.
- Verifiche: 105 test; gestionale confrontato al centesimo con `forfettario.js` su 22 scenari (LibreOffice);
  budget ricalcolati e verificati a mano; DRY_RUN della sync su Etsy simulato (2 run: 36 scritture, poi 0);
  smoke test desktop e mobile. Non provati dal vivo: Excel, Google Sheets e le API Etsy reali (bloccate dal
  container: il primo run reale avverrà in GitHub Actions).
- In attesa del proprietario: Cloudflare Pages + dominio, negozio Etsy, app Etsy e 2 segreti (SETUP.md).
- Prossimo: edizioni 2027 dei budget planner (stagionalità Etsy).

## 2026-10-06 — Verifica avversariale dell'accuratezza
- Fatto: 5 revisori indipendenti (forfettario, stipendio, occasionale, fattura, IVA/mutuo/privacy) e
  5 scettici: 34 errori confermati su 39 segnalati, tutti corretti. Principali: addizionali azzerate
  quando l'IRPEF netta è zero; opzione massimale contributivo (contributivo puro); forfettario oltre
  100.000 € marcato "non applicabile" (circ. AdE 32/E/2023); colonna ATECO 2007 con nota su ATECO 2025;
  committenti forfettari senza ritenuta (art. 1 c. 69 L. 190/2014); fattura ordinaria esente IVA con
  bollo; avviso quando il netto richiesto cade nel salto della marca da bollo; informativa privacy
  completa (art. 13 GDPR) con segnaposto titolare/contatto; build bloccata se si pubblica o si attiva
  AdSense senza titolare ed email.
- Verifiche: 50 test, build, smoke test desktop e mobile, controlli manuali nel browser.
- Prossimo: addizionali regionali per regione.

## 2026-10-06 — Lancio
- Fatto: sito statico NettoChiaro con 6 calcolatori (forfettario, stipendio netto, scorporo IVA,
  prestazione occasionale, fattura, rata mutuo), pagine istituzionali, build con validazione,
  test unitari (26), smoke test Playwright desktop e mobile. Parametri 2026 in `src/lib/params.js`.
- Verifiche: IRPEF 2026 (L. 199/2025: 23/33/43), INPS circ. 14/2026 (artigiani e commercianti: minimale
  18.808 €, fissi 4.521,36 € / 4.611,64 €), INPS circ. 8/2026 (Gestione Separata 26,07%, massimale
  122.295 €), cuneo fiscale L. 207/2024.
- Stato: NON ancora online. Il connettore Vercel della sessione non ha permessi di scrittura (403) e
  Vercel Hobby vieta comunque l'uso commerciale: hosting previsto su Cloudflare Pages con dominio
  proprio (SETUP.md, punto 1). `indexable=false` e `baseUrl` vuoto finché il dominio non è attivo.
- Prossimo: addizionali regionali per regione.
