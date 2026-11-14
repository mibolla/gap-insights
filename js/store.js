// Data access, formatting, comparison groups and key sentences.
const V = window.GAP_BUILD ? `?v=${window.GAP_BUILD}` : '';   // cache busting per build (set in index.html by step 8)
export const dataUrl = (p) => `data/${p}${V}`;
export const S = { meta: null, regions: [], byId: new Map(), values: null, idx: new Map(), geo: null, detailCache: new Map() };

export async function loadAll() {
  const get = (p) => fetch(`data/${p}${V}`).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  const [meta, regions, values, geo] = await Promise.all([get('meta.json'), get('regions.json'), get('values.json'), get('geo.json')]);
  S.meta = meta; S.regions = regions; S.values = values; S.geo = geo;
  regions.forEach((r) => S.byId.set(r.id, r));
  values.ids.forEach((id, i) => S.idx.set(id, i));
  S.ind = new Map(meta.indicators.map((i) => [i.id, i]));
  S.q = new Map(meta.questions.map((q) => [q.id, q]));
  S.sub = new Map();
  meta.themen.forEach((t) => t.sub.forEach((s) => S.sub.set(s.id, { ...s, thema: t })));
}

export async function detail(id) {
  if (!S.detailCache.has(id)) {
    S.detailCache.set(id, fetch(`data/detail/${id.replace(':', '_')}.json${V}`).then((r) => r.json()));
  }
  return S.detailCache.get(id);
}

export const val = (ind, id) => { const a = S.values.v[ind]; const i = S.idx.get(id); return a && i !== undefined ? a[i] : null; };
export const region = (id) => S.byId.get(id);

/** parents of a region: [BEZ, KT, CH] that exist */
export function parents(id) {
  const r = region(id); const out = [];
  if (!r || r.e === 'CH') return out;
  if (r.e === 'GDE') out.push(r.bez);
  if (r.e !== 'KT') out.push(`KT:${r.kt}`);
  out.push('CH');
  return out;
}

export function regionLabel(id, withKt = true) {
  const r = region(id); if (!r) return id;
  if (r.e === 'CH') return 'Schweiz';
  if (r.e === 'KT') return `Kanton ${r.n}`;
  if (r.e === 'BEZ') return withKt ? `Bezirk ${r.n} (${r.kt})` : `Bezirk ${r.n}`;
  return withKt ? `${r.n} (${r.kt})` : r.n;
}
export const shortName = (id) => { const r = region(id); return r.e === 'KT' ? r.n : r.e === 'BEZ' ? `Bezirk ${r.n}` : r.n; };
export const ebeneLabel = { CH: 'Land', KT: 'Kanton', BEZ: 'Bezirk', GDE: 'Gemeinde' };
/** coat of arms (PNG, 64 px wide, Wikimedia Commons): the Gemeinde's own, else its Kanton's (also for Bezirke); none for CH */
export function wappen(id) {
  const r = region(id); if (!r || r.e === 'CH') return null;
  return r.e === 'GDE' && r.w ? `wappen/GDE_${id.slice(4)}.png` : `wappen/KT_${r.kt}.png`;
}
export const wappenImg = (id, cls = 'wappen') => { const u = wappen(id); return u ? `<img class="${cls}" src="${u}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''; };

// ---------- formatting
const nf = (d) => new Intl.NumberFormat('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmt(v, ind) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  const i = typeof ind === 'string' ? S.ind.get(ind) : ind;
  const d = i ? i.dec : 0;
  return nf(d).format(v);
}
export function fmtUnit(v, ind) {
  const i = typeof ind === 'string' ? S.ind.get(ind) : ind;
  const s = fmt(v, i);
  if (s === '–') return s;
  const u = i.unit;
  if (u.startsWith('Stufe')) return `Stufe ${s}`;
  if (u === '%' ) return `${s} %`;
  if (u === 'CHF') return `${s} Franken`;
  if (u === 'pro 1000' || u === 'pro 100' || u === 'Personen' || u === 'Stunden' || u === 'Jahre' || u === 'Tage' || u === 'Stellen') return `${s} ${u === 'pro 1000' ? 'von 1000' : u === 'pro 100' ? 'pro 100' : u}`;
  return `${s} ${u}`;
}
export const fmtInt = (v) => nf(0).format(v);
export const plusMinus = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(d).format(Math.abs(v));

// ---------- comparisons
/** describe a relative to b: 'deutlich mehr als', 'etwas mehr als', 'etwa gleich viel wie', ... */
export function compareWord(a, b, ind) {
  if (a == null || b == null) return null;
  const i = S.ind.get(ind);
  const diff = a - b;
  const rel = Math.abs(b) > 1e-9 ? Math.abs(diff / b) : Math.abs(diff);
  const pp = i && (i.unit === '%' || i.unit === '% des Ertrags');   // shares: compare in percentage points
  const tiny = pp ? Math.abs(diff) < 0.3 : rel < 0.03;
  if (tiny) return 'etwa gleich hoch wie';
  const strong = pp ? Math.abs(diff) >= 3 || (rel >= 0.2 && Math.abs(diff) >= 1) : rel >= 0.15;
  return `${strong ? 'deutlich' : 'etwas'} ${diff > 0 ? 'höher' : 'tiefer'} als`;
}

/** key sentence for one indicator and region, with Kanton and Schweiz as comparison.
 *  The indicator name is the card title, so the sentence starts with the place. */
export function sentence(indId, id) {
  const i = S.ind.get(indId); const r = region(id);
  const v = val(indId, id);
  if (v == null) return null;
  const vc = val(indId, 'CH');
  if (r.e === 'CH') return `Schweiz: <b>${fmtUnit(v, i)}</b>.`;
  const head = `${shortName(id)}: <b>${fmtUnit(v, i)}</b>`;
  const wc = compareWord(v, vc, indId);
  if (r.e === 'KT') return `${head} – ${wc} in der Schweiz (${fmtUnit(vc, i)}).`;
  const kt = `KT:${r.kt}`; const vk = val(indId, kt);
  if (vk == null) return `${head} – ${wc} in der Schweiz (${fmtUnit(vc, i)}).`;
  const wk = compareWord(v, vk, indId);
  return `${head} – ${wk} im Kanton ${region(kt).n} (${fmtUnit(vk, i)}) und ${wc === wk ? '' : wc + ' '}in der Schweiz (${fmtUnit(vc, i)}).`;
}

/** comparison groups for a Gemeinde (ids, excluding itself) */
export function groupMembers(mode, id) {
  const r = region(id);
  if (!r) return [];
  if (mode === 'nb' && r.e === 'GDE') return r.nb || [];
  if (mode === 'size' && r.e === 'GDE') {
    return S.regions.filter((x) => x.e === 'GDE' && x.kt === r.kt && x.id !== id)
      .sort((a, b) => Math.abs(Math.log(a.pop / r.pop)) - Math.abs(Math.log(b.pop / r.pop))).slice(0, 12).map((x) => x.id);
  }
  if (mode === 'kanton') {
    return S.regions.filter((x) => x.e === r.e && x.kt === r.kt && x.id !== id).map((x) => x.id);
  }
  if (mode === 'own') return (prefs().own || []).filter((x) => x !== id && S.byId.has(x));
  return [];
}
export const groupLabel = { kt: 'Bezirk, Kanton, Schweiz', nb: 'Nachbargemeinden', size: 'Ähnliche Grösse', kanton: 'Alle im Kanton', own: 'Eigene Auswahl' };

// ---------- preferences, Favoriten (browser storage; key 'mappe' kept so saved favourites survive)
const KEY = 'gap-insights-v1';
export function prefs() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function setPrefs(patch) {
  const p = { ...prefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: keep in memory only */ }
  return p;
}
export const mappe = () => prefs().mappe || [];
export function toggleMappe(item) {
  const m = mappe(); const k = (x) => `${x.ind}|${x.id}`;
  const exists = m.some((x) => k(x) === k(item));
  const next = exists ? m.filter((x) => k(x) !== k(item)) : [...m, { ...item, note: '' }];
  setPrefs({ mappe: next });
  return !exists;
}
export const inMappe = (ind, id) => mappe().some((x) => x.ind === ind && x.id === id);

// ---------- sources
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** link to a source (opens the publisher's page in a new tab; app-internal links stay in the app) */
export function srcLink(url, label) {
  if (!url) return escH(label);
  const ext = !url.startsWith('#');
  return `<a href="${escH(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${escH(label)}${ext ? ' ↗' : ' →'}</a>`;
}
/** source line as HTML with the dataset name linked to the publisher's page */
export function sourceHTML(srcKey) {
  const s = S.meta.sources[srcKey];
  return `<span>Quelle: ${escH(s.publisher)},</span> ${srcLink(s.url, s.name)} <span>· ${escH(s.year)}</span>`;
}
export function sourceLine(srcKey) {
  const s = S.meta.sources[srcKey];
  return `Quelle: ${s.publisher}, ${s.name} · ${s.year}`;
}

/** quantile breaks over non-null values */
export function quantiles(values, n = 5) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return [];
  return Array.from({ length: n - 1 }, (_, k) => v[Math.floor(((k + 1) / n) * (v.length - 1))]);
}
export const classOf = (x, breaks) => (x == null ? -1 : breaks.filter((b) => x > b).length);
