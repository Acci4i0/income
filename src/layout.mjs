// Layout HTML condiviso. Nessuna dipendenza: template string + escape.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function faqHtml(faq) {
  if (!faq?.length) return '';
  return `
    <section class="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Domande frequenti</h2>
      ${faq.map(({ q, a }) => `<details><summary>${esc(q)}</summary><div>${a}</div></details>`).join('\n')}
    </section>`;
}

function relatedHtml(page, pages) {
  const rel = (page.related || []).map((s) => pages.find((p) => p.slug === s)).filter(Boolean);
  if (!rel.length) return '';
  return `
    <section class="related">
      <h2>Altri calcolatori</h2>
      <ul class="cards">
        ${rel.map((p) => `<li><a class="card" href="/${p.slug}/"><strong>${esc(p.navLabel)}</strong><span>${esc(p.cardText || p.description)}</span></a></li>`).join('')}
      </ul>
    </section>`;
}

function toolCards(tools) {
  return `
    <ul class="cards home-cards">
      ${tools.map((p) => `<li><a class="card" href="/${p.slug}/"><strong>${esc(p.h1)}</strong><span>${esc(p.cardText || p.description)}</span></a></li>`).join('')}
    </ul>`;
}

const dataIt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export function renderPage(page, { config, pages, asset }) {
  const url = urlFor(config, page.slug);
  const title = page.slug ? `${page.title} | ${config.name}` : page.title;
  const tools = pages.filter((p) => p.kind === 'tool');
  const adsense = config.monetization?.adsenseClient;
  const cfToken = config.analytics?.cloudflareToken;
  const isTool = page.kind === 'tool';

  const nav = tools.map((p) => `<a href="/${p.slug}/"${p.slug === page.slug ? ' aria-current="page"' : ''}>${esc(p.navLabel)}</a>`).join('');

  const main = isTool ? `
    <nav class="crumbs" aria-label="Percorso"><a href="/">Home</a> <span aria-hidden="true">›</span> <span>${esc(page.navLabel)}</span></nav>
    <h1>${esc(page.h1)}</h1>
    <div class="lead">${page.intro}</div>
    <section class="tool" aria-label="Calcolatore">${page.tool}</section>
    ${offersFor(page, config)}
    <article class="prose">${page.content}</article>
    ${faqHtml(page.faq)}
    ${relatedHtml(page, pages)}
    <p class="disclaimer small muted">I risultati sono stime basate sulla normativa ${esc(page.year || '')} e su ipotesi semplificate indicate nella pagina. Non sostituiscono il parere di un commercialista o di un CAF. Aggiornato il ${dataIt(page.updated)}.</p>
  ` : `
    <h1>${esc(page.h1)}</h1>
    ${page.intro ? `<div class="lead">${page.intro}</div>` : ''}
    ${page.kind === 'home' ? toolCards(tools) : `<article class="prose">${page.content}</article>`}
    ${page.updated ? `<p class="small muted">Ultimo aggiornamento: ${dataIt(page.updated)}.</p>` : ''}
  `;

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
<meta name="theme-color" content="#0f766e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${asset('style.css')}">
${adsense ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(adsense)}" crossorigin="anonymous"></script>` : ''}
${structuredData(page, config)}
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">€</span>${esc(config.name)}</a>
    <nav class="site-nav" aria-label="Calcolatori">${nav}</nav>
  </div>
</header>
<main id="contenuto" class="wrap">
${main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p><strong>${esc(config.name)}</strong> · ${esc(config.tagline)}</p>
    <p class="footer-links"><a href="/chi-siamo/">Chi siamo e metodo</a> · <a href="/privacy/">Privacy e cookie</a>${config.contactEmail ? ` · <a href="mailto:${esc(config.contactEmail)}">Contatti</a>` : ` · <a href="${esc(config.repoUrl)}/issues" rel="noopener">Segnala un errore</a>`}</p>
    <p class="small muted">Strumenti gratuiti a scopo informativo. I calcoli avvengono nel tuo browser: gli importi che inserisci non vengono salvati né inviati, a meno che tu non condivida il link a un calcolo.</p>
  </div>
</footer>
${page.script ? `<script type="module" src="${asset(`tools/${page.script}`)}"></script>` : ''}
${cfToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfToken)}"}'></script>` : ''}
</body>
</html>
`;
}
