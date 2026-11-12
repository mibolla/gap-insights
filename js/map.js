// Swiss map: Gemeinden as SVG paths (LV95 projected to a 1000 px wide box), zoom and pan with d3.zoom.
import { S, region, fmtInt } from './store.js?v=20261112122928';

const NS = 'http://www.w3.org/2000/svg';
const RAMP = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)'];

export function createMap(container, { onClick, tip = defaultTip, interactive = true, mini = false } = {}) {
  const G = S.geo;
  container.innerHTML = '';
  container.classList.add('map');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${G.w} ${G.h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Karte der Schweiz mit allen Gemeinden. Auswahl auch über das Suchfeld möglich.');
  const root = document.createElementNS(NS, 'g');
  svg.appendChild(root);
  const bg = document.createElementNS(NS, 'path');
  bg.setAttribute('class', 'bg'); bg.setAttribute('d', G.ch); root.appendChild(bg);

  const gdeG = el('g', 'gde'); root.appendChild(gdeG);
  const paths = new Map();
  const frag = document.createDocumentFragment();
  for (const [nr, d] of Object.entries(G.gde)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); p.dataset.id = `GDE:${nr}`;
    frag.appendChild(p); paths.set(`GDE:${nr}`, p);
  }
  gdeG.appendChild(frag);
  const areas = {};
  for (const lvl of ['bez', 'kt']) {
    const g = el('g', `area area-${lvl}`); root.appendChild(g);
    areas[lvl] = { g, paths: new Map() };
    for (const [k, d] of Object.entries(G[lvl])) {
      const p = document.createElementNS(NS, 'path');
      const id = lvl === 'kt' ? `KT:${k}` : `BEZ:${k}`;
      p.setAttribute('d', d); p.dataset.id = id; g.appendChild(p); areas[lvl].paths.set(id, p);
    }
  }
  const dotsG = el('g', 'dots'); root.appendChild(dotsG);
  const ktLines = el('g', 'kt'); root.appendChild(ktLines);
  for (const d of Object.values(G.kt)) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); ktLines.appendChild(p); }
  container.appendChild(svg);

  // tooltip + controls
  const tipEl = document.createElement('div'); tipEl.className = 'map-tip'; tipEl.hidden = true; container.appendChild(tipEl);
  let zoom = null; let current = d3.zoomIdentity; let level = 'gde';
  if (interactive) {
    zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[-50, -50], [G.w + 50, G.h + 50]])
      .on('zoom', (ev) => { current = ev.transform; root.setAttribute('transform', ev.transform); });
    d3.select(svg).call(zoom).on('dblclick.zoom', null);
    const ctrl = document.createElement('div'); ctrl.className = 'map-ctrl no-print';
    ctrl.innerHTML = '<button type="button" aria-label="Hineinzoomen">+</button><button type="button" aria-label="Herauszoomen">−</button><button type="button" aria-label="Ganze Schweiz">⤢</button>';
    const [bIn, bOut, bAll] = ctrl.querySelectorAll('button');
    bIn.onclick = () => d3.select(svg).transition().duration(300).call(zoom.scaleBy, 1.6);
    bOut.onclick = () => d3.select(svg).transition().duration(300).call(zoom.scaleBy, 1 / 1.6);
    bAll.onclick = () => api.reset();
    container.appendChild(ctrl);
  }
  const hitLayer = () => (level === 'gde' ? gdeG : areas[level].g);
  const pick = (ev) => ev.target && ev.target.dataset && ev.target.dataset.id;
  svg.addEventListener('mousemove', (ev) => {
    const id = pick(ev);
    if (!id || !tip || mini) { tipEl.hidden = true; return; }
    const box = container.getBoundingClientRect();
    tipEl.innerHTML = tip(id); tipEl.hidden = false;
    tipEl.style.left = `${ev.clientX - box.left}px`; tipEl.style.top = `${ev.clientY - box.top}px`;
  });
  svg.addEventListener('mouseleave', () => { tipEl.hidden = true; });
  let downAt = null;
  svg.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
  svg.addEventListener('click', (ev) => {
    if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return; // was a drag
    const id = pick(ev);
    if (id && onClick) {
      const box = container.getBoundingClientRect();
      onClick(id, { x: ev.clientX - box.left, y: ev.clientY - box.top });
    }
  });

  const api = {
    svg, container,
    /** which layer receives colours and clicks: 'gde' | 'bez' | 'kt' */
    setLevel(l) {
      level = l;
      for (const [k, a] of Object.entries(areas)) { a.g.classList.toggle('on', k === l); a.g.style.pointerEvents = k === l ? 'auto' : 'none'; }
      gdeG.style.pointerEvents = l === 'gde' ? 'auto' : 'none';
    },
    clear() {
      paths.forEach((p) => { p.style.fill = ''; p.classList.remove('hl', 'hlp', 'sel', 'peer', 'dim'); });
      Object.values(areas).forEach((a) => a.paths.forEach((p) => { p.style.fill = ''; p.classList.remove('sel'); }));
      dotsG.innerHTML = '';
    },
    /** colour by class index (0-4) per region id; missing = default fill */
    choropleth(classes) {
      const target = level === 'gde' ? paths : areas[level].paths;
      target.forEach((p, id) => { const c = classes.get(id); p.style.fill = c == null || c < 0 ? '' : RAMP[c]; });
    },
    highlight(ids, { prog = false } = {}) { const set = new Set(ids); paths.forEach((p, id) => { p.classList.toggle('hl', set.has(id) && !prog); p.classList.toggle('hlp', set.has(id) && prog); }); },
    peers(ids) { const set = new Set(ids); paths.forEach((p, id) => p.classList.toggle('peer', set.has(id))); },
    dots(points) {   // [{id, r}] at Gemeinde representative points
      dotsG.innerHTML = '';
      for (const { id, r } of points) {
        const c = S.geo.c[id.slice(4)]; if (!c) continue;
        const ci = document.createElementNS(NS, 'circle');
        ci.setAttribute('cx', c[0]); ci.setAttribute('cy', c[1]); ci.setAttribute('r', r); dotsG.appendChild(ci);
      }
    },
    select(id, { zoomTo = true } = {}) {
      paths.forEach((p) => p.classList.remove('sel'));
      Object.values(areas).forEach((a) => a.paths.forEach((p) => p.classList.remove('sel')));
      if (!id) return;
      const r = region(id); if (!r || r.e === 'CH') return;
      const p = r.e === 'GDE' ? paths.get(id) : areas[r.e === 'KT' ? 'kt' : 'bez'].paths.get(id);
      if (!p) return;
      if (r.e !== 'GDE') { areas[r.e === 'KT' ? 'kt' : 'bez'].g.classList.add('on'); }
      p.classList.add('sel');
      if (zoomTo) api.zoomToBox(p.getBBox(), r.e === 'GDE' ? 6 : 3);
    },
    zoomToBox(b, maxK = 6) {
      const pad = 1.8;
      const k = Math.min(maxK, 0.9 / Math.max((b.width * pad) / G.w, (b.height * pad) / G.h));
      const t = d3.zoomIdentity.translate(G.w / 2, G.h / 2).scale(Math.max(1, k)).translate(-(b.x + b.width / 2), -(b.y + b.height / 2));
      if (zoom) d3.select(svg).transition().duration(reduced() ? 0 : 900).call(zoom.transform, t);
      else root.setAttribute('transform', t);
    },
    zoomToKanton(kt, k = 3) { const p = areas.kt.paths.get(`KT:${kt}`); if (p) api.zoomToBox(p.getBBox(), k); },
    reset() { if (zoom) d3.select(svg).transition().duration(reduced() ? 0 : 600).call(zoom.transform, d3.zoomIdentity); },
    /** slow ambient drift (landing); stops for good on the first user interaction */
    drift() {
      if (!zoom || reduced()) return () => {};
      let stopped = false; const targets = ['LU', 'TI', 'GR', 'VD', 'ZH', 'BE'];
      let i = 0;
      const step = () => {
        if (stopped) return;
        const kt = targets[i++ % targets.length];
        const p = areas.kt.paths.get(`KT:${kt}`);
        const b = p.getBBox();
        const t = d3.zoomIdentity.translate(G.w / 2, G.h / 2).scale(1.6).translate(-(b.x + b.width / 2), -(b.y + b.height / 2));
        d3.select(svg).transition().duration(9000).ease(d3.easeSinInOut).call(zoom.transform, t)
          .transition().duration(9000).ease(d3.easeSinInOut).call(zoom.transform, d3.zoomIdentity)
          .on('end', step);
      };
      const stop = () => { if (!stopped) { stopped = true; d3.select(svg).interrupt(); } };
      ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((e) => svg.addEventListener(e, stop, { once: true, passive: true }));
      setTimeout(step, 1500);
      return stop;
    },
    paths,
  };
  api.setLevel('gde');
  return api;
}

function el(tag, cls) { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; }
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function defaultTip(id) {
  const r = region(id); if (!r) return '';
  if (r.e === 'GDE') return `<b>${r.n}</b> (${r.kt}) · ${fmtInt(r.pop)} Einw.`;
  if (r.e === 'BEZ') return `<b>Bezirk ${r.n}</b> (${r.kt}) · ${fmtInt(r.pop)} Einw.`;
  return `<b>Kanton ${r.n}</b> · ${fmtInt(r.pop)} Einw.`;
}

export function legendHTML(breaks, fmtFn, label) {
  const lo = breaks.length ? fmtFn(breaks[0]) : '';
  const hi = breaks.length ? fmtFn(breaks[breaks.length - 1]) : '';
  return `<div class="legend"><span>${label}</span><span>bis ${lo}</span><span class="ramp">${RAMP.map((c) => `<span style="background:${c}"></span>`).join('')}</span><span>über ${hi}</span></div>`;
}
