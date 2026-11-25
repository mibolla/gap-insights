// Landing chapter «Allein leben», step 2: time travel 2012 → latest year of the people 65+ who live alone.
// The map colours every Gemeinde by its share (fixed classes), while light points rise where the number grows:
// one point = 100 more people 65+ living alone, released over the year in the Bezirk where they are added
// (Bezirk values are complete; inside the Bezirk a Gemeinde is picked by its people 65+). The card counts the
// people and shows an index chart (number vs share, first year = 100). At the end the map turns into the change
// of the share in percentage points (diverging colours), then the time travel starts again.
import { S, region, fmtInt, fmt, classOf, dataUrl } from './store.js?v=20261125201421';
import { legendHTML, reduced } from './map.js?v=20261125201421';
import { main } from './ui.js?v=20261125201421';

let AL = null;
const load = () => (AL = AL || fetch(dataUrl('alleinleben.json')).then((r) => r.json()));
const BR = [260, 290, 320, 350];                       // share classes in per mille: 26 · 29 · 32 · 35 %
const RAMP = [0, 1, 2, 3, 4].map((k) => `var(--r${k})`);
const DBR = [-40, -20, 0, 20, 40];                     // change in per mille points: −4 … +4 Prozentpunkte
const DIV = ['#2166ac', '#67a9cf', '#c6dbef', '#fcbba1', '#ef8a62', '#b2182b'];
const PER = 100, SPEED = 1.3, CAP = 420;               // people per light point · years per second · points at once
const NS = 'http://www.w3.org/2000/svg';
const pct = (pm) => `${fmt(pm / 10, { dec: 1 })} %`;

/** the step card (step 2 of the chapter) */
export function alleinSteps(y0, y1) {
  return [{ title: `Zeitreise ${y0} → ${y1}`,
    text: `Jeder Lichtpunkt steht für 100 Menschen ab 65 mehr, die allein leben – er steigt dort auf, wo sie dazukommen. Die Farbe zeigt den Anteil in jeder Gemeinde. Am Ende wird die Karte zur Bilanz: Wo ist der Anteil seit ${y0} gestiegen, wo gesunken?`,
    extra: `<div class="al-big"><b class="num" data-al="year">${y0}</b><span data-al="mode">Anteil je Gemeinde</span></div>
      <div class="age-counters"><div><b class="num" data-al="n">–</b><span>Menschen ab 65, die allein leben (Schweiz)</span></div><div><b class="num" data-al="grow">–</b><span>mehr als ${y0}</span></div></div>
      <div class="age-mini al-mini"><span class="small muted">Index ${y0} = 100: <i class="al-k n"></i> Anzahl · <i class="al-k s"></i> Anteil</span><div data-al="chart"></div></div>
      <p class="age-beat" data-al="beat"></p>
      <div class="age-ctrl"><button class="btn small" type="button" data-al="play">Pause</button><button class="btn small ghost" type="button" data-al="restart">Von vorn</button></div>` }];
}

/**
 * Chapter map. Step 0: the static map of the latest year (opts.staticView). Step 1: the time travel.
 * opts: { ctl, initStep, staticView: () => legend html, scope: element with the step card, legendEl: () => element }
 */
export function alleinChapter(map, setTip, alive, opts = {}) {
  let mode = 0, gen = 0;
  const q = (k) => (opts.scope || main()).querySelector(`[data-al="${k}"]`);
  const setLeg = (h) => { const e = opts.legendEl?.(); if (e) e.innerHTML = h; };
  const root = map.svg.firstElementChild;
  const cleanFx = () => { root.querySelector('.al-fx')?.remove(); map.container.querySelector('.al-year')?.remove(); map.paths.forEach((p) => { p.style.transition = ''; }); };

  const still = () => { mode = 0; gen++; cleanFx(); return opts.staticView(); };

  const anim = async () => {
    const my = ++gen; mode = 1;
    const A = await load();
    if (!alive() || my !== gen) return;
    cleanFx(); map.clear(); map.setLevel('gde');
    const Y = A.years, Y0 = Y[0], Y1 = Y[Y.length - 1], n = A.ids.length, last = Y.length - 1;
    const fx = document.createElementNS(NS, 'g'); fx.setAttribute('class', 'al-fx'); root.appendChild(fx);
    const big = document.createElement('div'); big.className = 'al-year num'; big.setAttribute('aria-hidden', 'true'); map.container.appendChild(big);
    // Bezirke: cumulative weights to place a point in a Gemeinde, carry of fractional points
    const BZ = Object.values(A.bez).map((b) => { let s = 0; const cw = b.w.map((w) => (s += Math.max(1, w))); return { g: b.g, cw, tot: s, n: b.n, carry: Math.random() }; });
    const ch = A.ch, idx = (arr, k) => arr[k] / arr[0] * 100;
    const nAt = (y) => { const k = Math.min(last - 1, Math.floor(y - Y0)), f = Math.min(1, y - Y0 - k); return ch.n65[k] + (ch.n65[k + 1] - ch.n65[k]) * f; };
    // index chart: number of people vs share (first year = 100)
    const W = 300, H = 96, lo = 95, hi = Math.ceil(Math.max(idx(ch.n65, last), 105) / 5) * 5;
    const sx = (y) => 6 + (y - Y0) / (Y1 - Y0) * (W - 12), sy = (v) => H - 16 - (v - lo) / (hi - lo) * (H - 28);
    const pts = (arr, upto) => Y.filter((y) => y <= upto).map((y, k) => [y, idx(arr, k)]);
    const d = (p) => p.map(([y, v], k) => `${k ? 'L' : 'M'}${sx(y).toFixed(1)} ${sy(v).toFixed(1)}`).join('');
    const chart = q('chart');
    if (chart) chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Index ${Y0} = 100: Menschen ab 65, die allein leben, Anzahl und Anteil">
      <line class="ax" x1="6" x2="${W - 6}" y1="${sy(100)}" y2="${sy(100)}"/>
      <path class="al-n" d=""/><path class="al-s" d=""/>
      <text x="${sx(Y0)}" y="${H - 2}">${Y0}</text><text x="${sx(Y1)}" y="${H - 2}" text-anchor="end">${Y1}</text>
      <text class="val al-vn" x="${sx(Y1)}" y="${sy(idx(ch.n65, last)) - 6}" text-anchor="end"></text>
      <text class="val al-vs" x="${sx(Y1)}" y="${sy(idx(ch.al65, last)) + 13}" text-anchor="end"></text>
      <circle class="dot al-dn" r="4" cx="${sx(Y0)}" cy="${sy(100)}"/></svg>`;
    const cn = chart?.querySelector('.al-n'), cs = chart?.querySelector('.al-s'), cd = chart?.querySelector('.al-dn');
    const grow = ch.n65[last] - ch.n65[0], growPct = (ch.n65[last] / ch.n65[0] - 1) * 100;
    const beats = [
      [Y0, `${Y0} leben ${fmtInt(ch.n65[0])} Menschen ab 65 allein – ${pct(ch.al65[0])} aller Menschen ab 65 in Privathaushalten.`],
      [Y0 + 2.5, 'Die Lichtpunkte steigen vor allem in den Städten und Agglomerationen auf: Dort kommen die meisten älteren Menschen dazu, die allein leben.'],
      [Y0 + 7, `Die Karte bleibt fast gleich gefärbt – der Anteil verändert sich kaum. Aber die Zahl wächst Jahr für Jahr.`],
      [Y1, `${Y1}: ${fmtInt(ch.n65[last])} Menschen – ${fmt(growPct, { dec: 0 })} % mehr als ${Y0}. Der Anteil steigt nur von ${pct(ch.al65[0])} auf ${pct(ch.al65[last])}: Es gibt schlicht mehr ältere Menschen.`],
    ];
    const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
    const legTime = () => `${legendHTML(BR.map((b) => b / 10), (x) => `${fmt(x, { dec: 0 })} %`, 'Anteil 65+ allein lebend')}
      <div class="legend al-key"><span><i class="al-pt"></i> = 100 Menschen ab 65 mehr, die allein leben</span><span class="muted">grau: Wert unterdrückt oder Gemeinde fusioniert</span></div>`;
    const legChange = () => `<div class="legend"><span>Veränderung des Anteils ${Y0}–${Y1}, Prozentpunkte</span><span>weniger</span><span class="ramp">${DIV.map((c) => `<span style="background:${c}"></span>`).join('')}</span><span>mehr</span><span class="muted">Stufen: −4 · −2 · 0 · +2 · +4</span></div>`;
    setLeg(legTime());
    const cls = new Int8Array(n).fill(-9);
    const paintYear = (k) => {
      for (let i = 0; i < n; i++) {
        const v = A.a[k][i], c = v < 0 ? -1 : classOf(v, BR);
        if (c !== cls[i]) { cls[i] = c; const p = map.paths.get(A.ids[i]); if (p) p.style.fill = c < 0 ? '' : RAMP[c]; }
      }
    };
    const paintChange = () => {
      for (let i = 0; i < n; i++) {
        const a = A.a[0][i], b = A.a[last][i], p = map.paths.get(A.ids[i]); if (!p) continue;
        p.style.transition = 'fill 1.2s ease'; p.style.fill = a < 0 || b < 0 ? '' : DIV[classOf(b - a, DBR)];
      }
      cls.fill(-9);
    };
    const emit = (b) => {
      if (fx.childElementCount > CAP) return;
      const r = Math.random() * b.tot; let j = 0; while (b.cw[j] < r) j++;
      const id = A.ids[b.g[j]], c = S.geo.c[id.slice(4)]; if (!c) return;
      const e = document.createElementNS(NS, 'circle');
      e.setAttribute('cx', (c[0] + (Math.random() - 0.5) * 5).toFixed(1)); e.setAttribute('cy', (c[1] + (Math.random() - 0.5) * 5).toFixed(1));
      e.setAttribute('r', '1.9'); e.setAttribute('class', 'al-dot'); e.style.animationDuration = `${(2.2 + Math.random() * 1.4).toFixed(2)}s`;
      e.addEventListener('animationend', () => e.remove()); fx.appendChild(e);
    };
    let y = reduced() ? Y1 : Y0, run = !reduced(), phase = reduced() ? 'change' : 'time', hold = 0, t0 = performance.now(), shownK = -1;
    if (setTip) setTip((id) => {
      const r = region(id); const i = A.ids.indexOf(id); if (!r || i < 0) return '';
      if (phase === 'change') { const a = A.a[0][i], b = A.a[last][i]; return `${r.n} · 65+ allein: ${a < 0 || b < 0 ? '–' : `${pct(a)} (${Y0}) → ${pct(b)} (${Y1})`}`; }
      const v = A.a[Math.min(last, Math.floor(y - Y0))][i]; return `${r.n} · 65+ allein ${Math.floor(y)}: ${v < 0 ? '–' : pct(v)}`;
    });
    const frame = () => {
      const k = Math.min(last, Math.floor(y - Y0 + 1e-9));
      if (k !== shownK) { shownK = k; paintYear(k); }
      const yi = Y0 + k, nn = nAt(y);
      set('year', yi); big.textContent = yi; set('n', fmtInt(Math.round(nn))); set('grow', `+${fmtInt(Math.round(nn - ch.n65[0]))}`);
      set('beat', beats.reduce((s, b) => (y >= b[0] ? b[1] : s), beats[0][1])); set('mode', 'Anteil je Gemeinde');
      if (cn) {
        const up = Math.min(Y1, y), kk = Math.min(last - 1, Math.floor(up - Y0)), f = up - Y0 - kk;
        const iv = (arr) => idx(arr, kk) + (idx(arr, Math.min(last, kk + 1)) - idx(arr, kk)) * f;
        cn.setAttribute('d', d([...pts(ch.n65, up), [up, iv(ch.n65)]])); cs.setAttribute('d', d([...pts(ch.al65, up), [up, iv(ch.al65)]]));
        cd.setAttribute('cx', sx(up)); cd.setAttribute('cy', sy(iv(ch.n65)));
        chart.querySelector('.al-vn').textContent = up >= Y1 ? `Anzahl ${fmt(idx(ch.n65, last), { dec: 0 })}` : '';
        chart.querySelector('.al-vs').textContent = up >= Y1 ? `Anteil ${fmt(idx(ch.al65, last), { dec: 0 })}` : '';
      }
    };
    const toChange = () => {
      phase = 'change'; hold = 0; paintChange(); setLeg(legChange()); big.textContent = `${Y0}→${Y1}`;
      set('mode', 'Veränderung des Anteils'); set('year', `${Y0} → ${Y1}`);
      const up = A.a[0].reduce((s, a, i) => s + (a >= 0 && A.a[last][i] >= 0 && A.a[last][i] - a > 0 ? 1 : 0), 0);
      const both = A.a[0].reduce((s, a, i) => s + (a >= 0 && A.a[last][i] >= 0 ? 1 : 0), 0);
      set('beat', `Bilanz ${Y0}–${Y1}: In ${fmtInt(up)} von ${fmtInt(both)} Gemeinden mit Werten ist der Anteil gestiegen (rot), in den übrigen gesunken (blau). Insgesamt leben ${fmtInt(grow)} Menschen ab 65 mehr allein.`);
    };
    const restart = () => { phase = 'time'; y = Y0; hold = 0; shownK = -1; cls.fill(-9); map.paths.forEach((p) => { p.style.transition = ''; }); BZ.forEach((b) => { b.carry = Math.random(); }); setLeg(legTime()); };
    const tick = (now) => {
      if (my !== gen) return;
      if (!alive()) { cleanFx(); return; }
      const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      if (phase === 'time') {
        if (run) {
          if (y >= Y1) { hold += dt; if (hold > 2.2) toChange(); }
          else {
            const y2 = Math.min(Y1, y + dt * SPEED), k = Math.min(last - 1, Math.floor(y - Y0));
            BZ.forEach((b) => { b.carry += Math.max(0, b.n[k + 1] - b.n[k]) / PER * (y2 - y); while (b.carry >= 1) { b.carry -= 1; emit(b); } });
            y = y2;
          }
        }
        frame();
      } else if (run) { hold += dt; if (hold > 7) restart(); }
      requestAnimationFrame(tick);
    };
    if (phase === 'change') { y = Y1; frame(); toChange(); }
    requestAnimationFrame(tick);
    const pb = q('play'), rb = q('restart');
    if (pb) { pb.textContent = run ? 'Pause' : 'Abspielen'; pb.onclick = () => { run = !run; t0 = performance.now(); pb.textContent = run ? 'Pause' : 'Abspielen'; }; }
    if (rb) rb.onclick = () => { restart(); run = true; if (pb) pb.textContent = 'Pause'; };
  };

  if (opts.ctl) {
    opts.ctl.go = (st) => {
      if (st && mode !== 1) anim();
      else if (!st && mode !== 0) setLeg(still());
    };
  }
  const leg = still();
  if (opts.initStep && opts.initStep()) setTimeout(() => opts.ctl?.go(opts.initStep()), 0);
  return leg;
}
