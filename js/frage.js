// Workflow B "Frage zuerst": answer for Switzerland (map + Kantone), then "Und bei uns?".
import { S, val, region, fmt, fmtUnit, shortName, regionLabel, quantiles, classOf, prefs, setPrefs } from './store.js?v=20261112003758';
import { createMap, legendHTML } from './map.js?v=20261112003758';
import { indicatorCard, plot, baseLayout, COLORS, rnd } from './cards.js?v=20261112003758';
import { exportItems, exportMenu, FORMATS } from './export.js?v=20261112003758';
import { omnibox } from './search.js?v=20261112003758';
import { esc, main } from './ui.js?v=20261112003758';

const DL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg>';

export function render(qid, id) {
  const q = S.q.get(qid);
  if (!q) { main().innerHTML = '<div class="wrap page"><p class="empty">Diese Frage gibt es nicht. <a href="#/themen">Alle Fragen</a></p></div>'; return; }
  const i = S.ind.get(q.ind); const sub = S.sub.get(q.sub); const r = id ? region(id) : null;
  if (r) setPrefs({ last: r.id });
  const lvl = i.levels.includes('GDE') ? 'GDE' : 'BEZ';
  const ids = S.regions.filter((x) => x.e === lvl).map((x) => x.id);
  const vals = ids.map((x) => val(i.id, x));
  const br = quantiles(vals);
  const kts = S.regions.filter((x) => x.e === 'KT').map((x) => ({ x, v: val(i.id, x.id) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
  const hi = kts[0]; const lo = kts[kts.length - 1];
  const others = S.meta.questions.filter((x) => x.id !== qid);
  main().innerHTML = `
  <section class="qhead"><div class="wrap qhead-in">
    <nav class="crumbs"><a href="#/themen">Themen</a><span class="sep">›</span><span class="dot ${sub.thema.color}"></span>${esc(sub.thema.label)}<span class="sep">›</span><a href="#/thema/${sub.id}">${esc(sub.label)}</a></nav>
    <h1>${esc(q.text)}</h1>
    <p class="answer-big">In der Schweiz: <b>${fmtUnit(val(i.id, 'CH'), i)}</b> <span class="muted" style="font-size:.8em">(${esc(i.label)})</span>.
      Am höchsten im Kanton ${esc(hi.x.n)} (${fmtUnit(hi.v, i)}), am tiefsten im Kanton ${esc(lo.x.n)} (${fmtUnit(lo.v, i)}).</p>
  </div></section>
  <div class="wrap page">
    <div class="q-grid">
      <article class="card"><div class="card-head"><h3>${esc(i.label)} – ${lvl === 'GDE' ? 'alle Gemeinden' : 'alle Bezirke'}</h3>
        <div class="card-tools no-print"><button class="icon-btn" id="xMap" aria-label="Werte aller ${lvl === 'GDE' ? 'Gemeinden' : 'Bezirke'} exportieren" aria-haspopup="menu" title="Werte aller ${lvl === 'GDE' ? 'Gemeinden' : 'Bezirke'} exportieren (Excel, CSV, PDF, PowerPoint)">${DL}</button></div></div>
        <p class="small muted">Klicken Sie auf ${lvl === 'GDE' ? 'eine Gemeinde' : 'einen Bezirk'}, um die Antwort dafür zu sehen.</p>
        <div id="qMap"></div><div class="small">${legendHTML(br, (x) => fmt(x, i), '')}</div>
        ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
        <p class="src-line">Quelle: ${esc(S.meta.sources[i.src].publisher)}, ${esc(S.meta.sources[i.src].name)} · ${esc(S.meta.sources[i.src].year)}</p></article>
      <div style="display:flex;flex-direction:column;gap:18px">
        <section class="us" aria-labelledby="usTitle"><h3 id="usTitle">${r ? `Und bei ${esc(shortName(r.id))}?` : 'Und bei uns?'}</h3>
          <div id="usSearch"></div>
          ${r ? `<p class="small"><a class="btn small primary" href="#/gemeinde/${r.id}">Alles zu ${esc(shortName(r.id))} →</a> <a class="btn small" href="#/gemeinde/${r.id}/${q.sub}">Thema ${esc(sub.label)} für ${esc(shortName(r.id))}</a></p>` : '<p class="small muted">Gemeinde, Bezirk oder Kanton suchen – oder auf der Karte anklicken.</p>'}
        </section>
        <div id="usCard"></div>
        <article class="card"><div class="card-head"><h3>Kantone im Vergleich</h3><div class="card-tools no-print"><button class="icon-btn" id="xKt" aria-label="Exportieren" aria-haspopup="menu" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV">${DL}</button></div></div><div id="ktChart" class="chart"></div></article>
      </div>
    </div>
    <h2 style="font-size:1.4rem">Mehr zu dieser Frage${r ? ` für ${esc(shortName(r.id))}` : ''}</h2>
    <div class="cards" id="moreCards"></div>
    <article class="card"><h3>Weitere Fragen</h3><ul class="qlist">${others.map((x) => `<li><a href="#/frage/${x.id}${r ? '/' + r.id : ''}">${esc(x.text)}</a></li>`).join('')}</ul></article>
  </div>`;
  const m = createMap(document.getElementById('qMap'), { onClick: (cid) => { location.hash = `#/frage/${qid}/${cid}`; },
    tip: (cid) => { const x = region(cid); return `<b>${esc(x.e === 'BEZ' ? 'Bezirk ' + x.n : x.n)}</b> (${x.kt}) · ${fmtUnit(val(i.id, cid), i)}`; } });
  m.setLevel(lvl === 'GDE' ? 'gde' : 'bez');
  m.choropleth(new Map(ids.map((x, k) => [x, classOf(vals[k], br)])));
  if (r && r.e !== 'CH') { m.select(lvl === 'BEZ' && r.e === 'GDE' ? r.bez : r.id); if (r.e === 'GDE' && lvl === 'GDE') m.peers(r.nb || []); }
  omnibox(document.getElementById('usSearch'), { id: 'omniUs', compact: true, placeholder: r ? 'Andere Gemeinde wählen …' : 'Gemeinde suchen …',
    filter: (it) => it.go.startsWith('#/gemeinde/'), onPick: (it) => { location.hash = `#/frage/${qid}/${it.go.split('/')[2]}`; } });
  if (r) document.getElementById('usCard').appendChild(indicatorCard(i.id, r.id, { mode: prefs().mode || 'kt' }));
  // Kantone ranking, own Kanton highlighted
  const myKt = r && r.e !== 'CH' ? r.kt : null;
  plot(document.getElementById('ktChart'), [{ type: 'bar', orientation: 'h', y: kts.map((d) => d.x.kt), x: kts.map((d) => d.v),
    marker: { color: kts.map((d) => (d.x.kt === myKt ? COLORS.me : COLORS.grey)) }, text: kts.map((d) => fmt(d.v, i)), textposition: 'outside', cliponaxis: false,
    customdata: kts.map((d) => d.x.n), hovertemplate: '%{customdata}: %{x}<extra></extra>' }],
  baseLayout({ height: 26 * kts.length + 40, margin: { l: 8, r: 50, t: 20, b: 4 }, yaxis: { autorange: 'reversed', automargin: true, tickfont: { size: 11 } }, xaxis: { visible: false },
    shapes: [{ type: 'line', x0: val(i.id, 'CH'), x1: val(i.id, 'CH'), yref: 'paper', y0: 0, y1: 1, line: { color: COLORS.ch, dash: 'dot', width: 1.5 } }],
    annotations: [{ x: val(i.id, 'CH'), yref: 'paper', y: 1, text: 'Schweiz', showarrow: false, font: { size: 11, color: COLORS.ch }, yanchor: 'bottom' }] }));
  // exports
  const unit = i.unit === 'pro 1000' ? 'von 1000' : i.unit;
  const src = `Quelle: ${S.meta.sources[i.src].publisher}, ${S.meta.sources[i.src].name} · ${S.meta.sources[i.src].year}`;
  const allRows = S.regions.filter((x) => x.e === lvl).map((x) => [x.n, x.e === 'GDE' ? x.bn : '', x.kt, x.pop, rnd(val(i.id, x.id), i.dec + 1)])
    .sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));
  const bt = document.getElementById('xMap');
  bt.onclick = () => exportMenu(bt, (f) => exportItems(f, [{ title: `${i.label} – alle ${lvl === 'GDE' ? 'Gemeinden' : 'Bezirke'}`, sheet: i.short,
    sentence: `${q.text} Schweiz: ${fmtUnit(val(i.id, 'CH'), i)}.`, source: src, definition: i.def, div: null,
    table: { columns: [lvl === 'GDE' ? 'Gemeinde' : 'Bezirk', lvl === 'GDE' ? 'Bezirk' : '', 'Kanton', 'Einwohner', `${i.short} (${unit})`], rows: allRows } }]),
  { formats: FORMATS.filter((x) => !x.needsChart) });
  const kdiv = document.getElementById('ktChart'); const bk = document.getElementById('xKt');
  bk.onclick = () => exportMenu(bk, (f) => exportItems(f, [{ title: `${i.label} – Kantone im Vergleich`, sheet: 'Kantone', sentence: '', source: src, definition: i.def, div: kdiv,
    table: { columns: ['Kanton', 'Kürzel', `${i.short} (${unit})`], rows: [...kts.map((d) => [d.x.n, d.x.kt, rnd(d.v, i.dec + 1)]), ['Schweiz', 'CH', rnd(val(i.id, 'CH'), i.dec + 1)]] } }]));
  const more = document.getElementById('moreCards');
  q.more.forEach((k) => more.appendChild(indicatorCard(k, r ? r.id : 'CH', { mode: prefs().mode || 'kt' })));
  window.scrollTo(0, 0);
}
