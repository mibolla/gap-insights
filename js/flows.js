// Landing chapter «Ins Heim in einen anderen Kanton»: clients of Alters- und Pflegeheime whose Heim lies outside
// their home Kanton (BFS SOMED, Klientenwanderung). Light particles stream along arcs from the home Kanton to the
// Kanton of the Heim (one particle = PER clients); the arcs bend to the left of the direction, so A→B and B→A
// stay apart. Step 1: flows of the latest year, Kantone by their share of clients from other Kantone.
// Step 2: balance (clients taken in minus clients sent). Step 3: time travel over all years.
// Hovering a Kanton shows only its flows.
import { S, region, fmtInt, fmt, quantiles, classOf, dataUrl, wappen } from './store.js?v=20261125201421';
import { legendHTML, reduced } from './map.js?v=20261125201421';
import { esc, main } from './ui.js?v=20261125201421';

let MD = null;
const load = () => (MD = MD || fetch(dataUrl('mobility.json')).then((r) => r.json()));
const NS = 'http://www.w3.org/2000/svg';
const RAMP = [0, 1, 2, 3, 4].map((k) => `var(--r${k})`);
const DIV = ['#2166ac', '#67a9cf', '#c6dbef', '#fcbba1', '#ef8a62', '#b2182b'];
const NBR = [-200, -50, 0, 50, 200];                 // balance classes (clients)
const PER = 15;                                      // clients per particle

/** chapter card extra: the largest flows (filled when the chapter opens) */
export const flowsExtra = '<div class="mob-top" data-mob="top"></div>';

export function flowsSteps(y0, y1) {
  return [
    { title: 'Wer nimmt auf, wer gibt ab?', text: 'Rot: Kantone, deren Heime mehr Menschen aus anderen Kantonen aufnehmen, als eigene Einwohnerinnen und Einwohner in Heime anderer Kantone ziehen. Blau: umgekehrt. Obwalden nimmt viele Luzernerinnen und Luzerner auf, Basel-Stadt viele aus Basel-Landschaft.' },
    { title: `Zeitreise ${y0} → ${y1}`, text: 'Die Ströme Jahr für Jahr: Die Zahl der Menschen in einem Heim ausserhalb ihres Wohnkantons wächst – ihr Anteil kaum. Die Wege folgen den Agglomerationen über die Kantonsgrenzen.',
      extra: `<div class="al-big"><b class="num" data-mob="year">${y0}</b><span>Klientinnen und Klienten in Heimen</span></div>
        <div class="age-counters"><div><b class="num" data-mob="n">–</b><span>in einem Heim ausserhalb des Wohnkantons</span></div><div><b class="num" data-mob="sh">–</b><span>aller Heimbewohnenden</span></div></div>
        <div class="age-mini"><span class="small muted">Menschen in einem Heim eines anderen Kantons</span><div data-mob="chart"></div></div>
        <div class="age-ctrl"><button class="btn small" type="button" data-mob="play">Pause</button><button class="btn small ghost" type="button" data-mob="restart">Von vorn</button></div>` },
  ];
}

/** chapter map; opts: { ctl, initStep, scope, legendEl } */
export function flowsChapter(map, setTip, alive, opts = {}) {
  let step = -1, gen = 0, cleanup = () => {};
  const q = (k) => (opts.scope || main()).querySelector(`[data-mob="${k}"]`);
  const setLeg = (h) => { const e = opts.legendEl?.(); if (e) e.innerHTML = h; };
  const root = map.svg.firstElementChild;

  const anchors = () => {      // population-weighted centre of each Kanton (map coordinates)
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
    const arcsG = document.createElementNS(NS, 'g'); arcsG.setAttribute('class', 'mob-arcs'); fx.appendChild(arcsG);
    const dotsG = document.createElementNS(NS, 'g'); dotsG.setAttribute('class', 'mob-dots'); fx.appendChild(dotsG);
    const F = D.flows.map(([o, d, ns]) => {
      const p0 = A[o], p1 = A[d]; if (!p0 || !p1) return null;
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
      const c = [(p0[0] + p1[0]) / 2 - dy * 0.22, (p0[1] + p1[1]) / 2 + dx * 0.22];   // bend to the left
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`);
      arcsG.appendChild(path);
      const maxP = Math.ceil(Math.max(...ns) / PER);
      const dots = Array.from({ length: maxP }, () => { const e = document.createElementNS(NS, 'circle'); e.setAttribute('r', '2.1'); dotsG.appendChild(e); return { e, ph: Math.random(), sp: 0.22 + Math.random() * 0.1 }; });
      return { o, d, ns, p0, p1, c, L, path, dots };
    }).filter(Boolean);
    const at = (arr, y) => { const k = Math.min(last - 1, Math.max(0, Math.floor(y - Y[0]))), f = Math.max(0, Math.min(1, y - Y[0] - k)); return arr[k] + (arr[k + 1] - arr[k]) * f; };
    const inflow = (k, y) => F.reduce((s, f) => s + (f.d === k ? at(f.ns, y) : 0), 0);
    const outflow = (k, y) => F.reduce((s, f) => s + (f.o === k ? at(f.ns, y) : 0), 0);
    let focus = null;
    const ktIds = D.kts.map((k) => `KT:${k}`);
    const paintKt = (y) => {
      const yi = Math.round(y);
      if (mode === 'net') {
        map.choropleth(new Map());
        D.kts.forEach((k) => { const p = map.svg.querySelector(`.area-kt [data-id="KT:${k}"]`); if (p) p.style.fill = DIV[classOf(inflow(k, yi) - outflow(k, yi), NBR)]; });
      } else {
        const vals = D.kts.map((k) => inflow(k, yi) / Math.max(1, at(D.tot[k], yi)) * 100);
        map.choropleth(new Map(ktIds.map((id, i) => [id, classOf(vals[i], BRS)])));
      }
    };
    const BRS = quantiles(D.kts.map((k) => inflow(k, Y[last]) / Math.max(1, D.tot[k][last]) * 100));
    let y = mode === 'time' && !reduced() ? Y[0] : Y[last], run = true, hold = 0, t0 = performance.now(), shown = null;
    const draw = (dt) => {
      F.forEach((f) => {
        const n = at(f.ns, y), np = n / PER, on = !focus || f.o === focus || f.d === focus;
        f.path.style.strokeWidth = (0.3 + Math.sqrt(n) * 0.11).toFixed(2);
        f.path.style.opacity = on ? (focus ? 0.55 : 0.2) : 0.03;
        f.dots.forEach((p, i) => {
          const vis = i < np ? 1 : i < np + 1 ? np - i : 0;
          if (!vis || !on) { if (p.v !== 0) { p.e.style.opacity = 0; p.v = 0; } return; }
          if (!reduced()) p.ph = (p.ph + dt * p.sp * (90 / Math.max(40, f.L))) % 1;
          const t = p.ph, u = 1 - t;
          p.e.setAttribute('cx', (u * u * f.p0[0] + 2 * u * t * f.c[0] + t * t * f.p1[0]).toFixed(1));
          p.e.setAttribute('cy', (u * u * f.p0[1] + 2 * u * t * f.c[1] + t * t * f.p1[1]).toFixed(1));
          const o = vis * Math.min(1, Math.sin(Math.PI * t) * 1.6); p.e.style.opacity = o.toFixed(2); p.v = o;
        });
      });
    };
    // card: largest flows of the latest year (chapter card) and counters / chart (time travel)
    const top = q('top');
    if (top && !top.dataset.done) {
      top.dataset.done = 1;
      const t = [...F].sort((a, b) => b.ns[last] - a.ns[last]).slice(0, 6);
      top.innerHTML = `<span class="small muted">Grösste Ströme ${Y[last]} (Wohnkanton → Kanton des Heims)</span><ol>${t.map((f) => `<li><img src="${wappen(`KT:${f.o}`)}" alt=""> ${f.o} <span class="arr">→</span> <img src="${wappen(`KT:${f.d}`)}" alt=""> ${f.d}<b class="num">${fmtInt(f.ns[last])}</b></li>`).join('')}</ol>`;
    }
    const W = 300, H = 80, mx = Math.max(...D.inter);
    const sx = (yy) => 6 + (yy - Y[0]) / (Y[last] - Y[0]) * (W - 12), sy = (v) => H - 16 - v / mx * (H - 28);
    const chart = q('chart');
    if (mode === 'time' && chart) chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Menschen in einem Heim eines anderen Kantons ${Y[0]} bis ${Y[last]}"><line class="ax" x1="6" x2="${W - 6}" y1="${H - 16}" y2="${H - 16}"/>
      <path class="obs" d="${D.inter.map((v, i) => `${i ? 'L' : 'M'}${sx(Y[i]).toFixed(1)} ${sy(v).toFixed(1)}`).join('')}"/>
      <text x="${sx(Y[0])}" y="${H - 2}">${Y[0]}</text><text x="${sx(Y[last])}" y="${H - 2}" text-anchor="end">${Y[last]}</text><circle class="dot" r="4.5" cx="${sx(Y[0])}" cy="${sy(D.inter[0])}"/></svg>`;
    const dot = chart?.querySelector('.dot');
    const counters = () => {
      const yi = Math.min(Y[last], Math.floor(y + 1e-9)), n = at(D.inter, y), sh = n / at(D.all, y) * 100;
      const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
      set('year', yi); set('n', fmtInt(Math.round(n))); set('sh', `${fmt(sh, { dec: 1 })} %`);
      if (dot) { dot.setAttribute('cx', sx(y)); dot.setAttribute('cy', sy(n)); }
    };
    // hover: only the flows of one Kanton
    const over = (ev) => { const id = ev.target?.dataset?.id; focus = id && id.startsWith('KT:') ? id.slice(3) : null; };
    const leave = () => { focus = null; };
    map.svg.addEventListener('pointerover', over); map.svg.addEventListener('pointerleave', leave);
    if (setTip) setTip((id) => {
      const r = region(id); if (!r) return ''; const k = id.slice(3), yi = Math.round(y);
      const i = inflow(k, yi), o = outflow(k, yi);
      return `${esc(r.n)} ${yi} · aus anderen Kantonen: ${fmtInt(Math.round(i))} (${fmt(i / Math.max(1, at(D.tot[k], yi)) * 100, { dec: 1 })} %) · in Heime anderer Kantone: ${fmtInt(Math.round(o))} · Saldo ${i - o >= 0 ? '+' : ''}${fmtInt(Math.round(i - o))}`;
    });
    cleanup = () => { fx.remove(); map.svg.removeEventListener('pointerover', over); map.svg.removeEventListener('pointerleave', leave); cleanup = () => {}; };
    paintKt(y); draw(0); counters();
    const tick = (now) => {
      if (my !== gen) return;
      if (!alive()) { cleanup(); return; }
      const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      if (mode === 'time' && run) {
        if (y >= Y[last]) { hold += dt; if (hold > 3) { y = Y[0]; hold = 0; } } else y = Math.min(Y[last], y + dt * 0.8);
        const yi = Math.floor(y + 1e-9); if (yi !== shown) { shown = yi; paintKt(yi); }
        counters();
      }
      draw(run ? dt : 0);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const pb = q('play'), rb = q('restart');
    if (mode === 'time') {
      if (pb) { pb.textContent = 'Pause'; pb.onclick = () => { run = !run; t0 = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
      if (rb) rb.onclick = () => { y = Y[0]; hold = 0; run = true; shown = null; if (pb) pb.textContent = 'Pause'; };
    }
    const key = `<span><i class="mob-pt"></i> = ${PER} Menschen, die in ein Heim eines anderen Kantons ziehen · Maus auf einen Kanton: nur seine Ströme</span>`;
    if (mode === 'net') return `<div class="legend"><span>Saldo ${Y[last]}: aufgenommen − abgegeben</span><span>gibt ab</span><span class="ramp">${DIV.map((c) => `<span style="background:${c}"></span>`).join('')}</span><span>nimmt auf</span><span class="muted">Stufen: −200 · −50 · 0 · +50 · +200</span></div><div class="legend mob-key">${key}</div>`;
    return `${legendHTML(BRS, (x) => `${fmt(x, { dec: 1 })} %`, `Anteil aus anderen Kantonen${mode === 'time' ? '' : `, ${Y[last]}`}`)}<div class="legend mob-key">${key}</div>`;
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
