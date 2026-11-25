// Landing chapter «Ins Heim in einen anderen Kanton» (BFS SOMED, Klientenwanderung: clients of Alters- und
// Pflegeheime by home Kanton × Kanton of the Heim). Curved arrows from the home Kanton to the Kanton of the Heim;
// the width is the number of people, moving dashes show the direction. A→B and B→A bend to different sides.
// Step 1: the largest flows of the latest year (Kantone by share of residents from other Kantone).
// Step 2: balance (taken in − sent out) as sorted bars in the card, same map. Step 3: «Neue Wege» – the total hardly changes, but the routes do:
//         arrows morph year by year, the card shows the «Rennen der Kantone» of the balances.
// Arrows are coloured by intensity; hovering a Kanton colours its incoming arrows red and its outgoing ones blue.
import { S, region, fmtInt, classOf, dataUrl, wappen } from './store.js?v=20261125232023';
import { reduced } from './map.js?v=20261125232023';
import { esc, main } from './ui.js?v=20261125232023';

let MD = null;
const load = () => (MD = MD || fetch(dataUrl('mobility.json')).then((r) => r.json()));
const NS = 'http://www.w3.org/2000/svg';
const MIN_PAIR = 30, MIN_SHOW = 30, NLAB = 6;
const ICOL = ['#f3dca0', '#f5b649', '#ec8a24', '#c4591a'];   // intensity: 30–60 · 60–120 · 120–200 · 200+ people
const IBR = [60, 120, 200];
const C_IN = '#e0605a', C_OUT = '#4a90d9';                     // hover: arriving (taken in) · leaving (sent out)
const W_OF = (n) => 0.6 + Math.sqrt(n) * 0.45;        // arrow width in map units: 20 → 2.6, 100 → 5.1, 364 → 9.2
const RN = (v) => Math.sqrt(Math.abs(v)) * 0.85;       // net circle: area ~ |taken in − sent out| (692 → 22)
const FOCUS = new Set(['OW', 'BS', 'BE', 'ZH', 'LU']);     // Kantone of the story: coloured, thick, with value
// line colour per Kanton, after the main colour of its coat of arms (black/white Kantone use the theme ink)
const KCOL = { ZH: '#1f6fd1', BE: '#f2b705', LU: '#5aa9e6', UR: '#f6d000', SZ: '#e2231a', OW: '#d7263d', NW: '#b5172e',
  GL: '#a3192b', ZG: '#3b8fd9', FR: 'var(--muted)', SO: '#ef3340', BS: 'var(--ink)', BL: '#c8102e', SH: '#e0b100',
  AR: 'var(--faint)', AI: '#8d8d8d', SG: '#00a651', GR: '#7d8fa0', AG: '#2a6ebb', TG: '#2e9e4f', TI: '#d62828',
  VD: '#0b9b4a', VS: '#e4572e', NE: '#3fb950', GE: '#e9a400', JU: '#c1272d' };

export const flowsExtra = '<div class="mob-top" data-mob="top"></div>';

export function flowsSteps(y0, y1) {
  return [
    { title: 'Wer nimmt auf, wer gibt ab?', text: `Rot: Kantone, deren Heime mehr Menschen aus anderen Kantonen aufnehmen, als eigene Einwohnerinnen und Einwohner in Heime anderer Kantone ziehen. Blau: umgekehrt. Saldo ${y1}:`,
      extra: '<div class="mob-bars" data-mob="bars"></div>' },
    { title: `Neue Wege ${y0} → ${y1}`, text: `Insgesamt ziehen jedes Jahr ähnlich viele Menschen in ein Heim eines anderen Kantons – rund 4 % aller Heimbewohnenden. Aber die Wege haben sich verschoben: Obwalden wird zum Heimkanton der Zentralschweiz, Basel-Stadt nimmt Baselbieter auf, Bern verliert seine Rolle als grosser Aufnahmekanton.`,
      extra: `<div class="al-big"><b class="num" data-mob="year">${y0}</b><span data-mob="beat"></span></div>
        <div class="mob-race" data-mob="race"></div>
        <div class="age-ctrl"><button class="btn small" type="button" data-mob="play">Pause</button><button class="btn small ghost" type="button" data-mob="restart">Von vorn</button></div>` },
  ];
}

export function flowsChapter(map, setTip, alive, opts = {}) {
  let step = -1, gen = 0, cleanup = () => {};
  const q = (k) => (opts.scope || main()).querySelector(`[data-mob="${k}"]`);
  const setLeg = (h) => { const e = opts.legendEl?.(); if (e) e.innerHTML = h; };
  const root = map.svg.firstElementChild;
  const anchors = () => {
    const a = {};
    S.regions.forEach((r) => { if (r.e !== 'GDE') return; const c = S.geo.c[r.id.slice(4)]; if (!c) return;
      const x = (a[r.kt] = a[r.kt] || [0, 0, 0]); x[0] += c[0] * r.pop; x[1] += c[1] * r.pop; x[2] += r.pop; });
    return Object.fromEntries(Object.entries(a).map(([k, [x, y, w]]) => [k, [x / w, y / w]]));
  };

  const start = async (mode) => {
    const my = ++gen; cleanup(); const D = await load(); if (!alive() || my !== gen) return '';
    const Y = D.years, last = Y.length - 1, A = anchors();
    map.clear(); map.setLevel('kt');
    root.querySelector('.mob-fx')?.remove();
    const fx = document.createElementNS(NS, 'g'); fx.setAttribute('class', 'mob-fx'); root.appendChild(fx);
    const MK = { ...Object.fromEntries(ICOL.map((c, i) => [`i${i}`, c])), in: C_IN, out: C_OUT };
    const at = (arr, y) => { const k = Math.min(last - 1, Math.max(0, Math.floor(y - Y[0]))), f = Math.max(0, Math.min(1, y - Y[0] - k)); return arr[k] + (arr[k + 1] - arr[k]) * f; };
    // collector bubbles: every Kanton gets a circle; arrows arrive on its border, each at its own port
    const PAIRS = D.flows.filter((f) => Math.max(...f[2]) >= MIN_PAIR && A[f[0]] && A[f[1]]);
    // net per Kanton and year (all flows); the arrows end on the net circle, or on a minimal ring that leaves room
    // for all ports where the net is small (e.g. Zürich: many arrows, balance ≈ 0)
    const NET = Object.fromEntries(D.kts.map((k) => [k, Y.map((_, i) => D.flows.reduce((s2, f) => s2 + (f[1] === k ? f[2][i] : 0) - (f[0] === k ? f[2][i] : 0), 0))]));
    const RMIN = Object.fromEntries(D.kts.map((k) => [k, Math.max(5, PAIRS.reduce((s2, f) => s2 + (f[0] === k || f[1] === k ? W_OF(Math.max(...f[2])) + 1.4 : 0), 0) / (2 * Math.PI))]));
    const R = Object.fromEntries(D.kts.map((k) => [k, Math.max(RMIN[k], mode === 'time' ? Math.max(...NET[k].map(RN)) : RN(NET[k][last]))]));
    // bubbles must not overlap: push neighbours apart (Basel, Appenzell/St. Gallen, Zentralschweiz), small pull back
    const K2 = D.kts.filter((k) => A[k]); const home = Object.fromEntries(K2.map((k) => [k, [...A[k]]]));
    for (let it = 0; it < 200; it++) {
      for (let i = 0; i < K2.length; i++) for (let j = i + 1; j < K2.length; j++) {
        const a2 = A[K2[i]], b2 = A[K2[j]], dx = b2[0] - a2[0], dy = b2[1] - a2[1], d = Math.hypot(dx, dy) || 0.01, m = R[K2[i]] + R[K2[j]] + 4;
        if (d < m) { const push = (m - d) / 2, ux = dx / d, uy = dy / d; a2[0] -= ux * push; a2[1] -= uy * push; b2[0] += ux * push; b2[1] += uy * push; }
      }
      K2.forEach((k) => { A[k][0] += (home[k][0] - A[k][0]) * 0.02; A[k][1] += (home[k][1] - A[k][1]) * 0.02; });
    }
    const ports = {};                                                // Kanton -> [{flow, kind, ang, w}]
    const F = PAIRS.map(([o, d, ns]) => {
      const p0 = A[o], p1 = A[d], dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const c = [(p0[0] + p1[0]) / 2 - uy * L * 0.18, (p0[1] + p1[1]) / 2 + ux * L * 0.18];   // bend to the left
      const f = { o, d, ns, c, wmax: W_OF(Math.max(...ns)) };
      (ports[d] = ports[d] || []).push({ f, kind: 'in', ang: Math.atan2(c[1] - p1[1], c[0] - p1[0]) });
      (ports[o] = ports[o] || []).push({ f, kind: 'out', ang: Math.atan2(c[1] - p0[1], c[0] - p0[0]) });
      return f;
    });
    // spread the ports around each circle: neighbours keep at least their half widths + a gap apart (arc length)
    Object.entries(ports).forEach(([k, ps]) => {
      const r = R[k] + 1.5; ps.sort((a2, b2) => a2.ang - b2.ang);
      const need = (i, j) => ((ps[i].f.wmax + ps[j].f.wmax) / 2 + 2.2) / r;
      for (let it = 0; it < 60; it++) {
        let moved = false;
        for (let i = 0; i < ps.length && ps.length > 1; i++) {
          const j = (i + 1) % ps.length; let gap = ps[j].ang - ps[i].ang; if (j === 0) gap += 2 * Math.PI;
          const m = need(i, j); if (gap < m) { const d2 = (m - gap) / 2; ps[i].ang -= d2; ps[j].ang += d2; moved = true; }
        }
        if (!moved) break;
      }
      ps.forEach((pt) => { const P = [A[k][0] + Math.cos(pt.ang) * (R[k] + (pt.kind === 'in' ? 1 : 0)), A[k][1] + Math.sin(pt.ang) * (R[k] + (pt.kind === 'in' ? 1 : 0))];
        if (pt.kind === 'in') pt.f.e = P; else pt.f.s = P; });
    });
    F.forEach((f) => {
      // control point: the original bend, pulled so the curve leaves and enters radially
      const s0 = f.s, s1 = f.e, so = A[f.o], sd = A[f.d], L = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
      const k1 = L * 0.38, a0 = Math.atan2(s0[1] - so[1], s0[0] - so[0]), a1 = Math.atan2(s1[1] - sd[1], s1[0] - sd[0]);
      const c0 = [s0[0] + Math.cos(a0) * k1, s0[1] + Math.sin(a0) * k1], c1 = [s1[0] + Math.cos(a1) * k1, s1[1] + Math.sin(a1) * k1];
      const d0 = `M${s0[0].toFixed(1)} ${s0[1].toFixed(1)}C${c0[0].toFixed(1)} ${c0[1].toFixed(1)} ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${s1[0].toFixed(1)} ${s1[1].toFixed(1)}`;
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'mob-arrow');
      g.innerHTML = `<path class="body" d="${d0}"/><path class="flow" d="${d0}"/><path class="head"/>`;
      f.g = g; [f.body, f.flow, f.head] = g.children;
      // the arrowhead is its own triangle (SVG markers do not always repaint when their colour changes):
      // tip on the circle border, the body ends at the base of the head
      const dl = Math.hypot(s1[0] - c1[0], s1[1] - c1[1]) || 1;
      Object.assign(f, { s0, c0, c1, s1, dir: [(s1[0] - c1[0]) / dl, (s1[1] - c1[1]) / dl], w: -1 });
      f.mid = [0.125 * s0[0] + 0.375 * c0[0] + 0.375 * c1[0] + 0.125 * s1[0], 0.125 * s0[1] + 0.375 * c0[1] + 0.375 * c1[1] + 0.125 * s1[1]];
    });
    F.sort((a2, b2) => Math.max(...b2.ns) - Math.max(...a2.ns));
    [...F].reverse().forEach((f) => fx.appendChild(f.g));              // large arrows on top
    const bubG = document.createElementNS(NS, 'g'); bubG.setAttribute('class', 'mob-bub'); fx.appendChild(bubG);
    bubG.innerHTML = D.kts.filter((k) => A[k]).map((k) => `<g data-k="${k}" transform="translate(${A[k][0].toFixed(1)},${A[k][1].toFixed(1)})"><circle class="port" r="${R[k].toFixed(1)}"/>
      <circle class="net" r="0"/><circle class="rip a" r="0"/><circle class="rip b" r="0"/><text class="kt" y="${(-R[k] - 3).toFixed(1)}">${k}</text><text class="v num" y="${(R[k] + 9).toFixed(1)}"></text></g>`).join('');
    const bub = Object.fromEntries(D.kts.filter((k) => A[k]).map((k) => [k, bubG.querySelector(`g[data-k="${k}"]`)]));
    const labG = document.createElementNS(NS, 'g'); labG.setAttribute('class', 'mob-labs'); fx.appendChild(labG);
    const inflow = (k, y) => D.flows.reduce((s, f) => s + (f[1] === k ? at(f[2], y) : 0), 0);
    const outflow = (k, y) => D.flows.reduce((s, f) => s + (f[0] === k ? at(f[2], y) : 0), 0);
    let focus = null, y = Y[last], run = true, hold = 0, t0 = performance.now(), shown = null;
    const paintKt = () => map.choropleth(new Map());                   // neutral map: the arrows and circles carry the story
    const draw = () => {
      const cur = F.map((f) => at(f.ns, y));
      const topIdx = cur.map((n, i) => [n, i]).sort((a, b) => b[0] - a[0]).slice(0, NLAB).map((x) => x[1]);
      F.forEach((f, i) => {
        const n = cur[i], on = !focus || f.o === focus || f.d === focus, vis = n >= MIN_SHOW;
        f.g.style.opacity = !vis ? 0 : on ? 1 : 0.06;
        const wn = W_OF(n);
        if (Math.abs(wn - f.w) > 0.02) {               // geometry follows the width: body to the base, head scaled
          f.w = wn; const hl = wn * 1.9 + 2.5, hw = wn * 1.15 + 1.8, [dx, dy] = f.dir;
          const b = [f.s1[0] - dx * hl, f.s1[1] - dy * hl], c1 = [f.c1[0] - dx * hl, f.c1[1] - dy * hl];
          const d = `M${f.s0[0].toFixed(1)} ${f.s0[1].toFixed(1)}C${f.c0[0].toFixed(1)} ${f.c0[1].toFixed(1)} ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${(b[0] + dx * 0.6).toFixed(1)} ${(b[1] + dy * 0.6).toFixed(1)}`;
          f.body.setAttribute('d', d); f.flow.setAttribute('d', d);
          f.head.setAttribute('d', `M${f.s1[0].toFixed(1)} ${f.s1[1].toFixed(1)}L${(b[0] - dy * hw).toFixed(1)} ${(b[1] + dx * hw).toFixed(1)}L${(b[0] + dy * hw).toFixed(1)} ${(b[1] - dx * hw).toFixed(1)}Z`);
          f.body.style.strokeWidth = wn.toFixed(2); f.flow.style.strokeWidth = Math.max(0.5, wn * 0.3).toFixed(2);
        }
        const mk = focus && on ? (f.d === focus ? 'in' : 'out') : `i${classOf(n, IBR)}`;
        if (mk !== f.mk) { f.mk = mk; f.body.style.stroke = MK[mk]; f.head.style.fill = MK[mk]; }
      });
      D.kts.forEach((k) => { const b2 = bub[k]; if (!b2) return;
        const n = at(NET[k], y), r = Math.min(R[k], RN(n)).toFixed(1), on = !focus || focus === k || F.some((f) => (f.o === focus && f.d === k) || (f.d === focus && f.o === k));
        b2.classList.toggle('pos', n > 0.5); b2.classList.toggle('neg', n < -0.5);
        b2.querySelectorAll('.net, .rip').forEach((c) => c.setAttribute('r', r));
        b2.querySelector('.v').textContent = Math.abs(n) >= 1 ? `${n > 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(n)))}` : '±0'; b2.style.opacity = on ? 1 : 0.15; });
      const labIdx = focus ? F.map((f, i) => i).filter((i) => F[i].o === focus || F[i].d === focus) : topIdx;    // hover: every arrow of the Kanton
      labG.innerHTML = labIdx.filter((i) => cur[i] >= MIN_SHOW)
        .map((i) => `<g class="${focus ? (F[i].d === focus ? 'in' : 'out') : ''}" transform="translate(${F[i].mid[0].toFixed(1)},${F[i].mid[1].toFixed(1)})"><rect x="-17" y="-8" width="34" height="15" rx="7"/><text y="3.5" text-anchor="middle">${fmtInt(Math.round(cur[i]))}</text></g>`).join('');
    };
    // card: largest flows of the latest year
    const top = q('top');
    if (top && !top.dataset.done) {
      top.dataset.done = 1;
      const t = [...D.flows].sort((a, b) => b[2][last] - a[2][last]).slice(0, 6);
      top.innerHTML = `<span class="small muted">Grösste Ströme ${Y[last]} (Wohnkanton → Kanton des Heims)</span><ol>${t.map((f) => `<li><img src="${wappen(`KT:${f[0]}`)}" alt=""> ${f[0]} <span class="arr">→</span> <img src="${wappen(`KT:${f[1]}`)}" alt=""> ${f[1]}<b class="num">${fmtInt(f[2][last])}</b></li>`).join('')}</ol>`;
    }
    // step 2: balance of the latest year as sorted bars (red right: takes in, blue left: sends out)
    const bars = q('bars');
    if (mode === 'net' && bars) {                                  // rebuilt each time, so its hover uses this run's state
      const K = D.kts.filter((k) => NET[k]).sort((a2, b2) => NET[b2][last] - NET[a2][last]), bh = 16, BW = 380, bz = 205, bh2 = 115;
      const mx = Math.max(...K.map((k) => Math.abs(NET[k][last])));
      bars.innerHTML = `<svg viewBox="0 0 ${BW} ${K.length * bh + 4}" role="img" aria-label="Saldo der Kantone ${Y[last]}"><line class="z" x1="${bz}" x2="${bz}" y1="0" y2="${K.length * bh + 4}"/>
        ${K.map((k, r) => { const v = NET[k][last], w = Math.max(0.5, Math.abs(v) / mx * bh2);
          return `<g class="br" data-k="${k}" transform="translate(0,${r * bh + 2})"><rect class="hit" x="0" y="0" width="${BW}" height="${bh}"/><text class="rk" x="14" y="${bh * 0.72}" text-anchor="end">${r + 1}</text><image href="${wappen(`KT:${k}`)}" x="19" y="1.5" width="${bh - 3}" height="${bh - 3}"/>
            <text class="kt" x="${21 + bh}" y="${bh * 0.72}">${k}</text><rect class="${v >= 0 ? 'pos' : 'neg'}" x="${(v >= 0 ? bz : bz - w).toFixed(1)}" y="3" width="${w.toFixed(1)}" height="${bh - 6}" rx="2"/>
            <text class="v num ${v >= 0 ? 'pos' : 'neg'}" x="${BW - 2}" y="${bh * 0.72}" text-anchor="end">${v >= 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(v)))}</text></g>`; }).join('')}</svg>`;
    }
    // time travel: beats and the «Rennen der Kantone» of the balances (taken in − sent out)
    const rb0 = q('race');
    const beats = [[Y[0], `${Y[0]}: Bern nimmt am meisten auf (Saldo ${fmtInt(Math.round(at(NET.BE, Y[0])))}), Zürich gibt am meisten ab.`],
      [2011, 'Luzern → Obwalden und Basel-Landschaft → Basel-Stadt beginnen zu wachsen; die Wege nach Bern werden schmaler.'],
      [2017, 'Obwalden wird zum Heimkanton der Zentralschweiz: Luzerner und Nidwaldner ziehen in seine Heime.'],
      [Y[last], `${Y[last]}: Obwalden nimmt netto ${fmtInt(Math.round(NET.OW[last]))} Menschen auf – fast doppelt so viele wie Bern. Basel-Stadt nimmt auf statt abzugeben, Zürich ist ausgeglichen.`]];
    // «Rennen der Kantone»: the chart starts as the bar chart of step 2 and morphs into the time series.
    // Phases: morph (bars turn vertical onto the latest year, Wappen fly to their balance) → hold → rewind (bars
    // fade, Wappen semi-transparent slide back to the first year, the map rewinds too) → race (lines grow to the
    // latest year). Linear y axis.
    const RK = D.kts.filter((k) => NET[k]), RW = 380, RH = 330, L0 = 40, R0 = RW - 76, T0 = 12, B0 = RH - 22, WS = 11, GAP = 11.6;
    const all = RK.flatMap((k) => NET[k]), lo = Math.min(...all) * 1.08, hi = Math.max(...all) * 1.08;
    const sl = (v) => v;                                            // linear y axis
    const rx = (yy) => L0 + (yy - Y[0]) / (Y[last] - Y[0]) * (R0 - L0), ry = (v) => B0 - (sl(v) - sl(lo)) / (sl(hi) - sl(lo)) * (B0 - T0);
    const TICKS = Array.from({ length: 13 }, (_, i) => -1200 + i * 200).filter((v) => v >= lo && v <= hi);
    const order25 = [...RK].sort((a2, b2) => NET[b2][last] - NET[a2][last]);
    const rowH = (B0 - T0) / RK.length, xz = L0 + (R0 - L0) * 0.5, half = (R0 - L0) * 0.46, mx25 = Math.max(...RK.map((k) => Math.abs(NET[k][last])));
    if (mode === 'time' && rb0) rb0.innerHTML = `<span class="small muted">Rennen der Kantone: Saldo aufgenommen − abgegeben, ${Y[0]}–${Y[last]}</span>
      <svg viewBox="0 0 ${RW} ${RH}" role="img" aria-label="Saldo der Kantone ${Y[0]} bis ${Y[last]}">
      <g class="axis">${TICKS.map((v) => `<line class="${v === 0 ? 'z0' : 'gl'}" x1="${L0}" x2="${R0}" y1="${ry(v).toFixed(1)}" y2="${ry(v).toFixed(1)}"/><text class="tk" x="${L0 - 4}" y="${(ry(v) + 3).toFixed(1)}" text-anchor="end">${v > 0 ? '+' : ''}${fmtInt(v)}</text>`).join('')}
      ${Y.filter((yy) => yy % 5 === 0).map((yy) => `<text class="tk" x="${rx(yy).toFixed(1)}" y="${RH - 6}" text-anchor="middle">${yy}</text>`).join('')}
      <text class="lab in" x="${L0 + 4}" y="${T0 + 10}">nimmt auf</text><text class="lab out" x="${L0 + 4}" y="${B0 - 4}">gibt ab</text>
      <text class="yrl num" x="${(L0 + R0) / 2}" y="${(T0 + B0) / 2 + 12}" text-anchor="middle"></text></g>
      <g class="mbars">${order25.map((k) => `<rect data-k="${k}" class="${NET[k][last] >= 0 ? 'pos' : 'neg'}"/>`).join('')}</g>
      ${RK.map((k) => `<path class="ln${FOCUS.has(k) ? ' fk' : ''}" data-k="${k}" d=""/>`).join('')}
      ${RK.map((k) => `<g class="hd${FOCUS.has(k) ? ' fk' : ''}" data-k="${k}"><line class="ld"/><circle r="2.2"/><image href="${wappen(`KT:${k}`)}" width="${WS}" height="${WS}"/><text class="v num" x="${WS + 3}" y="9"></text></g>`).join('')}
      </svg>`;
    const SV = rb0?.querySelector('svg');
    const LN = Object.fromEntries(RK.map((k) => [k, rb0?.querySelector(`path[data-k="${k}"]`)]));
    const HD = Object.fromEntries(RK.map((k) => [k, rb0?.querySelector(`g.hd[data-k="${k}"]`)]));
    const BR = Object.fromEntries(RK.map((k) => [k, rb0?.querySelector(`.mbars rect[data-k="${k}"]`)]));
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), lerp = (a2, b2, t) => a2 + (b2 - a2) * t;
    const spread = (vals) => {          // Wappen y positions next to the points, kept GAP apart
      const ks = [...RK].sort((a2, b2) => vals[b2] - vals[a2]), pos = ks.map((k) => ry(vals[k]) - WS / 2);
      for (let it = 0; it < 40; it++) for (let i = 1; i < pos.length; i++) if (pos[i] - pos[i - 1] < GAP) { const d = (GAP - (pos[i] - pos[i - 1])) / 2; pos[i - 1] -= d; pos[i] += d; }
      return Object.fromEntries(ks.map((k, i) => [k, pos[i]]));
    };
    const v25 = Object.fromEntries(RK.map((k) => [k, NET[k][last]])), py25 = spread(v25);
    const barStart = (k) => { const r = order25.indexOf(k), v = v25[k], w = Math.max(0.6, Math.abs(v) / mx25 * half);
      return { x: v >= 0 ? xz : xz - w, y: T0 + r * rowH + 1.2, w, h: rowH - 2.4, wx: L0 - WS - 22, wy: T0 + r * rowH + (rowH - WS) / 2 }; };
    const barEnd = (k) => { const y0 = ry(0), y1 = ry(v25[k]); return { x: rx(Y[last]) - 1.6, y: Math.min(y0, y1), w: 3.2, h: Math.max(0.6, Math.abs(y1 - y0)), wx: rx(Y[last]) + 8, wy: py25[k] }; };
    // one head: point on the line, leader, Wappen at (wx, wy)
    const head = (k, px, pyv, wx, wy, op, label) => {
      const g2 = HD[k]; if (!g2) return;
      const c = g2.querySelector('circle'), im = g2.querySelector('image'), ld = g2.querySelector('.ld'), tx = g2.querySelector('.v');
      c.setAttribute('cx', px.toFixed(1)); c.setAttribute('cy', pyv.toFixed(1)); c.style.display = px == null ? 'none' : '';
      im.setAttribute('x', wx.toFixed(1)); im.setAttribute('y', wy.toFixed(1)); im.style.opacity = op;
      ld.setAttribute('x1', px.toFixed(1)); ld.setAttribute('y1', pyv.toFixed(1)); ld.setAttribute('x2', wx.toFixed(1)); ld.setAttribute('y2', (wy + WS / 2).toFixed(1));
      tx.setAttribute('x', (wx + WS + 3).toFixed(1)); tx.setAttribute('y', (wy + 9).toFixed(1)); tx.style.display = label && FOCUS.has(k) ? '' : 'none';
      if (label) tx.textContent = label;
    };
    const fmtV = (v) => `${v >= 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(v)))}`;
    let phase = 'race', pt = 0;
    const renderMorph = (t) => {        // t 0 → 1: horizontal bars → vertical bars on the latest year
      const e = ease(t);
      RK.forEach((k) => { const a2 = barStart(k), b2 = barEnd(k), r = BR[k];
        if (r) { r.setAttribute('x', lerp(a2.x, b2.x, e).toFixed(1)); r.setAttribute('y', lerp(a2.y, b2.y, e).toFixed(1)); r.setAttribute('width', lerp(a2.w, b2.w, e).toFixed(1)); r.setAttribute('height', lerp(a2.h, b2.h, e).toFixed(1)); r.style.opacity = 1; }
        const wx = lerp(a2.wx, b2.wx, e), wy = lerp(a2.wy, b2.wy, e);
        head(k, rx(Y[last]), lerp(a2.y + a2.h / 2, ry(v25[k]), e), wx, wy, 1, t >= 1 ? `${k} ${fmtV(v25[k])}` : '');
        HD[k].querySelector('circle').style.opacity = e; HD[k].querySelector('.ld').style.opacity = e;
      });
      SV?.querySelector('.axis').style.setProperty('opacity', e.toFixed(2));
      LN && RK.forEach((k) => LN[k].setAttribute('d', ''));
    };
    const renderRace = (op) => {        // lines up to y, heads at y (Wappen opacity op)
      const x = rx(Math.min(y, Y[last])), v = Object.fromEntries(RK.map((k) => [k, at(NET[k], y)])), py = spread(v);
      RK.forEach((k) => {
        if (phase === 'race') {
          const pts = Y.filter((yy) => yy <= y).map((yy, i) => [rx(yy), ry(NET[k][i])]); pts.push([x, ry(v[k])]);
          LN[k].setAttribute('d', pts.map(([a2, b2], i) => `${i ? 'L' : 'M'}${a2.toFixed(1)} ${b2.toFixed(1)}`).join(''));
          LN[k].style.stroke = FOCUS.has(k) ? KCOL[k] : '';            // others: thin grey (CSS)
        } else LN[k].setAttribute('d', '');
        head(k, x, ry(v[k]), x + 8, py[k], op, `${k} ${fmtV(v[k])}`);
        HD[k].querySelector('circle').style.opacity = 1; HD[k].querySelector('.ld').style.opacity = 1;
      });
    };
    const yrl = SV?.querySelector('.yrl');
    const counters = () => {
      const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
      const yi = Math.min(Y[last], Math.floor(y + 1e-9));
      set('year', yi); set('beat', beats.reduce((s2, b2) => (y >= b2[0] ? b2[1] : s2), beats[0][1]));
      if (yrl) yrl.textContent = phase === 'morph' || phase === 'hold' ? '' : yi;
    };
    const markRow = () => bars && mode === 'net' && bars.querySelectorAll('g.br').forEach((g2) => g2.classList.toggle('hl', g2.dataset.k === focus));
    const over = (ev) => { const id = ev.target?.dataset?.id; focus = id && id.startsWith('KT:') ? id.slice(3) : null; draw(); markRow(); };
    if (mode === 'net' && bars) bars.querySelectorAll('g.br').forEach((g2) => {      // hover a bar = hover the Kanton on the map
      g2.addEventListener('pointerenter', () => { focus = g2.dataset.k; draw(); markRow(); });
      g2.addEventListener('pointerleave', () => { focus = null; draw(); markRow(); });
    });
    const leave = () => { focus = null; draw(); markRow(); };
    map.svg.addEventListener('pointerover', over); map.svg.addEventListener('pointerleave', leave);
    if (setTip) setTip((id) => {
      const r = region(id); if (!r) return ''; const k = id.slice(3), yi = Math.round(y), i = inflow(k, yi), o = outflow(k, yi);
      const top3 = (side) => D.flows.filter((f) => (side === 'in' ? f[1] : f[0]) === k).map((f) => [side === 'in' ? f[0] : f[1], at(f[2], yi)])
        .sort((a2, b2) => b2[1] - a2[1]).slice(0, 3).filter((x) => x[1] >= 1).map(([kk, n]) => `${kk} ${fmtInt(Math.round(n))}`).join(' · ');
      return `<b>${esc(r.n)}</b> <span class="tm">${yi}</span><span class="tr in"><span>aufgenommen</span><b class="num">${fmtInt(Math.round(i))}</b></span><span class="tw">von ${top3('in') || '–'}</span>
        <span class="tr out"><span>abgegeben</span><b class="num">${fmtInt(Math.round(o))}</b></span><span class="tw">nach ${top3('out') || '–'}</span>
        <span class="tr sal ${i - o >= 0 ? 'pos' : 'neg'}"><span>Saldo</span><b class="num">${i - o >= 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(i - o)))}</b></span>`;
    });
    map.container.classList.add('tip-side');                         // tooltip in the corner: never over the arrows
    cleanup = () => { fx.remove(); map.container.classList.remove('tip-side'); map.svg.removeEventListener('pointerover', over); map.svg.removeEventListener('pointerleave', leave); cleanup = () => {}; };
    paintKt(Math.round(y)); draw(); counters();
    if (mode === 'time') {
      const bars = SV?.querySelector('.mbars');
      if (reduced() || !SV) { phase = 'race'; y = Y[last]; if (bars) bars.style.display = 'none'; renderRace(1); counters(); }
      else { phase = 'morph'; y = Y[last]; renderMorph(0); }
      let op = 1;
      const tick = (now) => {
        if (my !== gen) return; if (!alive()) { cleanup(); return; }
        const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
        if (run && SV) {
          if (phase === 'morph') { pt += dt / 1.8; renderMorph(Math.min(1, pt)); if (pt >= 1) { phase = 'hold'; pt = 0; } }
          else if (phase === 'hold') { pt += dt; if (pt > 1.4) { phase = 'rewind'; pt = 0; } }
          else if (phase === 'rewind') {     // back to the first year: bars fade, Wappen semi-transparent
            pt += dt / 2.2; const e = ease(Math.min(1, pt)); y = lerp(Y[last], Y[0], e); op = lerp(1, 0.45, Math.min(1, pt * 2));
            if (bars) bars.style.opacity = (1 - Math.min(1, pt * 2.5)).toFixed(2);
            renderRace(op); draw();
            if (pt >= 1) { phase = 'race'; pt = 0; y = Y[0]; if (bars) bars.style.display = 'none'; }
          } else {
            y = Math.min(Y[last], y + dt * 1.5);               // race speed: years per second
            op = Math.min(1, op + dt * 1.2);
            if (y >= Y[last] && op >= 1) finish();          // the race ends at the latest year and stays there
            const yi = Math.floor(y + 1e-9); if (yi !== shown) { shown = yi; paintKt(yi); }
            renderRace(op); draw();
          }
          counters();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const pb = q('play'), rb = q('restart');
      function finish() { run = false; renderRace(1); draw(); counters(); if (pb) { pb.textContent = 'Pause'; pb.disabled = true; } }
      if (pb) { pb.disabled = false; pb.textContent = 'Pause'; pb.onclick = () => { run = !run; t0 = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
      if (rb) rb.onclick = () => { phase = 'race'; y = Y[0]; op = 0.45; hold = 0; run = true; shown = null; t0 = performance.now();
        if (bars) bars.style.display = 'none'; if (pb) { pb.disabled = false; pb.textContent = 'Pause'; } };
    } else {
      const watch = () => { if (my !== gen) return; if (!alive()) { cleanup(); return; } setTimeout(watch, 400); };
      watch();
    }
    const key = `<span class="mob-akey">Pfeile: Wohnkanton → Kanton des Heims, Breite und Farbe = Menschen (ab ${MIN_SHOW}): ${ICOL.map((c, i) => `<i style="background:${c}"></i>${['30', '60', '120', '200+'][i]}`).join(' ')}</span><span><i class="mob-bkey pos"></i><i class="mob-bkey neg"></i> Kreis = Saldo des Kantons (Fläche): rot nimmt mehr auf als er abgibt, Ringe ziehen nach innen · blau gibt mehr ab, Ringe ziehen nach aussen</span><span class="muted">Maus auf einen Kanton: <b style="color:${C_IN}">rot</b> was er aufnimmt, <b style="color:${C_OUT}">blau</b> was er abgibt</span>`;
    return `<div class="legend mob-key">${key}</div>`;
  };

  const go = (st) => {
    if (st === step) return; step = st;
    start(st === 1 ? 'net' : st === 2 ? 'time' : 'flows').then((h) => { if (h) setLeg(h); });
  };
  if (opts.ctl) opts.ctl.go = go;
  step = 0;
  const first = start('flows');
  if (opts.initStep && opts.initStep()) setTimeout(() => go(opts.initStep()), 0);
  return first;
}
