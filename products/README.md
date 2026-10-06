# Prodotti digitali (Etsy + sito)

Ogni prodotto vive in `products/<slug>/` ed è rigenerabile da script. La sincronizzazione con Etsy
(`scripts/etsy/`, GitHub Actions) e il sito (`build.mjs`) leggono solo questi file.

```
products/<slug>/
  listing.json      metadati (schema sotto)
  build.py          rigenera i file in files/ (python3 + openpyxl), deterministico
  files/            file consegnati all'acquirente (max 5, ciascuno ≤ 20 MB)
  images/           immagini dell'inserzione: 01-cover.png ... (5-10, PNG/JPG, lato lungo ≥ 2000 px,
                    proporzione 4:3) + card.jpg (1200×900, ≤ 200 KB) per il sito
  README.md         cosa contiene, come si rigenera, limiti noti
products/etsy-listings.json   scritto SOLO dalla sync Etsy: { "<slug>": { "listing_id", "url", "state" } }
```

## listing.json

```json
{
  "slug": "gestionale-forfettario-2026",
  "language": "it",
  "title": "Titolo Etsy, max 140 caratteri, niente MAIUSCOLO intero",
  "short": "Frase per il sito, max 160 caratteri",
  "description": "Testo semplice con \n per gli a capo. Contiene: cosa ricevi, a chi serve, cosa fa, compatibilità (Excel, Google Sheets, LibreOffice), come si scarica, limiti, e la riga di trasparenza sull'uso dell'AI.",
  "tags": ["13 tag", "ciascuno max 20 caratteri", "solo lettere numeri spazi"],
  "price": 9.9,
  "quantity": 999,
  "who_made": "i_did",
  "when_made": "made_to_order",
  "is_supply": false,
  "taxonomy_path": ["percorso", "categoria", "Etsy leggibile"],
  "files": ["files/nome-file.xlsx"],
  "images": ["images/01-cover.png", "images/02-....png"],
  "site_pages": ["calcolo-tasse-forfettario"],
  "publish": true
}
```

Regole Etsy da rispettare:
- Attributo "Designed by seller" (`who_made: "i_did"`) e, nella descrizione, la frase di trasparenza:
  "Progettato da NettoChiaro con l'aiuto di strumenti di intelligenza artificiale; formule verificate
  con test." (in inglese per i prodotti in inglese).
- Niente promesse di guadagno, niente "consulenza fiscale", niente marchi altrui nel titolo oltre a
  "Excel" / "Google Sheets" usati per indicare la compatibilità.
- Prezzi in EUR (valuta del negozio).
