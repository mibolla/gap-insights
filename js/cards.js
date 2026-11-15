// Answer cards (key sentence → chart → explanation → source) and the chart types.
import { S, val, region, parents, shortName, regionLabel, sentence, fmt, fmtUnit, fmtInt, sourceLine, sourceHTML,
  groupMembers, groupLabel, groupLabelFor, inMappe, toggleMappe, detail, isPro } from './store.js?v=20261115162929';
import { whyHTML } from './context.js?v=20261115162929';
import { attachMap } from './kpimap.js?v=20261115162929';
import { toast, esc } from './ui.js?v=20261115162929';
import { exportItems, exportMenu, FORMATS } from './export.js?v=20261115162929';

const rnd = (v, d) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const plain = (h) => String(h || '').replace(/<[^>]+>/g, '');
const ebene = { CH: 'Schweiz', KT: 'Kanton', BEZ: 'Bezirk', GDE: 'Gemeinde' };

const LIGHT = { grp: '#2a9d8f', chRed: '#d62828', me: '#e8701a', bez: '#8fb3d6', kt: '#1b67b2', ch: '#3a4046', grey: '#c7d0d6', ink: '#17232c', muted: '#5b6872', line: '#dbe1e5',
  grid: '#eef1f3', annbg: 'rgba(255,255,255,0.85)', edge: '#ffffff', rest: '#9fb6c8', band: 'rgba(27,103,178,0.16)' };
const DARK = { grp: '#3fbfae', chRed: '#ff6b6b', me: '#f08433', bez: '#4f7ba6', kt: '#6aa6e0', ch: '#c9d2d8', grey: '#55636e', ink: '#e6ecef', muted: '#a3b0b9', line: '#2c3740',
  grid: '#27313a', annbg: 'rgba(27,35,42,0.85)', edge: '#1b232a', rest: '#5f7385', band: 'rgba(106,166,224,0.22)' };
const C = { ...LIGHT };
const FONT = { family: 'Noto Sans, Helvetica Neue, Arial, sans-serif', size: 13, color: C.ink };
/** chart colours follow the mode (Experte = dark ground); charts are redrawn by the router afterwards */
export function chartTheme(dark) { Object.assign(C, dark ? DARK : LIGHT); FONT.color = C.ink; C.dark = !!dark; }
/** exports are always on white: translate the dark chart colours back to the light ones */
export function lightFigure(fig) {
  if (!C.dark) return fig;
  let j = JSON.stringify(fig);
  Object.keys(LIGHT).forEach((k) => { j = j.split(JSON.stringify(DARK[k]).slice(1, -1)).join(LIGHT[k]); });
  return JSON.parse(j);
}
/** the «black» observed line is light on the dark ground */
export const inkWord = (cap = false) => (C.dark ? (cap ? 'Hell' : 'helle') : (cap ? 'Schwarz' : 'schwarze'));
const CFG = { displayModeBar: false, responsive: true, locale: 'de-CH' };

export function baseLayout(extra = {}) {
  return { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 8, r: 16, t: 8, b: 28 },
    hoverlabel: { font: { family: FONT.family } }, showlegend: false, ...extra };
}
export const plot = (div, data, layout, cfg = {}) => {
  // a fixed-height chart keeps its container at that height: otherwise Plotly's responsive resize (window
  // resize) shrinks the container to its CSS min-height and the plot overflows onto the source line below
  if (layout.height) div.style.height = `${layout.height}px`;
  return Plotly.react(div, data, layout, { ...CFG, ...cfg });
};
/** long rankings (more than `show` bars): a window of `show` rows that scrolls, opened at the selected region */
export const SCROLL_ROWS = 10;
export function scrollRows(div, n, rowH, top, focus = 0, show = SCROLL_ROWS) {
  const old = div.parentElement?.classList.contains('chart-scroll') ? div.parentElement : null;
  if (n <= show) { if (old) { old.replaceWith(div); } return; }
  const wrap = old || document.createElement('div');
  if (!old) { wrap.className = 'chart-scroll'; div.replaceWith(wrap); wrap.appendChild(div); }
  wrap.style.maxHeight = `${top + rowH * show + 6}px`;
  let hint = wrap.nextElementSibling?.classList.contains('scroll-hint') ? wrap.nextElementSibling : null;
  if (!hint) { hint = document.createElement('p'); hint.className = 'scroll-hint'; wrap.after(hint); }
  hint.textContent = `${n} Einträge – in der Liste scrollen`;
  requestAnimationFrame(() => { wrap.scrollTop = Math.max(0, top + rowH * focus - (rowH * show) / 2); });
}

const ICON = {
  star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3 2.7 5.6 6.2.9-4.5 4.3 1 6.2L12 17l-5.5 3 1-6.2L3 9.5l6.2-.9z"/></svg>',
  starOn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.2.9-4.5 4.3 1 6.2L12 17l-5.5 3 1-6.2L3 9.5l6.2-.9z"/></svg>',
  png: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg>',
  dl: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg>',
  link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};

/** One indicator for one region. mode: 'kt' | 'nb' | 'size' | 'kanton' | 'own' */
export function indicatorCard(indId, id, { mode = 'kt', wide = false } = {}) {
  const i = S.ind.get(indId); const r = region(id);
  const card = document.createElement('article');
  card.className = `card${wide ? ' wide' : ''}`; card.id = `ind-${indId}`;
  const v = val(indId, id);
  const levelOk = i.levels.includes(r.e) || r.e === 'CH';
  // indicator only meaningful for Bezirke/Kantone: a Gemeinde shows the value of its Bezirk (sentence and bars)
  const proxy = !levelOk && r.e === 'GDE' && val(indId, r.bez) != null ? r.bez : null;
  let sent = levelOk ? sentence(indId, id) : proxy ? sentence(indId, proxy) : null;
  if (indId === 'bev' && r.e !== 'CH') {
    const same = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).sort((a, b) => b.pop - a.pop);
    const what = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirken' : 'Kantonen';
    sent = `${shortName(id)}: <b>${fmtInt(v)}</b> Einwohnerinnen und Einwohner – Rang ${same.findIndex((x) => x.id === id) + 1} von ${same.length} ${what}${r.e === 'KT' ? '' : ' im Kanton'}.`;
  }
  let empty = '';
  let hint = '';
  if (proxy) hint = `${esc(r.n)} liegt im ${esc(regionLabel(proxy, false))}. Für einzelne Gemeinden ist dieser Wert nicht sinnvoll – gezeigt wird deshalb der Bezirk.`;
  else if (!levelOk) {
    const b = r.e === 'GDE' ? r.bez : null;
    empty = `Für einzelne Gemeinden nicht sinnvoll. ${b ? `Wert für den ${regionLabel(b, false)}: <b>${fmtUnit(val(indId, b), i)}</b>.` : ''}`;
  } else if (v == null) {
    const isAph = ['somed'].includes(i.src) && r.e === 'GDE';
    const b = r.e === 'GDE' ? r.bez : null;
    empty = isAph ? `In ${r.n} gibt es kein Alters- und Pflegeheim. ${b && val(indId, b) != null ? `Wert für den ${regionLabel(b, false)}: <b>${fmtUnit(val(indId, b), i)}</b>.` : ''}`
      : 'Für diese Region liegt kein Wert vor.';
  }
  // Experte: where the region stands among its peers (rank, median, range)
  let stats = '';
  if (isPro() && levelOk && v != null && r.e !== 'CH' && indId !== 'bev') {
    const pool = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).map((x) => val(indId, x.id)).filter((x) => x != null).sort((a, b) => b - a);
    if (pool.length > 2) {
      const med = pool.length % 2 ? pool[(pool.length - 1) / 2] : (pool[pool.length / 2 - 1] + pool[pool.length / 2]) / 2;
      const what = r.e === 'GDE' ? `Gemeinden im Kanton ${r.kt}` : r.e === 'BEZ' ? `Bezirken im Kanton ${r.kt}` : 'Kantonen';
      stats = `<p class="pro-stats num"><span>Rang <b>${pool.findIndex((x) => x <= v) + 1}</b> von ${pool.length} ${what} <small>(höchster Wert = Rang 1)</small></span><span>Median <b>${fmt(med, i)}</b></span><span>Spannweite <b>${fmt(pool[pool.length - 1], i)}</b> bis <b>${fmt(pool[0], i)}</b></span></p>`;
    }
  }
  const on = inMappe(indId, id);
  card.innerHTML = `
    <div class="card-head"><h3>${esc(i.label)}</h3>
      <div class="card-tools no-print">
        <button class="icon-btn${on ? ' on' : ''}" data-act="mappe" aria-pressed="${on}" title="${on ? 'Aus den Favoriten entfernen' : 'Als Favorit hinzufügen'}" aria-label="${on ? 'Aus den Favoriten entfernen' : 'Als Favorit hinzufügen'}">${on ? ICON.starOn : ICON.star}</button>
        <button class="icon-btn" data-act="export" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV" aria-label="Exportieren" aria-haspopup="menu">${ICON.dl}</button>
        <button class="icon-btn" data-act="link" title="Link zu dieser Ansicht kopieren" aria-label="Link kopieren">${ICON.link}</button>
      </div></div>
    ${sent ? `<p class="key-sentence">${sent}</p>` : ''}
    ${empty ? `<p class="empty">${empty}</p>` : ''}
    ${hint ? `<p class="proxy-hint">${hint}</p>` : ''}
    <div class="chart" aria-hidden="true"></div>${stats}${whyHTML(indId)}
    ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
    <details class="how"><summary>Wie wird das gemessen?</summary><p>${esc(i.def)}</p>
      <p><a href="${S.meta.sources[i.src].url}" target="_blank" rel="noopener">${esc(S.meta.sources[i.src].publisher)} – ${esc(S.meta.sources[i.src].name)} ↗</a> · <a href="#/daten">Methodik</a></p></details>
    <p class="src-line">${sourceHTML(i.src)}</p>`;
  const div = card.querySelector('.chart');
  const useGroup = mode !== 'kt' && r.e !== 'CH' && !proxy && levelOk;
  if (indId === 'bev' && !useGroup) div.remove();   // absolute size: no benchmark bars
  else {
    requestAnimationFrame(() => (useGroup ? groupChart(div, indId, id, mode) : benchmarkChart(div, indId, proxy || id)));
    // Experte: the same indicator on a map, to the right of the bars
    if (isPro() && (v != null || proxy)) attachMap(card, div, { id, title: `Karte: ${i.short}`, label: `${i.short}${i.unit && i.unit !== 'Personen' ? ` (${i.unit === 'pro 1000' ? 'von 1000' : i.unit})` : ''}`,
      value: (x) => val(indId, x), fmt: (x) => `${fmt(x, i)}${i.unit === '%' ? ' %' : ''}`, levels: i.levels, href: (x) => `#/gemeinde/${x}/${i.sub}` });
  }
  card.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'mappe') {
      const now = toggleMappe({ ind: indId, id });
      b.classList.toggle('on', now); b.setAttribute('aria-pressed', now); b.title = now ? 'Aus den Favoriten entfernen' : 'Als Favorit hinzufügen'; b.setAttribute('aria-label', b.title); b.innerHTML = now ? ICON.starOn : ICON.star;
      toast(now ? 'Als Favorit hinzugefügt' : 'Aus den Favoriten entfernt'); document.dispatchEvent(new Event('mappe'));
    } else if (b.dataset.act === 'export') {
      const item = indicatorItem(indId, proxy || id, { mode: proxy ? 'kt' : mode, div: div.isConnected ? div : null, sentence: sent || empty });
      exportMenu(b, (f) => exportItems(f, [item]), { formats: item.div ? FORMATS : FORMATS.filter((x) => !x.needsChart) });
    } else if (b.dataset.act === 'link') {
      const url = `${location.origin}${location.pathname}#/gemeinde/${id}/${i.sub}/${indId}`;
      navigator.clipboard?.writeText(url).then(() => toast('Link kopiert'), () => toast(url));
    }
  });
  return card;
}

/** export item for one indicator card: title, sentence, chart, numbers */
export function indicatorItem(indId, id, { mode = 'kt', div = null, sentence: sent = null, note = '' } = {}) {
  const i = S.ind.get(indId); const r = region(id);
  const unit = i.unit === 'pro 1000' ? 'von 1000' : i.unit;
  const useGroup = mode !== 'kt' && r.e !== 'CH';
  const refIds = r.e === 'KT' ? ['CH'] : [`KT:${r.kt}`, 'CH'];
  let ids = useGroup ? [id, ...groupMembers(mode, id), ...refIds] : [id, ...parents(id)];
  ids = [...new Set(ids)];
  const rows = ids.map((x) => { const rr = region(x); return [rr.e === 'CH' ? 'Schweiz' : shortName(x), ebene[rr.e], rr.kt || '', rnd(val(indId, x), i.dec + 1)]; });
  if (useGroup) {   // ranking: members sorted, references at the end
    const refs = rows.slice(-refIds.length); const mem = rows.slice(0, -refIds.length).filter((x) => x[3] != null).sort((a, b) => b[3] - a[3]);
    rows.splice(0, rows.length, ...mem, ...refs);
  }
  return { title: `${i.label} – ${r.e === 'CH' ? 'Schweiz' : shortName(id)}`, sheet: i.short, sentence: sent ?? sentence(indId, id), note,
    source: sourceLine(i.src), definition: i.def, div: div && div.data ? div : null,
    table: { columns: ['Region', 'Ebene', 'Kanton', `${i.short} (${unit})`], rows } };
}

/** horizontal bars: region, its Bezirk, Kanton, Schweiz */
export function benchmarkChart(div, indId, id) {
  const i = S.ind.get(indId);
  const ids = [id, ...parents(id)].filter((x) => i.levels.includes(region(x).e) || x === 'CH' || region(x).e === 'KT');
  const rows = ids.map((x) => ({ x, v: val(indId, x) })).filter((d) => d.v != null);
  if (!rows.length) { div.style.minHeight = '0'; return; }
  const col = (x) => (x === id ? C.me : x === 'CH' ? C.ch : region(x).e === 'KT' ? C.kt : C.bez);
  const neg = rows.some((d) => d.v < 0);
  // with negative values the value goes into the row label, so labels never collide with bars
  const names = rows.map((d) => { const n = shortName(d.x) + (neg ? ` · ${fmtUnit(d.v, i)}` : ''); return d.x === id ? `<b>${n}</b>` : n; });
  plot(div, [{ type: 'bar', orientation: 'h', y: names, x: rows.map((d) => d.v), marker: { color: rows.map((d) => col(d.x)) },
    text: neg ? undefined : rows.map((d) => fmtUnit(d.v, i)), textposition: 'outside', cliponaxis: false, hoverinfo: 'skip' }],
  baseLayout({ height: 46 * rows.length + 30, margin: { l: 8, r: neg ? 16 : 90, t: 4, b: 4 },
    yaxis: { autorange: 'reversed', automargin: true, ticks: '', showline: false },
    xaxis: { visible: neg, showticklabels: false, showgrid: false, zeroline: true, zerolinecolor: C.muted, zerolinewidth: 1.5, rangemode: 'tozero' }, bargap: 0.35 }));
  div.setAttribute('aria-label', rows.map((d) => `${shortName(d.x)} ${fmtUnit(d.v, i)}`).join(', '));
}

/** ranked bars for a comparison group, the region highlighted, Kanton and CH as lines */
export function groupChart(div, indId, id, mode) {
  const i = S.ind.get(indId); const r = region(id);
  const members = [id, ...groupMembers(mode, id)];
  const rows = members.map((x) => ({ x, v: val(indId, x) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
  if (rows.length < 2) { div.innerHTML = `<p class="empty">Für „${groupLabelFor(mode, r.e)}“ liegen zu wenige Werte vor.</p>`; return; }
  const vk = r.e === 'KT' ? null : val(indId, `KT:${r.kt}`); const vc = val(indId, 'CH');
  const shapes = []; const ann = [];
  // labels of the two reference lines: if the lines are close, put "Schweiz" one row higher so the texts never overlap
  const span = Math.max(...rows.map((d) => Math.abs(d.v)), Math.abs(vk ?? 0), Math.abs(vc ?? 0)) || 1;
  const close = vk != null && vc != null && Math.abs(vk - vc) / span < 0.18;
  [[vk, `Kanton ${r.kt}`, C.kt, 0], [vc, 'Schweiz', C.ch, close ? 15 : 0]].forEach(([v, lab, c, lift]) => {
    if (v == null) return;
    shapes.push({ type: 'line', x0: v, x1: v, yref: 'paper', y0: 0, y1: 1, line: { color: c, width: 1.5, dash: 'dot' } });
    ann.push({ x: v, yref: 'paper', y: 1, yshift: 2 + lift, text: lab, showarrow: false, font: { size: 11, color: c }, yanchor: 'bottom',
      bgcolor: C.annbg, borderpad: 1 });
    if (lift) shapes.push({ type: 'line', x0: v, x1: v, yref: 'paper', y0: 1, y1: 1, line: { color: c, width: 1, dash: 'dot' } });
  });
  plot(div, [{ type: 'bar', orientation: 'h', y: rows.map((d) => (d.x === id ? `<b>${shortName(d.x)}</b>` : shortName(d.x))), x: rows.map((d) => d.v),
    marker: { color: rows.map((d) => (d.x === id ? C.me : C.grey)) }, text: rows.map((d) => fmt(d.v, i)), textposition: rows.some((d) => d.v < 0) ? 'auto' : 'outside', cliponaxis: false,
    hovertemplate: '%{y}: %{x}<extra></extra>' }],
  baseLayout({ height: 26 * rows.length + (close ? 74 : 60), margin: { l: 8, r: 60, t: close ? 40 : 26, b: 4 }, shapes, annotations: ann,
    yaxis: { autorange: 'reversed', automargin: true, tickfont: { size: 12 } }, xaxis: { visible: false, rangemode: 'tozero' }, bargap: 0.25 }));
  scrollRows(div, rows.length, 26, close ? 40 : 26, rows.findIndex((d) => d.x === id));
}

// ---------------------------------------------------------------- special charts per Unterthema
/** body of «Wie wird das gemessen?»: explanation + link to the source and the methodology */
export function howBody(text, srcKey) {
  const so = S.meta.sources[srcKey];
  return `${text ? `<p>${text}</p>` : so ? `<p>Daten: ${esc(so.name)} (${esc(so.year)}).</p>` : ''}${so && so.url ? `<p><a href="${so.url}" target="_blank" rel="noopener">${esc(so.publisher)} – ${esc(so.name)} ↗</a> · <a href="#/daten">Methodik</a></p>` : '<p><a href="#/daten">Methodik</a></p>'}`;
}
export function chartCard(title, sub, srcKey, wide = true) {
  const card = document.createElement('article');
  card.className = `card${wide ? ' wide' : ''}`;
  card.innerHTML = `<div class="card-head"><h3>${esc(title)}</h3><div class="card-tools no-print"><button class="icon-btn" data-act="export" aria-label="Exportieren" aria-haspopup="menu" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV">${ICON.dl}</button></div></div>
    ${sub ? `<p class="key-sentence">${sub}</p>` : ''}<div class="chart"></div>
    <details class="how"><summary>Wie wird das gemessen?</summary><div class="how-b">${howBody('', srcKey)}</div></details><p class="src-line">${sourceHTML(srcKey)}</p>`;
  const div = card.querySelector('.chart');
  const btn = card.querySelector('[data-act="export"]');
  btn.onclick = () => exportMenu(btn, (f) => exportItems(f, [{ title: div._title || title, sheet: title, sentence: card.querySelector('.key-sentence')?.innerHTML || '',
    source: sourceLine(srcKey), div, table: div._table || { columns: [], rows: [] } }]));
  return { card, div, setHow: (text, src = srcKey) => { card.querySelector('.how-b').innerHTML = howBody(text, src); }, setSub: (h) => { let p = card.querySelector('.key-sentence'); if (!p) { p = document.createElement('p'); p.className = 'key-sentence'; card.querySelector('.card-head').after(p); } p.innerHTML = h; } };
}

/** series helpers: a series is {id, d} or a comparison group {id: 'GRP', name, grp: true, d} */
const nameOf = (s) => s.name || shortName(s.id);
const colOf = (s, k) => (k === 0 ? C.me : s.col ? s.col : s.grp ? C.grp : s.id === 'CH' ? C.ch : (region(s.id) || {}).e === 'BEZ' ? C.bez : C.kt);

/** outline of a pyramid side as a staircase on a numeric y axis: each age group k spans k-0.4 … k+0.4 at value x[k] */
export function stairs(x) {
  const xs = []; const ys = [];
  x.forEach((v, k) => { xs.push(v, v); ys.push(k - 0.5, k + 0.5); });
  return { x: xs, y: ys };
}
export function pyramid(div, d, dk, years, refName = 'Schweiz') {
  const [y0, y1] = years; const g = d.pyr.groups;
  const tot = (p) => p.m.reduce((a, b) => a + b, 0) + p.f.reduce((a, b) => a + b, 0);
  const pct = (arr, p) => arr.map((x) => (x / tot(p)) * 100);
  const now = d.pyr[y1]; const then = d.pyr[y0]; const ref = dk.pyr[y1];
  // numeric y axis (index of the age group): bars centred on k, comparison lines as exact staircases over each bar
  const yi = g.map((_, k) => k);
  const st = (x, extra) => ({ type: 'scatter', mode: 'lines', ...stairs(x), hoverinfo: 'skip', ...extra });
  const refLine = { color: refName === 'Schweiz' ? C.kt : C.grp, width: refName === 'Schweiz' ? 1.2 : 2, dash: 'dot' };
  const data = [
    { type: 'bar', orientation: 'h', y: yi, x: pct(now.m, now).map((x) => -x), name: `Männer ${y1}`, marker: { color: '#7eaed9' }, text: g, hovertemplate: 'Männer %{text}: %{customdata:.1f} %<extra></extra>', textposition: 'none', customdata: pct(now.m, now) },
    { type: 'bar', orientation: 'h', y: yi, x: pct(now.f, now), name: `Frauen ${y1}`, marker: { color: '#f2a46a' }, text: g, hovertemplate: 'Frauen %{text}: %{x:.1f} %<extra></extra>', textposition: 'none' },
    st(pct(then.m, then).map((x) => -x), { name: `${y0}`, line: { color: C.ink, width: 1.5 } }),
    st(pct(then.f, then), { showlegend: false, line: { color: C.ink, width: 1.5 } }),
    st(pct(ref.m, ref).map((x) => -x), { name: `${refName} ${y1}`, line: refLine }),
    st(pct(ref.f, ref), { showlegend: false, line: refLine }),
  ];
  const m = Math.max(...data.slice(0, 2).flatMap((t) => t.x.map(Math.abs)), ...pct(ref.m, ref), ...pct(ref.f, ref)) * 1.1;
  const ticks = [-6, -4, -2, 0, 2, 4, 6].filter((t) => Math.abs(t) <= m);
  const r1 = (a) => a.map((x) => rnd(x, 2));
  const tm = pct(now.m, now); const tf = pct(now.f, now); const pm = pct(then.m, then); const pf = pct(then.f, then);
  div._table = { columns: ['Altersgruppe', `Männer ${y1} (Personen)`, `Frauen ${y1} (Personen)`, `Männer ${y1} (%)`, `Frauen ${y1} (%)`,
    `Männer ${y0} (%)`, `Frauen ${y0} (%)`, `${refName} Männer ${y1} (%)`, `${refName} Frauen ${y1} (%)`],
  rows: g.map((x, k) => [x, now.m[k], now.f[k], r1(tm)[k], r1(tf)[k], r1(pm)[k], r1(pf)[k], r1(pct(ref.m, ref))[k], r1(pct(ref.f, ref))[k]]) };
  plot(div, data, baseLayout({ height: 460, barmode: 'overlay', bargap: 0.08, showlegend: true,
    legend: { orientation: 'h', y: -0.08, font: { size: 12 } }, margin: { l: 8, r: 8, t: 8, b: 40 },
    xaxis: { range: [-m, m], tickvals: ticks, ticktext: ticks.map((t) => `${Math.abs(t)} %`), zeroline: true, zerolinecolor: C.line, gridcolor: C.grid },
    yaxis: { automargin: true, tickfont: { size: 11 }, tickvals: yi, ticktext: g, range: [-0.6, g.length - 0.4], zeroline: false, showgrid: false } }));
}

/** lean line chart (report style): end dots and «Name value» labels at the line ends (pushed apart), horizontal grid only.
 *  ends: [{s, k, x:[years], y:[values]}] in series order; data: the line traces */
function leanPlot(div, data, ends0, nm, years, { note = '', ref100 = false, tozero = false, fmtEnd = (v) => fmtInt(Math.round(v)) } = {}) {
  const nLines = data.length;                 // traces 0..nLines-1 are the lines, in the order of ends0
  const ends = ends0.map((e, ti) => { let i = e.y.length - 1; while (i >= 0 && e.y[i] == null) i--; return i < 0 ? null : { ...e, ti, x: e.x[i], y: e.y[i] }; }).filter(Boolean);
  data.push({ type: 'scatter', mode: 'markers', x: ends.map((e) => e.x), y: ends.map((e) => e.y), showlegend: false, hoverinfo: 'skip',
    marker: { size: ends.map((e) => (e.k === 0 ? 9 : 7)), color: ends.map((e) => colOf(e.s, e.k)) } });
  const H = 300; const all = data.flatMap((t) => t.y).filter((v) => v != null);
  const lo = Math.min(ref100 ? 100 : tozero ? 0 : Infinity, ...all); const hi = Math.max(ref100 ? 100 : -Infinity, ...all);
  const gap = ((hi - lo) || 1) * 17 / (H - 40);
  const lbl = [...ends].sort((a, b) => b.y - a.y); lbl.forEach((e, i) => { e.ly = i ? Math.min(e.y, lbl[i - 1].ly - gap) : e.y; });
  const ann = lbl.map((e) => ({ x: e.x, y: e.ly, xanchor: 'left', xshift: 8, showarrow: false, captureevents: true,
    text: `${e.k === 0 ? '<b>' : ''}${nm(e.s)} ${fmtEnd(e.y)}${e.k === 0 ? '</b>' : ''}`, font: { size: e.k === 0 ? 13 : 12, color: colOf(e.s, e.k) } }));
  if (note) ann.push({ text: note, xref: 'paper', yref: 'paper', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom', showarrow: false, font: { size: 11, color: C.muted } });
  const lw = Math.max(60, ...ends.map((e) => (nm(e.s).length + 4) * 7)) + 14;
  const done = plot(div, data, baseLayout({ height: H, showlegend: false, margin: { l: 40, r: lw, t: 26, b: 30 }, annotations: ann,
    xaxis: { range: [years[0] - 0.3, years[1] + 0.3], tickvals: years[1] - years[0] <= 6 ? Array.from({ length: years[1] - years[0] + 1 }, (_, k) => years[0] + k) : [years[0], years[0] + 4, years[0] + 8, years[1]].filter((v, i, a) => v <= years[1] && a.indexOf(v) === i), showgrid: false, zeroline: false, ticks: 'outside', ticklen: 4, tickcolor: C.line },
    yaxis: { gridcolor: C.grid, zeroline: false, rangemode: tozero ? 'tozero' : 'normal' },
    shapes: ref100 ? [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 100, y1: 100, line: { color: C.muted, width: 1, dash: 'dot' } }] : [] }));
  // hover a name (or a line): that line stays, all other lines, end dots and names fade
  const focus = (ti) => {
    const tr = div.querySelectorAll('.scatterlayer .trace');
    for (let t = 0; t < nLines; t++) if (tr[t]) { tr[t].style.transition = 'opacity .15s'; tr[t].style.opacity = ti == null || t === ti ? 1 : 0.15; }
    tr[nLines]?.querySelectorAll('.point').forEach((p, e) => { p.style.opacity = ti == null || ends[e]?.ti === ti ? 1 : 0.15; });
    div.querySelectorAll('.annotation').forEach((a, j) => { if (j < lbl.length) { a.style.transition = 'opacity .15s'; a.style.opacity = ti == null || lbl[j].ti === ti ? 1 : 0.25; } });
  };
  Promise.resolve(done).then(() => {
    div.querySelectorAll('.annotation').forEach((a, j) => {
      if (j >= lbl.length) return;
      a.style.cursor = 'default';
      a.onmouseenter = () => focus(lbl[j].ti); a.onmouseleave = () => focus(null);
    });
    if (!div._leanHover) {                    // once per chart div (it is redrawn when a button changes the indicator)
      div._leanHover = true;
      div.on('plotly_hover', (ev) => { const c = ev.points?.[0]?.curveNumber; if (c != null && c < div._nLines) div._focus(c); });
      div.on('plotly_unhover', () => div._focus(null));
    }
    div._nLines = nLines; div._focus = focus;
  });
}
/** display name in charts: Kantone as «Kanton XY» */
const nmOf = (s) => (s.id === 'CH' || s.grp ? nameOf(s) : region(s.id).e === 'KT' ? `Kanton ${region(s.id).kt}` : nameOf(s));

export function indexLines(div, series, which, years) {
  // series: [{id, d}] ; which: 'bev'|'b65'|'b80'
  // lean style (like the report): solid lines, the region thick, names and end values at the line ends instead of a legend
  const idx = (d) => { const base = d.ts[which][0]; return d.ts[which].map((v) => (base ? (v / base) * 100 : null)); };
  const nm = (s) => (s.id === 'CH' || s.grp ? nameOf(s) : region(s.id).e === 'KT' ? `Kanton ${region(s.id).kt}` : nameOf(s));
  const data = series.map((s, k) => ({ type: 'scatter', mode: 'lines', x: s.d.ts.y, y: idx(s.d), name: nm(s), showlegend: false,
    line: { color: colOf(s, k), width: k === 0 ? 3.5 : s.grp ? 2.5 : 2 },
    customdata: s.d.ts[which], hovertemplate: `${nm(s)} %{x}: %{customdata:,.0f} Personen (Index %{y:.0f})<extra></extra>` }));
  leanPlot(div, data, series.map((s, k) => ({ s, k, x: s.d.ts.y, y: idx(s.d) })), nm, years, { note: `Index ${years[0]} = 100`, ref100: true });
}

/** Alters- und Pflegeheime over time. which: 'pl80' places per 1000 80+, 'kl80' residents per 1000 80+,
 *  'pl' places as index (first year = 100). Series without any Heim in the period are left out. */
export const APH_TS_OPTS = { pl80: 'Plätze pro 1000 Menschen ab 80', kl80: 'Heimbewohnende pro 1000 Menschen ab 80', pl: 'Pflegeheimplätze (Index)' };
export function aphRate(s, which, k) {
  const a = s.d.aph_ts; const b = s.d.ts && s.d.ts.b80[k];
  if (which === 'pl') return a.pl[0] ? (a.pl[k] / a.pl[0]) * 100 : null;
  return b ? (a[which === 'kl80' ? 'kl' : 'pl'][k] / b) * 1000 : null;
}
export function aphLines(div, series, which, years) {
  const use = series.filter((s) => s.d.aph_ts && s.d.ts && s.d.aph_ts.pl.some((x) => x > 0));
  const abs = which === 'kl80' ? 'kl' : 'pl';
  const data = use.map((s) => {
    const k0 = series.indexOf(s); const a = s.d.aph_ts;
    return { type: 'scatter', mode: 'lines', x: a.y, y: a.y.map((_, k) => rnd(aphRate(s, which, k), 1)), name: nmOf(s), showlegend: false,
      line: { color: colOf(s, k0), width: k0 === 0 ? 3.5 : s.grp ? 2.5 : 2 },
      customdata: a[abs], hovertemplate: which === 'pl'
        ? `${nmOf(s)} %{x}: %{customdata:,.0f} Plätze (Index %{y:.0f})<extra></extra>`
        : `${nmOf(s)} %{x}: %{y:.0f} pro 1000 ab 80 (%{customdata:,.0f} ${abs === 'kl' ? 'Heimbewohnende' : 'Plätze'})<extra></extra>` };
  });
  const lab = APH_TS_OPTS[which];
  div._table = { columns: ['Jahr', ...use.flatMap((s) => [`${nameOf(s)}: ${abs === 'kl' ? 'Heimbewohnende' : 'Plätze'}`, `${nameOf(s)}: ${which === 'pl' ? `Index ${years[0]} = 100` : 'pro 1000 ab 80'}`])],
    rows: (use[0] ? use[0].d.aph_ts.y : []).map((y, k) => [y, ...use.flatMap((s) => [s.d.aph_ts[abs][k], rnd(aphRate(s, which, k), 1)])]) };
  div._title = `${lab} ${years[0]}–${years[1]}`;
  leanPlot(div, data, use.map((s) => ({ s, k: series.indexOf(s), x: s.d.aph_ts.y, y: s.d.aph_ts.y.map((_, k) => aphRate(s, which, k)) })), nmOf, years,
    { note: which === 'pl' ? `Index ${years[0]} = 100` : 'pro 1000 Menschen ab 80', ref100: which === 'pl', tozero: which !== 'pl' });
}

/** one Heim indicator over time (detail.aph_hist[indId]); series without values are left out */
export function histLines(div, series, indId, years) {
  const i = S.ind.get(indId);
  const use = series.filter((s) => s.d.aph_hist && s.d.aph_hist[indId] && s.d.aph_hist[indId].some((v) => v != null));
  const x = (S.meta.hist_years && S.meta.hist_years[indId]) || Array.from({ length: years[1] - years[0] + 1 }, (_, k) => years[0] + k);
  const data = use.map((s) => {
    const k0 = series.indexOf(s); const v = s.d.aph_hist[indId];
    return { type: 'scatter', mode: 'lines', x, y: v, name: nmOf(s), connectgaps: false, showlegend: false,
      line: { color: colOf(s, k0), width: k0 === 0 ? 3.5 : s.grp ? 2.5 : 2 },
      customdata: v.map((y) => fmtUnit(y, i)), hovertemplate: `${nmOf(s)} %{x}: %{customdata}<extra></extra>` };
  });
  div._table = { columns: ['Jahr', ...use.map((s) => `${nameOf(s)} (${i.unit})`)], rows: x.map((y, k) => [y, ...use.map((s) => s.d.aph_hist[indId][k])]) };
  div._title = `${i.label} ${years[0]}–${years[1]}`;
  leanPlot(div, data, use.map((s) => ({ s, k: series.indexOf(s), x, y: s.d.aph_hist[indId] })), nmOf, [x[0], x[x.length - 1]],
    { note: i.unit, fmtEnd: (v) => fmt(v, i) });
}

export function shareBars(div, cats, series, unitLabel = '%', xTitle = '') {
  // series: [{id, values(abs)}] → shares in %
  const data = series.map((s, k) => {
    const { values } = s; const tot = values.reduce((a, b) => a + (b || 0), 0);
    return { type: 'bar', x: cats, y: values.map((v) => (tot ? ((v || 0) / tot) * 100 : null)), name: nameOf(s),
      marker: { color: colOf(s, k) }, hovertemplate: `${nameOf(s)} · ${xTitle ? xTitle + ' ' : ''}%{x}: %{y:.1f} ${unitLabel}<extra></extra>` };
  });
  div._table = { columns: ['Kategorie', ...series.flatMap((s) => [`${nameOf(s)} (Anzahl)`, `${nameOf(s)} (%)`])],
    rows: cats.map((c, k) => [c, ...series.flatMap(({ values }, j) => [values[k] == null ? null : rnd(values[k], 0), rnd(data[j].y[k], 2)])]) };
  plot(div, data, baseLayout({ height: 320, barmode: 'group', showlegend: true, legend: { orientation: 'h', y: xTitle ? -0.3 : -0.2 }, margin: { l: 40, r: 10, t: 10, b: 60 },
    xaxis: { type: 'category', title: xTitle ? { text: xTitle, font: { size: 11, color: C.muted }, standoff: 6 } : undefined },
    yaxis: { ticksuffix: ' %', gridcolor: C.grid } }));
}

export function stackedMix(div, series, cats, colors) {
  // series: [{id, mix:{cat: abs}}] → horizontal 100 % bars
  const ys = series.map((s, k) => (k === 0 ? `<b>${nameOf(s)}</b>` : nameOf(s)));
  const data = cats.map((c, j) => ({ type: 'bar', orientation: 'h', name: c, y: ys,
    x: series.map(({ mix }) => { const t = Object.values(mix).reduce((a, b) => a + Math.max(0, b), 0); return t ? (Math.max(0, mix[c]) / t) * 100 : null; }),
    marker: { color: colors[j] }, hovertemplate: `${c}: %{x:.1f} %<extra></extra>` }));
  div._table = { columns: ['Region', ...cats.map((c) => `${c} (%)`), ...cats.map((c) => `${c} (CHF)`)],
    rows: series.map((s, k) => [nameOf(s), ...cats.map((c, j) => rnd(data[j].x[k], 2)), ...cats.map((c) => rnd(s.mix[c], 0))]) };
  plot(div, data, baseLayout({ height: 60 + 46 * series.length, barmode: 'stack', showlegend: true, legend: { orientation: 'h', y: -0.25 },
    margin: { l: 8, r: 10, t: 6, b: 50 }, yaxis: { autorange: 'reversed', automargin: true }, xaxis: { ticksuffix: ' %', range: [0, 100], gridcolor: C.grid } }));
}

export function bewChart(div, series) {
  const keys = ['Geburten', 'Todesfälle', 'Zuzug inter-kanton', 'Wegzug inter-kanton', 'Einwanderung', 'Auswanderung', 'Erwerb CH-Bürgerrecht'];
  const lab = { 'Zuzug inter-kanton': 'Zuzug aus anderen Kantonen', 'Wegzug inter-kanton': 'Wegzug in andere Kantone', Einwanderung: 'Einwanderung (Ausland)', Auswanderung: 'Auswanderung (Ausland)', 'Erwerb CH-Bürgerrecht': 'Einbürgerungen' };
  const data = series.map((s, k) => ({ type: 'bar', orientation: 'h', y: keys.map((x) => lab[x] || x), x: keys.map((x) => s.d.bew[x]), name: nameOf(s),
    marker: { color: colOf(s, k) }, hovertemplate: `${nameOf(s)} · %{y}: %{x:.2f} % pro Jahr<extra></extra>` }));
  div._table = { columns: ['Bewegung', ...series.map((s) => `${nameOf(s)} (% der Bevölkerung pro Jahr)`)],
    rows: keys.map((x) => [lab[x] || x, ...series.map(({ d }) => rnd(d.bew[x], 3))]) };
  plot(div, data, baseLayout({ height: 380, barmode: 'group', showlegend: true, legend: { orientation: 'h', y: -0.12 }, margin: { l: 8, r: 10, t: 6, b: 50 },
    yaxis: { autorange: 'reversed', automargin: true }, xaxis: { ticksuffix: ' %', gridcolor: C.grid, title: { text: 'in % der Bevölkerung pro Jahr', font: { size: 11 } } } }));
}

export function peerScatter(div, id, xInd, yInd, mode = 'kt') {
  const r = region(id); const lvl = r.e === 'GDE' ? 'GDE' : r.e === 'BEZ' ? 'BEZ' : 'KT';  // CH: all Kantone, none highlighted
  const pool = S.regions.filter((x) => x.e === lvl && (lvl === 'KT' || x.kt === r.kt));
  const pts = pool.map((x) => ({ x, a: val(xInd, x.id), b: val(yInd, x.id) })).filter((p) => p.a != null && p.b != null);
  // log axes: only positive values can be drawn (all values stay in the exported table)
  const pos = pts.filter((p) => p.a > 0 && p.b > 0);
  // comparison group («Vergleichen mit»): highlighted in teal, members outside the Kanton added (e.g. an Eigene Auswahl)
  const gm = mode !== 'kt' && r.e !== 'CH' ? groupMembers(mode, id) : [];
  const gset = new Set(gm);
  const gpts = gm.map((g) => region(g)).filter(Boolean).map((x) => ({ x, a: val(xInd, x.id), b: val(yInd, x.id) })).filter((p) => p.a > 0 && p.b > 0);
  const me = pos.filter((p) => p.x.id === id); const rest = pos.filter((p) => p.x.id !== id && !gset.has(p.x.id));
  const ix = S.ind.get(xInd); const iy = S.ind.get(yInd);
  // Kantone: abbreviation inside large bubbles, above small bubbles; dark text, white only on the orange bubble
  const BIG = 22;
  const tr = (arr, c, size, name) => {
    const t = { type: 'scatter', mode: 'markers', x: arr.map((p) => p.a), y: arr.map((p) => p.b), name,
      customdata: arr.map((p) => p.x.n), marker: { color: c, size: arr.map((p) => size(p)), line: { color: C.edge, width: 1 }, opacity: 0.85 },
      hovertemplate: `<b>%{customdata}</b><br>${ix.short}: %{x:.1f}<br>${iy.short}: %{y:.1f}<extra></extra>` };
    if (lvl === 'KT') {
      t.mode = 'markers+text'; t.text = arr.map((p) => p.x.kt); t.cliponaxis = false;
      t.textposition = arr.map((p) => (size(p) >= BIG ? 'middle center' : 'top center'));
      t.textfont = { family: FONT.family, size: 11, color: arr.map((p) => (size(p) >= BIG ? (c === C.me ? '#ffffff' : '#17232c') : C.ink)) };
    }
    return t;
  };
  const sz = (p) => Math.max(6, Math.min(30, Math.sqrt(p.x.pop) / 12));
  const vk = [val(xInd, lvl === 'KT' ? 'CH' : `KT:${r.kt}`), val(yInd, lvl === 'KT' ? 'CH' : `KT:${r.kt}`)];
  div._table = { columns: ['Region', 'Kanton', 'Einwohner', `${ix.short} (${ix.unit})`, `${iy.short} (${iy.unit})`],
    rows: [...pts.sort((a, b) => b.x.pop - a.x.pop).map((p) => [p.x.e === 'BEZ' ? `Bezirk ${p.x.n}` : p.x.n, p.x.kt, p.x.pop, rnd(p.a, 2), rnd(p.b, 2)]),
      ['Schweiz', 'CH', region('CH').pop, rnd(val(xInd, 'CH'), 2), rnd(val(yInd, 'CH'), 2)]] };
  // Switzerland as a red reference bubble (fixed size), third legend entry
  const chx = val(xInd, 'CH'); const chy = val(yInd, 'CH');
  const chTrace = chx > 0 && chy > 0 ? [{ type: 'scatter', mode: lvl === 'KT' ? 'markers+text' : 'markers', x: [chx], y: [chy], name: 'Schweiz',
    marker: { color: C.chRed, size: lvl === 'KT' ? 26 : 20, line: { color: C.edge, width: 1.5 }, opacity: 0.95 },
    text: lvl === 'KT' ? ['CH'] : undefined, textposition: 'middle center', textfont: { family: FONT.family, size: 11, color: '#ffffff' }, cliponaxis: false,
    hovertemplate: `<b>Schweiz</b><br>${ix.short}: %{x:.1f}<br>${iy.short}: %{y:.1f}<extra></extra>` }] : [];
  const own = mode === 'own' && gpts.length <= 3;     // Eigene Auswahl up to three: each with its name and colour, as in the line charts
  const OWNC = ['#2a9d8f', '#8e5bb5', '#b07d12'];
  const grpTr = !gpts.length ? [] : own ? gpts.map((p, k) => ({ ...tr([p], OWNC[k], (q) => sz(q) + 2, shortName(p.x.id)), mode: 'markers+text', text: [shortName(p.x.id)], textposition: 'top center', textfont: { family: FONT.family, size: 11, color: OWNC[k] }, cliponaxis: false }))
    : [tr(gpts, C.grp, (q) => sz(q) + 1, `${groupLabelFor(mode, r.e)} (${gpts.length})`)];
  plot(div, [tr(rest, C.rest, sz, lvl === 'GDE' ? `Gemeinden ${r.kt}` : lvl === 'BEZ' ? `Bezirke ${r.kt}` : 'Kantone'), ...grpTr, tr(me, C.me, (p) => sz(p) + 4, shortName(id)), ...chTrace],
    baseLayout({ height: 420, showlegend: true, legend: { orientation: 'h', y: -0.18 }, margin: { l: 56, r: 12, t: 28, b: 60 },
      // both axes logarithmic with readable ticks 1-2-5; shapes use data values, annotations log10 positions
      xaxis: { type: 'log', title: { text: `${ix.short} (log. Skala)`, font: { size: 12 } }, gridcolor: C.grid, zeroline: false, ...logTicks([...pos, ...gpts].map((p) => p.a).concat(vk[0] > 0 ? [vk[0]] : [], chx > 0 ? [chx] : [])) },
      yaxis: { type: 'log', title: { text: `${iy.short} (log. Skala)`, font: { size: 12 } }, gridcolor: C.grid, zeroline: false, ...logTicks([...pos, ...gpts].map((p) => p.b).concat(vk[1] > 0 ? [vk[1]] : [], chy > 0 ? [chy] : [])) },
      shapes: vk[0] > 0 && vk[1] > 0 ? [
        { type: 'line', x0: vk[0], x1: vk[0], yref: 'paper', y0: 0, y1: 1, line: { color: C.kt, dash: 'dot', width: 1 } },
        { type: 'line', y0: vk[1], y1: vk[1], xref: 'paper', x0: 0, x1: 1, line: { color: C.kt, dash: 'dot', width: 1 } }] : [],
      annotations: vk[0] > 0 ? [{ x: Math.log10(vk[0]), yref: 'paper', y: 1, text: lvl === 'KT' ? 'Schweiz' : `Kanton ${r.kt}`, showarrow: false, font: { size: 11, color: C.kt }, yanchor: 'bottom' }] : [] }));
  const dropped = pts.length - pos.length;
  if (dropped) div.insertAdjacentHTML('afterend', `<p class="note no-print">${dropped} ${lvl === 'GDE' ? 'Gemeinden' : 'Regionen'} ohne Heim oder ohne Spitex-Stunden fehlen in der Grafik (Wert 0 lässt sich auf einer logarithmischen Achse nicht zeigen); sie sind im Export enthalten.</p>`);
}

/** log axis with ticks 1, 2, 5, 10, 20, 50 … covering the values, plus a small margin */
function logTicks(values) {
  const v = values.filter((x) => x > 0);
  if (!v.length) return {};
  const lo = Math.min(...v) / 1.25; const hi = Math.max(...v) * 1.25;
  const ticks = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) { const t = m * 10 ** e; if (t >= lo && t <= hi) ticks.push(t); }
  }
  if (ticks.length < 4) {   // narrow range: add 1.5, 3, 4, 6, 8 steps so the axis is still readable
    for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) {
      for (const m of [1.5, 3, 4, 6, 8]) { const t = m * 10 ** e; if (t >= lo && t <= hi) ticks.push(t); }
    }
    ticks.sort((a, b) => a - b);
  }
  const fmtT = (t) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(t);
  return { range: [Math.log10(lo), Math.log10(hi)], tickvals: ticks, ticktext: ticks.map(fmtT) };
}

export function simpleBars(div, cats, values, color = C.kt, suffix = '') {
  plot(div, [{ type: 'bar', x: cats, y: values, marker: { color }, hovertemplate: `%{x}: %{y:,.0f}${suffix}<extra></extra>` }],
    baseLayout({ height: 280, margin: { l: 50, r: 10, t: 10, b: 50 }, yaxis: { gridcolor: C.grid } }));
}

export { C as COLORS, fmtInt, rnd };
