// Answer cards (key sentence → chart → explanation → source) and the chart types.
import { S, val, region, parents, shortName, regionLabel, sentence, fmt, fmtUnit, fmtInt, sourceLine,
  groupMembers, groupLabel, inMappe, toggleMappe, detail } from './store.js?v=20261112004657';
import { toast, esc } from './ui.js?v=20261112004657';
import { exportItems, exportMenu, FORMATS } from './export.js?v=20261112004657';

const rnd = (v, d) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const plain = (h) => String(h || '').replace(/<[^>]+>/g, '');
const ebene = { CH: 'Schweiz', KT: 'Kanton', BEZ: 'Bezirk', GDE: 'Gemeinde' };

const C = { me: '#e8701a', bez: '#8fb3d6', kt: '#1b67b2', ch: '#3a4046', grey: '#c7d0d6', ink: '#17232c', muted: '#5b6872', line: '#dbe1e5' };
const FONT = { family: 'Noto Sans, Helvetica Neue, Arial, sans-serif', size: 13, color: C.ink };
const CFG = { displayModeBar: false, responsive: true, locale: 'de-CH' };

export function baseLayout(extra = {}) {
  return { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 8, r: 16, t: 8, b: 28 },
    hoverlabel: { font: { family: FONT.family } }, showlegend: false, ...extra };
}
export const plot = (div, data, layout, cfg = {}) => Plotly.react(div, data, layout, { ...CFG, ...cfg });

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
  let sent = levelOk ? sentence(indId, id) : null;
  if (indId === 'bev' && r.e !== 'CH') {
    const same = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).sort((a, b) => b.pop - a.pop);
    const what = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirken' : 'Kantonen';
    sent = `${shortName(id)}: <b>${fmtInt(v)}</b> Einwohnerinnen und Einwohner – Rang ${same.findIndex((x) => x.id === id) + 1} von ${same.length} ${what}${r.e === 'KT' ? '' : ' im Kanton'}.`;
  }
  let empty = '';
  if (!levelOk) {
    const b = r.e === 'GDE' ? r.bez : null;
    empty = `Für einzelne Gemeinden nicht sinnvoll. ${b ? `Wert für den ${regionLabel(b, false)}: <b>${fmtUnit(val(indId, b), i)}</b>.` : ''}`;
  } else if (v == null) {
    const isAph = ['somed'].includes(i.src) && r.e === 'GDE';
    const b = r.e === 'GDE' ? r.bez : null;
    empty = isAph ? `In ${r.n} gibt es kein Alters- und Pflegeheim. ${b && val(indId, b) != null ? `Wert für den ${regionLabel(b, false)}: <b>${fmtUnit(val(indId, b), i)}</b>.` : ''}`
      : 'Für diese Region liegt kein Wert vor.';
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
    <div class="chart" aria-hidden="true"></div>
    ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
    <details class="how"><summary>Wie wird das gemessen?</summary><p>${esc(i.def)}</p>
      <p><a href="${S.meta.sources[i.src].url}" target="_blank" rel="noopener">${esc(S.meta.sources[i.src].publisher)} – ${esc(S.meta.sources[i.src].name)} ↗</a> · <a href="#/daten">Methodik</a></p></details>
    <p class="src-line">${esc(sourceLine(i.src))}</p>`;
  const div = card.querySelector('.chart');
  const useGroup = mode !== 'kt' && r.e !== 'CH' && r.e !== 'KT';
  if (indId === 'bev' && !useGroup) div.remove();   // absolute size: no benchmark bars
  else requestAnimationFrame(() => (useGroup ? groupChart(div, indId, id, mode) : benchmarkChart(div, indId, id)));
  card.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'mappe') {
      const now = toggleMappe({ ind: indId, id });
      b.classList.toggle('on', now); b.setAttribute('aria-pressed', now); b.title = now ? 'Aus den Favoriten entfernen' : 'Als Favorit hinzufügen'; b.setAttribute('aria-label', b.title); b.innerHTML = now ? ICON.starOn : ICON.star;
      toast(now ? 'Als Favorit hinzugefügt' : 'Aus den Favoriten entfernt'); document.dispatchEvent(new Event('mappe'));
    } else if (b.dataset.act === 'export') {
      const item = indicatorItem(indId, id, { mode, div: div.isConnected ? div : null, sentence: sent || empty });
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
  const useGroup = mode !== 'kt' && r.e !== 'CH' && r.e !== 'KT';
  let ids = useGroup ? [id, ...groupMembers(mode, id), `KT:${r.kt}`, 'CH'] : [id, ...parents(id)];
  ids = [...new Set(ids)];
  const rows = ids.map((x) => { const rr = region(x); return [rr.e === 'CH' ? 'Schweiz' : shortName(x), ebene[rr.e], rr.kt || '', rnd(val(indId, x), i.dec + 1)]; });
  if (useGroup) {   // ranking: members sorted, references at the end
    const refs = rows.slice(-2); const mem = rows.slice(0, -2).filter((x) => x[3] != null).sort((a, b) => b[3] - a[3]);
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
  if (rows.length < 2) { div.innerHTML = `<p class="empty">Für „${groupLabel[mode]}“ liegen zu wenige Werte vor.</p>`; return; }
  const vk = val(indId, `KT:${r.kt}`); const vc = val(indId, 'CH');
  const shapes = []; const ann = [];
  // labels of the two reference lines: if the lines are close, put "Schweiz" one row higher so the texts never overlap
  const span = Math.max(...rows.map((d) => Math.abs(d.v)), Math.abs(vk ?? 0), Math.abs(vc ?? 0)) || 1;
  const close = vk != null && vc != null && Math.abs(vk - vc) / span < 0.18;
  [[vk, `Kanton ${r.kt}`, C.kt, 0], [vc, 'Schweiz', C.ch, close ? 15 : 0]].forEach(([v, lab, c, lift]) => {
    if (v == null) return;
    shapes.push({ type: 'line', x0: v, x1: v, yref: 'paper', y0: 0, y1: 1, line: { color: c, width: 1.5, dash: 'dot' } });
    ann.push({ x: v, yref: 'paper', y: 1, yshift: 2 + lift, text: lab, showarrow: false, font: { size: 11, color: c }, yanchor: 'bottom',
      bgcolor: 'rgba(255,255,255,0.85)', borderpad: 1 });
    if (lift) shapes.push({ type: 'line', x0: v, x1: v, yref: 'paper', y0: 1, y1: 1, line: { color: c, width: 1, dash: 'dot' } });
  });
  plot(div, [{ type: 'bar', orientation: 'h', y: rows.map((d) => (d.x === id ? `<b>${shortName(d.x)}</b>` : shortName(d.x))), x: rows.map((d) => d.v),
    marker: { color: rows.map((d) => (d.x === id ? C.me : C.grey)) }, text: rows.map((d) => fmt(d.v, i)), textposition: rows.some((d) => d.v < 0) ? 'auto' : 'outside', cliponaxis: false,
    hovertemplate: '%{y}: %{x}<extra></extra>' }],
  baseLayout({ height: 26 * rows.length + (close ? 74 : 60), margin: { l: 8, r: 60, t: close ? 40 : 26, b: 4 }, shapes, annotations: ann,
    yaxis: { autorange: 'reversed', automargin: true, tickfont: { size: 12 } }, xaxis: { visible: false, rangemode: 'tozero' }, bargap: 0.25 }));
}

// ---------------------------------------------------------------- special charts per Unterthema
export function chartCard(title, sub, srcKey, wide = true) {
  const card = document.createElement('article');
  card.className = `card${wide ? ' wide' : ''}`;
  card.innerHTML = `<div class="card-head"><h3>${esc(title)}</h3><div class="card-tools no-print"><button class="icon-btn" data-act="export" aria-label="Exportieren" aria-haspopup="menu" title="Exportieren: Bild, PDF, PowerPoint, Excel, CSV">${ICON.dl}</button></div></div>
    ${sub ? `<p class="key-sentence">${sub}</p>` : ''}<div class="chart"></div><p class="src-line">${esc(sourceLine(srcKey))}</p>`;
  const div = card.querySelector('.chart');
  const btn = card.querySelector('[data-act="export"]');
  btn.onclick = () => exportMenu(btn, (f) => exportItems(f, [{ title: div._title || title, sheet: title, sentence: card.querySelector('.key-sentence')?.innerHTML || '',
    source: sourceLine(srcKey), div, table: div._table || { columns: [], rows: [] } }]));
  return { card, div, setSub: (h) => { let p = card.querySelector('.key-sentence'); if (!p) { p = document.createElement('p'); p.className = 'key-sentence'; card.querySelector('.card-head').after(p); } p.innerHTML = h; } };
}

export function pyramid(div, d, dk, years) {
  const [y0, y1] = years; const g = d.pyr.groups;
  const tot = (p) => p.m.reduce((a, b) => a + b, 0) + p.f.reduce((a, b) => a + b, 0);
  const pct = (arr, p) => arr.map((x) => (x / tot(p)) * 100);
  const now = d.pyr[y1]; const then = d.pyr[y0]; const ref = dk.pyr[y1];
  const data = [
    { type: 'bar', orientation: 'h', y: g, x: pct(now.m, now).map((x) => -x), name: `Männer ${y1}`, marker: { color: '#7eaed9' }, hovertemplate: 'Männer %{y}: %{customdata:.1f} %<extra></extra>', customdata: pct(now.m, now) },
    { type: 'bar', orientation: 'h', y: g, x: pct(now.f, now), name: `Frauen ${y1}`, marker: { color: '#f2a46a' }, hovertemplate: 'Frauen %{y}: %{x:.1f} %<extra></extra>' },
    { type: 'scatter', mode: 'lines', y: g, x: pct(then.m, then).map((x) => -x), name: `${y0}`, line: { color: C.ink, width: 1.5, shape: 'hvh' }, hoverinfo: 'skip' },
    { type: 'scatter', mode: 'lines', y: g, x: pct(then.f, then), showlegend: false, line: { color: C.ink, width: 1.5, shape: 'hvh' }, hoverinfo: 'skip' },
    { type: 'scatter', mode: 'lines', y: g, x: pct(ref.m, ref).map((x) => -x), name: 'Schweiz ' + y1, line: { color: C.kt, width: 1.2, dash: 'dot', shape: 'hvh' }, hoverinfo: 'skip' },
    { type: 'scatter', mode: 'lines', y: g, x: pct(ref.f, ref), showlegend: false, line: { color: C.kt, width: 1.2, dash: 'dot', shape: 'hvh' }, hoverinfo: 'skip' },
  ];
  const m = Math.max(...data.slice(0, 2).flatMap((t) => t.x.map(Math.abs)), ...pct(ref.m, ref), ...pct(ref.f, ref)) * 1.1;
  const ticks = [-6, -4, -2, 0, 2, 4, 6].filter((t) => Math.abs(t) <= m);
  const r1 = (a) => a.map((x) => rnd(x, 2));
  const tm = pct(now.m, now); const tf = pct(now.f, now); const pm = pct(then.m, then); const pf = pct(then.f, then);
  div._table = { columns: ['Altersgruppe', `Männer ${y1} (Personen)`, `Frauen ${y1} (Personen)`, `Männer ${y1} (%)`, `Frauen ${y1} (%)`,
    `Männer ${y0} (%)`, `Frauen ${y0} (%)`, `Schweiz Männer ${y1} (%)`, `Schweiz Frauen ${y1} (%)`],
  rows: g.map((x, k) => [x, now.m[k], now.f[k], r1(tm)[k], r1(tf)[k], r1(pm)[k], r1(pf)[k], r1(pct(ref.m, ref))[k], r1(pct(ref.f, ref))[k]]) };
  plot(div, data, baseLayout({ height: 460, barmode: 'overlay', bargap: 0.08, showlegend: true,
    legend: { orientation: 'h', y: -0.08, font: { size: 12 } }, margin: { l: 8, r: 8, t: 8, b: 40 },
    xaxis: { range: [-m, m], tickvals: ticks, ticktext: ticks.map((t) => `${Math.abs(t)} %`), zeroline: true, zerolinecolor: C.line, gridcolor: '#eef1f3' },
    yaxis: { automargin: true, tickfont: { size: 11 } } }));
}

export function indexLines(div, series, which, years) {
  // series: [{id, d}] ; which: 'bev'|'b65'|'b80'
  const col = (id, k) => (k === 0 ? C.me : id === 'CH' ? C.ch : C.kt);
  const data = series.map(({ id, d }, k) => {
    const base = d.ts[which][0];
    return { type: 'scatter', mode: 'lines+markers', x: d.ts.y, y: d.ts[which].map((v) => (base ? (v / base) * 100 : null)), name: shortName(id),
      line: { color: col(id, k), width: k === 0 ? 3 : 2, dash: k === 0 ? 'solid' : id === 'CH' ? 'dot' : 'dash' }, marker: { size: k === 0 ? 6 : 4 },
      customdata: d.ts[which], hovertemplate: `${shortName(id)} %{x}: %{customdata:,.0f} Personen (Index %{y:.0f})<extra></extra>` };
  });
  const lab = { bev: 'Bevölkerung', b65: 'Personen ab 65', b80: 'Personen ab 80' }[which];
  div._table = { columns: ['Jahr', ...series.flatMap(({ id }) => [`${shortName(id)}: ${lab}`, `${shortName(id)}: Index ${years[0]} = 100`])],
    rows: series[0].d.ts.y.map((y, k) => [y, ...series.flatMap(({ d }) => [d.ts[which][k], rnd(d.ts[which][0] ? (d.ts[which][k] / d.ts[which][0]) * 100 : null, 1)])]) };
  div._title = `Entwicklung ${lab} ${years[0]}–${years[1]}`;
  plot(div, data, baseLayout({ height: 340, showlegend: true, legend: { orientation: 'h', y: -0.15 }, margin: { l: 44, r: 12, t: 10, b: 50 },
    xaxis: { dtick: 2, gridcolor: '#eef1f3' }, yaxis: { title: { text: `Index ${years[0]} = 100`, font: { size: 11 } }, gridcolor: '#eef1f3' },
    shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 100, y1: 100, line: { color: C.line, width: 1 } }] }));
}

export function shareBars(div, cats, series, unitLabel = '%') {
  // series: [{id, values(abs)}] → shares in %
  const data = series.map(({ id, values }, k) => {
    const tot = values.reduce((a, b) => a + (b || 0), 0);
    return { type: 'bar', x: cats, y: values.map((v) => (tot ? ((v || 0) / tot) * 100 : null)), name: shortName(id),
      marker: { color: k === 0 ? C.me : id === 'CH' ? C.ch : C.kt }, hovertemplate: `${shortName(id)} · %{x}: %{y:.1f} ${unitLabel}<extra></extra>` };
  });
  div._table = { columns: ['Kategorie', ...series.flatMap(({ id }) => [`${shortName(id)} (Anzahl)`, `${shortName(id)} (%)`])],
    rows: cats.map((c, k) => [c, ...series.flatMap(({ values }, j) => [values[k] == null ? null : rnd(values[k], 0), rnd(data[j].y[k], 2)])]) };
  plot(div, data, baseLayout({ height: 320, barmode: 'group', showlegend: true, legend: { orientation: 'h', y: -0.2 }, margin: { l: 40, r: 10, t: 10, b: 60 },
    yaxis: { ticksuffix: ' %', gridcolor: '#eef1f3' } }));
}

export function stackedMix(div, series, cats, colors) {
  // series: [{id, mix:{cat: abs}}] → horizontal 100 % bars
  const ys = series.map(({ id }, k) => (k === 0 ? `<b>${shortName(id)}</b>` : shortName(id)));
  const data = cats.map((c, j) => ({ type: 'bar', orientation: 'h', name: c, y: ys,
    x: series.map(({ mix }) => { const t = Object.values(mix).reduce((a, b) => a + Math.max(0, b), 0); return t ? (Math.max(0, mix[c]) / t) * 100 : null; }),
    marker: { color: colors[j] }, hovertemplate: `${c}: %{x:.1f} %<extra></extra>` }));
  div._table = { columns: ['Region', ...cats.map((c) => `${c} (%)`), ...cats.map((c) => `${c} (CHF)`)],
    rows: series.map(({ id, mix }, k) => [shortName(id), ...cats.map((c, j) => rnd(data[j].x[k], 2)), ...cats.map((c) => rnd(mix[c], 0))]) };
  plot(div, data, baseLayout({ height: 60 + 46 * series.length, barmode: 'stack', showlegend: true, legend: { orientation: 'h', y: -0.25 },
    margin: { l: 8, r: 10, t: 6, b: 50 }, yaxis: { autorange: 'reversed', automargin: true }, xaxis: { ticksuffix: ' %', range: [0, 100], gridcolor: '#eef1f3' } }));
}

export function bewChart(div, series) {
  const keys = ['Geburten', 'Todesfälle', 'Zuzug inter-kanton', 'Wegzug inter-kanton', 'Einwanderung', 'Auswanderung', 'Erwerb CH-Bürgerrecht'];
  const lab = { 'Zuzug inter-kanton': 'Zuzug aus anderen Kantonen', 'Wegzug inter-kanton': 'Wegzug in andere Kantone', Einwanderung: 'Einwanderung (Ausland)', Auswanderung: 'Auswanderung (Ausland)', 'Erwerb CH-Bürgerrecht': 'Einbürgerungen' };
  const data = series.map(({ id, d }, k) => ({ type: 'bar', orientation: 'h', y: keys.map((x) => lab[x] || x), x: keys.map((x) => d.bew[x]), name: shortName(id),
    marker: { color: k === 0 ? C.me : id === 'CH' ? C.ch : C.kt }, hovertemplate: `${shortName(id)} · %{y}: %{x:.2f} % pro Jahr<extra></extra>` }));
  div._table = { columns: ['Bewegung', ...series.map(({ id }) => `${shortName(id)} (% der Bevölkerung pro Jahr)`)],
    rows: keys.map((x) => [lab[x] || x, ...series.map(({ d }) => rnd(d.bew[x], 3))]) };
  plot(div, data, baseLayout({ height: 380, barmode: 'group', showlegend: true, legend: { orientation: 'h', y: -0.12 }, margin: { l: 8, r: 10, t: 6, b: 50 },
    yaxis: { autorange: 'reversed', automargin: true }, xaxis: { ticksuffix: ' %', gridcolor: '#eef1f3', title: { text: 'in % der Bevölkerung pro Jahr', font: { size: 11 } } } }));
}

export function peerScatter(div, id, xInd, yInd) {
  const r = region(id); const lvl = r.e === 'GDE' ? 'GDE' : r.e === 'BEZ' ? 'BEZ' : 'KT';  // CH: all Kantone, none highlighted
  const pool = S.regions.filter((x) => x.e === lvl && (lvl === 'KT' || x.kt === r.kt));
  const pts = pool.map((x) => ({ x, a: val(xInd, x.id), b: val(yInd, x.id) })).filter((p) => p.a != null && p.b != null);
  const me = pts.filter((p) => p.x.id === id); const rest = pts.filter((p) => p.x.id !== id);
  const ix = S.ind.get(xInd); const iy = S.ind.get(yInd);
  // Kantone: abbreviation inside large bubbles, above small bubbles; dark text, white only on the orange bubble
  const BIG = 22;
  const tr = (arr, c, size, name) => {
    const t = { type: 'scatter', mode: 'markers', x: arr.map((p) => p.a), y: arr.map((p) => p.b), name,
      customdata: arr.map((p) => p.x.n), marker: { color: c, size: arr.map((p) => size(p)), line: { color: '#fff', width: 1 }, opacity: 0.85 },
      hovertemplate: `<b>%{customdata}</b><br>${ix.short}: %{x:.1f}<br>${iy.short}: %{y:.1f}<extra></extra>` };
    if (lvl === 'KT') {
      t.mode = 'markers+text'; t.text = arr.map((p) => p.x.kt); t.cliponaxis = false;
      t.textposition = arr.map((p) => (size(p) >= BIG ? 'middle center' : 'top center'));
      t.textfont = { family: FONT.family, size: 11, color: arr.map((p) => (size(p) >= BIG && c === C.me ? '#ffffff' : C.ink)) };
    }
    return t;
  };
  const sz = (p) => Math.max(6, Math.min(30, Math.sqrt(p.x.pop) / 12));
  const vk = [val(xInd, lvl === 'KT' ? 'CH' : `KT:${r.kt}`), val(yInd, lvl === 'KT' ? 'CH' : `KT:${r.kt}`)];
  div._table = { columns: ['Region', 'Kanton', 'Einwohner', `${ix.short} (${ix.unit})`, `${iy.short} (${iy.unit})`],
    rows: pts.sort((a, b) => b.x.pop - a.x.pop).map((p) => [p.x.e === 'BEZ' ? `Bezirk ${p.x.n}` : p.x.n, p.x.kt, p.x.pop, rnd(p.a, 2), rnd(p.b, 2)]) };
  plot(div, [tr(rest, '#9fb6c8', sz, lvl === 'GDE' ? `Gemeinden ${r.kt}` : lvl === 'BEZ' ? `Bezirke ${r.kt}` : 'Kantone'), tr(me, C.me, (p) => sz(p) + 4, shortName(id))],
    baseLayout({ height: 420, showlegend: true, legend: { orientation: 'h', y: -0.18 }, margin: { l: 56, r: 12, t: 28, b: 60 },
      xaxis: { title: { text: ix.short, font: { size: 12 } }, gridcolor: '#eef1f3', zeroline: false },
      yaxis: { title: { text: iy.short, font: { size: 12 } }, gridcolor: '#eef1f3', zeroline: false },
      shapes: vk[0] != null ? [
        { type: 'line', x0: vk[0], x1: vk[0], yref: 'paper', y0: 0, y1: 1, line: { color: C.kt, dash: 'dot', width: 1 } },
        { type: 'line', y0: vk[1], y1: vk[1], xref: 'paper', x0: 0, x1: 1, line: { color: C.kt, dash: 'dot', width: 1 } }] : [],
      annotations: vk[0] != null ? [{ x: vk[0], yref: 'paper', y: 1, text: lvl === 'KT' ? 'Schweiz' : `Kanton ${r.kt}`, showarrow: false, font: { size: 11, color: C.kt }, yanchor: 'bottom' }] : [] }));
}

export function simpleBars(div, cats, values, color = C.kt, suffix = '') {
  plot(div, [{ type: 'bar', x: cats, y: values, marker: { color }, hovertemplate: `%{x}: %{y:,.0f}${suffix}<extra></extra>` }],
    baseLayout({ height: 280, margin: { l: 50, r: 10, t: 10, b: 50 }, yaxis: { gridcolor: '#eef1f3' } }));
}

export { C as COLORS, fmtInt, rnd };
