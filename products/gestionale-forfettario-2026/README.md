# Gestionale Partita IVA forfettaria 2026

Foglio Excel (compatibile con Google Sheets e LibreOffice) per chi è in regime forfettario: registro
fatture, stima di imposta sostitutiva e contributi, quota da accantonare mese per mese, soglie di
85.000 e 100.000 €, scadenze F24. Prezzo: 9,90 € (prodotti simili su Etsy: 6-15 $; quelli italiani
sul forfettario sono pochi).

## Contenuto

| File | Cosa contiene |
|---|---|
| `files/gestionale-forfettario-2026.xlsx` | foglio vuoto (impostazioni predefinite: 15%, nessuna riduzione, bollo nei ricavi) |
| `files/gestionale-forfettario-2026-esempio.xlsx` | stesso foglio con un anno di esempio (grafica freelance, Gestione Separata, 78%) |
| `listing.json` | inserzione Etsy (schema in `products/README.md`) |
| `images/01-cover.png` … `08-contenuto.png` | immagini dell'inserzione, 2000×1500 |
| `images/card.jpg` | 1200×900 per il sito |
| `images/src/` | sorgenti HTML/CSS delle immagini e script per rigenerarle |
| `build.py` | rigenera i due xlsx |
| `verifica.py` | ricalcola con LibreOffice e confronta con `src/lib/forfettario.js` |

Fogli: **Istruzioni**, **Impostazioni** (attività, previdenza, imposta, riduzione 35%, contributi versati,
acconti versati), **Parametri 2026** (tutti i valori con la fonte e gli elenchi dei menu), **Fatture**
(300 righe), **Spese** (200 righe, facoltativo), **Riepilogo mensile**, **Dashboard** (totali, soglie,
controlli, 2 grafici nativi), **Scadenze**.

Convenzioni: celle da compilare gialle e sbloccate; tutti i fogli protetti senza password (filtri e
larghezza colonne consentiti); date `gg/mm/aaaa`; importi `#.##0,00 €`; stampa A4 impostata; nessuna
macro e solo funzioni presenti in Excel 2016, Google Sheets e LibreOffice. Elenco completo delle funzioni nelle
formule: AND, CHAR, CHOOSE, COUNTIF, COUNTIFS, DATE, FIXED, IF, IFERROR, INDEX, ISNUMBER, LEN, MATCH, MAX,
MIN, N, NOT, OR, REPT, ROUND, SUM, SUMIFS, SUMPRODUCT, TODAY, YEAR (più LEFT e RIGHT nella formattazione
condizionale). La formattazione condizionale usa solo celle dello
stesso foglio, perché Google Sheets non accetta riferimenti ad altri fogli.

## Come calcola (uguale a `src/lib/forfettario.js`)

- Ricavo di ogni fattura = compenso + rivalsa INPS 4% (se scelta, arrotondata al centesimo) + bollo
  addebitato al cliente (escludibile in Impostazioni). Bollo di 2 € se compenso + rivalsa > 77,47 €.
- Incassato dell'anno = somma dei ricavi con **data di incasso** nel 2026 (principio di cassa).
- Reddito = incassato × coefficiente. Contributi:
  - Gestione Separata: `min(reddito, massimale) × aliquota` (26,07% o 24%);
  - Artigiani/Commercianti: fissi `(fisso − maternità) × (1 − 35% se riduzione) + maternità`, più
    `(max(0, min(base, 56.224) − minimale) × aliquota + max(0, base − 56.224) × aliquota oltre) × fattore`,
    con `base = min(reddito, massimale)`;
  - Cassa: `reddito × aliquota` inserita.
- Imposta = `max(0, reddito − contributi) × 15% o 5%` (stima a regime). Se in Impostazioni inserisci i
  contributi versati nel 2026, si deducono quelli.
- Riepilogo mensile: la stessa formula sull'incassato cumulato a fine mese; quota da accantonare =
  differenza con il mese prima, con i contributi fissi divisi in 12 quote. La somma dei 12 mesi è uguale
  al totale della Dashboard (controllato da `verifica.py`).
- Avvisi: oltre 85.000 € (resti nel regime quest'anno, poi ordinario) e oltre 100.000 € (uscita
  immediata, imposta sostitutiva non dovuta), testi uguali a quelli del sito. In Scadenze, oltre 85.000 €
  gli acconti 2027 d'imposta sostitutiva diventano "Non dovuto" (dal 2027 regime ordinario) e oltre
  100.000 € anche il saldo 2026.
- Dati sbagliati: un compenso o una data scritti come testo (tipico quando si incolla da un altro file)
  non bloccano il file. La riga mostra "Compenso non valido" o "Data non valida", resta fuori dai totali e
  il riquadro Controlli della Dashboard la conta; lo stesso per spese senza data o con importo testuale e
  per importi testuali in Impostazioni (che vengono ignorati).

Scelte fatte:
- **Bollo addebitato nei ricavi = Sì** per default: risposta AdE 428/2022 (il riaddebito fa parte del
  compenso). Dopo il D.Lgs. 192/2024 alcune interpretazioni (DRE Lombardia, dicembre 2025) escludono dai
  compensi dei professionisti forfettari i rimborsi spese analitici: la scelta resta all'utente.
- Fattura senza data di incasso = "Da incassare"; incassata in un altro anno = "Incassata nel AAAA", e
  non conta.
- Celle "vuoto = default": rivalsa vuota = No (accetta anche "Si" senza accento), bollo al cliente vuoto = Sì.
- Fattura pagata a rate: una riga per pagamento; sulle righe successive alla prima la data di emissione resta
  vuota e "Bollo al cliente" = No, così bollo per trimestre e numero di fatture emesse non si duplicano
  (spiegato nelle Istruzioni).

## Verifica (6/10/2026)

`python3 verifica.py` compila una copia del file vuoto per ogni scenario (una fattura con il ricavo
indicato, bollo a carico), la ricalcola con LibreOffice headless e confronta la Dashboard con
`calcolaForfettario()`. Differenza massima: **0,0000 €** su tutti i valori (reddito, contributi fissi e a
percentuale, imposta, totale, netto). Valori in euro, uguali nel foglio e in forfettario.js:

| Scenario | Reddito | Contributi | Imposta sostitutiva | Totale | Netto |
|---|---:|---:|---:|---:|---:|
| Gestione Separata, 40.000 € al 78% | 31.200,00 | 8.133,84 | 3.459,92 | 11.593,76 | 28.406,24 |
| Commercianti, 50.000 € al 40% | 20.000,00 | 4.903,44 | 2.264,48 | 7.167,93 | 42.832,07 |
| Artigiano, 30.000 € al 67%, riduzione 35% | 20.100,00 | 3.143,04 | 2.543,54 | 5.686,58 | 24.313,42 |
| Startup 5%, Gestione Separata, 30.000 € al 78% | 23.400,00 | 6.100,38 | 864,98 | 6.965,36 | 23.034,64 |
| GS pensionato, 25.000 € al 67% | 16.750,00 | 4.020,00 | 1.909,50 | 5.929,50 | 19.070,50 |
| Cassa 14,5%, 60.000 € al 78% | 46.800,00 | 6.786,00 | 6.002,10 | 12.788,10 | 47.211,90 |
| Artigiano, 95.000 € all'86% (oltre 56.224 € di reddito) | 81.700,00 | 19.870,20 | 9.274,47 | 29.144,67 | 65.855,33 |
| Commercianti, 20.000 € al 40% (sotto il minimale), riduzione 35% | 8.000,00 | 3.000,17 | 749,97 | 3.750,14 | 16.249,86 |
| Gestione Separata, 160.000 € al 78% (fuori regime, oltre il massimale) | 124.800,00 | 31.882,31 | 13.937,65 | 45.819,96 | 114.180,04 |
| Artigiano, 15.000 € al 67% (sotto il minimale, senza riduzione) | 10.050,00 | 4.521,36 | 829,30 | 5.350,66 | 9.649,34 |
| Gestione Separata, 90.000 € al 78% (oltre 85.000 €) | 70.200,00 | 18.301,14 | 7.784,83 | 26.085,97 | 63.914,03 |
| Artigiano, 120.000 € all'86% (oltre 100.000 €) | 103.200,00 | 25.245,20 | 11.693,22 | 36.938,42 | 83.061,58 |

Controlli a mano: commercianti 50.000 € → reddito 20.000; fissi 4.611,64; (20.000 − 18.808) × 24,48% =
291,80; imposta (20.000 − 4.903,44) × 15% = 2.264,48. Artigiano 30.000 € con riduzione → fissi
(4.521,36 − 7,44) × 0,65 + 7,44 = 2.941,49; (20.100 − 18.808) × 24% × 0,65 = 201,55; imposta
(20.100 − 3.143,04) × 15% = 2.543,54.

Artigiano 120.000 € → reddito 103.200; (56.224 − 18.808) × 24% = 8.979,84; (103.200 − 56.224) × 25% = 11.744;
con i fissi 4.521,36 fanno 25.245,20; imposta (103.200 − 25.245,20) × 15% = 11.693,22.

Altri controlli dello script: Scadenze senza acconti 2027 oltre 85.000 € e senza saldo 2026 oltre 100.000 €;
un file con dati sbagliati (compenso e data come testo, spesa con importo testuale, contributi versati
scritti come testo) senza celle in errore, con le righe escluse e i 4 controlli attesi; deduzione dei contributi versati ((31.200 − 5.000) × 15% = 3.930,00) e
saldo 2026 in Scadenze; messaggi delle soglie e avviso del minimale coerenti con forfettario.js; somma
mensile da accantonare = totale; file di esempio (incassato 37.212,80 €, spese 4.459,00 €, contributi
7.567,07 €, imposta 3.218,84 €, netto dopo le spese 21.967,89 €) uguale a un calcolo indipendente in
Python + forfettario.js, anche mese per mese; nessuna cella con errori in entrambi i file.

## Rigenerare

```bash
cd products/gestionale-forfettario-2026
python3 build.py              # files/*.xlsx (legge src/lib/params.js con node)
python3 verifica.py           # serve LibreOffice (soffice); esce con 1 se un controllo fallisce
python3 images/src/genera.py  # dati.js dal file di esempio ricalcolato, PNG con Playwright, card.jpg
```

`build.py` è deterministico: a parità di input cambiano solo la data di modifica nei metadati e i
timestamp dello zip xlsx. Le
immagini: `genera.py` scrive `images/src/dati.js` (valori ricalcolati del file di esempio), poi
`images/src/render.mjs` fotografa ogni `images/src/NN-*.html` a 2000×1500 (si ferma se un contenuto
esce dal riquadro) e `card.jpg` si ricava dalla copertina (≤ 200 KB).

## Aggiornamento annuale

1. Aggiorna `src/lib/params.js` (procedura in OPERATIONS.md): soglie, aliquote, coefficienti, INPS
   (circolari di gennaio-febbraio), bollo. `build.py` li rilegge da lì.
2. In `build.py`, valori che params.js non contiene: `ACCONTI` (50% per rata, 51,65 €, 103 €),
   `BOLLO_SOGLIA_RINVIO` (5.000 €), `SCADENZE` (date e note dell'anno nuovo, con proroghe), il testo
   del limite di reddito da lavoro dipendente ("35.000 € per il 2026"), le date di `ESEMPIO` e la data
   fissa dei metadati.
3. `SLUG` e nomi file contengono l'anno: per il 2027 crea `products/gestionale-forfettario-2027/`
   copiando la cartella (non rinominare questa, l'inserzione esistente la usa).
4. Rigenera, verifica, rigenera le immagini; aggiorna titolo, descrizione e tag in `listing.json`.

## Fonti delle scadenze (verificate a ottobre 2026)

- Contributi fissi artigiani/commercianti 2026: 18/05/2026 (16 maggio era sabato), 20/08/2026,
  16/11/2026, 16/02/2027 (circolare INPS 14/2026; informazionefiscale.it, edotto.com, leggioggi.it).
- Saldo 2025 e 1° acconto 2026 prorogati dal 30/06 al 20/07/2026 per forfettari e soggetti ISA, fino al
  20/08 con lo 0,80%: DL 22/5/2026 n. 89, art. 6 (mysolution.it, finanzaefisco.com, cafinforma.it).
  Anche i contributi INPS a percentuale seguono le scadenze delle imposte, proroga compresa (circolare
  INPS 62/2026; investireoggi.it, fiscoetasse.com).
- Acconti dell'imposta sostitutiva: due rate del 50% (art. 58 DL 124/2019), nessun acconto fino a
  51,65 €, unica rata a novembre se la prima è sotto 103 € (leggioggi.it, optlyx.com, fisco7.it).
  Codici tributo 1790, 1791, 1792 (fiscozen.it, partitaiva.it).
- Bollo fatture elettroniche: 1° trimestre entro il 1/6/2026 (31 maggio domenica), 2° entro il 30/9,
  3° entro il 30/11, 4° entro il 28/2 dell'anno dopo (2027: domenica, quindi 1/3); rinvio possibile fino
  a 5.000 € (DL 73/2022). Codici 2521-2524 (fiscal-focus.it, assolombarda.it, edotto.com).
- Principio di cassa anche per la soglia degli 85.000 €: circolare AdE 10/E/2016.

## Limiti noti

- Stima: non sostituisce il commercialista né la dichiarazione. Non gestisce minimi e contributo
  integrativo delle casse, altre riduzioni INPS (pensionati oltre 65 anni, nuovi iscritti 2025), IVA,
  crediti. Gli incassi parziali si registrano a mano (vedi sopra); il bollo della riga si calcola sul
  pagamento, non sul totale della fattura.
- Oltre 85.000 € il foglio non stima gli acconti IRPEF 2027 del regime ordinario.
- I file non contengono valori già calcolati (openpyxl scrive solo le formule): Excel ricalcola all'apertura,
  ma in "Visualizzazione protetta" le celle sembrano vuote finché non si fa clic su "Abilita modifica"
  (scritto nelle Istruzioni e nella descrizione).
- Gli acconti dei contributi INPS non sono stimati (percentuali diverse per gestione): il foglio
  Scadenze indica "Dalla dichiarazione".
- Le date del 2027 sono i termini ordinari: le proroghe vanno aggiunte quando escono.
- Lo "Stato" delle scadenze usa `TODAY()`: cambia da solo nel tempo.
