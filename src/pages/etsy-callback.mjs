// Pagina tecnica di ritorno dell'autorizzazione Etsy (redirect_uri https://nettochiaro.com/etsy-callback/).
// Mostra code e state per incollarli nell'Action "Etsy: autorizzazione" (passo "completa"). Non invia dati.
// kind "page" e noindex: fuori dal menu (che mostra solo i tool) e fuori dalla sitemap.
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../../site.config.json', import.meta.url), 'utf8'));
const actions = config.repoUrl ? `${config.repoUrl.replace(/\/$/, '')}/actions/workflows/etsy-auth.yml` : '';
const azione = actions
  ? `<a href="${actions}" rel="noopener">Actions → Etsy: autorizzazione</a>`
  : '<strong>Actions → Etsy: autorizzazione</strong>';

export default {
  order: 98,
  kind: 'page',
  slug: 'etsy-callback',
  noindex: true,
  title: 'Collegamento del negozio Etsy',
  description: 'Pagina tecnica usata una sola volta per collegare il negozio Etsy di NettoChiaro alla pubblicazione automatica dei prodotti. Non invia dati.',
  h1: 'Collegamento del negozio Etsy',
  script: 'etsy-callback.js',
  content: `
<div id="etsy-callback">
  <p data-vista="carico">Lettura della risposta di Etsy…</p>

  <div data-vista="ok" hidden>
    <p>Etsy ha confermato l'autorizzazione. Copia i due valori e incollali su GitHub.</p>
    <div class="example fields">
      <label>code
        <input id="etsy-code" type="text" readonly autocomplete="off" spellcheck="false">
      </label>
      <button type="button" class="btn btn-secondary" data-copia="etsy-code">Copia code</button>
      <label>state
        <input id="etsy-state" type="text" readonly autocomplete="off" spellcheck="false">
      </label>
      <button type="button" class="btn btn-secondary" data-copia="etsy-state">Copia state</button>
    </div>
    <ol>
      <li>Apri ${azione} e premi <strong>Run workflow</strong>.</li>
      <li>In <strong>passo</strong> scegli <strong>completa</strong>.</li>
      <li>Incolla <strong>code</strong> e <strong>state</strong> nei due campi e premi <strong>Run workflow</strong>.</li>
    </ol>
    <p>Il code vale pochi minuti e una volta sola. Se scade, riapri il link di autorizzazione del passo <strong>avvia</strong> e ripeti.</p>
  </div>

  <div data-vista="errore" hidden>
    <p>Etsy non ha concesso l'autorizzazione: <code data-errore></code>.</p>
    <p>Se hai annullato per errore, riapri il link di autorizzazione del passo <strong>avvia</strong> e conferma.</p>
  </div>

  <div data-vista="vuoto" hidden>
    <p>Questa pagina serve solo durante il collegamento del negozio Etsy: Etsy la apre con un codice dopo che hai autorizzato l'app. Qui non c'è nessun codice da mostrare.</p>
    <p>Per collegare il negozio lancia ${azione} con il passo <strong>avvia</strong> e apri il link che trovi nel riepilogo del run.</p>
  </div>
</div>

<p class="small muted">La pagina non invia dati: code e state restano nel tuo browser finché non li incolli tu su GitHub. Da soli non danno accesso al negozio.</p>
`,
};
