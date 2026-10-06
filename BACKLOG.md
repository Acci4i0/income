# BACKLOG

Ordinato per priorità: (domanda di ricerca × accuratezza ottenibile × potenziale di monetizzazione).
L'operatore prende la prima voce non spuntata di "Prossimi". Spezza le voci troppo grandi.

## Prossimi

- [ ] **Addizionali regionali 2026 per regione**: tabella verificata delle 20 regioni (scaglioni e aliquote)
  in `params.js`; select "Regione" nel calcolo stipendio netto al posto dell'aliquota manuale (mantieni
  l'opzione "personalizzata"); pagina `addizionale-regionale-irpef` con tabella e calcolatore.
- [ ] **Calcolo NASpI 2026** (`calcolo-naspi`): importo mensile (75% fino alla soglia + 25% eccedenza,
  massimale), durata (metà delle settimane contributive degli ultimi 4 anni), riduzione mensile del 3%.
  Soglia e massimale dalla circolare INPS 2026.
- [ ] **Partita IVA o dipendente?** (`partita-iva-o-dipendente`): a parità di costo per il committente,
  confronta netto da dipendente (RAL) e netto da forfettario. Riusa `stipendio.js` e `forfettario.js`.
- [ ] **Cedolare secca o IRPEF?** (`calcolo-cedolare-secca`): 21% / 10% canone concordato contro IRPEF
  marginale + addizionali + imposta di registro e bollo. Mostra quale conviene.
- [ ] **Calcolo TFR** (`calcolo-tfr`): quota annua RAL/13,5 meno 0,5%, rivalutazione 1,5% + 75% inflazione
  ISTAT; tassazione separata indicativa.
- [ ] **Calcolo ritenuta d'acconto** (`calcolo-ritenuta-acconto`): pagina dedicata (lordo↔netto) che
  riusa `fattura.js`; spiega F24 codice 1040 e certificazione unica.
- [ ] **Forfettario o ordinario?** (`forfettario-o-ordinario`): confronto con costi reali e IRPEF.
- [ ] **Tredicesima e quattordicesima** (`calcolo-tredicesima`): rateo per mesi lavorati, tassazione.
- [ ] **Tasse crypto 2026** (`tasse-criptovalute`): imposta sulle plusvalenze (verifica aliquota 2026),
  calcolo plusvalenza, quadro RW/RT.
- [ ] **Assegno unico 2026** (`calcolo-assegno-unico`): importi per ISEE e maggiorazioni dalla circolare
  INPS 2026.
- [ ] **Immagine Open Graph**: PNG 1200×630 generata in build (Playwright o SVG statico) per la condivisione.
- [ ] **Prodotto digitale**: foglio Excel "Gestione forfettario" (registro fatture, accantonamento mensile,
  scadenze F24). Il file va in `products/`; il proprietario lo carica su Gumroad o Lemon Squeezy e mette
  l'URL in `site.config.json` → offerta `foglio-forfettario`.

- [ ] **Contributo integrativo delle casse in params.js**: aliquote con fonte (Cassa Forense, Inarcassa,
  ENPAP: verificare se dal 2027 passa al 4%) al posto dei valori scritti nella pagina fattura.

## Ricorrenti

- Ogni gennaio: **Aggiornamento parametri** (vedi OPERATIONS.md, "Aggiornamento annuale").
- Ogni trimestre: rileggi le FAQ delle pagine principali e aggiorna le date nei testi se superate.

## Fatto

- [x] Infrastruttura: build statico con validazione SEO, test unitari, smoke test nel browser.
- [x] Calcolatori: forfettario, stipendio netto, scorporo IVA, prestazione occasionale, fattura, rata mutuo.
- [x] Pagine: home, chi siamo e metodo, privacy e cookie, 404.
