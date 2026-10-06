// Pagina /prodotti/: i fogli di calcolo di NettoChiaro venduti su Etsy (products/, vedi products/README.md).
// Il contenuto dipende dai prodotti attivi: build.mjs chiama prepare({ products }) prima di generarla.
// Senza prodotti attivi la pagina esiste comunque, ma è noindex, fuori dalla sitemap e senza link dal footer.
import { esc, productItem } from '../layout.mjs';

const VUOTA = `
<p>I fogli di calcolo saranno disponibili a breve.</p>
<p>Nel frattempo puoi usare i <a href="/">calcolatori gratuiti</a> del sito.</p>
`;

// Descrizione Etsy (testo semplice con \n) in HTML. Blocchi separati da una riga vuota; una prima riga
// breve senza punteggiatura finale diventa un sottotitolo; righe "- ", "• " o "1. " diventano elenchi.
const VOCE = /^(?:([-•*])|\d+[.)])\s+(.*)$/;

export function descrizioneHtml(text) {
  const out = [];
  for (const block of String(text || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines[0].length <= 60 && !/[.,:;!?]$/.test(lines[0]) && !VOCE.test(lines[0])) {
      out.push(`<h3>${esc(lines.shift())}</h3>`);
    }
    let list = null;
    const chiudi = () => {
      if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };
    for (const line of lines) {
      const m = line.match(VOCE);
      const tag = m ? (m[1] ? 'ul' : 'ol') : null;
      if (list && list.tag !== tag) chiudi();
      if (!tag) {
        out.push(`<p>${esc(line)}</p>`);
        continue;
      }
      list ??= { tag, items: [] };
      list.items.push(m[2]);
    }
    chiudi();
  }
  return out.join('\n');
}

function contenuto(products) {
  const items = products.map((p, i) => productItem(p, {
    level: 2,
    eager: i === 0, // prima immagine visibile senza scorrere: niente lazy loading
    extra: p.description ? `
        <details class="product-details">
          <summary>Cosa contiene</summary>
          <div>${descrizioneHtml(p.description)}</div>
        </details>` : '',
  })).join('');
  return `
<ul class="product-list product-list-page">${items}</ul>

<h2>Prima di acquistare</h2>
<ul>
  <li>Il pulsante «Disponibile su Etsy» apre l'inserzione su Etsy in una nuova scheda.</li>
  <li>Pagamento e download avvengono su Etsy. Dopo il pagamento trovi i file nella pagina «Acquisti e recensioni» del tuo account Etsy o nel link dell'email di conferma.</li>
  <li>Sono file digitali: non ricevi nulla per posta.</li>
  <li>Il prezzo indicato è quello dell'inserzione. L'importo finale, con eventuali imposte, è quello che Etsy mostra prima del pagamento.</li>
</ul>
<p>I fogli servono a organizzare i conti e a fare stime: non sostituiscono un commercialista o un CAF. I calcolatori del sito restano gratuiti.</p>
`;
}

export default {
  order: 80,
  kind: 'page',
  slug: 'prodotti',
  navLabel: 'Fogli Excel',
  title: 'Fogli di calcolo per Excel e Google Sheets',
  description: 'Fogli di calcolo di NettoChiaro per Excel e Google Sheets: cosa contengono, a chi servono, prezzo e link all\'inserzione su Etsy.',
  h1: 'Fogli di calcolo per Excel e Google Sheets',
  noindex: true,
  content: VUOTA,
  prepare({ products }) {
    if (!products.length) return { noindex: true, intro: '', content: VUOTA };
    return {
      noindex: false,
      intro: `<p>${products.length === 1 ? 'Un foglio di calcolo preparato' : 'Fogli di calcolo preparati'} da NettoChiaro, da usare con Excel o Google Sheets. Si acquistano e si scaricano su Etsy.</p>`,
      content: contenuto(products),
    };
  },
};
