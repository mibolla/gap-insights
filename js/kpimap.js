// Experte: «Auf Karte zeigen» for bar cards – a half-width choropleth beside the bars.
// Level: Gemeinde | Bezirk | Kanton; Gemeinden either of the Bezirk or of the whole Kanton.
import { S, region, shortName, regionLabel, prefs, setPrefs } from './store.js?v=20261115164535';
import { esc } from './ui.js?v=20261115164535';

const NS = 'http://www.w3.org/2000/svg';
const RAMP = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)'];
const LVL = { GDE: 'Gemeinden', BEZ: 'Bezirke', KT: 'Kantone' };
const MAP_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/></svg>';

/** extents offered for a granularity: Gemeinden in Bezirk | Kanton, Bezirke in Kanton | Schweiz, Kantone in der Schweiz */
const EXT = { BEZ: 'im Bezirk', KT: 'im Kanton', CH: 'in der Schweiz' };
function extsFor(r, level) {
  if (level === 'KT' || r.e === 'CH') return ['CH'];
  if (level === 'BEZ') return ['KT', 'CH'];
  return r.e === 'KT' ? ['KT'] : ['BEZ', 'KT'];
}
/** the regions drawn: granularity `level` within the extent `ext` around the region r */
function regionsFor(r, level, ext) {
  const all = S.regions.filter((x) => x.e === level);
  if (ext === 'CH') return all;
  if (ext === 'KT') return all.filter((x) => x.kt === r.kt);
  const bez = r.e === 'GDE' ? r.bez : r.id;
  return all.filter((x) => x.bez === bez);
}
const pathOf = (x) => (x.e === 'GDE' ? S.geo.gde[x.id.slice(4)] : x.e === 'BEZ' ? S.geo.bez[x.id.slice(4)] : S.geo.kt[x.kt]);
/** the region itself, or the Bezirk / Kanton it belongs to at a coarser level */
const selfAt = (r, level) => (level === r.e ? r.id : level === 'KT' ? (r.e === 'CH' ? null : `KT:${r.kt}`) : level === 'BEZ' && r.e === 'GDE' ? r.bez : null);

/** opts: { id, title, label, value(id) -> number|null, fmt(v) -> string, levels: ['GDE','BEZ','KT'], href(id) } */
export function kpiMapCard(opts) {
  const r = region(opts.id);
  const card = document.createElement('article'); card.className = 'card kmap';
  const can = (l) => opts.levels.includes(l);
  let level = can(r.e) ? r.e : can('BEZ') ? 'BEZ' : 'KT';
  if (r.e === 'CH') level = 'KT';
  const want = { ...(prefs().mapExts || {}) };   // remembered extent per granularity
  const extOf = () => { const xs = extsFor(r, level); return xs.includes(want[level]) ? want[level] : xs[xs.length > 1 && level === 'GDE' ? 1 : 0]; };
  card.innerHTML = `<div class="card-head"><h3>${esc(opts.title)}</h3><div class="card-tools no-print"><button class="icon-btn" data-close title="Karte schliessen" aria-label="Karte schliessen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>
    <div class="km-ctrl no-print"><div class="km-grp"><span class="km-k">Granularität</span><div class="seg" role="group" aria-label="Granularität">${['GDE', 'BEZ', 'KT'].map((l) => `<button type="button" data-l="${l}"${can(l) ? '' : ' disabled title="Für diese Ebene nicht verfügbar"'}>${LVL[l]}</button>`).join('')}</div></div>
      <div class="km-grp"><span class="km-k">Ausschnitt</span><div class="seg km-ext" role="group" aria-label="Ausschnitt"></div></div></div>
    <div class="km-map"><svg role="img"></svg></div>
    <p class="km-read num" aria-live="polite"></p>
    <div class="km-leg num"></div>`;
  const svg = card.querySelector('.km-map svg'); const read = card.querySelector('.km-read'); const leg = card.querySelector('.km-leg');
  const draw = () => {
    const ext = extOf();
    const regs = regionsFor(r, level, ext).map((x) => ({ x, d: pathOf(x), v: opts.value(x.id) })).filter((o) => o.d);
    const vals = regs.map((o) => o.v).filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
    // quintile breaks (fewer classes when there are few distinct values)
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    const brk = [...new Set([0.2, 0.4, 0.6, 0.8].map(q))].filter((b) => b > vals[0]);
    const cls = (v) => { let k = 0; while (k < brk.length && v >= brk[k]) k++; return Math.round((k / Math.max(1, brk.length)) * (RAMP.length - 1)); };
    const me = selfAt(r, level);
    svg.innerHTML = '';
    const g = document.createElementNS(NS, 'g'); svg.appendChild(g);
    let top = null; const items = [];
    regs.forEach((o) => {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', o.d);
      const ok = o.v != null && Number.isFinite(o.v);
      p.style.fill = ok ? RAMP[cls(o.v)] : 'var(--map-fill)';
      if (!ok) p.classList.add('na');
      if (o.x.id === me) { p.classList.add('me'); top = p; }
      const txt = `${o.x.e === 'GDE' ? o.x.n : regionLabel(o.x.id, false)}: ${ok ? opts.fmt(o.v) : 'kein Wert'}`;
      p.addEventListener('mouseenter', () => { read.innerHTML = `<b>${esc(txt.split(': ')[0])}</b> ${esc(txt.split(': ')[1])}`; });
      p.addEventListener('click', () => { location.hash = opts.href(o.x.id); });
      const t = document.createElementNS(NS, 'title'); t.textContent = txt; p.appendChild(t);
      g.appendChild(p);
      if (ok) items.push({ p, o, k: cls(o.v) });
    });
    if (top) g.appendChild(top);   // the own region on top, so its outline is complete
    const lab = document.createElementNS(NS, 'g'); lab.setAttribute('class', 'km-val'); svg.appendChild(lab);
    // values written into the regions that are large enough (font 10.5 px on screen, whatever the zoom of the viewBox)
    const labels = () => {
      lab.innerHTML = ''; const vb = svg.viewBox.baseVal; const w = svg.clientWidth; const h = svg.clientHeight;
      if (!vb || !vb.width || !w) return;
      const sc = Math.min(w / vb.width, h / vb.height); const fs = 10.5 / sc; const pt = svg.createSVGPoint();
      items.forEach(({ p, o, k }) => {
        const t = opts.fmt(o.v).replace(/\s*%$/, ''); const b = p.getBBox();
        const tw = t.length * 0.6 * fs; const c = o.x.e === 'GDE' && S.geo.c && S.geo.c[o.x.id.slice(4)];
        const cx = c ? c[0] : b.x + b.width / 2; const cy = c ? c[1] : b.y + b.height / 2;
        if (b.width < tw * 1.25 || b.height < fs * 1.9) return;
        // the whole text box, with a little air, must lie inside the shape
        const inside = [[-0.56, 0], [0, 0], [0.56, 0], [0, -0.65], [0, 0.65]].every(([dx, dy]) => { pt.x = cx + dx * tw; pt.y = cy + dy * fs; return p.isPointInFill(pt); });
        if (!inside) return;
        const e = document.createElementNS(NS, 'text'); e.setAttribute('x', cx); e.setAttribute('y', cy); e.setAttribute('font-size', fs);
        e.setAttribute('class', k >= 3 ? 'on-dark' : 'on-light'); e.textContent = t; lab.appendChild(e);
      });
    };
    const fit = () => { const b = g.getBBox(); if (!b.width) return; const m = Math.max(b.width, b.height) * 0.02; svg.setAttribute('viewBox', `${b.x - m} ${b.y - m} ${b.width + 2 * m} ${b.height + 2 * m}`); labels(); };
    card._relabel = labels;
    if (card.isConnected) fit(); else requestAnimationFrame(fit);
    svg.setAttribute('aria-label', `Karte: ${opts.label}, ${LVL[level]}`);
    const scope = `${LVL[level]} ${ext === 'CH' ? 'der Schweiz' : ext === 'KT' ? `im Kanton ${r.kt}` : `im ${regionLabel(r.e === 'GDE' ? r.bez : r.id, false)}`}`;
    const meV = me ? opts.value(me) : null;
    const base = me && meV != null ? `<b>${esc(shortName(me))}</b> ${esc(opts.fmt(meV))}` : `${regs.length} ${LVL[level]}`;
    read.innerHTML = base; svg.onmouseleave = () => { read.innerHTML = base; };
    leg.innerHTML = vals.length ? `<span class="km-lab">${esc(opts.label)} · ${esc(scope)}</span><span class="km-ramp"><span>${esc(opts.fmt(vals[0]))}</span>${RAMP.map((c) => `<i style="background:${c}"></i>`).join('')}<span>${esc(opts.fmt(vals[vals.length - 1]))}</span></span>`
      : `<span class="km-lab">Für diese Ebene liegen keine Werte vor.</span>`;
    card.querySelectorAll('[data-l]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === level)));
    // the extents on the right follow the granularity
    card.querySelector('.km-ext').innerHTML = extsFor(r, level).map((x) => `<button type="button" data-x="${x}" aria-pressed="${x === ext}">${EXT[x]}</button>`).join('');
  };
  card.querySelector('.km-ctrl').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.l) level = b.dataset.l; else { want[level] = b.dataset.x; setPrefs({ mapExts: want }); }
    draw();
  });
  draw();
  if (window.ResizeObserver) new ResizeObserver(() => card._relabel && card._relabel()).observe(svg);
  return card;
}

/** adds the «Auf Karte zeigen» button under `after` and opens the map card to the right of `card` */
export function attachMap(card, after, opts) {
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small km-toggle no-print';
  let mapCard = null; let pair = null;
  const label = () => { btn.innerHTML = `${MAP_ICON}<span>${mapCard ? 'Karte schliessen' : 'Auf Karte zeigen'}</span>`; btn.setAttribute('aria-expanded', String(!!mapCard)); };
  const close = () => { if (!mapCard) return; if (pair.isConnected) pair.before(card); pair.remove(); pair = null; mapCard = null; card.classList.remove('has-map'); label(); };
  const open = () => {
    if (mapCard || !card.parentElement) return;
    // bars and map share one full-width row, so the map is always to the right of its own bar card
    pair = document.createElement('div'); pair.className = 'km-pair'; card.before(pair);
    mapCard = kpiMapCard(opts); card.classList.add('has-map'); pair.append(card, mapCard);
    mapCard.querySelector('[data-close]').addEventListener('click', close); label();
    mapCard._relabel?.();
  };
  btn.addEventListener('click', () => (mapCard ? close() : open()));
  label(); after.after(btn);
  card._map = { open, close, isOpen: () => !!mapCard };
}
