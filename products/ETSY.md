# Negozio Etsy: configurazione (una volta sola, circa 30 minuti)

Ogni prodotto in `products/` diventa un'inserzione nel tuo negozio Etsy. La pubblica e la aggiorna una
GitHub Action, da sola. Tu fai solo questi quattro passi.

## 1. Apri il negozio Etsy

1. Vai su <https://www.etsy.com/sell> ed entra con il tuo account (o creane uno).
2. Segui la procedura: paese Italia, lingua italiano, valuta euro (i prezzi dei prodotti sono in EUR; con
   un'altra valuta la sincronizzazione si ferma senza toccare le inserzioni).
   Etsy chiede il nome del negozio, l'IBAN per gli incassi, una carta per le commissioni e la verifica
   dell'identità.
3. Etsy chiede di creare almeno un'inserzione per aprire il negozio. Crea un prodotto digitale con il
   **titolo identico** a quello di un prodotto in `products/` (campo `"title"` di `listing.json`), con
   un'immagine e un file qualsiasi: la sincronizzazione lo riconosce dal titolo e lo completa.

## 2. Crea l'app su Etsy

Apri <https://www.etsy.com/developers/register> (serve il negozio già aperto) e compila così:

| Campo | Valore |
|---|---|
| Tipo di app | **Seller App** (solo il tuo negozio: approvazione quasi immediata) |
| Nome dell'app | `NettoChiaro Sync` (non usare la parola "Etsy") |
| Descrizione / perché usi l'API | testo qui sotto, in inglese |
| Sito web | `https://nettochiaro.com` |
| Chi userà l'app | **Just myself or colleagues** (solo io) |
| Tipo di applicazione | **Seller Tools** |
| Uso commerciale | **No** |

Descrizione da incollare:

```
Private tool for my own Etsy shop (NettoChiaro). It creates and updates my digital download listings (title, description, tags, price, images and files) from my own GitHub repository, and reads my order totals for my bookkeeping. Single user (me), runs a few times per week, no buyer personal data is stored.
```

Accetta i termini dell'API e crea l'app. Poi, nella scheda dell'app, tra i **callback URL** (redirect URI)
aggiungi esattamente `https://nettochiaro.com/etsy-callback/` (con la barra finale).
In <https://www.etsy.com/developers/your-apps> trovi **Keystring** e **Shared secret**.

Etsy può tenere la chiave "in revisione" da qualche giorno a qualche settimana: finché non è attiva il
passo 4 non funziona. Lo stato si vede nella stessa pagina.

## 3. Aggiungi i 2 segreti su GitHub

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nome | Valore |
|---|---|
| `ETSY_KEYSTRING` | il Keystring |
| `ETSY_SHARED_SECRET` | la Shared secret |

Non scriverli da nessun'altra parte (issue, commenti, file): il repository è pubblico.

## 4. Autorizza il negozio

1. Repository → **Actions** → **Etsy: autorizzazione** → **Run workflow**, passo **avvia** → **Run workflow**.
2. Apri il run appena partito: nel riepilogo (**Summary**) clicca **Autorizza NettoChiaro su Etsy** e
   conferma su Etsy.
3. Etsy apre `nettochiaro.com/etsy-callback/`, che mostra **code** e **state** con i pulsanti per copiarli.
   Se il sito non è ancora online, copia dalla barra degli indirizzi l'intero indirizzo della pagina.
4. Di nuovo **Etsy: autorizzazione** → **Run workflow**, passo **completa**: incolla code e state (oppure
   l'intero indirizzo nel campo code) → **Run workflow**. Fallo subito: il code scade dopo pochi minuti.

Fatto. La prima sincronizzazione parte da sola.

## Cosa succede dopo

- L'Action **Etsy: sincronizzazione** gira a ogni modifica di `products/` sul branch principale e ogni
  lunedì alle 05:00 UTC (le 7 in Italia con l'ora legale). Crea le inserzioni nuove (bozza, immagini, file,
  pubblicazione) e aggiorna solo quello che è cambiato.
- Scrive nel repository `products/etsy-listings.json` (link e stato delle inserzioni) e
  `products/etsy-sales.json` (solo totali di vendite e ricavi: nessun dato degli acquirenti).
- Il token di accesso è cifrato sul branch `etsy-state` e si rinnova da solo ogni settimana. Se l'Action
  resta ferma per più di 90 giorni, ripeti il passo 4.
- I commit sul branch `etsy-state` e quelli che aggiornano solo le vendite iniziano con `[skip ci]`, così
  Cloudflare Pages non li pubblica. Se Cloudflare prova comunque a pubblicare `etsy-state`: Workers & Pages →
  progetto → Settings → Builds → Branch control → escludi `etsy-state` dalle anteprime.
- I file arrivano agli acquirenti in automatico (download). Ordini, messaggi e recensioni li segui tu
  dall'app Etsy.
- Ogni run ha un riepilogo (Actions → run → Summary). Se un run fallisce, GitHub ti manda un'email e il
  riepilogo dice cosa fare.

## Costi Etsy (ottobre 2026)

- 0,20 $ per ogni inserzione pubblicata. Dura 4 mesi e si rinnova da sola (altri 0,20 $), e si rinnova
  anche dopo ogni vendita (0,20 $).
- 6,5% del prezzo su ogni vendita (commissione sulla transazione).
- 4% + 0,30 € per il pagamento (Etsy Payments, Italia).
- 0,32% di commissione regolamentare per l'Italia.
- Etsy può applicare l'IVA sulle sue commissioni. Alcuni negozi nuovi pagano una quota di apertura una
  tantum: Etsy la mostra durante l'apertura.

I ricavi sono reddito da dichiarare (vedi `SETUP.md`, punto 7).

## Come fermare tutto

- **Un prodotto**: in `products/<prodotto>/listing.json` metti `"publish": false`. Alla sincronizzazione
  successiva l'inserzione diventa inattiva e non si rinnova più.
- **La sincronizzazione**: Actions → **Etsy: sincronizzazione** → **⋯** → **Disable workflow**. Oppure
  cancella i due segreti.
- **L'accesso al negozio**: nelle impostazioni dell'account Etsy togli l'app dalle app collegate, poi
  cancella il branch `etsy-state` su GitHub.

## Problemi frequenti

| Messaggio | Cosa fare |
|---|---|
| mancano i segreti ETSY_KEYSTRING ed ETSY_SHARED_SECRET | passo 3 |
| manca l'autorizzazione del negozio | passo 4 |
| Etsy ha rifiutato il codice (invalid_grant) | il code è scaduto o già usato: riapri il link di **avvia** e ripeti subito **completa** |
| Rinnovo del token rifiutato | ripeti il passo 4 |
| Invalid API key / 403 | la chiave Etsy non è ancora attiva, oppure un segreto è sbagliato |
| Il negozio Etsy usa la valuta … | imposta l'euro come valuta del negozio su Etsy, poi rilancia la sincronizzazione |

Per una prova senza toccare il negozio: **Etsy: sincronizzazione** → **Run workflow** con **Solo prova**
spuntato. Il log elenca le chiamate che farebbe.

Nota: il repository è pubblico. Il riepilogo di **avvia** mostra il link di autorizzazione, che contiene
l'identificativo pubblico dell'app (lo stesso che Etsy mostra nella barra degli indirizzi), non la shared
secret. Senza la shared secret il link e il code non danno accesso al negozio. Il code incollato in
**completa** non compare nel log del run.
