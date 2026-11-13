// Themen overview, one Thema (list of questions + Swiss values), Favoriten, Daten & Methodik.
import { S, val, mappe, setPrefs, prefs, shortName } from './store.js?v=20261113200622';
import { indicatorCard, indicatorItem } from './cards.js?v=20261113200622';
import { exportItems } from './export.js?v=20261113200622';
import { omnibox } from './search.js?v=20261113200622';
import { esc, main, toast } from './ui.js?v=20261113200622';

export function themen() {
  main().innerHTML = `<div class="wrap page"><div class="page-head"><div><span class="eyebrow">Frage zuerst</span><h2>Themen und Fragen</h2></div></div>
    <div class="themen-grid">${S.meta.themen.map((t) => `<article class="card"><h3 style="display:flex;gap:8px;align-items:center"><span class="dot ${t.color}"></span>${esc(t.label)}</h3>
      ${t.sub.map((s) => {
        const qs = S.meta.questions.filter((q) => q.sub === s.id);
        return s.soon ? `<p class="muted small">${esc(s.label)} · in Vorbereitung</p>`
          : `<div><a href="#/thema/${s.id}"><b>${esc(s.label)}</b></a>${qs.length ? `<ul class="qlist">${qs.map((q) => `<li><a href="#/frage/${q.id}">${esc(q.text)}</a></li>`).join('')}</ul>` : ''}</div>`;
      }).join('')}</article>`).join('')}</div></div>`;
  window.scrollTo(0, 0);
}

export function thema(subId) {
  const sub = S.sub.get(subId);
  if (!sub || sub.soon) { main().innerHTML = '<div class="wrap page"><p class="empty">Dieses Thema ist in Vorbereitung. <a href="#/themen">Alle Themen</a></p></div>'; return; }
  const qs = S.meta.questions.filter((q) => q.sub === subId);
  const last = prefs().last;
  main().innerHTML = `<section class="qhead"><div class="wrap qhead-in">
      <nav class="crumbs"><a href="#/themen">Themen</a><span class="sep">›</span><span class="dot ${sub.thema.color}"></span>${esc(sub.thema.label)}</nav>
      <h1>${esc(sub.label)}</h1>
      ${qs.length ? `<div class="chips">${qs.map((q) => `<a class="chip" href="#/frage/${q.id}">${esc(q.text)}</a>`).join('')}</div>` : ''}
    </div></section>
    <div class="wrap page">
      <section class="us"><h3>Für Ihre Gemeinde</h3><div id="themaSearch"></div>
        ${last ? `<p class="small"><a href="#/gemeinde/${last}/${subId}">${esc(sub.label)} für ${esc(shortName(last))} →</a></p>` : ''}</section>
      <h2 style="font-size:1.4rem">Die Schweiz im Überblick</h2>
      <div class="cards" id="themaCards"></div>
    </div>`;
  omnibox(document.getElementById('themaSearch'), { id: 'omniThema', compact: true, placeholder: 'Gemeinde suchen …',
    filter: (it) => it.go.startsWith('#/gemeinde/'), onPick: (it) => { location.hash = `${it.go}/${subId}`; } });
  const box = document.getElementById('themaCards');
  S.meta.indicators.filter((i) => i.sub === subId && i.zeit !== 'ausblick').forEach((i) => box.appendChild(indicatorCard(i.id, 'CH')));
  if ((S.meta.zeit[subId] || []).includes('ausblick')) box.insertAdjacentHTML('afterbegin', `<article class="card wide"><h3>Ausblick bis 2055</h3><p>Für dieses Thema gibt es Prognosen. <a class="btn small" href="#/gemeinde/CH/${subId}/ausblick">Ausblick Schweiz öffnen →</a></p></article>`);
  window.scrollTo(0, 0);
}

export function mappePage() {
  const items = mappe();
  main().innerHTML = `<div class="wrap page"><div class="page-head"><div><span class="eyebrow">Ihre Sammlung</span><h2>Favoriten</h2></div>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">${items.length ? `<span class="small muted" style="align-self:center">Alle Favoriten exportieren:</span>
        <button class="btn primary" type="button" data-mx="pptx">PowerPoint</button><button class="btn" type="button" data-mx="pdf">PDF</button>
        <button class="btn" type="button" data-mx="xlsx">Excel</button><button class="btn" type="button" data-mx="csv">CSV</button>
        <button class="btn ghost" type="button" id="print">Drucken</button><button class="btn ghost" type="button" id="clear">Favoriten leeren</button>` : ''}</div></div>
    ${items.length ? '<p class="muted no-print">Notizen werden in diesem Browser gespeichert und erscheinen im PDF.</p>' : `<div class="empty">Sie haben noch keine Favoriten. Fügen Sie Grafiken mit dem Stern ☆ als Favorit hinzu – zum Beispiel für einen Antrag an den Gemeinderat. <a href="#/">Zur Startseite</a></div>`}
    <div class="cards one" id="mappeCards"></div></div>`;
  const box = document.getElementById('mappeCards');
  items.forEach((it, k) => {
    if (!S.ind.has(it.ind) || !S.byId.has(it.id)) return;
    const wrap = document.createElement('div'); wrap.className = 'mappe-item';
    wrap.appendChild(indicatorCard(it.ind, it.id));
    const ta = document.createElement('textarea'); ta.id = `note-${k}`; ta.placeholder = 'Notiz zu dieser Grafik …'; ta.value = it.note || '';
    ta.addEventListener('input', () => { const m = mappe(); if (m[k]) { m[k].note = ta.value; setPrefs({ mappe: m }); } });
    wrap.appendChild(ta); box.appendChild(wrap);
  });
  document.getElementById('print')?.addEventListener('click', () => window.print());
  main().querySelectorAll('[data-mx]').forEach((b) => b.addEventListener('click', () => {
    const cur = mappe();
    const its = [...box.querySelectorAll('.mappe-item')].map((w, k) => {
      const it = cur[k]; if (!it) return null;
      return indicatorItem(it.ind, it.id, { div: w.querySelector('.chart'), note: w.querySelector('textarea').value });
    });
    exportItems(b.dataset.mx, its, { name: `GAP-Insights Favoriten ${new Date().toLocaleDateString('de-CH')}` });
  }));
  document.getElementById('clear')?.addEventListener('click', () => {
    const b = document.getElementById('clear');
    if (b.dataset.sure) { setPrefs({ mappe: [] }); document.dispatchEvent(new Event('mappe')); toast('Favoriten geleert'); mappePage(); }
    else { b.dataset.sure = '1'; b.textContent = 'Wirklich leeren?'; }
  });
  document.addEventListener('mappe', function once() { document.removeEventListener('mappe', once); if (location.hash === '#/favoriten' || location.hash === '#/mappe') mappePage(); });
  window.scrollTo(0, 0);
}

export function daten(anchor) {
  const M = S.meta;
  main().innerHTML = `<div class="wrap page"><div class="page-head"><div><span class="eyebrow">Transparenz</span><h2>Daten und Methodik</h2></div></div>
    <article class="card"><h3>Datenquellen</h3><div class="src-grid">${Object.values(M.sources).map((s) => `<div class="src-row"><span class="pub">${esc(s.publisher)}</span>
      <span>${esc(s.name)} · <span class="num">${esc(s.year)}</span><br><span class="use">${esc(s.use)}</span></span><a href="${s.url}" target="_blank" rel="noopener">↗</a></div>`).join('')}</div></article>
    <article class="card prose"><h3>Wie die Zahlen entstehen</h3>
      <p><b>Gemeinden.</b> Alle Werte beziehen sich auf den Gemeindestand vom 1.1.${M.jahr} (2131 Gemeinden, 143 Bezirke, 26 Kantone). Die Bevölkerungszahlen ${M.alter_jahre[0]}–${M.alter_jahre[1]} veröffentlicht das BFS rückwirkend auf diesem Stand.</p>
      <p><b>Pflegeheime.</b> Jedes Heim wird über die Postleitzahl seiner Adresse einer Gemeinde zugeordnet. Plätze pro Einwohner sind deshalb Standortwerte: Ein Heim versorgt auch Nachbargemeinden. Wie im ursprünglichen CoP-Dashboard werden 80 untypische Betriebe (mittlere Aufenthaltsdauer ab 8 Jahren oder Eintrittsalter bis 65) nicht mitgezählt.</p>
      <p><b>Spitex.</b> Organisationen sind über ihre Adresse einer Gemeinde zugeordnet. Organisationen ohne brauchbare Adresse oder mit Sitz ausserhalb des Bewilligungskantons werden nach Bevölkerung auf die Gemeinden ihres Kantons verteilt. Werte für einzelne Gemeinden sind deshalb Näherungen; Kantonswerte sind genau.</p>
      <p><b>Haushalte.</b> Privathaushalte nach Grösse stammen aus STATPOP ${M.jahr}. Werte zum Alleinleben im Alter stammen aus einer BFS-Tabelle mit dem Gemeindestand 2025; für 25 Gemeinden, die per 1.1.2025 fusioniert haben, liegt dort kein Wert vor. Sehr kleine Zahlen werden vom BFS aus Datenschutzgründen gerundet oder unterdrückt.</p>
      <p><b>Vergleiche.</b> Die Sätze vergleichen mit dem Kanton und der Schweiz: «etwa gleich» bei weniger als 3 % Unterschied (bei Anteilen 0.3 Prozentpunkte), «deutlich» ab 15 % (bei Anteilen 3 Prozentpunkte). Sie bewerten nicht, ob ein Wert gut oder schlecht ist.</p>
      <p><b>Jahre.</b> Spitex, Pflegeheime, Haushalte und Altersstruktur: ${M.jahr}. Bevölkerungsbewegungen: Durchschnitt ${M.periode[0]}–${M.periode[1]}. Datenstand der App: ${M.built}.</p>
      <p><b>Für Fachleute.</b> Die frei kombinierbaren Blasendiagramme aller Kennzahlen finden Sie im CoP-Dashboard (MAIN_CoP_Dashboard.html); das vollständige Datenmodell mit allen Attributen steht in <span class="num">data/unified/REF/REF_attribute.csv</span>.</p>
    </article>
    <article class="card prose" id="prognosen"><h3>Prognosen (Ausblick)</h3>
      <p>Prognosen hängen nicht nur von Daten ab, sondern von einem <b>Modell</b> und seinen <b>Annahmen</b>. Jede Prognose in GAP-Insights nennt deshalb Modell, Version, Variante und – wo nötig – wie sie auf Gemeinden übertragen wurde. Für jede Prognose gibt es zwei getrennte Verweise: auf die <b>Daten</b> und auf die <b>Methode</b>.</p>
      ${(() => {
        const seen = new Set(); return M.models.filter((m) => !seen.has(m.modell_id) && seen.add(m.modell_id)).map((m) => {
          const vs = M.models.filter((x) => x.modell_id === m.modell_id);
          const src = M.sources[m.modell_id === 'aph_dummy' ? 'aph_dummy' : 'bfs_szen'];
          return `<div class="model-box${m.status === 'platzhalter' ? ' ph' : ''}"><h4>${esc(m.name)} ${m.status === 'platzhalter' ? '<span class="pl-warn">Platzhalter</span>' : ''}</h4>
            <p class="small muted">${esc(m.herausgeber)} · Publikation ${m.publikation} · Basisjahr ${m.basisjahr} · Horizont ${m.horizont} · Quelle auf Ebene ${esc(m.ebene_quelle)}</p>
            <ul>${vs.map((x) => `<li><b>${esc(x.variante)}</b>${x.code ? ` (${esc(x.code)})` : ''}: ${esc(x.annahmen)}</li>`).join('')}</ul>
            <p><b>Regionalisierung:</b> ${esc(m.regionalisierung)}</p><p><b>Grenzen:</b> ${esc(m.grenzen)}</p>
            <p class="pl-links">${src.url ? `<a href="${src.url}" target="_blank" rel="noopener">Daten ↗</a>` : '<span class="muted">Daten: Platzhalter, keine externe Quelle</span>'}
              ${src.url_method && !src.url_method.startsWith('#') ? `<a href="${src.url_method}" target="_blank" rel="noopener">${esc(src.method_label)} ↗</a>` : ''}</p></div>`;
        }).join('');
      })()}
      <p><b>Übertragung der BFS-Szenarien auf Gemeinden (HSLU).</b> Das BFS rechnet die Szenarien für die Kantone. Für jede Gemeinde wird der beobachtete Bestand 2024 in jeder Altersgruppe (5 Jahre) und jedem Geschlecht mit der Entwicklung des Kantons in derselben Gruppe fortgeschrieben. Bezirke und Kantone sind die Summe ihrer Gemeinden; alle Varianten beginnen beim beobachteten Bestand 2024. Gemeindespezifische Zu- und Wegzüge sind nicht berücksichtigt – für kleine Gemeinden sind die Werte grobe Schätzungen. Prognosen werden gerundet angezeigt.</p>
    </article></div>`;
  if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
}
