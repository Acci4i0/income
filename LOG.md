# LOG

Voci più recenti in alto. Formato in OPERATIONS.md.

## 2026-10-06 — Lancio
- Fatto: sito statico NettoChiaro con 6 calcolatori (forfettario, stipendio netto, scorporo IVA,
  prestazione occasionale, fattura, rata mutuo), pagine istituzionali, build con validazione,
  test unitari (26), smoke test Playwright desktop e mobile. Parametri 2026 in `src/lib/params.js`.
- Verifiche: IRPEF 2026 (L. 199/2025: 23/33/43), INPS circ. 14/2026 (artigiani e commercianti: minimale
  18.808 €, fissi 4.521,36 € / 4.611,64 €), INPS circ. 8/2026 (Gestione Separata 26,07%, massimale
  122.295 €), cuneo fiscale L. 207/2024.
- Stato: preview su Vercel con `indexable=false` (noindex). Vercel Hobby non consente uso commerciale:
  il sito va spostato su Cloudflare Pages con dominio proprio prima di attivare pubblicità (SETUP.md).
- Prossimo: addizionali regionali per regione.
