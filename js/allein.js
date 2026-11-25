// Landing chapter «Allein leben», steps 2–4 (STATPOP households 2012 → latest year).
// Step 2 «Gleicher Anteil, andere Menschen»: the share of people 65+ living alone hardly moves, because two trends
//   cancel out – among 65–74 more live alone, among 75–84 and 85+ fewer. Animated lines per age group.
// Step 3 «Wo die Zahl wächst»: every Gemeinde leaves the map as a circle (area = people 65+ living alone) and joins
//   one of six piles by Gemeinde size; the years run and the piles grow – fastest in Gemeinden of 2000–20'000.
// Step 4 «Der Ring um die Städte»: Gemeinden by size, circles = additional people 80+ since the first year.
import { S, region, fmtInt, fmt, dataUrl } from './store.js?v=20261125230606';
import { reduced } from './map.js?v=20261125230606';
import { esc, main } from './ui.js?v=20261125230606';

let AL = null;
const load = () => (AL = AL || fetch(dataUrl('alleinleben.json')).then((r) => r.json()));
const NS = 'http://www.w3.org/2000/svg';
const AGES = [['65-74', '65–74', '#5aa9e6'], ['75-84', '75–84', '#8e7cc3'], ['85+', '85+', '#e8833a'], ['65+', 'alle ab 65', 'var(--ink)']];
const CLS = ['#d7e6f5', '#a9c9ea', '#74a7da', '#4682c4', '#2a5ea6', '#173c73'];   // Gemeinde size, small → large
const pct = (pm) => `${fmt(pm / 10, { dec: 1 })} %`;
const plus = (x) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), { dec: 0 })} %`;

export function alleinSteps(y0, y1) {
  return [
    { title: 'Gleicher Anteil, andere Menschen', text: `Warum bleibt der Anteil fast gleich? Zwei Entwicklungen heben sich auf: Zwischen 65 und 74 leben heute mehr Menschen allein als ${y0}. Ab 75 sind es anteilmässig weniger – Paare bleiben länger zusammen, weil auch die Männer älter werden. Weil aber immer mehr Menschen 85 werden, wächst die Zahl der Alleinlebenden trotzdem kräftig.`,
      extra: '<div class="al-ages" data-al="ages"></div>' },
    { title: 'Wo die Zahl wächst', text: `Jede Gemeinde wird zu einem Kreis – seine Fläche zeigt, wie viele Menschen ab 65 dort allein leben – und reiht sich nach ihrer Grösse ein. Die Städte haben am meisten Alleinlebende. Am schnellsten wächst die Zahl aber in Gemeinden mit 2000 bis 20'000 Einwohnerinnen und Einwohnern.`,
      extra: `<div class="al-big"><b class="num" data-al="year">${y0}</b><span>Kreisfläche = Menschen ab 65, die allein leben</span></div>
        <div class="age-ctrl"><button class="btn small" type="button" data-al="play">Pause</button><button class="btn small ghost" type="button" data-al="restart">Von vorn</button></div>` },
    { title: 'Der Ring um die Städte', text: `Wo kamen seit ${y0} die meisten Menschen über 80 dazu? Die Kreise zeigen die Zunahme, die Farbe die Grösse der Gemeinde: Fast drei Viertel des Zuwachses entfallen auf Gemeinden mit 2000 bis 20'000 Einwohnern – Agglomerationen und Kleinstädte, wo Unterstützung im Alltag oft weniger dicht ist als in den Städten.`,
      extra: '<div class="al-share" data-al="share"></div>' },
  ];
}

/** chapter map; opts: { ctl, initStep, staticView, scope, legendEl } */
export function alleinChapter(map, setTip, alive, opts = {}) {
  let step = -1, gen = 0, stop = () => {};
  const q = (k) => (opts.scope || main()).querySelector(`[data-al="${k}"]`);
  const setLeg = (h) => { const e = opts.legendEl?.(); if (e) e.innerHTML = h; };
  const root = map.svg.firstElementChild;
  const clean = () => { stop(); stop = () => {}; map.container.querySelector('.al-ov')?.remove(); root.querySelector('.al-pile')?.remove(); map.container.classList.remove('al-fade'); map.dots([]); root.querySelector('.dots')?.classList.remove('al-inc'); };

  // ---------------------------------------------------------------- step 2: lines by age group
  const lines = async (my) => {
    const D = await load(); if (!alive() || my !== gen) return;
    const Y = D.years, Y0 = Y[0], Y1 = Y[Y.length - 1], last = Y.length - 1, A = D.ch;
    const L = 70, R = 760, T = 50, B = 590, lo = 200, hi = 560;
    const sx = (y) => L + (y - Y0) / (Y1 - Y0) * (R - L), sy = (v) => B - (v - lo) / (hi - lo) * (B - T);
    const at = (arr, t) => { const k = Math.min(last - 1, Math.max(0, Math.floor(t - Y0))), f = Math.max(0, Math.min(1, t - Y0 - k)); return arr[k] + (arr[k + 1] - arr[k]) * f; };
    const ov = document.createElement('div'); ov.className = 'al-ov besa-ov';
    const grid = [20, 30, 40, 50].map((v) => `<line class="gl" x1="${L}" x2="${R}" y1="${sy(v * 10)}" y2="${sy(v * 10)}"/><text class="tk" x="${L - 8}" y="${sy(v * 10) + 4}" text-anchor="end">${v} %</text>`).join('');
    ov.innerHTML = `<svg viewBox="0 0 1000 632" role="img" aria-label="Anteil der Menschen in Privathaushalten, die allein leben, nach Alter, ${Y0} bis ${Y1}">
      ${grid}${Y.filter((y) => (y - Y0) % 3 === 0 || y === Y1).map((y) => `<text class="tk" x="${sx(y)}" y="${B + 20}" text-anchor="middle">${y}</text>`).join('')}
      <text class="axl" x="${L - 50}" y="${T - 20}">Anteil allein lebend (in Privathaushalten)</text>
      <text class="yr num" x="${R - 6}" y="${B - 14}" text-anchor="end">${Y0}</text>
      ${AGES.map(([k, , c]) => `<path class="al-line${k === '65+' ? ' tot' : ''}" data-k="${k}" stroke="${c}" d=""/>`).join('')}
      ${AGES.map(([k, lab, c]) => `<g class="al-head" data-k="${k}"><circle r="5" fill="${c}"/><text class="h1" x="12" y="-2">${lab}</text><text class="h2 num" x="12" y="14"></text></g>`).join('')}
    </svg>`;
    map.container.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
    const P = Object.fromEntries(AGES.map(([k]) => [k, ov.querySelector(`path[data-k="${k}"]`)]));
    const Hd = Object.fromEntries(AGES.map(([k]) => [k, ov.querySelector(`g[data-k="${k}"]`)]));
    const yr = ov.querySelector('.yr');
    const box = q('ages');
    if (box) box.innerHTML = `<table class="al-tab"><thead><tr><th>Alter</th><th class="r">${Y0}</th><th class="r">${Y1}</th><th class="r">allein lebend ${Y1}</th></tr></thead><tbody>${AGES.map(([k, lab, c]) => {
      const d = A.al[k][last] - A.al[k][0];
      return `<tr${k === '65+' ? ' class="tot"' : ''}><td><i style="background:${c}"></i>${lab}</td><td class="r num">${pct(A.al[k][0])}</td><td class="r num">${pct(A.al[k][last])} <span class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'}</span></td><td class="r num">${fmtInt(A.n[k][last])} <span class="muted">(${plus((A.n[k][last] / A.n[k][0] - 1) * 100)})</span></td></tr>`; }).join('')}</tbody></table>`;
    const draw = (t) => {
      AGES.forEach(([k]) => {
        const pts = Y.filter((y) => y <= t).map((y, i) => [sx(y), sy(A.al[k][i])]); pts.push([sx(t), sy(at(A.al[k], t))]);
        P[k].setAttribute('d', pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''));
        const v = at(A.al[k], t); Hd[k].setAttribute('transform', `translate(${sx(t).toFixed(1)},${sy(v).toFixed(1)})`);
        Hd[k].querySelector('.h2').textContent = `${pct(v)} · ${fmtInt(Math.round(at(A.n[k], t)))} Pers.`;
      });
      yr.textContent = Math.floor(t + 1e-9);
    };
    let t = reduced() ? Y1 : Y0, hold = 0, t0 = performance.now(), run = true;
    const tick = (now) => {
      if (!run || my !== gen) return; if (!alive()) { clean(); return; }
      const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      if (t >= Y1) { hold += dt; if (hold > 5) { t = Y0; hold = 0; } } else t = Math.min(Y1, t + dt * 1.2);
      draw(t); requestAnimationFrame(tick);
    };
    draw(t); requestAnimationFrame(tick);
    stop = () => { run = false; };
    setLeg(`<div class="legend besa-ikey">${AGES.map(([, lab, c]) => `<span><i style="background:${c}"></i>${lab}</span>`).join('')}<span class="muted">Personen in Privathaushalten (ohne Heime) · BFS STATPOP</span></div>`);
  };

  // ---------------------------------------------------------------- step 3: piles by Gemeinde size
  const piles = async (my) => {
    const D = await load(); if (!alive() || my !== gen) return;
    const Y = D.years, Y0 = Y[0], Y1 = Y[Y.length - 1], last = Y.length - 1, nc = D.labels.length;
    const vb = map.svg.viewBox.baseVal, W = vb.width, H = vb.height;
    map.reset(); map.clear(); map.setLevel('gde'); map.container.classList.add('al-fade');
    const top = 92, base = H - 70, colW = (W - 80) / nc, cx = (j) => 40 + colW * (j + 0.5);
    // radius scale: the largest pile (latest year) fills about 60 % of its column
    const tot = D.agg.map((_, j) => D.ids.reduce((s, _i, i) => s + (D.cls[i] === j && D.n[last][i] > 0 ? D.n[last][i] : 0), 0));
    const k = Math.sqrt(Math.min(...tot.map((x) => (colW - 14) * (base - top) * 0.38 / (Math.PI * Math.max(1, x)))));
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'al-pile'); root.appendChild(g);
    const heads = D.agg.map((a, j) => `<g class="al-colh" transform="translate(${cx(j)},${top - 58})"><text class="c1" text-anchor="middle">${a.label}</text>
      <text class="c2" y="16" text-anchor="middle">${fmtInt(a.gde)} Gemeinden</text><text class="c3 num" data-j="${j}" y="${base - top + 92}" text-anchor="middle"></text><text class="c4 num" data-j="${j}" y="${base - top + 108}" text-anchor="middle"></text></g>`).join('');
    g.innerHTML = `<line class="al-base" x1="20" x2="${W - 20}" y1="${base}" y2="${base}"/>${heads}<text class="al-pyr num" x="${W / 2}" y="${top + 52}" text-anchor="middle">${Y0}</text>`;
    const nodes = [];
    D.ids.forEach((id, i) => {
      const c = S.geo.c[id.slice(4)]; if (!c || D.n[last][i] < 0) return;
      const e = document.createElementNS(NS, 'circle'); e.dataset.id = id; e.setAttribute('fill', CLS[D.cls[i]]); g.appendChild(e);
      nodes.push({ i, j: D.cls[i], x: c[0], y: c[1], e, r: 0 });
    });
    const val = (nd, t) => { const kk = Math.min(last - 1, Math.max(0, Math.floor(t - Y0))), f = Math.max(0, Math.min(1, t - Y0 - kk));
      const a = D.n[kk][nd.i], b = D.n[kk + 1][nd.i]; return a < 0 || b < 0 ? Math.max(a, b, 0) : a + (b - a) * f; };
    const setR = (t) => nodes.forEach((nd) => { nd.r = Math.max(0.6, k * Math.sqrt(val(nd, t))); });
    let t = reduced() ? Y1 : Y0; setR(t);
    const sim = d3.forceSimulation(nodes).alphaDecay(0.02).velocityDecay(0.35)
      .force('x', d3.forceX((d) => cx(d.j)).strength((d) => 0.07 + 0.012 * d.r))
      .force('y', d3.forceY(base).strength((d) => 0.012 + 0.02 * (d.r / 12)))
      .force('c', d3.forceCollide((d) => d.r + 0.4).iterations(2))
      .on('tick', () => render());
    function render() { nodes.forEach((d) => { if (d.y > base - d.r) d.y = base - d.r; d.e.setAttribute('cx', d.x.toFixed(1)); d.e.setAttribute('cy', d.y.toFixed(1)); d.e.setAttribute('r', d.r.toFixed(2)); }); }
    if (reduced()) { sim.stop(); for (let n = 0; n < 300; n++) sim.tick(); render(); }
    const counters = (tt) => D.agg.forEach((a, j) => {
      const at = (arr) => { const kk = Math.min(last - 1, Math.floor(tt - Y0)), f = Math.min(1, tt - Y0 - kk); return arr[kk] + (arr[kk + 1] - arr[kk]) * f; };
      g.querySelector(`.c3[data-j="${j}"]`).textContent = `80+: ${plus((at(a.b80) / a.b80[0] - 1) * 100)}`;
      g.querySelector(`.c4[data-j="${j}"]`).textContent = `allein: ${plus((at(a.al) / a.al[0] - 1) * 100)}`;
    });
    if (setTip) setTip((id) => { const r = region(id); const i = D.ids.indexOf(id); if (!r || i < 0) return '';
      return `${esc(r.n)} · ${D.labels[D.cls[i]]} Einw. · 65+ allein: ${fmtInt(D.n[0][i])} (${Y0}) → ${fmtInt(D.n[last][i])} (${Y1})`; });
    let phase = reduced() ? 'done' : 'fly', pt = 0, hold = 0, t0 = performance.now(), run = true, alive2 = true, shownY = null;
    counters(t); g.querySelector('.al-pyr').textContent = Math.floor(t);
    const tick = (now) => {
      if (!alive2 || my !== gen) return; if (!alive()) { clean(); return; }
      const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      if (!run) { requestAnimationFrame(tick); return; }
      if (phase === 'fly') { pt += dt; if (pt > 3) phase = 'grow'; }
      else if (phase === 'grow') {
        if (t >= Y1) { hold += dt; if (hold > 5) { t = Y0; hold = 0; setR(t); sim.alpha(0.5).restart(); } }
        else { t = Math.min(Y1, t + dt * 0.9); setR(t); sim.force('c').radius((d) => d.r + 0.4); if (sim.alpha() < 0.2) sim.alpha(0.25).restart(); }
        const yi = Math.floor(t + 1e-9); if (yi !== shownY) { shownY = yi; g.querySelector('.al-pyr').textContent = yi; const e = q('year'); if (e) e.textContent = yi; }
        counters(t);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    stop = () => { alive2 = false; sim.stop(); };
    const pb = q('play'), rb = q('restart');
    if (pb) { pb.textContent = 'Pause'; pb.onclick = () => { run = !run; if (run) sim.restart(); else sim.stop(); t0 = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
    if (rb) rb.onclick = () => { t = Y0; hold = 0; run = true; phase = 'grow'; setR(t); sim.alpha(0.6).restart(); if (pb) pb.textContent = 'Pause'; };
    setLeg(`<div class="legend besa-ikey"><span class="muted">Gemeindegrösse (Einwohner ${Y1}):</span>${D.labels.map((l, j) => `<span><i style="background:${CLS[j]}"></i>${l}</span>`).join('')}</div>
      <div class="legend"><span class="muted">Kreisfläche = Menschen ab 65, die allein leben · unten: Zunahme seit ${Y0} (80+ alle Gemeinden; allein lebend: Gemeinden mit Werten in allen Jahren) · Gemeinden ohne Werte (Datenschutz) fehlen</span></div>`);
  };

  // ---------------------------------------------------------------- step 4: map of the 80+ increase
  const ring = async (my) => {
    const D = await load(); if (!alive() || my !== gen) return;
    const Y = D.years, Y0 = Y[0], Y1 = Y[Y.length - 1];
    map.clear(); map.setLevel('gde');
    D.ids.forEach((id, i) => { const p = map.paths.get(id); if (p) p.style.fill = CLS[D.cls[i]]; });
    const inc = D.ids.map((_, i) => Math.max(0, D.b80[1][i] - D.b80[0][i]));
    const mx = Math.max(...inc), kk = 11 / Math.sqrt(mx);
    map.dots(D.ids.map((id, i) => ({ id, r: (kk * Math.sqrt(inc[i])).toFixed(2) })).filter((p) => p.r > 0.3));
    root.querySelector('.dots')?.classList.add('al-inc');
    const watch = () => { if (my !== gen) return; if (!alive()) { clean(); return; } setTimeout(watch, 400); };   // leave no circles behind
    watch();
    if (setTip) setTip((id) => { const r = region(id); const i = D.ids.indexOf(id); if (!r || i < 0) return '';
      return `${esc(r.n)} · ${D.labels[D.cls[i]]} Einw. · Menschen ab 80: ${fmtInt(D.b80[0][i])} (${Y0}) → ${fmtInt(D.b80[1][i])} (${Y1}), ${D.b80[1][i] >= D.b80[0][i] ? '+' : ''}${fmtInt(D.b80[1][i] - D.b80[0][i])}`; });
    const d80 = D.agg.map((a) => a.b80[a.b80.length - 1] - a.b80[0]), s = d80.reduce((a, b) => a + b, 0);
    const box = q('share');
    if (box) box.innerHTML = `<span class="small muted">Anteil am Zuwachs der Menschen über 80, ${Y0}–${Y1}</span>${D.agg.map((a, j) => `<div class="al-bar"><span>${a.label}</span><i style="width:${(d80[j] / s * 100 * 2.2).toFixed(1)}%;background:${CLS[j]}"></i><b class="num">${fmt(d80[j] / s * 100, { dec: 0 })} %</b><span class="muted">· ${fmt(a.pop / D.agg.reduce((x, y) => x + y.pop, 0) * 100, { dec: 0 })} % der Bevölkerung</span></div>`).join('')}`;
    setLeg(`<div class="legend besa-ikey"><span class="muted">Gemeindegrösse:</span>${D.labels.map((l, j) => `<span><i style="background:${CLS[j]}"></i>${l}</span>`).join('')}</div>
      <div class="legend"><span><i class="al-incpt"></i> Kreisfläche = zusätzliche Menschen über 80, ${Y0}–${Y1} (grösster Kreis: +${fmtInt(mx)})</span></div>`);
  };

  const go = (st) => {
    if (st === step) return; step = st; const my = ++gen; clean();
    if (st === 1) lines(my); else if (st === 2) piles(my); else if (st === 3) ring(my);
    else setLeg(opts.staticView());
  };
  if (opts.ctl) opts.ctl.go = go;
  step = 0;
  const leg = opts.staticView();
  if (opts.initStep && opts.initStep()) setTimeout(() => go(opts.initStep()), 0);
  return leg;
}
