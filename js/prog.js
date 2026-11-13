// Ausblick (forecasts): declared models, variant/year selection, fan chart, forecast cards, overview page.
import { S, region, parents, shortName, regionLabel, fmtInt, fmt, prefs, setPrefs, detail, dataUrl, srcLink, compareWord } from './store.js?v=20261113200622';
import { plot, baseLayout, COLORS as C, rnd } from './cards.js?v=20261113200622';
import { exportItems, exportMenu, FORMATS } from './export.js?v=20261113200622';
import { esc } from './ui.js?v=20261113200622';

let PV = null;
export async function loadProg() {
  if (!PV) PV = fetch(dataUrl('values_prog.json')).then((r) => r.json());
  return PV;
}
export const progState = () => ({ v: prefs().variant || S.meta.prog.default_variant, j: +(prefs().zieljahr || S.meta.prog.default_year) });
export const isProg = (indId) => (S.ind.get(indId) || {}).zeit === 'ausblick';

export function pval(P, indId, id, v, j) {
  const t = P.v[indId]; const yi = P.years.indexOf(+j); const ri = S.idx.get(id);
  if (!t || yi < 0 || ri === undefined) return null;
  return t[v][yi][ri];
}
const VNAME = { tief: 'tief', mittel: 'mittel', hoch: 'hoch' };
export const model = (mid, v) => S.meta.models.find((m) => m.modell_id === mid && m.variante_id === v) || S.meta.models.find((m) => m.modell_id === mid);

/** round forecasts so they do not suggest false precision */
export function roundProg(x, unit) {
  if (x == null) return null;
  if (unit === '%' || unit === 'pro 100') return Math.round(x * 10) / 10;
  const a = Math.abs(x);
  const step = a < 100 ? 1 : a < 10000 ? 10 : a < 100000 ? 100 : 1000;
  return Math.round(x / step) * step;
}
const fmtP = (x, i) => (x == null ? '–' : i.unit === '%' ? `${fmt(roundProg(x, '%'), { dec: 1 })} %` : i.unit === 'pro 100' ? `${fmt(roundProg(x, i.unit), { dec: 1 })} pro 100` : `${fmtInt(roundProg(x, i.unit))}${i.unit === 'Plätze' ? ' Plätze' : ''}`);
const pct = (a, b) => (b ? (a / b - 1) * 100 : null);
/** round axis step: 1, 2 or 5 × 10^n, about four ticks per side */
const niceStep = (m) => { const r = m / 4; const p = 10 ** Math.floor(Math.log10(r || 1)); return [1, 2, 5, 10].map((f) => f * p).find((s) => s >= r); };
const sign = (x) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), { dec: 0 })} %`);

// ------------------------------------------------------------------ Prognose-Etikett (declaration + controls)
export function progLabel(mid, onChange) {
  const st = progState(); const m = model(mid, st.v); const src = S.meta.sources[mid === 'aph_dummy' ? 'aph_dummy' : 'bfs_szen'];
  const ph = m.status === 'platzhalter';
  const el = document.createElement('div'); el.className = `plabel${ph ? ' ph' : ''}`;
  el.innerHTML = `
    <div class="pl-head"><span class="pl-kind">${ph ? 'Platzhalter-Prognose' : 'Prognose'}</span>
      <b>${esc(m.name)}</b><span class="pl-meta">${esc(m.herausgeber)} · Publikation ${m.publikation} · Basisjahr ${m.basisjahr}</span>
      ${ph ? '<span class="pl-warn">nicht für Planungsentscheide – wird durch das Projektmodell ersetzt</span>' : ''}</div>
    <div class="pl-ctrl">
      <div><span class="pl-lab">Variante</span><div class="seg" role="group" aria-label="Variante">${S.meta.prog.variants.slice().reverse().map((v) =>
        `<button type="button" data-v="${v}" aria-pressed="${v === st.v}">${mid === 'aph_dummy' ? 'Basis BFS ' : 'BFS '}${VNAME[v]}</button>`).join('')}</div></div>
      <div><span class="pl-lab">Zieljahr</span><div class="seg" role="group" aria-label="Zieljahr">${S.meta.prog.years.map((y) =>
        `<button type="button" data-j="${y}" aria-pressed="${y === st.j}">${y}</button>`).join('')}</div></div>
    </div>
    <details class="pl-more"><summary>Annahmen, Regionalisierung und Quellen</summary>
      <p><b>Variante:</b> ${esc(m.variante)}${m.code ? ` (${esc(m.code)})` : ''}. ${esc(m.annahmen)}</p>
      <p><b>Regionalisierung:</b> ${esc(m.regionalisierung)}</p>
      <p><b>Grenzen:</b> ${esc(m.grenzen)}</p>
      <p class="pl-links">${src.url ? `<a href="${src.url}" target="_blank" rel="noopener">Daten ↗</a>` : '<span class="muted">Daten: Platzhalter (keine externe Quelle)</span>'}
        ${src.url_method ? `<a href="${src.url_method}" ${src.url_method.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${esc(src.method_label || 'Methode')}${src.url_method.startsWith('#') ? ' →' : ' ↗'}</a>` : ''}
        ${src.url_reg ? `<a href="${src.url_reg}">${esc(src.reg_label)} →</a>` : ''}</p>
    </details>`;
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-v],button[data-j]'); if (!b) return;
    if (b.dataset.v) setPrefs({ variant: b.dataset.v }); else setPrefs({ zieljahr: +b.dataset.j });
    onChange();
  });
  return el;
}

/** forecast source line as HTML: declaration plus links to data and method */
export function progSourceHTML(mid) {
  const src = S.meta.sources[mid === 'aph_dummy' ? 'aph_dummy' : 'bfs_szen'];
  const links = [src.url ? srcLink(src.url, 'Daten') : '', src.url_method ? srcLink(src.url_method, src.url_method.startsWith('#') ? (src.method_label || 'Methode') : 'Methode') : '', src.url_reg ? srcLink(src.url_reg, src.reg_label) : ''].filter(Boolean);
  return `<span>${esc(progSourceLine(mid))}</span>${links.length ? ` <span>·</span> ${links.join(' <span>·</span> ')}` : ''}`;
}
export function progSourceLine(mid) {
  const st = progState(); const m = model(mid, st.v);
  return `Prognose: ${m.name} · ${m.variante} · Zieljahr ${st.j}${m.status === 'platzhalter' ? ' · PLATZHALTER' : ''}`;
}

// ------------------------------------------------------------------ forecast card (one indicator, one region)
export async function progCard(indId, id) {
  const P = await loadProg(); const i = S.ind.get(indId); const r = region(id); const { v, j } = progState();
  const base = S.meta.prog.years[0] ? P.years[0] : 2024;
  const val0 = pval(P, indId, id, v, base); const valj = pval(P, indId, id, v, j);
  const r1 = pval(P, indId, id, 'tief', j); const r2 = pval(P, indId, id, 'hoch', j);
  const lo = r1 == null || r2 == null ? null : Math.min(r1, r2); const hi = r1 == null || r2 == null ? null : Math.max(r1, r2);   // range always low → high
  const m = model(i.modell, v); const ph = m.status === 'platzhalter';
  const where = r.e === 'CH' ? 'in der Schweiz' : r.e === 'KT' ? `im Kanton ${r.n}` : r.e === 'BEZ' ? `im Bezirk ${r.n}` : `in ${r.n}`;
  const share = i.unit === '%' || i.unit === 'pro 100';
  const who = ph ? `Gemäss Platzhaltermodell (Basis BFS ${v})` : `Gemäss BFS-Szenario ${v}`;
  const what = i.short.replace(' (Prognose)', '');
  const NOUN = { p_bev: 'Einwohnerinnen und Einwohner', p_b65: 'Menschen ab 65', p_b80: 'Menschen ab 80' };
  const today = (x) => { const a = pval(P, 'p_aph', x, v, j); const b = pval(P, 'p_aph_diff', x, v, j); return a == null || b == null ? null : a - b; };
  const exact = (x) => (x == null ? '–' : fmtInt(Math.round(x)));
  let sent;
  if (valj == null) sent = 'Für diese Region liegt keine Prognose vor.';
  else if (share) sent = `${who} beträgt der Wert «${esc(what)}» ${j} ${where} <b>${fmtP(valj, i)}</b> (${base}: ${fmtP(val0, i)}). Spannweite tief–hoch: ${fmtP(lo, i)} bis ${fmtP(hi, i)}.`;
  else if (indId === 'p_aph_diff') sent = `${who} bräuchte es ${j} ${where} <b>${valj >= 0 ? 'rund ' + fmtP(valj, i) + ' mehr' : 'rund ' + fmtP(-valj, i) + ' weniger'}</b> Pflegeheimplätze als heute. Spannweite tief–hoch: ${fmtP(lo, i)} bis ${fmtP(hi, i)}.`;
  else if (indId === 'p_aph') sent = `${who} bräuchte es ${j} ${where} <b>rund ${fmtP(valj, i)}</b> (Bedarf ${base} gemäss Modell: ${fmtP(val0, i)}; heute vorhanden: ${exact(today(id))} Plätze). Spannweite tief–hoch: ${fmtP(lo, i)} bis ${fmtP(hi, i)}.`;
  else sent = `${who} leben ${j} ${where} <b>rund ${fmtP(valj, i)}</b> ${esc(NOUN[indId] || what)} (${base}: ${exact(val0)}, ${sign(pct(valj, val0))}). Spannweite tief–hoch: ${fmtP(lo, i)} bis ${fmtP(hi, i)}.`;
  const card = document.createElement('article'); card.className = 'card'; card.id = `ind-${indId}`;
  card.innerHTML = `<div class="card-head"><h3>${esc(i.label)}</h3><div class="card-tools no-print">
      <button class="icon-btn" data-act="export" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV" aria-label="Exportieren" aria-haspopup="menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg></button></div></div>
    ${ph ? '<p class="ph-flag">Platzhalter – nicht für Planungsentscheide</p>' : ''}
    <p class="key-sentence">${sent}</p><div class="chart"></div>
    ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
    <details class="how"><summary>Wie wird das berechnet?</summary><p>${esc(i.def)}</p><p>${esc(m.regionalisierung)}</p></details>
    <p class="src-line">${progSourceHTML(i.modell)}</p>`;
  // bars: change 2024 -> j (counts) or value in j (shares) for region, Bezirk, Kanton, Schweiz
  const ids = [id, ...parents(id)];
  const rows = ids.map((x) => {
    const a = pval(P, indId, x, v, base); const b = pval(P, indId, x, v, j);
    if (indId === 'p_aph_diff') { const t = today(x); return { x, y: t ? (b / t) * 100 : null }; }   // in % of today's places
    return { x, y: share ? b : pct(b, a) };
  }).filter((d) => d.y != null);
  const div = card.querySelector('.chart');
  const lab = share ? `${i.short.replace(' (Prognose)', '')} ${j}` : indId === 'p_aph_diff' ? `Zusätzliche Plätze ${j} in % der heutigen Plätze` : `Veränderung ${base}–${j} in %`;
  requestAnimationFrame(() => {
    plot(div, [{ type: 'bar', orientation: 'h', y: rows.map((d) => (d.x === id ? `<b>${shortName(d.x)}</b>` : shortName(d.x))), x: rows.map((d) => d.y),
      marker: { color: rows.map((d) => (d.x === id ? C.me : d.x === 'CH' ? C.ch : region(d.x).e === 'KT' ? C.kt : C.bez)) },
      text: rows.map((d) => (share ? fmtP(d.y, i) : sign(d.y))), textposition: 'outside', cliponaxis: false, hoverinfo: 'skip' }],
    baseLayout({ height: 46 * rows.length + 46, margin: { l: 8, r: 70, t: 22, b: 4 }, yaxis: { autorange: 'reversed', automargin: true },
      xaxis: { visible: false, rangemode: 'tozero' }, bargap: 0.35,
      annotations: [{ text: lab, xref: 'paper', yref: 'paper', x: 0, y: 1.02, yanchor: 'bottom', xanchor: 'left', showarrow: false, font: { size: 11, color: C.muted } }] }));
    div._table = { columns: ['Region', `${base}`, ...S.meta.prog.variants.map((vv) => `${j} BFS ${vv}`)],
      rows: ids.map((x) => [x === 'CH' ? 'Schweiz' : shortName(x), rnd(pval(P, indId, x, 'mittel', base), 2), ...S.meta.prog.variants.map((vv) => rnd(pval(P, indId, x, vv, j), 2))]) };
  });
  const btn = card.querySelector('[data-act="export"]');
  btn.onclick = () => exportMenu(btn, (f) => exportItems(f, [{ title: `${i.label} – ${r.e === 'CH' ? 'Schweiz' : shortName(id)} – ${j} (${ph ? 'Platzhalter, ' : ''}BFS ${v})`, sheet: i.short,
    sentence: sent, source: progSourceLine(i.modell), definition: `${i.def} Modell: ${m.name}; Variante: ${m.variante}; Regionalisierung: ${m.regionalisierung} Grenzen: ${m.grenzen}`,
    div: div.data ? div : null, table: div._table }]));
  return card;
}

// ------------------------------------------------------------------ fan chart: observed past + tief–hoch band + selected variant
export function fanChart(div, id, d, key, opts = {}) {
  const { v, j } = progState(); const p = d.prog; if (!p) return;
  const lab = { bev: 'Bevölkerung', b65: 'Menschen ab 65', b80: 'Menschen ab 80', aph: 'Benötigte Pflegeheimplätze' }[key];
  const data = [];
  if (key !== 'aph') data.push({ type: 'scatter', mode: 'lines', x: d.ts.y, y: d.ts[key], name: 'beobachtet', line: { color: C.ink, width: 2.5 },
    hovertemplate: '%{x}: %{y:,.0f} (beobachtet)<extra></extra>' });
  data.push({ type: 'scatter', mode: 'lines', x: p.y, y: p.tief[key], name: 'BFS tief', line: { width: 0 }, showlegend: false, hoverinfo: 'skip' });
  data.push({ type: 'scatter', mode: 'lines', x: p.y, y: p.hoch[key], name: 'Spannweite tief–hoch', fill: 'tonexty', fillcolor: 'rgba(27,103,178,0.16)', line: { width: 0 }, hoverinfo: 'skip' });
  for (const vv of ['tief', 'mittel', 'hoch']) {
    data.push({ type: 'scatter', mode: 'lines', x: p.y, y: p[vv][key], name: `${key === 'aph' ? 'Basis ' : ''}BFS ${vv}`,
      line: { color: vv === v ? C.me : C.kt, width: vv === v ? 3 : 1.2, dash: vv === v ? 'solid' : 'dot' },
      hovertemplate: `BFS ${vv} %{x}: %{y:,.0f}<extra></extra>` });
  }
  const yi = p.y.indexOf(j); const yj = p[v][key][yi];
  const shapes = [{ type: 'line', x0: 2024, x1: 2024, yref: 'paper', y0: 0, y1: 1, line: { color: C.muted, width: 1, dash: 'dash' } }];
  const ann = [{ x: 2024, yref: 'paper', y: 1, text: 'heute', showarrow: false, yanchor: 'bottom', font: { size: 11, color: C.muted } },
    { x: j, y: yj, text: `${j}: ${fmtInt(roundProg(yj))}`, showarrow: true, arrowhead: 0, ax: 0, ay: -34, font: { size: 12, color: C.me }, bgcolor: 'rgba(255,255,255,0.85)' }];
  if (key === 'aph') {
    shapes.push({ type: 'line', x0: 2024, x1: 2055, y0: p.aph_heute, y1: p.aph_heute, line: { color: C.ink, width: 2 } });
    ann.push({ x: 2055, y: p.aph_heute, text: `Plätze heute: ${fmtInt(p.aph_heute)}`, showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { size: 11, color: C.ink } });
  }
  plot(div, data, baseLayout({ height: 360, showlegend: true, legend: { orientation: 'h', y: -0.16 }, margin: { l: 56, r: 16, t: 24, b: 50 },
    xaxis: { gridcolor: '#eef1f3', dtick: 5 }, yaxis: { gridcolor: '#eef1f3', rangemode: 'tozero', title: { text: lab, font: { size: 11 } } }, shapes, annotations: ann }));
  div._table = { columns: ['Jahr', ...(key !== 'aph' ? ['beobachtet'] : []), 'BFS tief', 'BFS mittel', 'BFS hoch'],
    rows: [...(key !== 'aph' ? d.ts.y.filter((y) => y < 2024).map((y, k) => [y, d.ts[key][k], null, null, null]) : []),
      ...p.y.map((y, k) => [y, ...(key !== 'aph' ? [y === 2024 ? d.ts[key][d.ts.y.indexOf(2024)] : null] : []), p.tief[key][k], p.mittel[key][k], p.hoch[key][k]])] };
  div._title = `${lab} ${d.ts.y[0]}–2055 – ${shortName(id)}`;
}

/** age structure 2024 vs target year (selected variant), counts per 5-year group */
export function pyrCompare(div, id, d) {
  const { v, j } = progState(); const p = d.prog; if (!p) return;
  // population pyramid: men left (negative x), women right; bars = target year, black step line = 2024
  const a = p.pyr_mf[v]['2024']; const b = p.pyr_mf[v][String(j)];
  const neg = (arr) => arr.map((x) => -x);
  const line = (x, show) => ({ type: 'scatter', mode: 'lines', y: p.groups, x, name: '2024', showlegend: show, line: { color: C.ink, width: 1.5, shape: 'hvh' }, hoverinfo: 'skip' });
  const hov = (sx) => `${sx} %{y} · ${j}: %{customdata[0]:,.0f} (2024: %{customdata[1]:,.0f})<extra></extra>`;
  const cd = (arr1, arr0) => arr1.map((x, k) => [x, arr0[k]]);
  const m = Math.max(...a.m, ...a.f, ...b.m, ...b.f) * 1.08;
  const step = niceStep(m);
  const ticks = []; for (let t = 0; t <= m; t += step) { ticks.push(t); if (t) ticks.unshift(-t); }
  plot(div, [
    { type: 'bar', orientation: 'h', y: p.groups, x: neg(b.m), name: `Männer ${j} (BFS ${v})`, marker: { color: '#7eaed9' }, customdata: cd(b.m, a.m), hovertemplate: hov('Männer') },
    { type: 'bar', orientation: 'h', y: p.groups, x: b.f, name: `Frauen ${j} (BFS ${v})`, marker: { color: '#f2a46a' }, customdata: cd(b.f, a.f), hovertemplate: hov('Frauen') },
    line(neg(a.m), true), line(a.f, false)],
  baseLayout({ height: 460, barmode: 'overlay', bargap: 0.08, showlegend: true, legend: { orientation: 'h', y: -0.14, font: { size: 12 } }, margin: { l: 8, r: 10, t: 6, b: 66 },
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { range: [-m, m], tickvals: ticks, ticktext: ticks.map((t) => fmtInt(Math.abs(t))), zeroline: true, zerolinecolor: C.line, gridcolor: '#eef1f3',
      title: { text: 'Personen  ·  ◀ Männer   |   Frauen ▶', font: { size: 11 } } } }));
  div._table = { columns: ['Altersgruppe', 'Männer 2024', `Männer ${j} BFS ${v}`, 'Frauen 2024', `Frauen ${j} BFS ${v}`, 'Veränderung total %'],
    rows: p.groups.map((g, k) => [g, rnd(a.m[k], 0), rnd(b.m[k], 0), rnd(a.f[k], 0), rnd(b.f[k], 0), rnd(pct(b.m[k] + b.f[k], a.m[k] + a.f[k]), 1)]) };
}

/** chart card helper with export menu */
export function progChartCard(title, sub, mid, draw) {
  const card = document.createElement('article'); card.className = 'card wide';
  card.innerHTML = `<div class="card-head"><h3>${esc(title)}</h3><div class="card-tools no-print"><button class="icon-btn" data-act="export" aria-label="Exportieren" aria-haspopup="menu" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg></button></div></div>
    ${sub ? `<p class="key-sentence">${sub}</p>` : ''}<div class="chart"></div><p class="src-line">${progSourceHTML(mid)}</p>`;
  const div = card.querySelector('.chart');
  requestAnimationFrame(() => draw(div));
  const btn = card.querySelector('[data-act="export"]');
  btn.onclick = () => exportMenu(btn, (f) => exportItems(f, [{ title: div._title || title, sheet: title, sentence: sub || '', source: progSourceLine(mid),
    definition: `${model(mid, progState().v).regionalisierung}`, div, table: div._table || { columns: [], rows: [] } }]));
  return card;
}

/** content of a topic's Ausblick view */
export async function ausblickSection(box, r, d, subId, rerender) {
  if (!d.prog) { box.innerHTML = '<p class="empty">Für diese Region liegt keine Prognose vor.</p>'; return; }
  const { v, j } = progState();
  const mid = subId === 'inanspruchnahme' ? 'aph_dummy' : 'bfs2025';
  box.appendChild(progLabel(mid, rerender));
  const grid = document.createElement('div'); grid.className = 'cards'; box.appendChild(grid);
  if (subId === 'alter') {
    grid.appendChild(progChartCard(`Menschen ab 80 – beobachtet und Szenarien bis 2055`, `Schwarz: beobachtet ${d.ts.y[0]}–2024. Band: Spannweite BFS tief bis hoch. Orange: gewählte Variante (BFS ${v}).`, mid, (div) => fanChart(div, r.id, d, 'b80')));
    grid.appendChild(progChartCard(`Altersaufbau 2024 und ${j}`, `Personen je Altersgruppe, Männer links, Frauen rechts. Balken: ${j} (BFS ${v}), schwarze Linie: 2024.`, mid, (div) => pyrCompare(div, r.id, d)));
  } else {
    grid.appendChild(progChartCard('Benötigte Pflegeheimplätze bis 2055', `Linie: heutige Langzeitplätze am Standort. Band: Spannweite auf Basis BFS tief bis hoch. Orange: Basis BFS ${v}.`, mid, (div) => fanChart(div, r.id, d, 'aph')));
  }
  const cards = document.createElement('div'); cards.className = 'cards'; box.appendChild(cards);
  for (const i of S.meta.indicators.filter((x) => x.sub === subId && x.zeit === 'ausblick')) cards.appendChild(await progCard(i.id, r.id));
}

/** #/ausblick/<id>: all forecasts of a region on one page (time first) */
export async function ausblickPage(page, r, d, rerender) {
  const { v, j } = progState();
  page.innerHTML = `<div class="page-head"><div><span class="eyebrow">Ausblick</span><h2>Was kommt auf ${esc(shortName(r.id))} zu?</h2></div></div>
    <p class="prose muted">Alle Prognosen für ${esc(regionLabel(r.id, false))} auf einer Seite. Jede Prognose nennt ihr Modell und ihre Variante; Werte sind gerundet, weil sie Schätzungen sind.</p>`;
  if (!d.prog) { page.insertAdjacentHTML('beforeend', '<p class="empty">Für diese Region liegt keine Prognose vor.</p>'); return; }
  const sec = (title, mid, subId) => {
    const s = document.createElement('section'); s.className = 'aus-sec';
    s.innerHTML = `<div class="aus-head"><h3>${esc(title)}</h3><a class="btn small" href="#/gemeinde/${r.id}/${subId}/ausblick">Im Thema öffnen →</a></div>`;
    page.appendChild(s); return s;
  };
  const s1 = sec('Bevölkerung', 'bfs2025', 'alter');
  s1.appendChild(progLabel('bfs2025', rerender));
  const g1 = document.createElement('div'); g1.className = 'cards'; s1.appendChild(g1);
  g1.appendChild(progChartCard('Menschen ab 80 bis 2055', '', 'bfs2025', (div) => fanChart(div, r.id, d, 'b80')));
  g1.appendChild(await progCard('p_b80', r.id));
  g1.appendChild(await progCard('p_a80', r.id));
  g1.appendChild(await progCard('p_aq', r.id));
  const s2 = sec('Pflegeheime', 'aph_dummy', 'inanspruchnahme');
  s2.appendChild(progLabel('aph_dummy', rerender));
  const g2 = document.createElement('div'); g2.className = 'cards'; s2.appendChild(g2);
  g2.appendChild(progChartCard('Benötigte Pflegeheimplätze bis 2055', '', 'aph_dummy', (div) => fanChart(div, r.id, d, 'aph')));
  g2.appendChild(await progCard('p_aph', r.id));
}

/** portrait: tile row 'Ausblick' */
export async function ausblickTiles(r) {
  const P = await loadProg(); const { v, j } = progState();
  const ref = r.e === 'KT' ? 'CH' : r.e === 'CH' ? null : `KT:${r.kt}`;
  const pool = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).map((x) => x.id);
  const t = (indId) => {
    const i = S.ind.get(indId); const a = pval(P, indId, r.id, v, 2024); const b = pval(P, indId, r.id, v, j);
    const share = i.unit === '%'; const ph = model(i.modell, v).status === 'platzhalter';
    // the orange point: shares -> value in the target year; counts -> change 2024 -> target year (comparable across sizes)
    const m = (x) => { const xa = pval(P, indId, x, v, 2024); const xb = pval(P, indId, x, v, j); return share ? xb : pct(xb, xa); };
    const f = (x) => (share ? `${fmt(roundProg(x, '%'), { dec: 1 })} %` : sign(x));
    const me = m(r.id); const vr = ref ? m(ref) : null;
    const w = me != null && vr != null ? compareWord(me, vr, share ? 'p_a80' : 'g80') : null;
    const vals = pool.map(m).filter((x) => x != null && Number.isFinite(x));
    const lo = Math.min(...vals); const hi = Math.max(...vals);
    const pos = hi > lo ? ((me - lo) / (hi - lo)) * 100 : 50;
    const cmp = w ? ` – ${esc(w)} ${ref === 'CH' ? 'in der Schweiz' : 'im Kanton'} (${f(vr)})` : '';
    const range = r.e !== 'CH' && vals.length > 2 && me != null
      ? `<div class="range" aria-hidden="true"><span class="bar"></span><span class="me prog" style="left:${Math.max(0, Math.min(100, pos)).toFixed(1)}%"></span></div>
        <div class="range-lab num"><span>${f(lo)}</span><span>${f(hi)}</span></div>` : '';
    return `<a class="tile ${i.sub === 'inanspruchnahme' ? 'blue' : 'slate'}" href="#/gemeinde/${r.id}/${i.sub}/ausblick"><span class="tl">${esc(i.short)} ${j}${ph ? ' <span class="ph-mini">Platzhalter</span>' : ''}</span>
      <span class="tv">${b == null ? '–' : share ? `${fmt(roundProg(b, '%'), { dec: 1 })}<small>%</small>` : fmtInt(roundProg(b))}</span>
      <p class="ts">${b == null ? '' : share ? `2024: ${fmt(a, { dec: 1 })} %${cmp}` : `2024: ${fmtInt(a)} · ${sign(pct(b, a))}${cmp}`}</p>${range}</a>`;
  };
  return `<div class="aus-tiles"><div class="aus-tiles-head"><h3>Ausblick ${j} <span class="muted small">(BFS ${v})</span></h3><a class="btn small" href="#/ausblick/${r.id}">Alle Prognosen →</a></div>
    <div class="tiles">${['p_bev', 'p_b80', 'p_a80', 'p_aph'].map(t).join('')}</div></div>`;
}
