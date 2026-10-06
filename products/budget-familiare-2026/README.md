# Budget familiare 2026

Foglio di calcolo in italiano (xlsx) per il budget della famiglia: registro dei movimenti, budget per
categoria e mese, consuntivo con differenze, dashboard con grafici, obiettivi di risparmio e piano debiti.
Prezzo 5,90 € (prodotti simili su Etsy: in gran parte tra 4 e 10 €, spesso in saldo). Pagine del sito
collegate: `calcolo-stipendio-netto`, `calcolo-rata-mutuo`.

## Contenuto

```
listing.json        metadati Etsy e sito (schema in products/README.md)
build.py            genera i due file in files/ (python3 + openpyxl, deterministico)
verifica.py         ricalcola con LibreOffice e controlla formule e totali; scrive images/src/dati.js
files/
  budget-familiare-2026.xlsx           modello vuoto
  budget-familiare-2026-esempio.xlsx   stesso modello con un anno di dati (famiglia di fantasia)
images/
  01-cover.png ... 08-contenuto.png    immagini dell'inserzione, 2000x1500
  card.jpg                             1200x900 per il sito
  src/                                 HTML sorgente, comune.css, comune.js, dati.js, render.mjs
```

Fogli del file (nell'ordine): Istruzioni, Impostazioni, Categorie, Movimenti, Budget, Mensile, Dashboard,
Obiettivi, Debiti, più Elenchi (nascosto: mesi, tipi, metodi per i menu a tendina).

- **Impostazioni**: anno (C4), saldo di cassa al 1° gennaio (C5), nome famiglia, mese di riferimento
  (Automatico, vuoto = Automatico, o un mese), data di riferimento (vuota = oggi), 6 membri, 8 conti. Le
  righe 11-13 sono i valori effettivi usati dalle formule.
- **Categorie**: 60 righe (A6:B65), 32 precompilate con 4 tipi: Entrata, Spesa fissa, Spesa variabile,
  Risparmio e investimenti. La colonna D segnala nomi doppi, tipo mancante e simboli non ammessi
  (`* ? ~` o `< > =` all'inizio: SUMIFS, COUNTIF e MATCH li leggerebbero come caratteri jolly o operatori
  e sommerebbero anche movimenti di altre categorie).
- **Movimenti**: 2.000 righe (A6:H2005). Importi positivi, il tipo viene dalla categoria; un rimborso è un
  importo negativo nella stessa categoria. G = tipo, H = controllo (data, importo, categoria, anno).
- **Budget** e **Mensile**: righe di riepilogo 6-12, categorie 14-73 allineate per riga con Categorie
  (riga categoria + 8). Riga 4 nascosta con i numeri dei mesi (servono ai confronti «da inizio anno»).
  Mensile usa SUMIFS su Movimenti con data nell'anno; differenza = consuntivo − budget, colorata secondo il
  tipo. Colonna Z nascosta = chiave per la classifica delle spese (totale − ROW()/10^7: a pari importo viene
  prima la categoria più in alto).
- **Dashboard**: 6 riquadri (entrate, spese, risparmio = entrate − spese, tasso di risparmio, saldo di
  cassa = saldo iniziale + entrate − spese − versamenti a risparmio, debiti residui), andamento mensile,
  budget e consuntivo da inizio anno, controlli (righe del registro, categorie e debiti da controllare),
  top 10 categorie di spesa, spese ed entrate per persona (un nome ripetuto in Impostazioni conta una
  volta), 2 grafici nativi.
- **Obiettivi**: 12 righe; mesi rimanenti = differenza di mesi tra data di riferimento e scadenza, quota =
  mancante / max(1, mesi).
- **Debiti**: 10 righe; mesi con NPER (o saldo/rata se TAN 0), oppure un avviso in G (Manca il nome, il
  saldo, il TAN o la rata; Rata troppo bassa; saldo 0 = estinto, nessun avviso), interessi residui
  stimati, ordine valanga (TAN decrescente, poi saldo) e palla di neve (saldo crescente, poi TAN) con
  COUNTIFS, effetto di una somma extra sul primo debito del metodo scelto.

Compatibilità: solo funzioni presenti in Excel 2016+, Google Sheets e LibreOffice. Elenco completo (6/10/2026):
AND, COUNT, COUNTIF, COUNTIFS, DATE, FIND, IF, IFERROR, INDEX, ISNA, ISNUMBER, ISTEXT (solo nella
formattazione condizionale), LARGE, LEFT, LEN, LOWER, MATCH, MAX, MIN, MONTH, N, NOT, NPER, OR, REPT, ROUND,
ROUNDUP, ROW, SUM, SUMIFS, TODAY, YEAR. Niente LET, LAMBDA, XLOOKUP, FILTER, OFFSET, INDIRECT, macro o
collegamenti esterni (verifica.py lo controlla). Niente `COUNTIF(...,"?*")` su colonne con numeri:
LibreOffice conta anche i numeri, Excel no. Celle da compilare in giallo chiaro e sbloccate; fogli protetti
senza password. Le date sono gg/mm/aaaa. Stampa A4 orizzontale: Istruzioni (verticale) e Debiti stanno in
una pagina, Mensile in due pagine di larghezza con Voce e Tipo ripetute. Nessun parametro fiscale nel file:
se in futuro servisse (es. importi INPS), va preso da `src/lib/params.js`.

## Come rigenerare

```bash
cd products/budget-familiare-2026
python3 build.py            # scrive files/*.xlsx (stessi byte a ogni esecuzione)
python3 verifica.py         # richiede soffice; esce con 1 se trova errori o totali diversi
node images/src/render.mjs  # richiede Playwright + Chromium (come scripts/smoke.mjs)
```

`verifica.py` ricalcola i file con LibreOffice in una cartella temporanea, cerca valori di errore e
funzioni vietate, confronta ogni cella di Mensile, Budget, Dashboard, Obiettivi e Debiti dell'esempio con
valori calcolati in Python dagli stessi dati, prova i controlli su un file con dati sbagliati apposta (righe
del registro, categoria doppia o con `*`, debiti incompleti, mese di riferimento vuoto, nome ripetuto tra i
membri) e infine aggiorna `images/src/dati.js`. Le immagini leggono solo `dati.js`: dopo aver cambiato i dati
di esempio esegui sempre `verifica.py` e poi `render.mjs`, e guarda le immagini prima di pubblicarle.

## Aggiornamento annuale (per la versione 2027)

1. Copia la cartella in `products/budget-familiare-2027/` (nuovo slug e nuova inserzione) oppure aggiorna
   questa e il titolo dell'inserzione.
2. `build.py`: `ANNO`, `VERSIONE`, `SLUG`; date di `ESEMPIO_IMPOSTAZIONI['data_rif']`, scadenze di
   `ESEMPIO_OBIETTIVI` e nomi con l'anno ("Vacanza estate 2027", "Regali di Natale 2026").
3. Controlla le voci delle categorie (nuove imposte o bonus con nomi diversi) e la nota di Istruzioni.
4. `listing.json`: titolo, `short`, descrizione e tag con l'anno; slug e nomi dei file.
5. Testi delle immagini in `images/src/*.html` che citano l'anno; poi `verifica.py` e `render.mjs`.

## Limiti noti

- Excel stampa anche le righe vuote del registro Movimenti (2.000 righe con formule): le istruzioni dicono
  di usare «Stampa selezione».
- In Google Sheets la protezione dei fogli può non restare attiva (le istruzioni dicono di scrivere solo
  nelle celle gialle) e i grafici hanno uno stile un po' diverso; le formule sono tutte disponibili anche lì.
  Il test automatico usa LibreOffice: Excel e Google Sheets non sono provati in CI.
- openpyxl non salva i valori calcolati: Excel ricalcola all'apertura (`fullCalcOnLoad`), ma in
  «Visualizzazione protetta» e nelle anteprime (Quick Look, app File del telefono) le celle con formule
  possono apparire vuote finché non si abilita la modifica. Istruzioni e descrizione Etsy lo dicono.
- Rinominare una categoria non aggiorna i movimenti già registrati (vengono segnalati come «Categoria non
  trovata»). Eliminare righe in Categorie è impedito dalla protezione, perché romperebbe l'allineamento con
  Budget e Mensile.
- Le stime di Debiti e Obiettivi ipotizzano tasso e rata costanti; l'effetto valanga/palla di neve su più
  debiti in sequenza non è simulato mese per mese.
