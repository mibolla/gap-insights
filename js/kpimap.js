// Experte: «Auf Karte zeigen» for bar cards – a half-width choropleth beside the bars.
// Level: Gemeinde | Bezirk | Kanton; Gemeinden either of the Bezirk or of the whole Kanton.
import { S, region, shortName, regionLabel, prefs, setPrefs } from './store.js?v=20261115161844';
import { esc } from './ui.js?v=20261115161844';

const NS = 'http://www.w3.org/2000/svg';
const RAMP = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)'];
const LVL = { GDE: 'Gemeinden', BEZ: 'Bezirke', KT: 'Kantone' };
const MAP_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/></svg>';

/** the regions drawn for a level; ext: 'BEZ' | 'KT' (Gemeinden only) */
function regionsFor(r, level, ext) {
  if (level === 'KT') return S.regions.filter((x) => x.e === 'KT');
  if (r.e === 'CH') return S.regions.filter((x) => x.e === level);
  if (level === 'BEZ') return S.regions.filter((x) => x.e === 'BEZ' && x.kt === r.kt);
  const bez = r.e === 'GDE' ? r.bez : r.e === 'BEZ' ? r.id : null;
  return S.regions.filter((x) => x.e === 'GDE' && (ext === 'BEZ' && bez ? x.bez === bez : x.kt === r.kt));
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
  let ext = prefs().mapExt === 'BEZ' ? 'BEZ' : 'KT';
  card.innerHTML = `<div class="card-head"><h3>${esc(opts.title)}</h3><div class="card-tools no-print"><button class="icon-btn" data-close title="Karte schliessen" aria-label="Karte schliessen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>
    <div class="km-ctrl no-print"><div class="seg" role="group" aria-label="Ebene">${['GDE', 'BEZ', 'KT'].map((l) => `<button type="button" data-l="${l}"${can(l) ? '' : ' disabled title="Für diese Ebene nicht verfügbar"'}>${LVL[l]}</button>`).join('')}</div>
      <div class="seg km-ext" role="group" aria-label="Ausschnitt"><button type="button" data-x="BEZ">im Bezirk</button><button type="button" data-x="KT">im Kanton</button></div></div>
    <div class="km-map"><svg role="img"></svg></div>
    <p class="km-read num" aria-live="polite"></p>
    <div class="km-leg num"></div>`;
  const svg = card.querySelector('.km-map svg'); const read = card.querySelector('.km-read'); const leg = card.querySelector('.km-leg');
  const draw = () => {
    const regs = regionsFor(r, level, ext).map((x) => ({ x, d: pathOf(x), v: opts.value(x.id) })).filter((o) => o.d);
    const vals = regs.map((o) => o.v).filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
    // quintile breaks (fewer classes when there are few distinct values)
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    const brk = [...new Set([0.2, 0.4, 0.6, 0.8].map(q))].filter((b) => b > vals[0]);
    const cls = (v) => { let k = 0; while (k < brk.length && v >= brk[k]) k++; return Math.round((k / Math.max(1, brk.length)) * (RAMP.length - 1)); };
    const me = selfAt(r, level);
    svg.innerHTML = '';
    const g = document.createElementNS(NS, 'g'); svg.appendChild(g);
    let top = null;
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
    });
    if (top) g.appendChild(top);   // the own region on top, so its outline is complete
    const fit = () => { const b = g.getBBox(); if (!b.width) return; const m = Math.max(b.width, b.height) * 0.02; svg.setAttribute('viewBox', `${b.x - m} ${b.y - m} ${b.width + 2 * m} ${b.height + 2 * m}`); };
    if (card.isConnected) fit(); else requestAnimationFrame(fit);
    svg.setAttribute('aria-label', `Karte: ${opts.label}, ${LVL[level]}`);
    const scope = level === 'KT' ? 'alle Kantone' : r.e === 'CH' ? `alle ${LVL[level]}` : level === 'BEZ' ? `Bezirke im Kanton ${r.kt}` : ext === 'BEZ' && r.e !== 'KT' ? `Gemeinden im ${regionLabel(r.e === 'GDE' ? r.bez : r.id, false)}` : `Gemeinden im Kanton ${r.kt}`;
    const meV = me ? opts.value(me) : null;
    const base = me && meV != null ? `<b>${esc(shortName(me))}</b> ${esc(opts.fmt(meV))}` : `${regs.length} ${LVL[level]}`;
    read.innerHTML = base; svg.onmouseleave = () => { read.innerHTML = base; };
    leg.innerHTML = vals.length ? `<span class="km-lab">${esc(opts.label)} · ${esc(scope)}</span><span class="km-ramp"><span>${esc(opts.fmt(vals[0]))}</span>${RAMP.map((c) => `<i style="background:${c}"></i>`).join('')}<span>${esc(opts.fmt(vals[vals.length - 1]))}</span></span>`
      : `<span class="km-lab">Für diese Ebene liegen keine Werte vor.</span>`;
    card.querySelectorAll('[data-l]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === level)));
    const extBox = card.querySelector('.km-ext'); extBox.hidden = !(level === 'GDE' && (r.e === 'GDE' || r.e === 'BEZ'));
    extBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.x === ext)));
  };
  card.querySelector('.km-ctrl').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.l) level = b.dataset.l; else { ext = b.dataset.x; setPrefs({ mapExt: ext }); }
    draw();
  });
  draw();
  return card;
}

/** adds the «Auf Karte zeigen» button under `after` and opens the map card to the right of `card` */
export function attachMap(card, after, opts) {
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small km-toggle no-print';
  let mapCard = null;
  const label = () => { btn.innerHTML = `${MAP_ICON}<span>${mapCard ? 'Karte schliessen' : 'Auf Karte zeigen'}</span>`; btn.setAttribute('aria-expanded', String(!!mapCard)); };
  const close = () => { if (!mapCard) return; mapCard.remove(); mapCard = null; card.classList.remove('has-map'); label(); };
  const open = () => {
    if (mapCard || !card.parentElement) return;
    mapCard = kpiMapCard(opts); card.classList.add('has-map'); card.after(mapCard);
    mapCard.querySelector('[data-close]').addEventListener('click', close); label();
  };
  btn.addEventListener('click', () => (mapCard ? close() : open()));
  label(); after.after(btn);
  card._map = { open, close, isOpen: () => !!mapCard };
}
