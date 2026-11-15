// Landing chapter «Ein Tag Pflege»: a scroll-driven story on one canvas in the sticky map panel.
// Step 0: an average day of Pflegeheime and Spitex (runs until the reader scrolls on)
// Step 1/2: staff per Bezirk (Heim | Spitex) → the Kantone fly into a scatter and become Wappen
// Step 3/4: services per Bezirk → scatter with Wappen · Step 5: time travel of the services 2012 → reporting year
// Data: data/tagpflege.json (cop/s8_tagpflege.py), heime.json, spitex.json, geo.json; daily rosters and visit routes are modelled.
import { S, dataUrl, region, wappen } from './store.js?v=20261115214001';
import { reduced } from './map.js?v=20261115214001';

let TP = null, HE = null, SX = null;
const load = () => Promise.all([
  TP || (TP = fetch(dataUrl('tagpflege.json')).then((r) => r.json())),
  HE || (HE = fetch(dataUrl('heime.json')).then((r) => r.json())),
  SX || (SX = fetch(dataUrl('spitex.json')).then((r) => r.json())),
]);
const fmt = (x) => Math.round(x).toLocaleString('de-CH').replace(/[,’]/g, '’');

// modelled daily rosters (hourly weights): Spitex visits and staff on duty; Heime with early, late and night shift
const SPX = [0.6, 0.4, 0.3, 0.3, 0.5, 1.6, 5.5, 9.5, 10, 9, 7.5, 5.5, 4, 3.8, 4.5, 5, 5.8, 7.5, 8, 6.5, 4.5, 2.6, 1.5, 0.9];
const APH = [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.7, 1, 1, 1, 1, 0.95, 0.9, 0.85, 0.9, 0.85, 0.8, 0.8, 0.75, 0.65, 0.55, 0.45, 0.4, 0.35];
const norm = (a) => { const s = a.reduce((x, y) => x + y, 0); return a.map((x) => x / s); };
const sp = norm(SPX), ap = norm(APH);
const rate = (p, h) => { const i = Math.floor(h) % 24, j = (i + 1) % 24, f = h - Math.floor(h); return p[i] * (1 - f) + p[j] * f; };
const cum = (p, h) => { const i = Math.floor(h) % 24; let s = 0; for (let k = 0; k < i; k++) s += p[k]; return s + p[i] * (h - Math.floor(h)); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const H_PER_VZAE = 1900, BESUCH_MIN = 45, PX_KM = 1000 / 349;
export const STEPS = 6;

/** text of the step cards (step 0 is the chapter card itself) */
export function tagpflegeSteps() {
  return [
    { title: 'Wie viel Personal?', text: 'Nach Mitternacht wird gezählt: Vollzeitstellen in Pflegeheimen (links) und bei der Spitex (rechts) pro 1000 Menschen ab 80, je Bezirk. Gezählt wird am Standort von Heim und Spitex-Organisation.' },
    { title: 'Heim und Spitex im Vergleich', text: 'Die Kantone fliegen aus beiden Karten in ein Streudiagramm und werden zu ihren Wappen: rechts viel Personal im Heim, oben viel bei der Spitex. Die gestrichelten Linien sind die Schweiz.' },
    { title: 'Und die Leistungen?', text: 'Pflegetage im Heim und Spitex-Stunden pro Mensch ab 80 und Jahr, je Bezirk – wo wird wie viel gepflegt?' },
    { title: 'Leistungen nach Kanton', text: 'Die Romandie setzt stärker auf die Spitex, Appenzell, Glarus und Uri stärker auf das Heim.' },
    { title: 'Zeitreise 2012 → heute', text: 'Fast alle Kantone wandern nach links oben: weniger Pflegetage im Heim, mehr Spitex-Stunden pro Mensch ab 80. Blass = 2012, kräftig = heute. Mit der Maus auf ein Wappen zeigen: Seine Spur erscheint.' },
  ];
}

/**
 * mount the chapter on the story map: map = createMap api (its SVG is hidden while the chapter runs),
 * opts: scope (element with data-tp placeholders: clock, duty, play, speed, tot), setCap(text), ctl (receives go(step)), initStep(),
 *       legendEl (legend of the host to hide), auto { maps, scatter } (hero: staff maps → scatter by time, then onDone())
 */
export async function tagpflegeChapter(map, setTip, alive, opts = {}) {
  const [T, Hm, Sx] = await load();
  if (!alive()) return '';
  const N = { ...T.n }; N.heime = N.heime || Hm.x.length;
  // overlay (hero): only the day, drawn over the interactive map in its own coordinates, following its zoom and drift
  const OV = !!opts.overlay;
  const G = S.geo, W = 1000, H = OV ? G.h : 700, OY = OV ? 0 : 34;
  const panel = map.container.parentElement;
  panel.querySelector('.tp-stage')?.remove();
  const stage = document.createElement('div'); stage.className = 'tp-stage';
  stage.innerHTML = '<canvas aria-label="Karte der Schweiz: Pflegeheime, Spitex-Standorte und Spitex-Besuche im Tagesverlauf, danach Personal und Leistungen je Bezirk und Kanton"></canvas><div class="tp-leg small"></div>';
  const legEl = opts.legendEl || panel.querySelector('#storyLegend');
  if (OV) { stage.classList.add('tp-overlay'); map.container.appendChild(stage); }
  else { panel.insertBefore(stage, map.container); map.container.hidden = true; if (legEl) legEl.hidden = true; }
  const zoomRoot = map.svg.firstElementChild;
  const Z = () => { if (!OV) return [1, 0, 0]; const tr = zoomRoot.getAttribute('transform') || ''; const m = tr.match(/translate\(([-\d.e]+),\s*([-\d.e]+)\)\s*scale\(([-\d.e]+)\)/); return m ? [+m[3], +m[1], +m[2]] : [1, 0, 0]; };
  const cv = stage.querySelector('canvas'), ctx = cv.getContext('2d'), tpLeg = stage.querySelector('.tp-leg');
  let dpr = 1;
  const fit = () => { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; base = null; };
  const KTS = Object.keys(G.kt); const ktP = KTS.map((k) => new Path2D(G.kt[k])); const chP = new Path2D(G.ch);
  let base = null;
  const drawBase = () => {
    const off = document.createElement('canvas'); off.width = W * dpr; off.height = H * dpr; const o = off.getContext('2d');
    o.fillStyle = '#0b1420'; o.fillRect(0, 0, off.width, off.height);
    o.scale(dpr, dpr); o.translate(0, OY);
    o.fillStyle = '#16263a'; o.fill(chP);
    o.strokeStyle = 'rgba(147,166,182,.22)'; o.lineWidth = 0.8; ktP.forEach((p) => o.stroke(p));
    o.strokeStyle = 'rgba(147,166,182,.45)'; o.lineWidth = 1.2; o.stroke(chP);
    return off;
  };
  // ---- the day: Spitex visits from the organisation to a point in a Gemeinde of its Bezirk (∝ people 65+);
  // a Bezirk without a Spitex seat is served from its neighbouring Bezirke in the same Kanton (T.ext)
  const BZ = { ...T.bz }, BZW = {}; Object.entries(T.ext || {}).forEach(([k, us]) => { if (BZ[k]) BZ[k] = BZ[k].concat(...us.map((u) => T.bz[u] || [])); }); Object.entries(BZ).forEach(([k, gs]) => { let t = 0; BZW[k] = gs.map((g) => (t += T.p65[g] + 1)); });
  const O = Sx.x.map((x, i) => [x, Sx.y[i], Sx.c[i], T.obz[i], Sx.v[i] || 1]).filter((o) => o[3] && BZ[o[3]]);
  const oc = []; let tot = 0; O.forEach((o) => { tot += o[2]; oc.push(tot); });
  const bs = (arr, r) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < r) lo = m + 1; else hi = m; } return lo; };
  const pickOrg = () => O[bs(oc, Math.random() * tot)];
  const pickDest = (o) => { const gs = BZ[o[3]], cw = BZW[o[3]], g = gs[bs(cw, Math.random() * cw[cw.length - 1])], P = T.gpts[g], k = (Math.random() * (P.length / 2)) | 0;
    return [P[2 * k] + (Math.random() - 0.5) * 2, P[2 * k + 1] + (Math.random() - 0.5) * 2]; };
  const HE_ = Hm.x.map((x, i) => [x, Hm.y[i], Hm.p[i]]);
  const SPARKS_DAY = N.spx_std_day * 60 / BESUCH_MIN;
  const PH_H = N.heim_vzae * H_PER_VZAE / 365, PH_S = N.spx_vzae * H_PER_VZAE / 365;
  const onH = (h) => PH_H * rate(ap, h), onS = (h) => PH_S * rate(sp, h);
  const apMax = Math.max(...ap), spMax = Math.max(...sp);
  let trips = [], rings = [], Tm = 6 * 60, acc = 0, playing = !reduced(), last = performance.now();
  const q = (k) => opts.scope?.querySelector(`[data-tp="${k}"]`);
  const secPerDay = () => +(q('speed')?.value || 12);
  const tod = () => ((Tm % 1440) + 1440) % 1440;
  const spawn = (at) => { const o = pickOrg(), d = pickDest(o), km = Math.hypot(d[0] - o[0], d[1] - o[1]) / PX_KM;
    trips.push({ x0: o[0], y0: o[1], x1: d[0], y1: d[1], t0: at, dur: Math.min(60, 10 + 2 * km), bend: (Math.random() - 0.5) * 24 }); };
  const emit = (t0, t1) => { for (let m = t0; m < t1;) { const st = Math.min(1, t1 - m), h = (((m % 1440) + 1440) % 1440) / 60;
    acc += SPARKS_DAY * rate(sp, h) * st / 60; while (acc >= 1) { acc -= 1; spawn(m + Math.random() * st); } m += st; } };
  const warm = () => { trips = []; rings = []; acc = Math.random(); emit(Tm - 90, Tm); };
  if (OV) Tm = 5 * 60; const T0 = Tm;
  if (reduced()) Tm = 8 * 60;
  function drawDay(h, dim) {
    const [zk, zx, zy] = Z(); ctx.setTransform(dpr * zk, 0, 0, dpr * zk, dpr * zx, dpr * (zy + OY * zk)); ctx.globalCompositeOperation = 'lighter';
    const lh = (0.25 + 0.75 * rate(ap, h) / apMax) * dim;
    for (const [x, y, p] of HE_) { const r = 0.8 + Math.sqrt(p) * 0.16; ctx.fillStyle = `rgba(244,169,76,${0.1 * lh})`; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.283); ctx.fill(); ctx.fillStyle = `rgba(255,196,120,${0.65 * lh})`; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 6.283); ctx.fill(); }
    const ls = (0.3 + 0.7 * rate(sp, h) / spMax) * dim;
    ctx.strokeStyle = `rgba(79,209,189,${0.55 * ls})`; ctx.lineWidth = 1;
    for (const o of O) { ctx.beginPath(); ctx.arc(o[0], o[1], 1.2 + Math.sqrt(o[4]) * 0.35, 0, 6.283); ctx.stroke(); }
    trips = trips.filter((t) => {
      const a = (Tm - t.t0) / t.dur; if (a < 0) return true;
      if (a >= 1) { rings.push({ x: t.x1, y: t.y1, t0: t.t0 + t.dur }); return false; }
      if (dim <= 0) return true;
      const e = a < 0.5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2;
      const mx = (t.x0 + t.x1) / 2 - (t.y1 - t.y0) * t.bend / 100, my = (t.y0 + t.y1) / 2 + (t.x1 - t.x0) * t.bend / 100;
      const pt = (s) => [(1 - s) * (1 - s) * t.x0 + 2 * (1 - s) * s * mx + s * s * t.x1, (1 - s) * (1 - s) * t.y0 + 2 * (1 - s) * s * my + s * s * t.y1];
      const [x, y] = pt(e), [xb, yb] = pt(Math.max(0, e - 0.3));
      ctx.strokeStyle = `rgba(110,235,214,${0.55 * dim})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(xb, yb); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(190,255,244,${0.95 * dim})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      return true;
    });
    rings = rings.filter((r) => { const a = (Tm - r.t0) / 8; if (a > 1) return false; if (a < 0) return true; ctx.strokeStyle = `rgba(79,209,189,${0.4 * (1 - a) * dim})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(r.x, r.y, 1.5 + a * 6, 0, 6.283); ctx.stroke(); return true; });
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- staff and services: Bezirk maps (Heim | Spitex) → Kanton scatter with Wappen → time travel
  const BK = Object.keys(T.bez).filter((k) => T.bez[k][2] > 0 && G.bez[k]);
  const BP = BK.map((k) => new Path2D(G.bez[k])), BV = BK.map((k) => T.bez[k]);
  const KPAL = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];   // ColorBrewer Blues, quantile classes (fifths of the Bezirke)
  const kCls = (v, br) => br.filter((b) => v > b).length;
  const KS = T.kt, KTL = KTS.filter((k) => KS[k] && T.lts.kt[k]);
  const KTN = Object.fromEntries(KTL.map((k) => [k, region(`KT:${k}`)?.n || k]));
  const VIEWS = [
    { mapTitle: 'Pflegepersonal pro 1000 Menschen ab 80, nach Bezirk', scTitle: 'Personal: Heim und Spitex im Vergleich, nach Kanton', legLabel: 'Vollzeitstellen pro 1000 ab 80, Quintile der Bezirke',
      xLab: 'Pflegeheime: Vollzeitstellen pro 1000 Menschen ab 80 →', yLab: 'Spitex: Vollzeitstellen pro 1000 Menschen ab 80 →', XR: [120, 300], XS: 30, YR: [20, 110], YS: 20,
      bez: [(b) => b[0] / b[2] * 1000, (b) => b[1] / b[2] * 1000], kt: [(v) => v[0] / v[2] * 1000, (v) => v[1] / v[2] * 1000],
      ch: [N.heim_vzae / N.bev80 * 1000, N.spx_vzae / N.bev80 * 1000], corner: ['viel Personal im Heim und bei der Spitex', 'wenig von beidem'] },
    { mapTitle: 'Leistungen pro Mensch ab 80 und Jahr, nach Bezirk', scTitle: 'Leistungen: Heim und Spitex im Vergleich, nach Kanton', legLabel: 'pro Mensch ab 80 und Jahr, Quintile der Bezirke',
      tTitle: `Leistungen ${T.lts.years[0]} → ${T.lts.years[T.lts.years.length - 1]}: weniger Heim, mehr Spitex – blass = ${T.lts.years[0]}, kräftig = heute`,
      xLab: 'Pflegeheime: Pflegetage pro Mensch ab 80 und Jahr →', yLab: 'Spitex: Stunden pro Mensch ab 80 und Jahr →', XR: [40, 140], XS: 20, YR: [20, 100], YS: 20, time: true,
      bez: [(b) => b[3] / b[2], (b) => b[4] / b[2]], kt: [(v) => v[3] / v[2], (v) => v[4] / v[2]],
      ch: [N.heim_tage / N.bev80, N.spx_std / N.bev80], corner: ['viel Pflege im Heim und viel Spitex', 'wenig von beidem'], units: ['Tage', 'Std.'] },
  ];
  VIEWS.forEach((V) => { V.ser = [0, 1].map((m) => { const v = BV.map(V.bez[m]); const so = [...v].sort((a, b) => a - b);
    return { key: m ? 'Spitex' : 'Pflegeheime', col: m ? '#6eebd6' : '#f4a94c', v, ch: V.ch[m], lo: so[0], hi: so[so.length - 1], br: [0.2, 0.4, 0.6, 0.8].map((x) => so[Math.floor(x * (so.length - 1))]), unit: V.units ? V.units[m] : '' }; }); });
  const LT = T.lts, LY = LT.years, Y1 = LY[LY.length - 1];
  const ltAt = (arr, yr) => { const k = Math.max(0, Math.min(LY.length - 2, Math.floor(yr - LY[0]))), f = Math.max(0, Math.min(1, yr - LY[k])); const a = arr[k], b = arr[k + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  const MAPS = { sc: 0.47 }; MAPS.oy = (H - 632 * MAPS.sc) / 2 + 26; MAPS.ox = [14, 14 + W / 2];
  const PX0 = 120, PX1 = 930, PY0 = 110, PY1 = 610;
  const b80max = Math.max(...KTL.map((k) => KS[k][2]));
  const KR = (k) => 9 + Math.sqrt(KS[k][2] / b80max) * 24;
  const WAP = {}; KTL.forEach((k) => { const im = new Image(); im.src = wappen(`KT:${k}`); WAP[k] = im; });
  const KBB = {}; KTS.forEach((k) => { const n = G.kt[k].match(/-?\d+\.?\d*/g).map(Number); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); } KBB[k] = [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0)]; });
  const sxP = (V, v) => PX0 + (v - V.XR[0]) / (V.XR[1] - V.XR[0]) * (PX1 - PX0), syP = (V, v) => PY1 - (v - V.YR[0]) / (V.YR[1] - V.YR[0]) * (PY1 - PY0);
  const font = (w, px, fam) => `${w} ${px}px ${fam === 'm' ? '"JetBrains Mono", ui-monospace, monospace' : fam === 'd' ? 'Archivo, "Helvetica Neue", sans-serif' : '"Noto Sans", "Helvetica Neue", sans-serif'}`;
  function drawMaps(V, a) {
    const { sc, oy } = MAPS;
    V.ser.forEach((Sr, m) => {
      const ox = MAPS.ox[m];
      ctx.globalAlpha = a; ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
      BP.forEach((p, i) => { ctx.fillStyle = KPAL[kCls(Sr.v[i], Sr.br)]; ctx.fill(p); });
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8; BP.forEach((p) => ctx.stroke(p));
      ctx.strokeStyle = 'rgba(11,20,32,.95)'; ctx.lineWidth = 2; ktP.forEach((p) => ctx.stroke(p));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = Sr.col; ctx.beginPath(); ctx.arc(ox + 8, oy - 26, 6, 0, 6.283); ctx.fill();
      ctx.font = font(700, 24, 'd'); ctx.fillStyle = '#e7eef4'; ctx.fillText(Sr.key, ox + 22, oy - 18);
      ctx.font = font(500, 16, 'm'); ctx.fillStyle = '#93a6b6'; ctx.fillText(`Schweiz ${fmt(Sr.ch)}${Sr.unit ? ' ' + Sr.unit : ''} · Bezirke ${fmt(Sr.lo)}–${fmt(Sr.hi)}`, ox + 22, oy + 4 + 632 * sc + 22);
    });
    ctx.globalAlpha = 1;
  }
  function drawAxes(V, a, chv) {
    ctx.globalAlpha = a; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#1e3044'; ctx.lineWidth = 1; ctx.font = font(500, 16, 'm'); ctx.fillStyle = '#93a6b6';
    for (let v = V.XR[0]; v <= V.XR[1]; v += V.XS) { const x = sxP(V, v); ctx.beginPath(); ctx.moveTo(x, PY0); ctx.lineTo(x, PY1); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(v, x, PY1 + 22); }
    for (let v = V.YR[0]; v <= V.YR[1]; v += V.YS) { const y = syP(V, v); ctx.beginPath(); ctx.moveTo(PX0, y); ctx.lineTo(PX1, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(v, PX0 - 10, y + 5); }
    ctx.font = font(600, 18); ctx.fillStyle = '#f4a94c'; ctx.textAlign = 'center'; ctx.fillText(V.xLab, (PX0 + PX1) / 2, PY1 + 52);
    ctx.save(); ctx.translate(PX0 - 56, (PY0 + PY1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#6eebd6'; ctx.fillText(V.yLab, 0, 0); ctx.restore();
    const cx = sxP(V, chv[0]), cy = syP(V, chv[1]);
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(231,238,244,.55)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(cx, PY0); ctx.lineTo(cx, PY1); ctx.moveTo(PX0, cy); ctx.lineTo(PX1, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = font(600, 15); ctx.fillStyle = '#e7eef4'; ctx.textAlign = 'left'; ctx.fillText(`Schweiz ${fmt(chv[0])}`, cx + 6, PY1 - 10);
    ctx.textAlign = 'right'; ctx.fillText(`Schweiz ${fmt(chv[1])}`, PX1, cy - 8);
    ctx.font = font(500, 14); ctx.fillStyle = 'rgba(147,166,182,.9)'; ctx.textAlign = 'right'; ctx.fillText(V.corner[0], PX1 - 6, PY0 + 18); ctx.textAlign = 'left'; ctx.fillText(V.corner[1], PX0 + 8, PY1 - 10);
    ctx.globalAlpha = 1;
  }
  const HITS = []; let hoverK = null;
  cv.addEventListener('mousemove', (e) => {
    const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * W, y = (e.clientY - b.top) / b.height * H;
    let best = null, bd = 1e9; for (const h of HITS) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h.k; } }
    hoverK = best; cv.style.cursor = best ? 'pointer' : '';
  });
  cv.addEventListener('mouseleave', () => { hoverK = null; cv.style.cursor = ''; });
  /** one perspective at local time t (as in the prototype): 0–6 maps · 6–8.4 flight · 8.4–9.4 Wappen · 10.6–11.8 back to the first year · 11.8–19.6 travel */
  function drawView(V, t, A) {
    const f = t < 6 ? 0 : ease(Math.min(1, (t - 6) / 2.4)), w = t < 8.4 ? 0 : Math.min(1, (t - 8.4) / 1);
    if (f < 1) drawMaps(V, A * (1 - Math.min(1, f * 1.6)));
    const r = V.time ? ease(Math.max(0, Math.min(1, (t - 10.6) / 1.2))) : 0;
    const yr = V.time && t >= 11.8 ? Math.min(Y1, LY[0] + (t - 11.8) / 7.8 * (Y1 - LY[0])) : Y1;
    const travel = V.time && t >= 10.6;
    const posOf = (arr, now) => (!travel ? now : t < 11.8 ? [now[0] + (arr[0][0] - now[0]) * r, now[1] + (arr[0][1] - now[1]) * r] : ltAt(arr, yr));
    const chNow = V.time ? posOf(LT.ch, V.ch) : V.ch;
    if (f > 0) drawAxes(V, A * f, chNow);
    const hk = travel && t >= 11.8 && hoverK && LT.kt[hoverK] ? hoverK : null;
    if (travel && t >= 11.8) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = A * 0.5; ctx.font = font(600, 48, 'm'); ctx.fillStyle = '#e7eef4'; ctx.textAlign = 'right'; ctx.fillText(Math.floor(yr), PX1 - 14, PY1 - 40);
      KTL.forEach((k) => { if (!WAP[k].complete || !WAP[k].naturalWidth) return; const [x0, y0] = LT.kt[k][0], hh = 2 * KR(k), ww = hh * (WAP[k].naturalWidth / WAP[k].naturalHeight);
        ctx.globalAlpha = A * (hk ? (k === hk ? 0.55 : 0.08) : 0.28); ctx.drawImage(WAP[k], sxP(V, x0) - ww / 2, syP(V, y0) - hh / 2, ww, hh); });
      ctx.globalAlpha = A * 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sxP(V, LT.ch[0][0]), syP(V, LT.ch[0][1]), 7, 0, 6.283); ctx.stroke();
      if (hk) {
        const arr = LT.kt[hk], n = Math.floor(yr - LY[0]); ctx.globalAlpha = A; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let k = 0; k <= n; k++) { const x = sxP(V, arr[k][0]), y = syP(V, arr[k][1]); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        const [px, py] = ltAt(arr, yr); ctx.lineTo(sxP(V, px), syP(V, py)); ctx.stroke();
        ctx.fillStyle = '#ffd166'; for (let k = 0; k <= n; k++) { ctx.beginPath(); ctx.arc(sxP(V, arr[k][0]), syP(V, arr[k][1]), 3.2, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    HITS.length = 0;
    if (t >= 6) {
      KTL.forEach((k) => {
        const i = KTS.indexOf(k), [bcx, bcy, bsz] = KBB[k], now = [V.kt[0](KS[k]), V.kt[1](KS[k])], [vx, vy] = V.time ? posOf(LT.kt[k], now) : now;
        const tx = sxP(V, vx), ty = syP(V, vy), ts = (2 * KR(k)) / bsz;
        [0, 1].forEach((m) => {
          const s0 = MAPS.sc, x0 = MAPS.ox[m] + s0 * bcx, y0 = MAPS.oy + s0 * bcy, sc = s0 * Math.pow(ts / s0, f), cx = x0 + (tx - x0) * f, cy = y0 + (ty - y0) * f;
          ctx.globalAlpha = A * (1 - w) * 0.85; ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (cx - sc * bcx), dpr * (cy - sc * bcy));
          ctx.fillStyle = V.ser[m].col; ctx.fill(ktP[i]);
        });
        if (w > 0 && WAP[k].complete && WAP[k].naturalWidth) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = A * w * (hk && k !== hk ? 0.25 : 1);
          const hh = 2 * KR(k), ww = hh * (WAP[k].naturalWidth / WAP[k].naturalHeight);
          HITS.push({ k, x: tx, y: ty, r: Math.max(12, hh / 2) });
          ctx.drawImage(WAP[k], tx - ww / 2, ty - hh / 2, ww, hh);
          ctx.font = font(600, 13); ctx.fillStyle = '#e7eef4'; ctx.textAlign = 'center'; ctx.fillText(k, tx, ty + hh / 2 + 14);
        }
      });
    }
    if (travel) {
      const [cxv, cyv] = chNow; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = A;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0d1826'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sxP(V, cxv), syP(V, cyv), 7, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.font = font(700, 14); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('Schweiz', sxP(V, cxv) + 11, syP(V, cyv) + 5);
    }
    if (hk) {
      const a = LT.kt[hk][0], b = LT.kt[hk][LY.length - 1], [hx, hy] = ltAt(LT.kt[hk], yr);
      const l1 = KTN[hk], l2 = `${LY[0]}: ${fmt(a[0])} Tage · ${fmt(a[1])} Std.`, l3 = `${Y1}: ${fmt(b[0])} Tage · ${fmt(b[1])} Std.`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.font = font(600, 15);
      const bw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width, ctx.measureText(l3).width) + 22;
      let bx = sxP(V, hx) + 28, by = syP(V, hy) - 34; if (bx + bw > W - 8) bx = sxP(V, hx) - 28 - bw; by = Math.max(8, Math.min(H - 76, by));
      ctx.fillStyle = 'rgba(11,20,32,.94)'; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, bw, 68, 8); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = '#ffd166'; ctx.fillText(l1, bx + 11, by + 20); ctx.fillStyle = '#e7eef4'; ctx.font = font(500, 14); ctx.fillText(l2, bx + 11, by + 40); ctx.fillText(l3, bx + 11, by + 58);
    }
    ctx.globalAlpha = 1;
  }

  // ---- clock and «im Dienst» chart in the chapter card (step 0)
  const NS = 'http://www.w3.org/2000/svg';
  const QW = 320, QX0 = 8, QX1 = 312, QY0 = 18, QY1 = 124;
  const qx = (h) => QX0 + (h / 24) * (QX1 - QX0);
  const qMax = Math.ceil(Math.max(...Array.from({ length: 97 }, (_, k) => onH(k / 4))) / 5000) * 5000;
  const qy = (v) => QY1 - (v / qMax) * (QY1 - QY0);
  const clockEl = q('clock'), dutyEl = q('duty');
  if (clockEl) {
    let c = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="47" fill="#0f1b2a" stroke="#24384d" stroke-width="1.5"/>';
    for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI, big = i % 5 === 0, r0 = big ? 37 : 41;
      c += `<line x1="${(r0 * Math.sin(a)).toFixed(2)}" y1="${(-r0 * Math.cos(a)).toFixed(2)}" x2="${(44 * Math.sin(a)).toFixed(2)}" y2="${(-44 * Math.cos(a)).toFixed(2)}" stroke="${big ? '#93a6b6' : '#2c4157'}" stroke-width="${big ? 2 : 1}" stroke-linecap="round"/>`; }
    c += '<line class="hh" x1="0" y1="5" x2="0" y2="-23" stroke="#e7eef4" stroke-width="4" stroke-linecap="round"/><line class="hm" x1="0" y1="7" x2="0" y2="-35" stroke="#f4a94c" stroke-width="2.2" stroke-linecap="round"/><circle r="3.6" fill="#f4a94c"/></svg>';
    clockEl.innerHTML = `${c}<div><b class="num tp-time">06:00</b><span class="tp-ampm">morgens</span></div>`;
  }
  if (dutyEl) {
    const path = (fn) => Array.from({ length: 97 }, (_, k) => { const h = k / 4; return `${k ? 'L' : 'M'}${qx(h).toFixed(1)} ${qy(fn(h)).toFixed(1)}`; }).join('');
    const lH = path(onH), lS = path(onS);
    let b = `<svg viewBox="0 0 ${QW} 140" role="img" aria-label="Personen im Dienst über 24 Stunden: Pflegeheime und Spitex">
      <rect x="${qx(0)}" y="${QY0 - 6}" width="${qx(6) - qx(0)}" height="${QY1 - QY0 + 6}" class="night"/><rect x="${qx(21)}" y="${QY0 - 6}" width="${qx(24) - qx(21)}" height="${QY1 - QY0 + 6}" class="night"/>
      <clipPath id="tpPast"><rect class="past" x="0" y="0" width="${QX0}" height="140"/></clipPath>`;
    for (const v of [qMax / 2, qMax]) b += `<line class="grid" x1="${QX0}" x2="${QX1}" y1="${qy(v)}" y2="${qy(v)}"/><text class="lb" x="${QX0}" y="${qy(v) - 3}">${fmt(v)}</text>`;
    b += `<path d="${lH}" class="ln h ghost"/><path d="${lS}" class="ln s ghost"/>
      <g clip-path="url(#tpPast)"><path d="${lH}L${QX1} ${QY1}L${QX0} ${QY1}Z" class="ar h"/><path d="${lS}L${QX1} ${QY1}L${QX0} ${QY1}Z" class="ar s"/><path d="${lH}" class="ln h"/><path d="${lS}" class="ln s"/></g>
      <line class="ax" x1="${QX0}" x2="${QX1}" y1="${QY1}" y2="${QY1}"/>`;
    for (const hh of [0, 6, 12, 18, 24]) b += `<text class="lb" x="${qx(hh)}" y="${QY1 + 14}" text-anchor="${hh === 0 ? 'start' : hh === 24 ? 'end' : 'middle'}">${hh}</text>`;
    b += `<text class="nm h" x="${qx(9.5)}" y="${qy(onH(9.5)) - 8}" text-anchor="middle">Pflegeheime</text><text class="nm s" x="${qx(13)}" y="${qy(onS(13)) - 8}" text-anchor="middle">Spitex</text>
      <line class="now" y1="${QY0 - 6}" y2="${QY1}"/><circle class="dot h" r="4.5"/><circle class="dot s" r="4.5"/><text class="val h"></text><text class="val s"></text></svg>`;
    dutyEl.innerHTML = b;
  }
  const totEl = q('tot'); if (totEl) totEl.textContent = `Insgesamt ${fmt(N.heim_vzae)} Vollzeitstellen in Pflegeheimen und ${fmt(N.spx_vzae)} bei der Spitex (${fmt(N.spx_pers)} Personen). Rund ${fmt(SPARKS_DAY)} Spitex-Besuche pro Tag (Annahme Ø ${BESUCH_MIN} Minuten). Im Dienst = Personen, die in dieser Stunde arbeiten, modelliert aus den Stellen (${fmt(H_PER_VZAE)} Stunden pro Stelle und Jahr).`;
  const playB = q('play'); if (playB) { playB.textContent = playing ? 'Pause' : 'Abspielen'; playB.onclick = () => { playing = !playing; playB.textContent = playing ? 'Pause' : 'Abspielen'; }; }
  const sel = (c) => dutyEl?.querySelector(c);
  function hands(h) {
    if (clockEl) { clockEl.querySelector('.hh').setAttribute('transform', `rotate(${((h % 12) / 12 * 360).toFixed(2)})`); clockEl.querySelector('.hm').setAttribute('transform', `rotate(${((tod() % 60) / 60 * 360).toFixed(2)})`); }
    if (!dutyEl) return;
    const x = qx(h), yH = qy(onH(h)), yS = qy(onS(h));
    sel('.past').setAttribute('width', x.toFixed(1)); sel('.now').setAttribute('x1', x.toFixed(1)); sel('.now').setAttribute('x2', x.toFixed(1));
    sel('.dot.h').setAttribute('cx', x); sel('.dot.h').setAttribute('cy', yH); sel('.dot.s').setAttribute('cx', x); sel('.dot.s').setAttribute('cy', yS);
    const right = x > QX1 - 60, tx = right ? x - 8 : x + 8, an = right ? 'end' : 'start', gap = Math.max(0, 14 - (yS - yH));
    const vh = sel('.val.h'), vs = sel('.val.s');
    vh.setAttribute('x', tx); vh.setAttribute('y', yH - 6 - gap / 2); vh.setAttribute('text-anchor', an);
    vs.setAttribute('x', tx); vs.setAttribute('y', Math.min(yS + 14 + gap / 2, QY1 - 4)); vs.setAttribute('text-anchor', an);
  }
  let lastUi = -1;
  function ui() {   // numbers in 5-minute steps, coarser at fast speeds (about four changes per second)
    const perSec = 1440 / secPerDay(), st = [5, 10, 15, 30, 60].find((x) => x >= perSec / 4) || 60, mm = Math.floor(tod() / st) * st;
    if (mm === lastUi) return; lastUi = mm; const h = mm / 60;
    const tEl = clockEl?.querySelector('.tp-time'); if (tEl) tEl.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
    const aEl = clockEl?.querySelector('.tp-ampm'); if (aEl) aEl.textContent = h < 5 ? 'nachts' : h < 11 ? 'morgens' : h < 14 ? 'mittags' : h < 18 ? 'nachmittags' : h < 22 ? 'abends' : 'nachts';
    if (dutyEl) { sel('.val.h').textContent = fmt(onH(h)); sel('.val.s').textContent = fmt(onS(h)); }
    const vEl = q('visits'); if (vEl) vEl.textContent = fmt(SPARKS_DAY * cum(sp, h));
  }

  // ---- steps: which perspective and local time; scrolling backwards shows a step's end state
  let step = 0, stepT = 0, cover = 0;
  const legOf = (Sr) => `<span class="lg"><b style="color:${Sr.col === '#f4a94c' ? '#c77a14' : '#1a9c86'}">${Sr.key}:</b>${KPAL.map((c, i) => `<span><i style="background:${c}"></i>${i === 0 ? `bis ${fmt(Sr.br[0])}` : i === 4 ? `über ${fmt(Sr.br[3])}` : `${fmt(Sr.br[i - 1])}–${fmt(Sr.br[i])}`}</span>`).join('')}</span>`;
  const DAY_LEG = '<span class="pt"><i class="h"></i>Pflegeheim (Grösse ∝ Personal, Helligkeit = im Dienst)</span><span class="pt"><i class="st"></i>Spitex-Standort (Grösse ∝ Stellen)</span><span class="pt"><i class="s"></i>1 Funke = 1 Spitex-Besuch</span>';
  const CAPS = ['Ein Tag Pflege: Pflegeheime und Spitex im Tagesverlauf (Durchschnittstag ' + S.meta.jahr + ', modelliert)', VIEWS[0].mapTitle, VIEWS[0].scTitle, VIEWS[1].mapTitle, VIEWS[1].scTitle, VIEWS[1].tTitle];
  const showStep = () => {
    if (OV) { if (legEl) legEl.innerHTML = `<div class="tp-leg small">${DAY_LEG}</div>`; return; }
    opts.setCap?.(CAPS[step]);
    tpLeg.innerHTML = step === 0 ? DAY_LEG : step === 1 || step === 3 ? `<span>${VIEWS[step === 1 ? 0 : 1].legLabel} · gezählt am Standort der Institution</span>${VIEWS[step === 1 ? 0 : 1].ser.map(legOf).join('')}`
      : step === 5 ? '<span>Mit der Maus auf ein Wappen zeigen: seine Spur erscheint · Grösse ∝ Menschen ab 80</span>' : '<span>Wappen = Kanton, Grösse ∝ Menschen ab 80 · gestrichelt = Schweiz</span>';
  };
  const go = (s) => { s = Math.max(0, Math.min(STEPS - 1, s)); if (s === step) return; stepT = s > step ? 0 : 99; step = s; hoverK = null; showStep(); };
  if (opts.ctl) opts.ctl.go = go;
  fit(); warm(); showStep(); go(opts.initStep ? opts.initStep() : 0);
  let done = false, overDone = false;
  if (opts.auto) { cover = 1; go(1); }   // hero entry: starts with the staff maps
  const onResize = () => fit(); window.addEventListener('resize', onResize);

  const tick = (now) => {
    if (!alive()) { stage.remove(); map.container.hidden = false; if (legEl) { legEl.hidden = false; if (OV) legEl.innerHTML = ''; } window.removeEventListener('resize', onResize); return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    stepT += dt;
    if (opts.auto) { if (step === 1 && stepT > opts.auto.maps) go(2); else if (step === 2 && stepT > opts.auto.scatter && !done) { done = true; opts.onDone?.(); } }
    cover = step === 0 ? Math.max(0, cover - dt / 0.8) : Math.min(1, cover + dt / 0.8);
    if (playing && cover < 1) { const dT = dt * 1440 / secPerDay(); emit(Tm, Tm + dT); Tm += dT; }
    const h = tod() / 60;
    if (OV) {   // night map in the zoom of the interactive map underneath
      const [zk, zx, zy] = Z();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * zk, 0, 0, dpr * zk, dpr * zx, dpr * zy);
      ctx.fillStyle = '#16263a'; ctx.fill(chP);
      ctx.strokeStyle = 'rgba(147,166,182,.22)'; ctx.lineWidth = 0.8 / zk; ktP.forEach((p) => ctx.stroke(p));
      ctx.strokeStyle = 'rgba(147,166,182,.45)'; ctx.lineWidth = 1.2 / zk; ctx.stroke(chP);
      if (!overDone && Tm >= Math.floor(T0 / 1440) * 1440 + 1440 && opts.onDone) { overDone = true; opts.onDone(); }
    } else {
      if (!base) base = drawBase();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0);
    }
    if (cover < 1) drawDay(h, 1 - cover);
    if (cover > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = cover * 0.97; ctx.fillStyle = '#0d1826'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      const V = VIEWS[step >= 3 ? 1 : 0];
      const t = step === 1 || step === 3 ? Math.min(stepT, 5.9) : step === 2 ? 6 + Math.min(stepT, 8) : step === 4 ? 6 + Math.min(stepT, 4.5) : step === 5 ? 10.6 + Math.min(stepT, 9.2) : 0;
      const A = step === 0 ? cover : step === 1 || step === 3 ? Math.min(1, t / 0.8) : 1;
      if (step > 0 || cover > 0) drawView(V, step === 0 ? 0.5 : t, step === 0 ? cover * 0 : A);
    }
    hands(h); ui();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return '';
}
