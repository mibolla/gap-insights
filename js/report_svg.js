// Gemeindebericht: small, dependency-free SVG charts. Every function returns an SVG string.
// Colours come from CSS classes defined in css/report.css (c-me, c-bez, c-kt, c-ch, …), so both themes work.
import { S } from './store.js?v=20261113195938';
import { esc } from './ui.js?v=20261113195938';

const nf = (d) => new Intl.NumberFormat('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : nf(d).format(v));

function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { hi = lo + 1; }
  const span = hi - lo; const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw)); const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const t0 = Math.floor(lo / step) * step; const t1 = Math.ceil(hi / step) * step; const out = [];
  for (let t = t0; t <= t1 + step * 0.001; t += step) out.push(Math.round(t / step) * step);
  return out;
}
const svg = (w, h, label, body) => `<svg class="rchart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMinYMin meet">${body}</svg>`;
/** spread label y positions so they keep a minimum distance */
function spread(items, gap = 14) {
  const s = items.slice().sort((a, b) => a.y - b.y);
  for (let k = 1; k < s.length; k += 1) if (s[k].y - s[k - 1].y < gap) s[k].y = s[k - 1].y + gap;
  return items;
}

// ------------------------------------------------------------------ horizontal bars (one value per region)
/** rows: [{label, v, cls, text, bold}] */
export function hbars(rows, { label = '', w = 640, unit = '' } = {}) {
  rows = rows.filter((r) => r.v != null && !Number.isNaN(r.v));
  if (!rows.length) return '';
  const L = 170; const R = 80; const rh = 30; const top = label ? 24 : 6;
  const lo = Math.min(0, ...rows.map((r) => r.v)); const hi = Math.max(0, ...rows.map((r) => r.v));
  const x = (v) => L + ((v - lo) / (hi - lo || 1)) * (w - L - R);
  const h = top + rows.length * rh + 6;
  let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  b += `<line class="c-axis" x1="${x(0)}" x2="${x(0)}" y1="${top - 2}" y2="${h - 4}"/>`;
  rows.forEach((r, k) => {
    const y = top + k * rh; const x0 = x(Math.min(0, r.v)); const x1 = x(Math.max(0, r.v));
    b += `<text class="c-lab${r.bold ? ' b' : ''}" x="${L - 10}" y="${y + rh / 2 + 4}" text-anchor="end">${esc(r.label)}</text>`;
    b += `<rect class="${r.cls}" x="${x0}" y="${y + 6}" width="${Math.max(1, x1 - x0)}" height="${rh - 12}" rx="3"/>`;
    b += `<text class="c-val${r.bold ? ' b' : ''}" x="${r.v < 0 ? x0 - 6 : x1 + 6}" y="${y + rh / 2 + 4}" text-anchor="${r.v < 0 ? 'end' : 'start'}">${esc(r.text ?? num(r.v, 1) + unit)}</text>`;
  });
  return svg(w, h, label || 'Balkendiagramm', b);
}

/** grouped bars: groups [{label, items:[{name, v, cls, text}]}] with a legend */
export function groupedBars(groups, { label = '', w = 640, legend = [] } = {}) {
  const L = 110; const R = 80; const bh = 14; const gap = 12; const top = (label ? 24 : 4) + (legend.length ? 22 : 0);
  const all = groups.flatMap((g) => g.items.map((i) => i.v)).filter((v) => v != null);
  const hi = Math.max(1, ...all);
  const x = (v) => L + (v / hi) * (w - L - R);
  let y = top; let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  let lx = 0;
  legend.forEach((l) => { b += `<rect class="${l.cls}" x="${lx}" y="${top - 18}" width="12" height="12" rx="2"/><text class="c-lab" x="${lx + 17}" y="${top - 8}">${esc(l.name)}</text>`; lx += 30 + l.name.length * 7; });
  for (const g of groups) {
    const gh = g.items.length * (bh + 3);
    b += `<text class="c-lab" x="${L - 10}" y="${y + gh / 2 + 3}" text-anchor="end">${esc(g.label)}</text>`;
    g.items.forEach((i, k) => {
      const yy = y + k * (bh + 3);
      if (i.v == null) return;
      b += `<rect class="${i.cls}" x="${L}" y="${yy}" width="${Math.max(1, x(i.v) - L)}" height="${bh}" rx="2"/>`;
      b += `<text class="c-val" x="${x(i.v) + 6}" y="${yy + bh - 3}">${esc(i.text ?? num(i.v))}</text>`;
    });
    y += gh + gap;
  }
  return svg(w, y, label || 'Gruppierte Balken', b);
}

// ------------------------------------------------------------------ 100 % stacked bars
/** rows: [{label, parts:[numbers]}]; cats: names; classes: css class per category */
export function stacked(rows, cats, classes, { label = '', w = 640 } = {}) {
  const L = 150; const rh = 30; const top = (label ? 24 : 4); const legH = 22;
  let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  rows.forEach((r, k) => {
    const tot = r.parts.reduce((a, c) => a + (c || 0), 0); if (!tot) return;
    const y = top + k * rh; let x = L;
    b += `<text class="c-lab${r.bold ? ' b' : ''}" x="${L - 10}" y="${y + rh / 2 + 4}" text-anchor="end">${esc(r.label)}</text>`;
    r.parts.forEach((p, c) => {
      const ww = ((p || 0) / tot) * (w - L - 4);
      b += `<rect class="${classes[c]}" x="${x}" y="${y + 5}" width="${Math.max(0, ww - 1)}" height="${rh - 10}"/>`;
      if (ww > 34) b += `<text class="c-in" x="${x + ww / 2}" y="${y + rh / 2 + 4}" text-anchor="middle">${num((p / tot) * 100)} %</text>`;
      x += ww;
    });
  });
  let y = top + rows.length * rh + 10; let lx = L;
  cats.forEach((c, k) => {
    const wd = 24 + c.length * 6.6;
    if (lx + wd > w) { lx = L; y += 18; }
    b += `<rect class="${classes[k]}" x="${lx}" y="${y}" width="12" height="12" rx="2"/><text class="c-lab" x="${lx + 17}" y="${y + 10}">${esc(c)}</text>`;
    lx += wd;
  });
  return svg(w, y + legH - 4, label || 'Gestapelte Balken', b);
}

// ------------------------------------------------------------------ index lines (time series)
/** x: years; series: [{name, y, cls, bold}] */
export function lines(x, series, { label = '', w = 640, h = 250, fmtY = (v) => num(v), refLine = null } = {}) {
  const L = 44; const R = 130; const T = label ? 28 : 10; const B = 26;
  const vals = series.flatMap((s) => s.y).filter((v) => v != null);
  const ticks = niceTicks(Math.min(...vals, refLine ?? Infinity), Math.max(...vals, refLine ?? -Infinity));
  const lo = ticks[0]; const hi = ticks[ticks.length - 1];
  const px = (v) => L + ((v - x[0]) / (x[x.length - 1] - x[0])) * (w - L - R);
  const py = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (h - T - B);
  let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  ticks.forEach((t) => { b += `<line class="c-grid" x1="${L}" x2="${w - R}" y1="${py(t)}" y2="${py(t)}"/><text class="c-tick" x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`; });
  if (refLine != null) b += `<line class="c-ref" x1="${L}" x2="${w - R}" y1="${py(refLine)}" y2="${py(refLine)}"/>`;
  const step = x.length > 8 ? 4 : 1;
  x.forEach((yr, k) => { if (k % step === 0 || k === x.length - 1) b += `<text class="c-tick" x="${px(yr)}" y="${h - 6}" text-anchor="middle">${yr}</text>`; });
  const ends = [];
  series.forEach((s) => {
    const pts = s.y.map((v, k) => (v == null ? null : `${px(x[k]).toFixed(1)},${py(v).toFixed(1)}`)).filter(Boolean).join(' ');
    b += `<polyline class="ln ${s.cls}${s.bold ? ' b' : ''}" points="${pts}"/>`;
    const lv = s.y[s.y.length - 1];
    b += `<circle class="dot ${s.cls}" cx="${px(x[x.length - 1])}" cy="${py(lv)}" r="${s.bold ? 4 : 3}"/>`;
    ends.push({ y: py(lv) + 4, t: `${s.name} ${fmtY(lv)}`, cls: s.cls, bold: s.bold });
  });
  spread(ends).forEach((e) => { b += `<text class="c-end ${e.cls}${e.bold ? ' b' : ''}" x="${w - R + 8}" y="${e.y}">${esc(e.t)}</text>`; });
  return svg(w, h, label || 'Zeitreihe', b);
}

// ------------------------------------------------------------------ fan chart: observed + scenario band
export function fan({ xObs, obs, xP, lo, mid, hi, j, label = '', w = 640, h = 280, fmtV = (v) => num(v) }) {
  const L = 54; const R = 110; const T = label ? 30 : 12; const B = 26;
  const all = [...obs, ...lo, ...hi].filter((v) => v != null);
  const ticks = niceTicks(0, Math.max(...all) * 1.05);
  const top = ticks[ticks.length - 1];
  const x0 = xObs[0]; const x1 = xP[xP.length - 1];
  const px = (v) => L + ((v - x0) / (x1 - x0)) * (w - L - R);
  const py = (v) => T + (1 - v / top) * (h - T - B);
  let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  ticks.forEach((t) => { b += `<line class="c-grid" x1="${L}" x2="${w - R}" y1="${py(t)}" y2="${py(t)}"/><text class="c-tick" x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${esc(fmtV(t))}</text>`; });
  [x0, 2020, 2030, 2040, 2050].filter((yy) => yy >= x0 && yy <= x1).forEach((yy) => { b += `<text class="c-tick" x="${px(yy)}" y="${h - 6}" text-anchor="middle">${yy}</text>`; });
  const band = [...xP.map((yy, k) => `${px(yy).toFixed(1)},${py(hi[k]).toFixed(1)}`), ...xP.slice().reverse().map((yy, k) => `${px(yy).toFixed(1)},${py(lo[lo.length - 1 - k]).toFixed(1)}`)].join(' ');
  b += `<polygon class="c-band" points="${band}"/>`;
  const now = xP[0];
  b += `<line class="c-now" x1="${px(now)}" x2="${px(now)}" y1="${T - 4}" y2="${h - B}"/><text class="c-tick" x="${px(now) - 5}" y="${T + 6}" text-anchor="end">beobachtet</text><text class="c-tick" x="${px(now) + 5}" y="${T + 6}">Szenarien</text>`;
  b += `<polyline class="ln c-me b" points="${xObs.map((yy, k) => `${px(yy).toFixed(1)},${py(obs[k]).toFixed(1)}`).join(' ')}"/>`;
  b += `<polyline class="ln c-me dash" points="${xP.map((yy, k) => `${px(yy).toFixed(1)},${py(mid[k]).toFixed(1)}`).join(' ')}"/>`;
  const kj = xP.indexOf(j);
  if (kj >= 0) {
    b += `<line class="c-mark" x1="${px(j)}" x2="${px(j)}" y1="${py(hi[kj])}" y2="${py(lo[kj])}"/><circle class="dot c-me" cx="${px(j)}" cy="${py(mid[kj])}" r="5"/>`;
    b += `<text class="c-val b" x="${px(j)}" y="${py(hi[kj]) - 8}" text-anchor="middle">${j}: rund ${esc(fmtV(mid[kj]))}</text>`;
  }
  const n = xP.length - 1;
  spread([{ y: py(hi[n]) + 4, t: `hoch ${fmtV(hi[n])}` }, { y: py(mid[n]) + 4, t: `mittel ${fmtV(mid[n])}` }, { y: py(lo[n]) + 4, t: `tief ${fmtV(lo[n])}` }])
    .forEach((e) => { b += `<text class="c-end" x="${w - R + 8}" y="${e.y}">${esc(e.t)}</text>`; });
  return svg(w, h, label || 'Szenarien', b);
}

// ------------------------------------------------------------------ age pyramid (shares), bars = region, line = reference
export function pyramid(groups, a, ref, { label = '', w = 640, aName = '', refName = '' } = {}) {
  const rh = 13; const T = (label ? 26 : 4) + 22; const mid = w / 2; const cw = 46; const B = 22;
  const tot = (p) => p.m.reduce((s, x) => s + x, 0) + p.f.reduce((s, x) => s + x, 0);
  const ta = tot(a); const tr = ref ? tot(ref) : 1;
  const sa = { m: a.m.map((x) => (x / ta) * 100), f: a.f.map((x) => (x / ta) * 100) };
  const sr = ref ? { m: ref.m.map((x) => (x / tr) * 100), f: ref.f.map((x) => (x / tr) * 100) } : null;
  const mx = Math.max(...sa.m, ...sa.f, ...(sr ? [...sr.m, ...sr.f] : [])) * 1.05;
  const half = mid - cw / 2 - 8;
  const len = (v) => (v / mx) * half;
  const n = groups.length; const h = T + n * rh + B;
  const yOf = (k) => T + (n - 1 - k) * rh;      // oldest on top
  let b = label ? `<text class="c-cap" x="0" y="14">${esc(label)}</text>` : '';
  b += `<text class="c-lab" x="${mid - cw / 2 - 8}" y="${T - 8}" text-anchor="end">Männer</text><text class="c-lab" x="${mid + cw / 2 + 8}" y="${T - 8}">Frauen</text>`;
  groups.forEach((g, k) => {
    const y = yOf(k); const old = k >= 13;
    b += `<rect class="${old ? 'c-me' : 'c-me soft'}" x="${mid - cw / 2 - len(sa.m[k])}" y="${y + 1}" width="${len(sa.m[k])}" height="${rh - 2}"/>`;
    b += `<rect class="${old ? 'c-me' : 'c-me soft'}" x="${mid + cw / 2}" y="${y + 1}" width="${len(sa.f[k])}" height="${rh - 2}"/>`;
    if (k % 2 === 0 || k === n - 1) b += `<text class="c-tick" x="${mid}" y="${y + rh - 3}" text-anchor="middle">${esc(g)}</text>`;
  });
  if (sr) {
    const step = (side) => groups.map((_, k) => {
      const y = yOf(k); const xx = side === 'm' ? mid - cw / 2 - len(sr.m[k]) : mid + cw / 2 + len(sr.f[k]);
      return `${xx.toFixed(1)},${(y + rh).toFixed(1)} ${xx.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    b += `<polyline class="ln c-kt" points="${step('m')}"/><polyline class="ln c-kt" points="${step('f')}"/>`;
  }
  const ly = h - 6;
  b += `<rect class="c-me" x="0" y="${ly - 10}" width="12" height="12" rx="2"/><text class="c-lab" x="17" y="${ly}">${esc(aName)} (Anteil in %, 65+ kräftig)</text>`;
  if (sr) b += `<line class="ln c-kt" x1="${w - 190}" x2="${w - 172}" y1="${ly - 4}" y2="${ly - 4}"/><text class="c-lab" x="${w - 166}" y="${ly}">${esc(refName)}</text>`;
  return svg(w, h, label || 'Alterspyramide', b);
}

// ------------------------------------------------------------------ dot strip: position among all Gemeinden of the Kanton
/** rows: [{label, all:[v], peers:[v], me, kt, fmtV, note}] */
export function dotStrip(rows, { w = 640 } = {}) {
  const rh = 62; const L = 10; const R = 10; let b = '';
  rows.forEach((r, k) => {
    const vals = r.all.filter((v) => v != null);
    if (!vals.length || r.me == null) return;
    const lo = Math.min(...vals, r.me); const hi = Math.max(...vals, r.me);
    const x = (v) => L + ((v - lo) / (hi - lo || 1)) * (w - L - R);
    const y0 = k * rh; const yl = y0 + 36;
    b += `<text class="c-lab b" x="0" y="${y0 + 14}">${esc(r.label)}</text><text class="c-lab" x="${w}" y="${y0 + 14}" text-anchor="end">${esc(r.note || '')}</text>`;
    b += `<line class="c-axis" x1="${L}" x2="${w - R}" y1="${yl}" y2="${yl}"/>`;
    vals.forEach((v) => { b += `<circle class="c-all" cx="${x(v).toFixed(1)}" cy="${yl}" r="3"/>`; });
    (r.peers || []).filter((v) => v != null).forEach((v) => { b += `<circle class="c-peer" cx="${x(v).toFixed(1)}" cy="${yl}" r="4.5"/>`; });
    if (r.kt != null) b += `<line class="c-ktmark" x1="${x(r.kt)}" x2="${x(r.kt)}" y1="${yl - 11}" y2="${yl + 11}"/>`;
    b += `<circle class="dot c-me" cx="${x(r.me)}" cy="${yl}" r="6.5"/>`;
    const anchor = x(r.me) < 60 ? 'start' : x(r.me) > w - 60 ? 'end' : 'middle';
    b += `<text class="c-val b" x="${x(r.me)}" y="${yl + 22}" text-anchor="${anchor}">${esc(r.fmtV(r.me))}</text>`;
    b += `<text class="c-tick" x="${L}" y="${yl + 22}">${esc(r.fmtV(lo))}</text><text class="c-tick" x="${w - R}" y="${yl + 22}" text-anchor="end">${esc(r.fmtV(hi))}</text>`;
  });
  return svg(w, rows.length * rh, 'Lage im Kanton', b);
}

// ------------------------------------------------------------------ locator maps (from the app's geo.json)
function bbox(d) {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (let k = 0; k + 1 < n.length; k += 2) { x0 = Math.min(x0, n[k]); x1 = Math.max(x1, n[k]); y0 = Math.min(y0, n[k + 1]); y1 = Math.max(y1, n[k + 1]); }
  return { x0, y0, x1, y1 };
}
export function locatorKanton(id) {
  const G = S.geo; const r = S.byId.get(id); const kt = r.kt;
  const bb = bbox(G.kt[kt]); const pad = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.06;
  const vb = [bb.x0 - pad, bb.y0 - pad, bb.x1 - bb.x0 + 2 * pad, bb.y1 - bb.y0 + 2 * pad].map((v) => v.toFixed(1)).join(' ');
  const sw = (bb.x1 - bb.x0) / 320;
  const gde = S.regions.filter((x) => x.e === 'GDE' && x.kt === kt);
  let b = '';
  for (const g of gde) { const d = G.gde[g.id.slice(4)]; if (d) b += `<path class="m-gde${g.id === id ? ' m-me' : g.bez === r.bez ? ' m-bez' : ''}" d="${d}" stroke-width="${sw}"/>`; }
  b += `<path class="m-kt" d="${G.kt[kt]}" stroke-width="${sw * 2.2}"/>`;
  return `<svg class="rmap" viewBox="${vb}" role="img" aria-label="${esc(`Lage von ${r.n} im Kanton ${kt}`)}">${b}</svg>`;
}
export function locatorCH(id) {
  const G = S.geo; const r = S.byId.get(id);
  let b = `<path class="m-ch" d="${G.ch}"/>`;
  b += `<path class="m-ktsel" d="${G.kt[r.kt]}"/>`;
  const c = G.c[id.slice(4)];
  if (c) b += `<circle class="m-pin" cx="${c[0]}" cy="${c[1]}" r="9"/>`;
  return `<svg class="rmap ch" viewBox="0 0 ${G.w} ${G.h}" role="img" aria-label="${esc(`Kanton ${r.kt} in der Schweiz`)}">${b}</svg>`;
}
