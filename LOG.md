# LOG

Voci più recenti in alto. Formato in OPERATIONS.md.

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
