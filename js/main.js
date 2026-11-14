// Boot, router and top bar.
import { S, loadAll, mappe } from './store.js?v=20261114141402';
import * as landing from './landing.js?v=20261114141402';
import * as gemeinde from './gemeinde.js?v=20261114141402';
import * as frage from './frage.js?v=20261114141402';
import * as pages from './pages.js?v=20261114141402';
import { omnibox } from './search.js?v=20261114141402';
import { main } from './ui.js?v=20261114141402';

function updateMappeCount() {
  const n = mappe().length; const b = document.getElementById('mappeCount');
  b.textContent = n; b.hidden = n === 0;
}

async function route() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  landing.teardown(); gemeinde.teardown();
  const slot = document.getElementById('topSearchSlot');
  slot.style.visibility = parts.length ? 'visible' : 'hidden';
  const [p0, p1, p2, p3] = parts;
  try {
    if (!p0) landing.render();
    else if (p0 === 'gemeinde') await gemeinde.render(p1, p2, p3);
    else if (p0 === 'ausblick') await gemeinde.render(p1 || 'CH', '__ausblick');
    else if (p0 === 'frage') frage.render(p1, p2);
    else if (p0 === 'thema') pages.thema(p1);
    else if (p0 === 'themen') pages.themen();
    else if (p0 === 'favoriten' || p0 === 'mappe') pages.mappePage();   // old links #/mappe keep working
    else if (p0 === 'daten') pages.daten(p1);
    else if (['story', 'choice', 'sources', 'heroTitle'].includes(p0)) { /* in-page anchor on the landing page */ return; }
    else landing.render();
    document.title = titleFor(p0, p1);
  } catch (e) {
    console.error(e);
    main().innerHTML = `<div class="wrap page"><p class="empty">Diese Ansicht konnte nicht geladen werden. <a href="#/">Zur Startseite</a></p></div>`;
  }
}

function titleFor(p0, p1) {
  if (p0 === 'gemeinde' && S.byId.get(p1)) return `${S.byId.get(p1).n} · GAP-Insights`;
  if (p0 === 'frage' && S.q.get(p1)) return `${S.q.get(p1).text} · GAP-Insights`;
  return 'GAP-Insights';
}

// in-page anchors (#story, #choice, …) must not trigger the router
window.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a) return;
  const h = a.getAttribute('href');
  if (!h.startsWith('#/') && h.length > 1) {
    const t = document.getElementById(h.slice(1));
    if (t) { ev.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
});

(async function boot() {
  try {
    await loadAll();
  } catch (e) {
    main().innerHTML = '<div class="wrap page"><p class="empty">Die Daten konnten nicht geladen werden. Bitte die App über einen Webserver öffnen (z. B. <code>python -m http.server</code>).</p></div>';
    return;
  }
  document.getElementById('footYear').textContent = S.meta.jahr;
  omnibox(document.getElementById('topSearchSlot'), { id: 'omniTop', compact: true });
  document.addEventListener('mappe', updateMappeCount);
  updateMappeCount();
  window.addEventListener('hashchange', route);
  route();
})();
