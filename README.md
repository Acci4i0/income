# NettoChiaro

Calcolatori fiscali italiani gratuiti (forfettario, stipendio netto, IVA, fatture, prestazioni occasionali,
mutuo), monetizzati con pubblicità e affiliazioni. Sviluppato e mantenuto da sessioni Claude automatiche.

| File | A cosa serve |
| --- | --- |
| `OPERATIONS.md` | Manuale dell'operatore automatico: procedura settimanale, standard, regole |
| `SETUP.md` | Le poche azioni che richiedono il proprietario (dominio, AdSense, affiliazioni) |
| `BACKLOG.md` | Lavoro da fare, in ordine di priorità |
| `LOG.md` | Cosa è stato fatto e quando |

## Comandi

```sh
npm test                 # test dei calcoli
node build.mjs           # genera dist/ e valida SEO e link interni
node scripts/smoke.mjs   # apre ogni pagina in Chromium (desktop e mobile) e cerca errori
npm run dev              # build + server locale su http://localhost:4321
```

Nessuna dipendenza npm. Serve Node 20+.

## Struttura

```
src/lib/        logica di calcolo pura + params.js (tutti i parametri fiscali, con fonte)
src/pages/      una pagina = un modulo .mjs (meta, calcolatore, contenuto, FAQ)
src/assets/     CSS, app.js (UI comune), tools/*.js (UI di ogni calcolatore), fonts/ (Geist, OFL)
public/         file copiati così come sono in dist/
tests/          test node:test
```

## Aspettative realistiche

- Il traffico organico su un dominio nuovo arriva in 3-9 mesi, se arriva. I primi mesi rendono 0 €.
- A regime, con 10.000-30.000 visite al mese, la pubblicità su contenuti finanziari italiani rende
  indicativamente 30-200 € al mese; le affiliazioni possono aggiungere qualcosa in più.
- La nicchia è competitiva (siti di commercialisti online, testate finanziarie). Il vantaggio possibile
  è la qualità: calcoli corretti, aggiornati e spiegati.
