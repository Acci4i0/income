// /etsy-callback/: mostra code e state ricevuti da Etsy per incollarli nell'Action "Etsy: autorizzazione".
// Non invia nulla. Toglie i valori dalla barra degli indirizzi (così non finiscono in cronologia o
// statistiche) e li tiene in sessionStorage, per ritrovarli se la pagina viene ricaricata.
const KEY = 'nettochiaro-etsy-callback';
const root = document.getElementById('etsy-callback');

function leggi() {
  const q = new URLSearchParams(location.search);
  if (q.has('code') || q.has('error')) {
    const dati = {
      code: (q.get('code') || '').trim(),
      state: (q.get('state') || '').trim(),
      error: (q.get('error') || '').trim(),
      description: (q.get('error_description') || '').trim(),
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(dati)); } catch { /* storage non disponibile */ }
    history.replaceState(null, '', location.pathname);
    return dati;
  }
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

function mostra(vista) {
  root.querySelectorAll('[data-vista]').forEach((el) => { el.hidden = el.dataset.vista !== vista; });
}

async function copia(btn) {
  const input = document.getElementById(btn.dataset.copia);
  if (!input) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(input.value);
    ok = true;
  } catch {
    input.focus();
    input.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  if (!btn.dataset.testo) btn.dataset.testo = btn.textContent;
  btn.textContent = ok ? 'Copiato' : 'Selezionato: copia con Ctrl+C';
  setTimeout(() => { btn.textContent = btn.dataset.testo; }, 2500);
}

if (root) {
  const dati = leggi();
  if (dati?.error) {
    mostra('errore');
    root.querySelector('[data-errore]').textContent = dati.description ? `${dati.error} (${dati.description})` : dati.error;
  } else if (dati?.code && dati?.state) {
    document.getElementById('etsy-code').value = dati.code;
    document.getElementById('etsy-state').value = dati.state;
    mostra('ok');
  } else {
    mostra('vuoto');
  }
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copia]');
    if (btn) copia(btn);
  });
  root.addEventListener('focusin', (e) => {
    if (e.target.matches('input[readonly]')) e.target.select();
  });
}
