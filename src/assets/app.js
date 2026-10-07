// Logica UI comune ai calcolatori. Ogni pagina tool importa calcolatore() e passa calcola/mostra.
import { parseNumero, euro, perc } from '/assets/lib/format.js';

export { parseNumero, euro, perc };

function leggi(form) {
  const v = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') v[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
    else v[el.name] = el.value;
  }
  return v;
}

const predefinita = (sel) => Math.max(0, [...sel.options].findIndex((o) => o.defaultSelected));

function applicaQuery(form) {
  const q = new URLSearchParams(location.search);
  for (const el of form.elements) {
    if (!el.name || !q.has(el.name)) continue;
    const val = q.get(el.name);
    if (el.type === 'checkbox') el.checked = val === '1';
    else if (el.type === 'radio') el.checked = el.value === val;
    else el.value = val;
    // Un link condiviso con opzioni diverse dal predefinito apre "Altre opzioni".
    const cambiato = el.type === 'checkbox' || el.type === 'radio' ? el.checked !== el.defaultChecked
      : el.tagName === 'SELECT' ? el.selectedIndex !== predefinita(el) : el.value !== el.defaultValue;
    const altre = el.closest('details');
    if (cambiato && altre) altre.open = true;
  }
}

// Al primo clic su un importo il valore di esempio è già selezionato: basta scrivere.
function selezionaAlFocus(form) {
  form.querySelectorAll('[data-num]').forEach((el) => {
    let appena = false;
    el.addEventListener('focus', () => { el.select(); appena = true; });
    el.addEventListener('mouseup', (e) => { if (appena) e.preventDefault(); appena = false; });
    el.addEventListener('blur', () => { appena = false; });
  });
}

function aggiornaVisibilita(form, valori) {
  form.querySelectorAll('[data-show-if]').forEach((el) => {
    const [nome, attesi] = el.dataset.showIf.split('=');
    const v = valori[nome];
    const visibile = attesi === undefined ? Boolean(v) : attesi.split('|').includes(String(v));
    el.hidden = !visibile;
  });
}

// Converte i campi marcati data-num in numeri; segnala quelli non validi.
function numeri(form, valori) {
  const out = { ...valori };
  form.querySelectorAll('[data-num]').forEach((el) => {
    const n = el.value.trim() === '' ? 0 : parseNumero(el.value);
    const valido = Number.isFinite(n) && n >= 0;
    el.setAttribute('aria-invalid', valido ? 'false' : 'true');
    out[el.name] = valido ? n * (el.dataset.num === 'perc' ? 0.01 : 1) : 0;
  });
  return out;
}

export function out(form, chiave, testo) {
  form.querySelectorAll(`[data-out="${chiave}"]`).forEach((el) => { el.textContent = testo; });
}

export function lista(form, chiave, voci) {
  form.querySelectorAll(`[data-list="${chiave}"]`).forEach((el) => {
    el.replaceChildren(...voci.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    el.hidden = voci.length === 0;
  });
}

// Barra impilata: parti = [{ etichetta, valore, classe }]
export function barra(form, parti) {
  const el = form.querySelector('[data-bar]');
  if (!el) return;
  const tot = parti.reduce((s, p) => s + Math.max(0, p.valore), 0) || 1;
  el.replaceChildren(...parti.map((p) => {
    const seg = document.createElement('span');
    seg.className = `seg ${p.classe}`;
    seg.style.width = `${(Math.max(0, p.valore) / tot) * 100}%`;
    seg.title = `${p.etichetta}: ${euro(p.valore)}`;
    return seg;
  }));
  const legenda = form.querySelector('[data-legend]');
  if (legenda) {
    legenda.replaceChildren(...parti.map((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="dot ${p.classe}"></i>`;
      li.append(`${p.etichetta} ${perc(Math.max(0, p.valore) / tot)}`);
      return li;
    }));
  }
}

// Su mobile, quando il riquadro dei risultati esce dallo schermo mentre compili i campi, il risultato
// principale resta visibile in una barra in basso (copia visiva: per gli screen reader c'è già aria-live).
function barraRisultato(form) {
  const principale = form.querySelector('.kpi.main');
  const risultati = form.querySelector('.results');
  if (!principale || !risultati || !('IntersectionObserver' in window)) return () => {};
  const barra = document.createElement('div');
  barra.className = 'barra-risultato';
  barra.setAttribute('aria-hidden', 'true');
  barra.hidden = true;
  const etichetta = document.createElement('span');
  const valore = document.createElement('strong');
  barra.append(etichetta, valore);
  form.after(barra);
  let risultatiVisibili = true;
  let formVisibile = true;
  const aggiornaVisibile = () => { barra.hidden = risultatiVisibili || !formVisibile; };
  new IntersectionObserver(([e]) => { risultatiVisibili = e.isIntersecting; aggiornaVisibile(); }).observe(risultati);
  new IntersectionObserver(([e]) => { formVisibile = e.isIntersecting; aggiornaVisibile(); }).observe(form.querySelector('.fields') || form);
  return () => {
    etichetta.textContent = principale.querySelector(':scope > span')?.textContent || '';
    valore.textContent = principale.querySelector('strong')?.textContent || '';
  };
}

export function calcolatore(selettore, calcola, mostra) {
  const form = document.querySelector(selettore);
  if (!form) return;
  applicaQuery(form);
  selezionaAlFocus(form);
  const copiaInBarra = barraRisultato(form);
  const aggiorna = () => {
    const grezzi = leggi(form);
    aggiornaVisibilita(form, grezzi);
    try {
      mostra(form, calcola(numeri(form, grezzi)));
    } catch (err) {
      console.error(err);
    }
    copiaInBarra();
  };
  form.addEventListener('input', aggiorna);
  form.addEventListener('change', aggiorna);
  form.addEventListener('submit', (e) => { e.preventDefault(); aggiorna(); });

  form.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(leggi(form))) q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : v);
      const link = `${location.origin}${location.pathname}?${q}`;
      try {
        await navigator.clipboard.writeText(link);
        btn.textContent = 'Link copiato';
      } catch {
        history.replaceState(null, '', `?${q}`);
        btn.textContent = 'Link aggiornato nella barra degli indirizzi';
      }
      setTimeout(() => { btn.textContent = 'Copia link a questo calcolo'; }, 2500);
    });
  });

  aggiorna();
}
