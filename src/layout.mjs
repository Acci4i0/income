// Layout HTML condiviso. Nessuna dipendenza: template string + escape.

import { euro } from './lib/format.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ogni <h2> senza attributi dei contenuti apre una sezione. Nelle pagine dei calcolatori le sezioni
// sono voci espandibili (<details>): la pagina resta corta, il testo resta nell'HTML per i motori di
// ricerca. Il testo prima del primo <h2> resta fuori; i titoli con attributi (es. <h2 class="product-name">
// in /prodotti/) non spezzano il contenuto.
function sezioni(html, { chiuse = false } = {}) {
  return String(html).split(/(?=<h2>)/).map((parte) => {
    const m = parte.match(/^(<h2>[\s\S]*?<\/h2>)([\s\S]*)$/);
    if (!m) return parte;
    return chiuse
      ? `<details class="sec"><summary>${m[1]}</summary><div class="sec-body">${m[2]}</div></details>`
      : `<section class="sec">${m[1]}${m[2]}</section>`;
  }).join('');
}

const stripTags = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function urlFor(config, slug) {
  return `${config.baseUrl.replace(/\/$/, '')}/${slug ? `${slug}/` : ''}`;
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function structuredData(page, config) {
  const url = urlFor(config, page.slug);
  const blocks = [];
  if (!page.slug) {
    blocks.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: config.name, url, inLanguage: 'it-IT' });
  } else {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: config.name, item: urlFor(config, '') },
        { '@type': 'ListItem', position: 2, name: page.navLabel || page.h1, item: url },
      ],
    });
  }
  if (page.kind === 'tool') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.h1,
      url,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      inLanguage: 'it-IT',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      dateModified: page.updated,
    });
  }
  if (page.faq?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })),
    });
  }
  return blocks.map(jsonLd).join('\n');
}

function offersFor(page, config) {
  const offers = (config.monetization?.offers || []).filter((o) => o.url && o.pages?.includes(page.slug));
  if (!offers.length) return '';
  const items = offers.map((o) => `
      <li class="offer">
        <span class="offer-label">${esc(o.label || 'Partner')}</span>
        <strong>${esc(o.title)}</strong>
        <p>${esc(o.text)}</p>
        <a class="btn btn-secondary" href="${esc(o.url)}" rel="sponsored nofollow noopener" target="_blank">${esc(o.cta || 'Scopri')}</a>
      </li>`).join('');
  return `
    <aside class="offers" aria-label="Strumenti consigliati">
      <h2>Strumenti utili</h2>
      <ul>${items}</ul>
      <p class="small muted">Alcuni link sono di affiliazione: se acquisti, il sito può ricevere una commissione. Non cambia il prezzo per te e non influenza i calcoli.</p>
    </aside>`;
}

// Prodotti digitali venduti su Etsy (preparati da build.mjs). Prodotti del sito, non affiliazioni:
// niente rel="sponsored".
export function productItem(p, { level = 3, extra = '', eager = false } = {}) {
  return `
      <li class="product">
        <img class="product-img" src="${esc(p.image)}" width="1200" height="900" alt="Anteprima: ${esc(p.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
        <div class="product-body">
          <span class="offer-label">Prodotto NettoChiaro</span>
          <h${level} class="product-name">${esc(p.name)}</h${level}>
          <p>${esc(p.short)}</p>
          <p class="product-price">${esc(euro(p.price))}</p>
          <a class="btn" href="${esc(p.url)}" rel="noopener" target="_blank">Disponibile su Etsy</a>
        </div>${extra}
      </li>`;
}

function productsFor(page, products) {
  const list = (products || []).filter((p) => p.sitePages.includes(page.slug));
  if (!list.length) return '';
  const uno = list.length === 1;
  return `
    <aside class="products" aria-labelledby="prodotti-box">
      <h2 id="prodotti-box">${uno ? 'Foglio di calcolo' : 'Fogli di calcolo'}</h2>
      <ul class="product-list">${list.map((p) => productItem(p)).join('')}</ul>
      <p class="small muted">${uno ? 'È un prodotto' : 'Sono prodotti'} di NettoChiaro: acquisto e download avvengono su Etsy. I calcolatori del sito restano gratuiti.</p>
    </aside>`;
}

function faqHtml(faq) {
  if (!faq?.length) return '';
  return `
    <section class="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Domande frequenti</h2>
      ${faq.map(({ q, a }) => `<details><summary>${esc(q)}</summary><div>${a}</div></details>`).join('\n')}
    </section>`;
}

// Elenco dei calcolatori: home (grande) e "Altri calcolatori".
function elenco(list, cls = 'list') {
  return `
    <ul class="${cls}">
      ${list.map((p) => `<li><a href="/${p.slug}/">${esc(p.navLabel)}<span aria-hidden="true">→</span></a></li>`).join('')}
    </ul>`;
}

function relatedHtml(page, pages) {
  const rel = (page.related || []).map((s) => pages.find((p) => p.slug === s)).filter(Boolean);
  if (!rel.length) return '';
  return `
    <section class="related">
      <h2>Altri calcolatori</h2>
      ${elenco(rel)}
    </section>`;
}

const dataIt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export function renderPage(page, { config, pages, asset, products = [] }) {
  const url = urlFor(config, page.slug);
  const title = page.slug ? `${page.title} | ${config.name}` : page.title;
  const tools = pages.filter((p) => p.kind === 'tool');
  const adsense = config.monetization?.adsenseClient;
  const cfToken = config.analytics?.cloudflareToken;
  const isTool = page.kind === 'tool';

  const main = isTool ? `
    <h1>${esc(page.h1)}</h1>
    <div class="lead">${page.intro}</div>
    <section class="tool" aria-label="Calcolatore">${page.tool}</section>
    ${productsFor(page, products)}
    ${offersFor(page, config)}
    <article class="prose">${sezioni(page.content, { chiuse: true })}</article>
    ${faqHtml(page.faq)}
    ${relatedHtml(page, pages)}
    <p class="disclaimer">Stime basate sulla normativa ${esc(page.year || '')}${page.fonti ? ` (${esc(page.fonti)})` : ''}. Non sostituiscono un commercialista o un CAF. Aggiornato il ${dataIt(page.updated)}.</p>
  ` : page.kind === 'home' ? `
    <h1 class="home-title">${esc(page.h1)}</h1>
    ${page.intro ? `<div class="lead">${page.intro}</div>` : ''}
    ${elenco(tools, 'list list-home')}
    ${productsFor(page, products)}
  ` : `
    <h1>${esc(page.h1)}</h1>
    ${page.intro ? `<div class="lead">${page.intro}</div>` : ''}
    <article class="prose">${sezioni(page.content)}</article>
    ${productsFor(page, products)}
    ${page.updated ? `<p class="disclaimer">Ultimo aggiornamento: ${dataIt(page.updated)}.</p>` : ''}
  `;

  const contatto = config.contactEmail
    ? `<a href="mailto:${esc(config.contactEmail)}">Contatti</a>`
    : `<a href="${esc(config.repoUrl)}/issues" rel="noopener">Segnala un errore</a>`;
  const linkSito = ['<a href="/chi-siamo/">Chi siamo e metodo</a>', products.length ? '<a href="/prodotti/">Fogli Excel</a>' : '', '<a href="/privacy/">Privacy e cookie</a>', contatto].filter(Boolean);

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
${config.indexable && !page.noindex ? '' : '<meta name="robots" content="noindex">'}
${config.verification?.google ? `<meta name="google-site-verification" content="${esc(config.verification.google)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset('style.css')}">
${adsense ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(adsense)}" crossorigin="anonymous"></script>` : ''}
${structuredData(page, config)}
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<header class="site-header wrap">
  <a class="brand" href="/">${esc(config.name)}</a>
</header>
<main id="contenuto" class="wrap">
${main}
</main>
<footer class="site-footer wrap">
  <nav aria-label="Calcolatori"><ul>${tools.map((p) => `<li><a href="/${p.slug}/">${esc(p.navLabel)}</a></li>`).join('')}</ul></nav>
  <nav aria-label="Informazioni"><ul class="footer-links">${linkSito.map((l) => `<li>${l}</li>`).join('')}</ul></nav>
  <p>I calcoli avvengono nel tuo browser: gli importi che inserisci non vengono salvati né inviati, a meno che tu non condivida il link a un calcolo.</p>
</footer>
${page.script ? `<script type="module" src="${asset(`tools/${page.script}`)}"></script>` : ''}
${cfToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfToken)}"}'></script>` : ''}
</body>
</html>
`;
}
