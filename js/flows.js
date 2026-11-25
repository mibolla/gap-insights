// Landing chapter «Ins Heim in einen anderen Kanton» (BFS SOMED, Klientenwanderung: clients of Alters- und
// Pflegeheime by home Kanton × Kanton of the Heim). Curved arrows from the home Kanton to the Kanton of the Heim;
// the width is the number of people, moving dashes show the direction. A→B and B→A bend to different sides.
// Step 1: the largest flows of the latest year (Kantone by share of residents from other Kantone).
// Step 2: balance (taken in − sent out). Step 3: «Neue Wege» – the total hardly changes, but the routes do:
//         arrows morph year by year, the card follows four Kantone whose role changed.
import { S, region, fmtInt, classOf, dataUrl, wappen } from './store.js?v=20261125215630';
import { reduced } from './map.js?v=20261125215630';
import { esc, main } from './ui.js?v=20261125215630';

let MD = null;
const load = () => (MD = MD || fetch(dataUrl('mobility.json')).then((r) => r.json()));
const NS = 'http://www.w3.org/2000/svg';
const DIV = ['#2166ac', '#67a9cf', '#c6dbef', '#fcbba1', '#ef8a62', '#b2182b'];
const NBR = [-200, -50, 0, 50, 200];
const MIN_PAIR = 20, MIN_SHOW = 20, NLAB = 6;
const W_OF = (n) => 0.6 + Math.sqrt(n) * 0.45;        // arrow width in map units: 20 → 2.6, 100 → 5.1, 364 → 9.2
const RN = (v) => Math.sqrt(Math.abs(v)) * 0.85;       // net circle: area ~ |taken in − sent out| (692 → 22)
const FOCUS = [['OW', 'Obwalden'], ['BS', 'Basel-Stadt'], ['BE', 'Bern'], ['ZH', 'Zürich']];

export const flowsExtra = '<div class="mob-top" data-mob="top"></div>';

export function flowsSteps(y0, y1) {
  return [
    { title: 'Wer nimmt auf, wer gibt ab?', text: 'Rot: Kantone, deren Heime mehr Menschen aus anderen Kantonen aufnehmen, als eigene Einwohnerinnen und Einwohner in Heime anderer Kantone ziehen. Blau: umgekehrt. Die Pfeile bleiben: Ihre Breite ist die Zahl der Menschen.' },
    { title: `Neue Wege ${y0} → ${y1}`, text: `Insgesamt ziehen jedes Jahr ähnlich viele Menschen in ein Heim eines anderen Kantons – rund 4 % aller Heimbewohnenden. Aber die Wege haben sich verschoben: Obwalden wird zum Heimkanton der Zentralschweiz, Basel-Stadt nimmt Baselbieter auf, Bern verliert seine Rolle als grosser Aufnahmekanton.`,
      extra: `<div class="al-big"><b class="num" data-mob="year">${y0}</b><span data-mob="beat"></span></div>
        <div class="mob-focus" data-mob="focus"></div>
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
    fx.innerHTML = `<defs><marker id="mobHead" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="2.4" markerHeight="2.4" orient="auto" markerUnits="strokeWidth"><path d="M0 0L10 5L0 10z"/></marker></defs>`;
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
      g.innerHTML = `<path class="body" d="${d0}" marker-end="url(#mobHead)"/><path class="flow" d="${d0}"/>`;
      f.g = g; f.body = g.firstChild; f.flow = g.lastChild;
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
    let focus = null, y = mode === 'time' && !reduced() ? Y[0] : Y[last], run = true, hold = 0, t0 = performance.now(), shown = null;
    const paintKt = (yy) => {
      if (mode !== 'net') { map.choropleth(new Map()); return; }          // neutral map: the arrows and circles carry the story
      map.choropleth(new Map());
      D.kts.forEach((k) => { const p = map.svg.querySelector(`.area-kt [data-id="KT:${k}"]`); if (p) p.style.fill = DIV[classOf(inflow(k, yy) - outflow(k, yy), NBR)]; });
    };
    const draw = () => {
      const cur = F.map((f) => at(f.ns, y));
      const topIdx = cur.map((n, i) => [n, i]).sort((a, b) => b[0] - a[0]).slice(0, NLAB).map((x) => x[1]);
      F.forEach((f, i) => {
        const n = cur[i], on = !focus || f.o === focus || f.d === focus, vis = n >= MIN_SHOW;
        f.g.style.opacity = !vis ? 0 : on ? 1 : 0.08;
        const w = W_OF(n).toFixed(2); f.body.style.strokeWidth = w; f.flow.style.strokeWidth = Math.max(0.5, W_OF(n) * 0.3).toFixed(2);
      });
      D.kts.forEach((k) => { const b2 = bub[k]; if (!b2) return;
        const n = at(NET[k], y), r = Math.min(R[k], RN(n)).toFixed(1), on = !focus || focus === k || F.some((f) => (f.o === focus && f.d === k) || (f.d === focus && f.o === k));
        b2.classList.toggle('pos', n > 0.5); b2.classList.toggle('neg', n < -0.5);
        b2.querySelectorAll('.net, .rip').forEach((c) => c.setAttribute('r', r));
        b2.querySelector('.v').textContent = Math.abs(n) >= 1 ? `${n > 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(n)))}` : '±0'; b2.style.opacity = on ? 1 : 0.15; });
      labG.innerHTML = topIdx.filter((i) => cur[i] >= MIN_SHOW && (!focus || F[i].o === focus || F[i].d === focus))
        .map((i) => `<g transform="translate(${F[i].mid[0].toFixed(1)},${F[i].mid[1].toFixed(1)})"><rect x="-17" y="-8" width="34" height="15" rx="7"/><text y="3.5" text-anchor="middle">${fmtInt(Math.round(cur[i]))}</text></g>`).join('');
    };
    // card: largest flows of the latest year
    const top = q('top');
    if (top && !top.dataset.done) {
      top.dataset.done = 1;
      const t = [...D.flows].sort((a, b) => b[2][last] - a[2][last]).slice(0, 6);
      top.innerHTML = `<span class="small muted">Grösste Ströme ${Y[last]} (Wohnkanton → Kanton des Heims)</span><ol>${t.map((f) => `<li><img src="${wappen(`KT:${f[0]}`)}" alt=""> ${f[0]} <span class="arr">→</span> <img src="${wappen(`KT:${f[1]}`)}" alt=""> ${f[1]}<b class="num">${fmtInt(f[2][last])}</b></li>`).join('')}</ol>`;
    }
    // time travel: beats and four Kantone whose role changed (balance per year)
    const fb = q('focus');
    const beats = [[Y[0], `${Y[0]}: Bern nimmt am meisten auf (Saldo ${fmtInt(Math.round(inflow('BE', Y[0]) - outflow('BE', Y[0])))}), Zürich gibt am meisten ab.`],
      [2011, 'Luzern → Obwalden und Basel-Landschaft → Basel-Stadt beginnen zu wachsen; die Wege nach Bern werden schmaler.'],
      [2017, 'Obwalden wird zum Heimkanton der Zentralschweiz: Luzerner und Nidwaldner ziehen in seine Heime.'],
      [Y[last], `${Y[last]}: Obwalden nimmt netto ${fmtInt(Math.round(inflow('OW', Y[last]) - outflow('OW', Y[last])))} Menschen auf – fast doppelt so viele wie Bern. Basel-Stadt nimmt auf statt abzugeben, Zürich ist ausgeglichen.`]];
    const SW = 120, SH = 34;
    const netS = Object.fromEntries(FOCUS.map(([k]) => [k, Y.map((yy) => inflow(k, yy) - outflow(k, yy))]));
    const nmax = Math.max(...Object.values(netS).flat().map(Math.abs));
    const ssx = (yy) => 2 + (yy - Y[0]) / (Y[last] - Y[0]) * (SW - 4), ssy = (v) => SH / 2 - v / nmax * (SH / 2 - 2);
    if (mode === 'time' && fb) fb.innerHTML = FOCUS.map(([k, n]) => `<div class="mf" data-k="${k}"><img src="${wappen(`KT:${k}`)}" alt=""><span class="n">${n}</span>
      <svg viewBox="0 0 ${SW} ${SH}"><line x1="0" x2="${SW}" y1="${SH / 2}" y2="${SH / 2}" class="z"/><path class="ln" d=""/><circle r="2.6"/></svg><b class="num"></b></div>`).join('') +
      '<p class="small muted">Saldo: aufgenommen − abgegeben (Menschen in Heimen)</p>';
    const counters = () => {
      const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
      set('year', Math.min(Y[last], Math.floor(y + 1e-9))); set('beat', beats.reduce((s, b) => (y >= b[0] ? b[1] : s), beats[0][1]));
      if (fb && mode === 'time') FOCUS.forEach(([k]) => {
        const el = fb.querySelector(`.mf[data-k="${k}"]`); if (!el) return; const v = inflow(k, y) - outflow(k, y);
        const pts = Y.filter((yy) => yy <= y).map((yy, i) => [ssx(yy), ssy(netS[k][i])]); pts.push([ssx(y), ssy(v)]);
        el.querySelector('.ln').setAttribute('d', pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join(''));
        const c = el.querySelector('circle'); c.setAttribute('cx', ssx(y)); c.setAttribute('cy', ssy(v));
        el.querySelector('b').textContent = `${v >= 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(v)))}`; el.classList.toggle('pos', v >= 0);
      });
    };
    const over = (ev) => { const id = ev.target?.dataset?.id; focus = id && id.startsWith('KT:') ? id.slice(3) : null; draw(); };
    const leave = () => { focus = null; draw(); };
    map.svg.addEventListener('pointerover', over); map.svg.addEventListener('pointerleave', leave);
    if (setTip) setTip((id) => {
      const r = region(id); if (!r) return ''; const k = id.slice(3), yi = Math.round(y), i = inflow(k, yi), o = outflow(k, yi);
      return `<b>${esc(r.n)}</b> <span class="tm">${yi}</span><span class="tr"><span>aufgenommen</span><b class="num">${fmtInt(Math.round(i))}</b></span><span class="tr"><span>abgegeben</span><b class="num">${fmtInt(Math.round(o))}</b></span><span class="tr sal ${i - o >= 0 ? 'pos' : 'neg'}"><span>Saldo</span><b class="num">${i - o >= 0 ? '+' : '−'}${fmtInt(Math.abs(Math.round(i - o)))}</b></span>`;
    });
    map.container.classList.add('tip-side');                         // tooltip in the corner: never over the arrows
    cleanup = () => { fx.remove(); map.container.classList.remove('tip-side'); map.svg.removeEventListener('pointerover', over); map.svg.removeEventListener('pointerleave', leave); cleanup = () => {}; };
    paintKt(Math.round(y)); draw(); counters();
    if (mode === 'time') {
      const tick = (now) => {
        if (my !== gen) return; if (!alive()) { cleanup(); return; }
        const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
        if (run) {
          if (y >= Y[last]) { hold += dt; if (hold > 5) { y = Y[0]; hold = 0; } } else y = Math.min(Y[last], y + dt * 0.75);
          const yi = Math.floor(y + 1e-9); if (yi !== shown) { shown = yi; paintKt(yi); }
          draw(); counters();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const pb = q('play'), rb = q('restart');
      if (pb) { pb.textContent = 'Pause'; pb.onclick = () => { run = !run; t0 = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
      if (rb) rb.onclick = () => { y = Y[0]; hold = 0; run = true; shown = null; if (pb) pb.textContent = 'Pause'; };
    } else {
      const watch = () => { if (my !== gen) return; if (!alive()) { cleanup(); return; } setTimeout(watch, 400); };
      watch();
    }
    const key = `<span class="mob-akey"><svg viewBox="0 0 60 14"><path d="M2 7H44" stroke-width="3"/><path d="M2 7H44" class="fl" stroke-width="1"/><path d="M44 2L56 7L44 12z"/></svg> Pfeilbreite = Menschen in einem Heim eines anderen Kantons (Wohnkanton → Kanton des Heims; ab ${MIN_SHOW} Personen)</span><span><i class="mob-bkey pos"></i><i class="mob-bkey neg"></i> Kreis = Saldo des Kantons (Fläche): rot nimmt mehr auf als er abgibt, Ringe ziehen nach innen · blau gibt mehr ab, Ringe ziehen nach aussen</span><span class="muted">Maus auf einen Kanton: nur seine Pfeile</span>`;
    if (mode !== 'net') return `<div class="legend mob-key">${key}</div>`;
    return `<div class="legend"><span>Saldo: aufgenommen − abgegeben</span><span>gibt ab</span><span class="ramp">${DIV.map((c) => `<span style="background:${c}"></span>`).join('')}</span><span>nimmt auf</span><span class="muted">−200 · −50 · 0 · +50 · +200</span></div><div class="legend mob-key">${key}</div>`;
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
