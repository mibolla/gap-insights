// Landing chapter «Pflegestufe im Heim»: how much care do residents of Pflegeheime need?
// Step 1: mean KVG care level (Pflegestufe 1–12, 20 minutes of care per day per level) per Bezirk, BAG 2024,
//         with a dot strip of all Bezirke in the card.
// Step 2: the same Bezirke coloured by the assessment instrument (BESA, RAI, PLAISIR) – it explains much of the gap.
// Step 3: «Rennen der Kantone»: animated line chart 2012 → latest year (2012–2016 BAG index, from 2017 BFS care
//         days by level), a Wappen at each line head and a ranking column that re-sorts as the years pass.
import { S, region, fmt, quantiles, classOf, dataUrl, wappen } from './store.js?v=20261125230833';
import { legendHTML, reduced } from './map.js?v=20261125230833';
import { esc, main } from './ui.js?v=20261125230833';

let BD = null;
const load = () => (BD = BD || fetch(dataUrl('besa.json')).then((r) => r.json()));
const RAMP = [0, 1, 2, 3, 4].map((k) => `var(--r${k})`);
const ICOL = { BESA: '#3fb39a', RAI: '#4e9be0', PLAISIR: '#e8833a', gemischt: '#9aa5b1' };
const INAME = { BESA: 'BESA', RAI: 'RAI-RUG', PLAISIR: 'PLAISIR', gemischt: 'gemischt' };
const NS = 'http://www.w3.org/2000/svg';
const f2 = (x) => fmt(x, { dec: 1 });
const instKey = () => `<div class="legend besa-ikey">${Object.keys(ICOL).map((k) => `<span><i style="background:${ICOL[k]}"></i>${INAME[k]}</span>`).join('')}</div>`;

/** chapter card extra (filled when the chapter opens) */
export const besaExtra = '<div class="besa-strip"><span class="small muted">Jeder Punkt ein Bezirk · Farbe = Pflegeinstrument</span><div data-besa="strip"></div></div>';

/** the step cards */
export function besaSteps(y0, y1) {
  return [
    { title: 'Das Instrument zählt', text: 'Gemessen wird der Pflegebedarf mit einem von drei Instrumenten: BESA (vor allem Deutschschweiz), RAI-RUG oder PLAISIR (Genf, Waadt, Neuenburg, Jura). Die Westschweizer PLAISIR-Kantone liegen fast drei Stufen höher – ein Teil davon ist Messung, nicht Pflege.' },
    { title: `Rennen der Kantone ${y0} → ${y1}`, text: `Die mittlere Pflegestufe steigt fast überall: Wer heute ins Heim kommt, braucht mehr Pflege. Jede Linie ist ein Kanton, die Rangliste rechts sortiert sich Jahr für Jahr neu. Farbe = Instrument.`,
      extra: '<p class="age-beat" data-besa="beat"></p><div class="age-ctrl"><button class="btn small" type="button" data-besa="play">Pause</button><button class="btn small ghost" type="button" data-besa="restart">Von vorn</button></div>' },
  ];
}

/** chapter map; opts: { ctl, initStep, scope, legendEl } */
export function besaChapter(map, setTip, alive, opts = {}) {
  let step = -1, gen = 0;
  const q = (k) => (opts.scope || main()).querySelector(`[data-besa="${k}"]`);
  const setLeg = (h) => { const e = opts.legendEl?.(); if (e) e.innerHTML = h; };
  const ovOff = () => map.container.querySelector('.besa-ov')?.remove();

  const strip = (D) => {
    const el = q('strip'); if (!el || el.dataset.done) return; el.dataset.done = 1;
    const vals = Object.values(D.bez), lo = 4, hi = 10, W = 320, H = 70;
    const sx = (v) => 8 + (v - lo) / (hi - lo) * (W - 16);
    const bins = {}; const dots = vals.sort((a, b) => a[0] - b[0]).map(([v, i]) => { const b = Math.round(sx(v) / 6); const k = bins[b] = (bins[b] || 0) + 1; return `<circle cx="${sx(v).toFixed(1)}" cy="${(H - 22 - (k - 1) * 5.4).toFixed(1)}" r="2.5" fill="${ICOL[i]}"/>`; });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mittlere Pflegestufe der Bezirke ${D.bez_jahr}">
      <line class="ax" x1="8" x2="${W - 8}" y1="${H - 17}" y2="${H - 17}"/>
      ${[4, 5, 6, 7, 8, 9, 10].map((t) => `<text x="${sx(t)}" y="${H - 4}" text-anchor="middle">${t}</text>`).join('')}
      <line class="ch" x1="${sx(D.ch_bez)}" x2="${sx(D.ch_bez)}" y1="4" y2="${H - 17}"/><text class="val" x="${sx(D.ch_bez) + 4}" y="11">Schweiz ${f2(D.ch_bez)}</text>
      ${dots.join('')}</svg>`;
  };

  const tipBez = (D, mode) => setTip && setTip((id) => {
    const r = region(id); const v = D.bez[id.slice(4)]; if (!r || !v) return r ? esc(r.n) : '';
    return mode === 'i' ? `${esc(r.n)} · ${INAME[v[1]]} · Ø Pflegestufe ${f2(v[0])}` : `${esc(r.n)} · Ø Pflegestufe ${D.bez_jahr}: ${f2(v[0])} (${INAME[v[1]]})`;
  });

  const paintMean = async () => {
    const my = ++gen; const D = await load(); if (!alive() || my !== gen) return '';
    ovOff(); map.clear(); map.setLevel('bez'); strip(D);
    const ids = Object.keys(D.bez).map((k) => `BEZ:${k}`), vals = ids.map((id) => D.bez[id.slice(4)][0]);
    const br = quantiles(vals);
    map.choropleth(new Map(ids.map((id, k) => [id, classOf(vals[k], br)])));
    tipBez(D, 'm');
    return `${legendHTML(br, (x) => f2(x), `Ø Pflegestufe ${D.bez_jahr}`)}<div class="legend"><span class="muted">Stufe 1 = bis 20 Minuten Pflege pro Tag, Stufe 12 = über 220 Minuten · BAG Kennzahlen Pflegeheime</span></div>`;
  };

  const paintInstr = async () => {
    const my = ++gen; const D = await load(); if (!alive() || my !== gen) return '';
    ovOff(); map.clear(); map.setLevel('bez'); strip(D);
    map.choropleth(new Map());                                   // reset the Bezirk layer, then colour by instrument
    Object.entries(D.bez).forEach(([k, v]) => { const p = map.svg.querySelector(`.area-bez [data-id="BEZ:${k}"]`); if (p) p.style.fill = ICOL[v[1]]; });
    tipBez(D, 'i');
    return `${instKey()}<div class="legend"><span class="muted">Instrument mit mindestens 60 % der Pflegetage im Bezirk, sonst «gemischt»</span></div>`;
  };

  const race = async () => {
    const my = ++gen; const D = await load(); if (!alive() || my !== gen) return;
    ovOff();
    const Y = D.years, Y0 = Y[0], Y1 = Y[Y.length - 1], KT = Object.keys(D.kt), nk = KT.length;
    const all = KT.flatMap((k) => D.kt[k].y);
    const vlo = Math.floor(Math.min(...all) * 2) / 2, vhi = Math.ceil(Math.max(...all) * 2) / 2;
    const L = 64, R = 742, T = 46, B = 596, RX = 790, rowH = (B - T) / nk;
    const sx = (y) => L + (y - Y0) / (Y1 - Y0) * (R - L), sy = (v) => B - (v - vlo) / (vhi - vlo) * (B - T);
    const at = (arr, t) => { const k = Math.min(Y.length - 2, Math.max(0, Math.floor(t - Y0))), f = Math.max(0, Math.min(1, t - Y0 - k)); return arr[k] + (arr[k + 1] - arr[k]) * f; };
    const ov = document.createElement('div'); ov.className = 'besa-ov';
    const grid = []; for (let v = Math.ceil(vlo); v <= vhi; v++) grid.push(`<line class="gl" x1="${L}" x2="${R}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tk" x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`);
    const xt = Y.filter((y) => (y - Y0) % 2 === 0 || y === Y1).map((y) => `<text class="tk" x="${sx(y)}" y="${B + 18}" text-anchor="middle">${y}</text>`);
    ov.innerHTML = `<svg viewBox="0 0 1000 632" role="img" aria-label="Mittlere Pflegestufe in Pflegeheimen nach Kanton, ${Y0} bis ${Y1}">
      <rect class="band" x="${sx(Y0)}" y="${T}" width="${sx(D.bfs_from - 0.5) - sx(Y0)}" height="${B - T}"/>
      <text class="bandl" x="${sx(Y0) + 6}" y="${T + 14}">BAG-Index</text><text class="bandl" x="${sx(D.bfs_from - 0.5) + 6}" y="${T + 14}">BFS: Pflegetage nach Stufe</text>
      ${grid.join('')}${xt.join('')}<text class="axl" x="${L - 40}" y="${T - 16}">Ø Pflegestufe</text>
      <text class="yr num" x="${R - 6}" y="${B - 14}" text-anchor="end">${Y0}</text>
      <g class="lines">${KT.map((k) => `<path data-k="${k}" stroke="${ICOL[D.kt[k].i]}" d=""/>`).join('')}<path class="chl" d=""/></g>
      <g class="heads">${KT.map((k) => `<image data-k="${k}" href="${wappen(`KT:${k}`)}" width="18" height="18" x="-40" y="-40"/>`).join('')}
        <circle class="chh" r="5"/><text class="chlab" x="-99" y="-99">Schweiz</text></g>
      <g class="rank">${KT.map((k) => `<g data-k="${k}" style="transform:translate(${RX}px,${T}px)"><rect x="-4" y="1" width="3" height="${rowH - 3}" fill="${ICOL[D.kt[k].i]}"/>
        <text class="rk" x="14" y="${rowH * 0.7}" text-anchor="end"></text><image href="${wappen(`KT:${k}`)}" x="20" y="2" width="${rowH - 4}" height="${rowH - 4}"/>
        <text class="kt" x="${22 + rowH}" y="${rowH * 0.7}">${k}</text><text class="v num" x="200" y="${rowH * 0.7}" text-anchor="end"></text></g>`).join('')}</g>
    </svg><div class="besa-leg">${instKey()}</div>`;
    map.container.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));
    const svg = ov.querySelector('svg');
    const lp = Object.fromEntries(KT.map((k) => [k, svg.querySelector(`.lines path[data-k="${k}"]`)]));
    const hp = Object.fromEntries(KT.map((k) => [k, svg.querySelector(`.heads image[data-k="${k}"]`)]));
    const rp = Object.fromEntries(KT.map((k) => [k, svg.querySelector(`.rank g[data-k="${k}"]`)]));
    const chl = svg.querySelector('.chl'), chh = svg.querySelector('.chh'), chlab = svg.querySelector('.chlab'), yr = svg.querySelector('.yr');
    const hl = (k) => { svg.classList.toggle('focus', !!k); KT.forEach((x) => { lp[x].classList.toggle('hl', x === k); rp[x].classList.toggle('hl', x === k); }); };
    KT.forEach((k) => { [hp[k], rp[k]].forEach((e) => { e.addEventListener('pointerenter', () => hl(k)); e.addEventListener('pointerleave', () => hl(null)); }); });
    const path = (arr, t) => { const pts = Y.filter((y) => y <= t).map((y, i) => [sx(y), sy(arr[i])]); pts.push([sx(t), sy(at(arr, t))]); return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''); };
    let order = '';
    const beats = [[Y0, `${Y0}: Die Kantone liegen zwischen Stufe ${f2(Math.min(...KT.map((k) => D.kt[k].y[0])))} und ${f2(Math.max(...KT.map((k) => D.kt[k].y[0])))}, die Schweiz bei ${f2(D.ch[0])}.`],
      [D.bfs_from, `Ab ${D.bfs_from} rechnet die Grafik mit den Pflegetagen nach Stufe der BFS-Statistik – auf derselben Skala wie der BAG-Index.`],
      [Y1, `${Y1}: Schweiz ${f2(D.ch[D.ch.length - 1])} – ${fmt((D.ch[D.ch.length - 1] - D.ch[0]), { dec: 1 })} Stufen mehr als ${Y0}, rund ${Math.round((D.ch[D.ch.length - 1] - D.ch[0]) * 20)} Minuten Pflege mehr pro Tag. Oben die PLAISIR-Kantone der Westschweiz.`]];
    const draw = (t) => {
      const v = Object.fromEntries(KT.map((k) => [k, at(D.kt[k].y, t)]));
      KT.forEach((k) => { lp[k].setAttribute('d', path(D.kt[k].y, t)); hp[k].setAttribute('x', (sx(t) - 9).toFixed(1)); hp[k].setAttribute('y', (sy(v[k]) - 9).toFixed(1)); });
      chl.setAttribute('d', path(D.ch, t)); const cy = sy(at(D.ch, t)); chh.setAttribute('cx', sx(t)); chh.setAttribute('cy', cy); chlab.setAttribute('x', sx(t) + 10); chlab.setAttribute('y', cy + 4);
      const o = [...KT].sort((a, b) => v[b] - v[a]);
      if (o.join() !== order) { order = o.join(); o.forEach((k, r) => { rp[k].style.transform = `translate(${RX}px,${(T + r * rowH).toFixed(1)}px)`; rp[k].querySelector('.rk').textContent = r + 1; }); }
      KT.forEach((k) => { rp[k].querySelector('.v').textContent = f2(v[k]); });
      yr.textContent = Math.floor(t + 1e-9);
      const b = q('beat'); if (b) b.textContent = beats.reduce((s, x) => (t >= x[0] ? x[1] : s), beats[0][1]);
    };
    let t = reduced() ? Y1 : Y0, run = !reduced(), hold = 0, last = performance.now();
    const SPEED = 1.1;
    const tick = (now) => {
      if (my !== gen) return;
      if (!alive()) { ovOff(); return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (run) { if (t >= Y1) { hold += dt; if (hold > 4.5) { t = Y0; hold = 0; } } else t = Math.min(Y1, t + dt * SPEED); }
      draw(t); requestAnimationFrame(tick);
    };
    draw(t); requestAnimationFrame(tick);
    const pb = q('play'), rb = q('restart');
    if (pb) { pb.textContent = run ? 'Pause' : 'Abspielen'; pb.onclick = () => { run = !run; last = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
    if (rb) rb.onclick = () => { t = Y0; hold = 0; run = true; if (pb) pb.textContent = 'Pause'; };
    setLeg(`${instKey()}<div class="legend"><span class="muted">Linie = Kanton (Farbe: Instrument), dicke Linie = Schweiz · ${Y0}–${D.bfs_from - 1} BAG-Index der Pflegeintensität, ab ${D.bfs_from} BFS (Pflegetage nach Stufe) · Maus auf ein Wappen: Linie hervorheben</span></div>`);
  };

  const go = (st) => {
    if (st === step) return; step = st;
    if (st === 2) race();
    else (st === 1 ? paintInstr() : paintMean()).then((h) => { if (h) setLeg(h); });
  };
  if (opts.ctl) opts.ctl.go = go;
  step = 0;
  const first = paintMean();
  if (opts.initStep && opts.initStep()) setTimeout(() => go(opts.initStep()), 0);
  return first;
}
