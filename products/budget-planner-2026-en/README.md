# 2026 Budget Planner (inglese, mercato internazionale Etsy)

Foglio di calcolo in inglese (xlsx) per il budget personale o familiare: registro delle transazioni, budget
per categoria e mese, riepilogo mensile con differenze, dashboard annuale con grafici, obiettivi di
risparmio, sinking funds e piano debiti snowball/avalanche. Pensato per acquirenti USA/UK: valuta
configurabile, date ISO (yyyy-mm-dd), inglese americano. Non è mostrato sul sito italiano (`site_pages: []`).

Prezzo 5,90 € (circa 6-7 $). Ricerca di ottobre 2026 con WebSearch su inserzioni Etsy simili: la gran parte
dei budget planner costa meno di 10 $ (RankHero, keyword "budget spreadsheet": 73% delle inserzioni sotto
10 $, 27.100 ricerche al mese, 67% dagli USA), spesso in saldo tra 2 e 9 $; i bundle con debt snowball e
sinking funds stanno tra 4,50 e 12 $. Fonti: etsy.com/listing/4527896464, etsy.com/listing/1241740962,
etsy.com/listing/4524036009, rankhero.com/keywords/budget-spreadsheet. Testi e struttura sono nostri.

## Contenuto

```
listing.json        metadati Etsy (schema in products/README.md)
build.py            genera i due file in files/ (python3 + openpyxl, deterministico)
verify.py           ricalcola con LibreOffice, controlla formule e totali, scrive images/src/data.js
files/
  budget-planner-2026.xlsx           modello vuoto
  budget-planner-2026-example.xlsx   stesso modello con un anno di dati di una famiglia di fantasia
images/
  01-cover.png ... 08-included.png   immagini dell'inserzione, 2000x1500
  card.jpg                           1200x900 (non usata dal sito finché site_pages è vuoto)
  src/                               HTML sorgente, common.css, common.js, data.js, render.mjs
```

Il file di esempio si chiama `-example` e non `-esempio` perché l'acquirente è anglofono.

## Fogli (nell'ordine)

Start Here, Settings, Categories, Transactions, Monthly Budget, Monthly Summary, Annual Dashboard,
Savings Goals, Sinking Funds, Debt Payoff, Debt Schedule, più `Lists` (nascosto: mesi, tipi, metodi,
simboli di valuta, numeri dei mesi in `I2:T2` per le SUMIFS; obiettivi e fondi: `V` nomi nell'ordine dei fogli,
`W` posizione tra i nomi non vuoti, `G` gli stessi nomi senza righe vuote in mezzo, usati dal menu di
Transactions e dai controlli).

Il modello vuoto si può usare anche per il 2027 cambiando l'anno in Settings (`C4`): tutti i calcoli seguono;
il titolo di Start Here resta un testo fisso ("2026 Budget Planner") perché deve leggersi anche in Protected View.

- **Settings**: anno `C4`, simbolo valuta `C5` (menu con suggerimenti, accetta anche altro), nome del piano
  `C6`, data di riferimento `C7` (vuota = TODAY()). Righe 10-15 calcolate: mese scelto, data usata, numero e
  nome del mese, `" ($)"` per le intestazioni. Conti `B18:B25`.
- **Categories**: `A6:B65` (60 righe), 28 precompilate con 4 tipi: Income, Fixed bills, Variable expenses,
  Savings & debt. Colonna D di controllo (nome doppio, tipo mancante o non valido).
- **Transactions**: `A6:I2005`. Importi positivi, un rimborso è negativo nella stessa categoria. F = obiettivo o
  fondo (facoltativo), H = tipo dalla categoria, I = controllo (data mancante o di testo, altro anno, categoria
  mancante, non in elenco o senza tipo, importo mancante o di testo, fondo non in elenco, fondo su un'entrata).
  `A3`: righe usate e totali di entrate e spese dell'anno del piano (stessi numeri della dashboard).
- **Monthly Budget**: riepilogo righe 6-12, categorie 14-73 (riga categoria = riga Categories + 8). Le celle
  dei mesi sono input che contengono `=$C<riga>` (importo tipico): l'utente le sovrascrive. Riga 11 = spese
  pagate con fondi accantonati (input facoltativo). Riga 12 "Left to budget" = 6 − 9 − 10 + 11.
- **Monthly Summary**: mese da rivedere in `B3` (Auto o un mese). Blocchi: C:F mese scelto, H:J da inizio
  anno, L:W consuntivo per mese (SUMIFS su Transactions con data nell'anno), X:Z anno. Una riga senza nome
  di categoria non riporta il piano (C, H, Y = 0), anche se in Monthly Budget restano importi vecchi. Differenza =
  consuntivo − budget, rossa se peggiore (spese sopra, entrate/risparmi sotto). Riga 11 = spese con fondo
  indicato (Fixed + Variable con colonna F non vuota). Colonna AA nascosta = chiave per la classifica.
- **Annual Dashboard**: 6 riquadri (entrate, spese, risparmio e debiti, savings rate, left over, debito
  totale), 3 riquadri larghi (obiettivi, fondi, data di uscita dai debiti), tabella mensile, confronto da
  inizio anno, controlli, top 10 categorie di spesa, 2 grafici nativi (colonne e barre).
- **Savings Goals** / **Sinking Funds**: 12 righe ciascuno. Saldo = iniziale + transazioni Savings & debt col
  nome del fondo − spese col nome del fondo. Mesi rimasti = differenza in mesi tra data di riferimento e
  scadenza; quota mensile = mancante / max(1, mesi). Gli obiettivi hanno anche il piano mensile e la data in
  cui si raggiungono. Sinking Funds confronta la quota mensile con il piano della categoria che si chiama
  esattamente "Sinking funds" in Monthly Budget; se la categoria viene rinominata il confronto resta vuoto.
- **Debt Payoff**: 10 debiti `B8:E17`. Ordine avalanche (APR decrescente, poi saldo) e snowball (saldo
  crescente, poi APR) con COUNTIFS; confronto minimi / snowball / avalanche (righe 23-27), elenchi degli
  ordini, dati del grafico righe 60-84 (25 punti, passo = mesi/24), grafico a linee. Colonna M nascosta.
- **Debt Schedule**: 360 mesi (righe 10-370) per tre blocchi: solo minimi (C:N), snowball (P:AM), avalanche
  (AO:BL). Ogni mese: interessi APR/12 sul saldo, ogni debito paga il minimo, il resto del totale mensile
  (somma dei minimi + extra, costante) va ai debiti nell'ordine. Colonne di appoggio nascoste.

Definizioni (spiegate anche in Start Here): Expenses = Fixed bills + Variable expenses; Savings rate =
(income − expenses) / income; Left over = income − expenses − savings & debt + paid from goals & funds.
Car payment è una spesa fissa; Debt payments (carte, prestiti) è in Savings & debt.

Compatibilità: solo SUM, SUMIFS, COUNT, COUNTIF(S), SUMPRODUCT, INDEX, MATCH, LARGE, IF, IFERROR, AND, OR, NOT,
ISNUMBER, ISNA, N, MIN, MAX, ROUND, ROUNDUP, REPT, FIXED, DATE, YEAR, MONTH, TODAY, ROW, LEFT, RIGHT, TRIM (tutte
presenti in Excel 2007+, Google Sheets e LibreOffice). INDEX su un intervallo di una riga ha sempre la forma
`INDEX(riga,1,n)`, che i tre programmi leggono allo stesso modo. Niente TEXT
(i codici di formato cambiano con la lingua: le date-testo sono costruite con YEAR e MONTH), LET, LAMBDA,
XLOOKUP, FILTER, OFFSET, INDIRECT, macro o collegamenti esterni (verify.py lo controlla). Formattazione
condizionale solo con riferimenti allo stesso foglio (Google Sheets non accetta altri fogli). Celle da
compilare gialle e sbloccate, fogli protetti senza password. Stampa su carta Letter (mercato USA), una pagina
in larghezza per foglio: su A4 si adatta da sola. Nessun parametro fiscale: `src/lib/params.js` non è coinvolto.

## Come rigenerare

```bash
cd products/budget-planner-2026-en
python3 build.py            # scrive files/*.xlsx (stessi byte a ogni esecuzione)
python3 verify.py           # richiede soffice; esce con 1 se trova errori o valori diversi; aggiorna data.js
node images/src/render.mjs  # richiede Playwright + Chromium (come scripts/smoke.mjs) e il font Inter
```

`verify.py` controlla: determinismo, funzioni vietate, assenza di errori nei tre file ricalcolati (vuoto,
esempio, copia con errori voluti), tutti i valori dell'esempio contro un calcolo indipendente in Python
(somme per categoria e mese, riepiloghi, dashboard, top 10, obiettivi, fondi), la simulazione dei debiti
contro una simulazione Python e contro NPER in forma chiusa, i messaggi di controllo, il mese scelto a mano,
il metodo snowball, il simbolo di valuta nelle intestazioni, i totali di `Transactions!A3`, il menu
obiettivi/fondi senza buchi e le righe senza categoria (circa 1.240 controlli).

Le immagini leggono solo `images/src/data.js`: dopo ogni modifica ai dati di esempio rieseguire verify.py e
render.mjs, poi guardare le PNG.

## Aggiornamento annuale

1. `build.py`: `YEAR`, `VERSION`, `BASE` (nome dei file), `EXAMPLE_SETTINGS['asof']`, le date di obiettivi,
   fondi e debiti di esempio (devono restare dopo la data di riferimento), eventuali festività nei dati.
2. `listing.json`: anno in titolo, tag (`2026 budget`), descrizione, nomi dei file. `verify.py` e quasi tutte
   le immagini leggono l'anno dai dati; fanno eccezione `04-transactions.html` (filtro sulle righe "2026-12",
   riga di esempio e testo "2026-12-04"), `08-included.html` ("2026-03-15") e `01-cover.html` ("2026").
3. Decidere con la sync Etsy se aggiornare l'inserzione esistente (stesso slug) o crearne una nuova: lo slug
   contiene l'anno.

## Limiti noti

- Verificato solo con LibreOffice 24.2 nel container. Excel e Google Sheets non sono disponibili qui: le
  funzioni usate sono comuni ai tre programmi, ma l'aspetto (grafici, protezione, rich text di Start Here,
  link interni) va guardato a mano almeno una volta in Excel e in Google Sheets.
- Stampa: Transactions stampa tutte le 2.000 righe gialle (circa 45 pagine) se non si stampa una selezione
  (Start Here lo spiega); Debt Schedule è un foglio di calcolo, non pensato per la stampa.
- Se si rinomina una categoria dopo aver registrato transazioni, le righe col vecchio nome vengono segnalate
  ("Category not in list") ed escluse dai totali finché non si aggiorna il nome (Start Here lo spiega).
- Google Sheets: non è verificato che la protezione dei fogli venga importata; la descrizione dice di scrivere
  solo nelle celle gialle.
- openpyxl non salva i valori calcolati: Excel ricalcola all'apertura (`fullCalcOnLoad`), ma un file scaricato da
  internet si apre in Protected View, dove le formule restano vuote finché non si clicca Enable Editing. Start
  Here e la descrizione lo dicono; i testi di Start Here sono fissi apposta.
- In Excel l'ordinamento di Transactions richiede di togliere la protezione (le colonne H:I sono bloccate);
  i filtri funzionano.
- Debiti: tasso e minimo costanti, interessi mensili APR/12 senza capitalizzazione giornaliera, orizzonte di
  30 anni ("Over 30 years" oltre). Snowball e avalanche coincidono quando l'ordine è lo stesso.
- Le spese pagate con un fondo contano come spese della categoria (servono al consuntivo) e vengono
  riaggiunte in "Left over"; un fondo non in elenco viene segnalato ma la spesa resta in "Paid from goals &
  funds".
- Un file = un anno solare e una valuta. Le note della dashboard usano FIXED, quindi separatori decimali e
  delle migliaia della lingua dell'utente (corretto, ma diversi dalle immagini).
