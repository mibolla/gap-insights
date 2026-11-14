// Workflow A "Gemeinde zuerst": region header, portrait tiles, topic pages with comparison switch.
import { S, val, region, parents, detail, fmt, fmtUnit, fmtInt, plusMinus, shortName, regionLabel, compareWord,
  prefs, setPrefs, groupMembers, groupLabel, ebeneLabel, srcLink, wappenImg } from './store.js?v=20261114143521';
import { createMap } from './map.js?v=20261114143521';
import { indicatorCard, chartCard, pyramid, indexLines, shareBars, stackedMix, bewChart, peerScatter, aphLines, aphRate, APH_TS_OPTS, histLines } from './cards.js?v=20261114143521';
import { omnibox } from './search.js?v=20261114143521';
import { esc, main } from './ui.js?v=20261114143521';
import { ausblickSection, ausblickPage, ausblickTiles } from './prog.js?v=20261114143521';
import { openReportDialog } from './report.js?v=20261114143521';

const ZEITEN = ['rueckblick', 'heute', 'ausblick'];

const TILES = ['bev', 'a80', 'g80', 'al65', 'aph_pl80', 'spx_kl65', 'hh1', 'wsaldo'];

export async function render(id, sub, p3) {
  const wantReport = sub === 'bericht'; if (wantReport) sub = undefined;
  const zeit = ZEITEN.includes(p3) ? p3 : null; const focusInd = zeit ? null : p3;
  const r = region(id);
  if (!r) { main().innerHTML = `<div class="wrap page"><p class="empty">Diese Region gibt es nicht. <a href="#/">Zur Startseite</a></p></div>`; return; }
  setPrefs({ last: id });
  const d = await detail(id);
  main().innerHTML = '';
  main().appendChild(header(r, d, sub && sub !== '__ausblick' ? sub : null));
  main().querySelector('[data-report]')?.addEventListener('click', () => openReportDialog(id));
  const panel = topicPanel(r, sub); const bar = compactBar(r, sub);
  main().appendChild(bar); main().appendChild(panel); wireCompact(panel, bar);
  const page = document.createElement('div'); page.className = 'wrap page'; main().appendChild(page);
  // mini map
  const mm = document.getElementById('miniMap');
  if (mm && r.e !== 'CH') {
    const m = createMap(mm, { interactive: false, mini: true }); m.select(id);
    // only while the mouse is over a neighbour in the list: colour it on the mini map
    main().querySelectorAll('.near-list[data-near="nb"] a[data-id]').forEach((a) => {
      a.addEventListener('mouseenter', () => m.highlight([a.dataset.id]));
      a.addEventListener('mouseleave', () => m.highlight([]));
    });
  }
  const rerender = async () => { const y = window.scrollY; await render(id, sub, p3); window.scrollTo(0, y); };
  if (!sub) await portrait(page, r, d);
  else if (sub === '__ausblick') await ausblickPage(page, r, d, rerender);
  else await topic(page, r, d, sub, zeit, rerender);
  if (focusInd) requestAnimationFrame(() => document.getElementById(`ind-${focusInd}`)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
  if (wantReport && r.e === 'GDE') openReportDialog(id);
}

function header(r, d, sub) {
  const crumbs = ['CH', ...(r.e === 'GDE' ? [`KT:${r.kt}`, r.bez] : r.e === 'BEZ' ? [`KT:${r.kt}`] : r.e === 'KT' ? [] : [])];
  const ts = d.ts; const n = ts.y.length - 1;
  const g80 = ts.b80[0] ? (ts.b80[n] / ts.b80[0] - 1) * 100 : null;
  const el = document.createElement('section'); el.className = 'rhead';
  el.innerHTML = `<div class="wrap rhead-in"><div>
      <nav class="crumbs" aria-label="Räumliche Ebene">${crumbs.map((c) => `<a href="#/gemeinde/${c}">${esc(c === 'CH' ? 'Schweiz' : shortName(c))}</a><span class="sep">›</span>`).join('')}<span>${esc(shortName(r.id))}</span></nav>
      <h1>${wappenImg(r.id, 'wappen wappen-h')}${esc(r.e === 'GDE' ? r.n : regionLabel(r.id, false))} <span class="kind">${ebeneLabel[r.e]}${r.e !== 'CH' && r.e !== 'KT' ? ' · ' + r.kt : ''}</span></h1>
      <div class="keyfacts num"><span><b>${fmtInt(r.pop)}</b> Einwohner</span>
        <span><b>${fmt(val('a65', r.id), 'a65')} %</b> ab 65</span>
        <span><b>${fmtInt(ts.b80[n])}</b> ab 80${g80 != null ? ` (${plusMinus(g80)} % seit ${ts.y[0]})` : ''}</span>
        ${d.aph ? `<span><b>${fmtInt(d.aph.heime)}</b> Pflegeheim${d.aph.heime === 1 ? '' : 'e'} · ${fmtInt(d.aph.plaetze)} Plätze</span>` : r.e === 'GDE' ? '<span>kein Pflegeheim</span>' : ''}
        ${d.spitex && d.spitex.length ? `<span><b>${d.spitex.length}</b> Spitex-Organisation${d.spitex.length === 1 ? '' : 'en'} mit Sitz hier</span>` : ''}</div>
      ${r.e === 'GDE' ? `<div class="rh-actions no-print"><button type="button" class="btn small magic" data-report><span class="mg-ico" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 17h5"/></svg><svg class="mg-spark s1" width="9" height="9" viewBox="0 0 10 10"><path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8z" fill="currentColor"/></svg><svg class="mg-spark s2" width="6" height="6" viewBox="0 0 10 10"><path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8z" fill="currentColor"/></svg></span>Bericht erstellen</button><span class="muted small">Alle Themen für ${esc(r.n)} als HTML-Bericht</span></div>` : ''}
    </div><div class="rh-side"><div class="mini-map" id="miniMap" aria-hidden="true"></div>${r.e === 'GDE' ? nearby(r, sub) : ''}</div></div>`;
  wireNearby(el);
  return el;
}

// ------------------------------------------------------------------ discreet list beside the mini map: neighbours / similar size
const NEAR_N = 5;
function nearby(r, sub) {
  const nb = groupMembers('nb', r.id).map(region).filter(Boolean).sort((a, b) => b.pop - a.pop);
  // similar size: the closest Gemeinden by population in all of Switzerland (log distance)
  const sz = S.regions.filter((x) => x.e === 'GDE' && x.id !== r.id)
    .sort((a, b) => Math.abs(Math.log(a.pop / r.pop)) - Math.abs(Math.log(b.pop / r.pop))).slice(0, NEAR_N).sort((a, b) => b.pop - a.pop);
  if (!nb.length && !sz.length) return '';
  const tab = prefs().nearTab === 'size' && sz.length ? 'size' : nb.length ? 'nb' : 'size';
  const row = (x) => `<li><a data-id="${x.id}" href="#/gemeinde/${x.id}${sub ? '/' + sub : ''}" title="${esc(x.n)} (${x.kt}) · ${fmtInt(x.pop)} Einwohner">${wappenImg(x.id, 'wappen')}<span class="nr-n">${esc(x.n.replace(` (${x.kt})`, ''))}</span><span class="nr-kt">${x.kt}</span><span class="nr-p num">${fmtInt(x.pop)}</span></a></li>`;
  const list = (k, xs, more) => `<ul class="near-list" data-near="${k}"${k === tab ? '' : ' hidden'}>${xs.slice(0, NEAR_N).map(row).join('')}${more > 0 ? `<li class="nr-more">+ ${more} weitere</li>` : ''}</ul>`;
  return `<nav class="near no-print" aria-label="Gemeinden in der Nähe und ähnlich grosse Gemeinden">
    <div class="near-tabs" role="tablist">${[['nb', 'Nachbarn', nb], ['size', 'Ähnliche Grösse', sz]].filter(([, , xs]) => xs.length).map(([k, l]) =>
      `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    ${nb.length ? list('nb', nb, nb.length - NEAR_N) : ''}${sz.length ? list('size', sz, 0) : ''}</nav>`;
}
function wireNearby(el) {
  el.querySelectorAll('.near-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.tab; setPrefs({ nearTab: k });
    el.querySelectorAll('.near-tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    el.querySelectorAll('.near-list').forEach((u) => { u.hidden = u.dataset.near !== k; });
  }));
}

// ------------------------------------------------------------------ topic panel (one row per Thema) + compact sticky bar
/** house icon of the «Überblick» home button (panel tile and sticky bar) */
const HOME_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/></svg>';
let topicCleanup = null;
export function teardown() { if (topicCleanup) { topicCleanup(); topicCleanup = null; } }

const chip = (t, s, base, sub) => (s.soon
  ? `<span class="chip soon" title="in Vorbereitung">${esc(s.label)}</span>`
  : `<a class="chip t-${t.color}${s.id === sub ? ' on' : ''}" href="${base}/${s.id}"${s.id === sub ? ' aria-current="page"' : ''}>${esc(s.label)}${(S.meta.zeit[s.id] || []).includes('ausblick') ? ' <span class="fut" title="mit Ausblick bis 2055">→ 2055</span>' : ''}</a>`);

function topicPanel(r, sub) {
  const base = `#/gemeinde/${r.id}`;
  const cur = sub ? S.sub.get(sub) : null;
  const el = document.createElement('nav'); el.className = 'topics'; el.id = 'topics'; el.setAttribute('aria-label', 'Themen');
  el.innerHTML = `<div class="wrap topics-in">
    <a class="ov${!sub ? ' on' : ''}" href="${base}"${!sub ? ' aria-current="page"' : ''} title="Überblick: Startseite von ${esc(shortName(r.id))}">
      <span class="ov-i">${HOME_ICON}</span>
      <span class="ov-x"><span class="ov-t">Überblick</span><span class="ov-s">${!sub ? `Startseite von ${esc(shortName(r.id))}` : `Zurück zum Start von ${esc(shortName(r.id))}`}</span></span></a>
    <div class="trows">${S.meta.themen.map((t) => `
      <div class="trow t-${t.color}${cur && cur.thema.id === t.id ? ' active' : ''}">
        <span class="tlabel">${esc(t.label)}</span>
        <div class="tchips">${t.sub.map((s) => chip(t, s, base, sub)).join('')}</div>
      </div>`).join('')}</div></div>`;
  return el;
}

function compactBar(r, sub) {
  const base = `#/gemeinde/${r.id}`;
  const cur = sub ? S.sub.get(sub) : null;
  const el = document.createElement('div'); el.className = 'topics-compact'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="wrap tc-in">
    <a class="tc-home${!sub ? ' on' : ''}" href="${base}" aria-label="Überblick – Startseite von ${esc(shortName(r.id))}" title="Überblick – Startseite von ${esc(shortName(r.id))}"${!sub ? ' aria-current="page"' : ''}>${HOME_ICON}</a>
    ${cur ? `<span class="tc-where t-${cur.thema.color}"><span class="tc-stripe"></span>${esc(cur.thema.label)}</span>
      <div class="tc-chips">${cur.thema.sub.map((s) => chip(cur.thema, s, base, sub)).join('')}</div>`
      : `<span class="tc-where"><span class="tc-stripe"></span>${esc(shortName(r.id))} · Überblick</span><div class="tc-chips"></div>`}
    <button class="btn small tc-all" type="button">Alle Themen ▾</button></div>`;
  el.querySelector('.tc-all').addEventListener('click', () => {
    document.getElementById('topics')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  return el;
}

function wireCompact(panel, bar) {
  teardown();
  let shown = null; let ticking = false;
  const update = () => {
    ticking = false;
    const top = document.getElementById('topbar')?.getBoundingClientRect().bottom || 57;
    const show = panel.getBoundingClientRect().bottom < top;          // panel scrolled away under the top bar
    if (show === shown) return;
    shown = show;
    bar.classList.toggle('show', show); bar.setAttribute('aria-hidden', String(!show));
    bar.querySelectorAll('a,button').forEach((a) => { a.tabIndex = show ? 0 : -1; });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
  topicCleanup = () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
}

// ------------------------------------------------------------------ portrait (overview)
async function portrait(page, r, d) {
  const tiles = TILES.map((k) => tile(k, r)).join('');
  const qs = S.meta.questions.map((q) => `<li><a href="#/frage/${q.id}/${r.id}">${esc(q.text)}</a></li>`).join('');
  page.innerHTML = `<div class="page-head"><div><span class="eyebrow">Überblick</span><h2>${esc(shortName(r.id))} auf einen Blick</h2></div>
      <p class="small muted">Punkt: Lage ${r.e === 'GDE' ? 'unter allen Gemeinden' : r.e === 'BEZ' ? 'unter allen Bezirken' : 'unter allen Kantonen'} ${r.e === 'KT' || r.e === 'CH' ? '' : 'des Kantons'} (tiefster bis höchster Wert)</p></div>
    <div class="tiles">${tiles}</div>
    ${await ausblickTiles(r)}
    <div class="cards"><article class="card"><h3>Was möchten Sie wissen?</h3><ul class="qlist">${qs}</ul></article>
      <article class="card"><h3>Mit anderen vergleichen</h3><p class="muted">Jedes Thema lässt sich mit dem Bezirk, dem Kanton und der Schweiz vergleichen – oder mit Nachbargemeinden, Gemeinden ähnlicher Grösse und einer eigenen Auswahl.</p>
        <p><a class="btn small" href="#/gemeinde/${r.id}/alter">Mit der Altersstruktur beginnen →</a></p></article></div>`;
}

function tile(k, r) {
  const i = S.ind.get(k); const v = val(k, r.id);
  const t = S.sub.get(i.sub).thema;
  const href = `#/gemeinde/${r.id}/${i.sub}/${k}`;
  let body;
  if (!i.levels.includes(r.e) && r.e !== 'CH') body = '<p class="ts muted">Nur für Bezirke und Kantone</p>';
  else if (v == null) body = `<p class="ts muted">${i.src === 'somed' && r.e === 'GDE' ? 'Kein Pflegeheim in der Gemeinde' : 'Kein Wert'}</p>`;
  else {
    const ref = r.e === 'KT' ? 'CH' : r.e === 'CH' ? null : `KT:${r.kt}`;
    if (k === 'bev' && r.e !== 'CH') {   // population: rank instead of a comparison with the Kanton
      const same = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).sort((a, b) => b.pop - a.pop);
      const rank = same.findIndex((x) => x.id === r.id) + 1;
      const what = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirken' : 'Kantonen';
      return `<a class="tile ${t.color}" href="${href}"><span class="tl">${esc(i.short)}</span><span class="tv">${fmt(v, i)}</span>
        <p class="ts">Rang ${rank} von ${same.length} ${what}${r.e === 'KT' ? '' : ' im Kanton'}</p></a>`;
    }
    const w = ref ? compareWord(v, val(k, ref), k) : null;
    const pool = S.regions.filter((x) => x.e === r.e && (r.e === 'KT' || x.kt === r.kt)).map((x) => val(k, x.id)).filter((x) => x != null);
    const lo = Math.min(...pool); const hi = Math.max(...pool);
    const pos = hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;
    const unit = i.unit === '%' ? ' %' : i.unit === 'pro 1000' ? ' ‰' : '';
    body = `<span class="tv">${fmt(v, i)}<small>${esc(i.unit === '%' ? '%' : i.unit === 'pro 1000' ? 'von 1000' : i.unit === 'Personen' ? '' : i.unit)}</small></span>
      ${w ? `<p class="ts">${esc(w)} ${ref === 'CH' ? 'in der Schweiz' : 'im Kanton'} (${fmt(val(k, ref), i)}${unit})</p>` : ''}
      ${r.e !== 'CH' && pool.length > 2 ? `<div class="range" aria-hidden="true"><span class="bar"></span><span class="me" style="left:${pos.toFixed(1)}%"></span></div>
        <div class="range-lab num"><span>${fmt(lo, i)}</span><span>${fmt(hi, i)}</span></div>` : ''}`;
  }
  return `<a class="tile ${t.color}" href="${href}"><span class="tl">${esc(i.short)}</span>${body}</a>`;
}

// ------------------------------------------------------------------ topic page
async function topic(page, r, d, subId, zeitReq, rerender) {
  const sub = S.sub.get(subId);
  if (!sub || sub.soon) { page.innerHTML = '<p class="empty">Dieses Thema ist in Vorbereitung.</p>'; return; }
  const zs = S.meta.zeit[subId] || ['heute'];
  const zeit = zs.includes(zeitReq) ? zeitReq : zs.includes(prefs().zeit) && !zeitReq ? prefs().zeit : 'heute';
  if (zeitReq) setPrefs({ zeit });
  const zbar = zs.length > 1 ? `<nav class="zeit no-print" aria-label="Zeitansicht">${zs.map((z) =>
    `<a class="zt${z === zeit ? ' on' : ''}" href="#/gemeinde/${r.id}/${subId}/${z}"${z === zeit ? ' aria-current="page"' : ''}><span class="zi">${z === 'rueckblick' ? '◀' : z === 'heute' ? '●' : '▶'}</span>${esc(S.meta.zeit_label[z])}</a>`).join('')}</nav>` : '';
  if (zeit === 'ausblick') {
    page.innerHTML = `<div class="page-head"><div><span class="eyebrow">${esc(sub.thema.label)}</span><h2>${esc(sub.label)}</h2></div></div>${zbar}<div id="ausblick"></div>`;
    await ausblickSection(document.getElementById('ausblick'), r, d, subId, rerender);
    return;
  }
  let mode = prefs().mode || 'kt';
  const modes = r.e === 'GDE' ? ['kt', 'nb', 'size', 'kanton', 'own'] : r.e === 'BEZ' ? ['kt', 'kanton'] : ['kt'];
  if (!modes.includes(mode)) mode = 'kt';
  // «Vergleichen mit» is a lever of its own: a full-width row in the topic panel, above the results
  let cmp = null;
  if (modes.length > 1) {
    cmp = document.createElement('div'); cmp.className = 'compare cmp-row no-print';
    cmp.innerHTML = `<span class="label">Vergleichen mit</span><div class="seg" role="group" aria-label="Vergleichen mit">
      ${modes.map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === mode}">${groupLabel[m]}</button>`).join('')}</div>`;
    document.querySelector('#topics .topics-in')?.appendChild(cmp);
  }
  // the box for «Eigene Auswahl» follows directly below the comparison row
  const ownEl = document.createElement('div'); ownEl.id = 'ownBox'; ownEl.className = 'own-row no-print';
  (cmp ? cmp.after(ownEl) : null);
  page.innerHTML = `<div class="page-head"><div><span class="eyebrow">${esc(sub.thema.label)}</span><h2>${esc(sub.label)}</h2></div></div>
    ${zbar}<div class="cards" id="special"></div><div class="cards" id="indCards"></div>`;
  const draw = () => {
    const box = document.getElementById('indCards'); box.innerHTML = '';
    S.meta.indicators.filter((i) => i.sub === subId && (i.zeit || 'heute') === zeit).forEach((i) => box.appendChild(indicatorCard(i.id, r.id, { mode })));
    ownBox(r, mode, () => { draw(); drawSpecial(); });
  };
  const spSub = zeit === 'rueckblick' ? ({ alter: 'entwicklung', inanspruchnahme: 'heimentwicklung' }[subId] || `hist_${subId}`) : subId;
  let spRun = 0;
  const drawSpecial = async () => {   // the topic chart follows «Vergleichen mit» as well
    const run = ++spRun; const box = document.getElementById('special');
    const tmp = document.createElement('div'); tmp.className = 'cards'; tmp.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + box.clientWidth + 'px';
    document.body.appendChild(tmp);     // drawn off-screen at the right width, then swapped in without flicker
    try { await special(tmp, r, d, spSub, mode); } finally { tmp.remove(); }
    if (run !== spRun) return;          // a newer selection is already drawing
    box.replaceChildren(...tmp.children);
    box.querySelectorAll('.js-plotly-plot').forEach((g) => Plotly.Plots.resize(g));
  };
  const redrawAll = () => { draw(); drawSpecial(); };
  cmp?.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m; setPrefs({ mode });
    cmp.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    redrawAll();
  }));
  await drawSpecial();
  draw();
}

function ownBox(r, mode, redraw) {
  const box = document.getElementById('ownBox');
  if (!box) return;
  if (mode !== 'own') { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  const own = (prefs().own || []).filter((x) => S.byId.has(x));   // ignore ids that no longer exist (merged Gemeinden, old links)
  box.innerHTML = `<div class="card"><h3>Eigene Auswahl</h3><p class="small muted">Zum Beispiel die Gemeinden Ihrer Versorgungsregion. Die Auswahl bleibt in diesem Browser gespeichert.</p>
    <div class="gcards">${own.map((x) => `<div class="gcard">${wappenImg(x)}<a class="gc-txt" href="#/gemeinde/${x}"><b>${esc(shortName(x))}</b><span>${esc(region(x).kt)}</span></a>
      <button class="gc-x" type="button" data-rm="${x}" aria-label="${esc(shortName(x))} aus der Auswahl entfernen" title="Entfernen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join('') || '<span class="muted small">Noch keine Gemeinden gewählt.</span>'}</div><div id="ownSearch"></div></div>`;
  box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { setPrefs({ own: own.filter((x) => x !== b.dataset.rm) }); redraw(); }));
  omnibox(document.getElementById('ownSearch'), { id: 'omniOwn', compact: true, placeholder: 'Gemeinde hinzufügen …', filter: (it) => it.go.startsWith('#/gemeinde/GDE:'),
    onPick: (it) => { const gid = it.go.split('/')[2]; setPrefs({ own: [...new Set([...own, gid])] }); redraw(); } });
}

// ------------------------------------------------------------------ comparison series for the topic charts
const GROUP_NAME = { nb: 'Nachbargemeinden', size: 'Ähnliche Grösse', kanton: 'Übrige Gemeinden im Kanton', own: 'Eigene Auswahl' };
const sumArr = (arrs) => arrs[0].map((_, k) => arrs.reduce((a, x) => a + (x[k] || 0), 0));
const sumObj = (objs) => Object.fromEntries(Object.keys(objs[0]).map((k) => [k, objs.reduce((a, o) => a + (o[k] || 0), 0)]));
/** one detail record for a group of Gemeinden: counts are summed, rates weighted by population */
function aggregate(ds) {
  const out = {};
  const ts = ds.filter((x) => x.ts);
  if (ts.length) out.ts = { y: ts[0].ts.y, ...Object.fromEntries(['bev', 'b65', 'b80'].map((k) => [k, sumArr(ts.map((x) => x.ts[k]))])) };
  const py = ds.filter((x) => x.pyr);
  if (py.length) {
    out.pyr = { groups: py[0].pyr.groups };
    Object.keys(py[0].pyr).filter((k) => k !== 'groups').forEach((y) => { out.pyr[y] = { m: sumArr(py.map((x) => x.pyr[y].m)), f: sumArr(py.map((x) => x.pyr[y].f)) }; });
  }
  const hh = ds.filter((x) => x.hh); if (hh.length) out.hh = sumArr(hh.map((x) => x.hh));
  const bw = ds.filter((x) => x.bew && x.ts);
  if (bw.length) {
    const w = bw.map((x) => x.ts.bev[x.ts.bev.length - 1]); const W = w.reduce((a, b) => a + b, 0);
    out.bew = Object.fromEntries(Object.keys(bw[0].bew).map((k) => [k, bw.reduce((a, x, i) => a + (x.bew[k] || 0) * w[i], 0) / W]));
  }
  // Rückblick Leistungen / Personal / Kosten: sum the parts of all members, then rebuild each indicator per year
  const as = ds.filter((x) => x.aph_sums);
  if (as.length) {
    const keys = [...new Set(as.flatMap((x) => Object.keys(x.aph_sums)))];
    const sums = Object.fromEntries(keys.map((k) => [k, sumArr(as.filter((x) => x.aph_sums[k]).map((x) => x.aph_sums[k]))]));
    const F = S.meta.hist_formula || {};
    out.aph_hist = Object.fromEntries(Object.entries(F).filter(([, f]) => sums[f[0] === 'ratio' ? f[1] : `${f[1]} × ${f[2]}`]).map(([id, f]) => [id, sums[f[0] === 'ratio' ? f[1] : `${f[1]} × ${f[2]}`].map((_, k) => {
      if (f[0] === 'ratio') { const den = f[2].reduce((a, c) => a + sums[c][k], 0); return den > 0 ? (sums[f[1]][k] / den) * f[3] : null; }
      const w = sums[`${f[2]} | ${f[1]}`][k]; return w > 0 ? sums[`${f[1]} × ${f[2]}`][k] / w : null;
    })]));
  }
  const at = ds.filter((x) => x.aph_ts);     // Gemeinden without a Heim add 0 places but their population (ts)
  if (at.length) out.aph_ts = { y: at[0].aph_ts.y, ...Object.fromEntries(['pl', 'kl', 'n'].map((k) => [k, sumArr(at.map((x) => x.aph_ts[k]))])) };
  const ap = ds.filter((x) => x.aph);
  if (ap.length) out.aph = { heime: ap.reduce((a, x) => a + x.aph.heime, 0), plaetze: ap.reduce((a, x) => a + x.aph.plaetze, 0),
    stufen: sumArr(ap.filter((x) => x.aph.stufen).map((x) => x.aph.stufen)), ertrag: sumObj(ap.map((x) => x.aph.ertrag)) };
  const sp = ds.filter((x) => x.spx && x.spx.einnahmen);
  if (sp.length) out.spx = { einnahmen: sumObj(sp.map((x) => x.spx.einnahmen)) };
  return out;
}
/** [the region itself, comparison(s)…, Kanton, Schweiz] according to «Vergleichen mit» */
async function compareSeries(r, d, mode) {
  const kt = r.e === 'CH' ? [] : parents(r.id).filter((x) => x !== r.bez);                 // Kanton + Schweiz
  const dk = await Promise.all(kt.map((x) => detail(x)));
  const refs = kt.map((x, k) => ({ id: x, d: dk[k] }));
  if (r.e === 'GDE' && mode === 'kt') return [{ id: r.id, d }, { id: r.bez, d: await detail(r.bez) }, ...refs];
  const members = r.e === 'GDE' || (r.e === 'BEZ' && mode === 'kanton') ? groupMembers(mode, r.id) : [];
  if (!members.length) return [{ id: r.id, d }, ...refs];
  const ds = await Promise.all(members.map((x) => detail(x)));
  // «Eigene Auswahl» with a single Gemeinde is shown under its name, with several as the group
  const gname = mode === 'own' && members.length === 1 ? shortName(members[0])
    : `${r.e === 'BEZ' ? 'Übrige Bezirke im Kanton' : GROUP_NAME[mode]} (${members.length})`;
  return [{ id: r.id, d }, { id: 'GRP', grp: true, name: gname, d: aggregate(ds) }, ...refs];
}

async function special(box, r, d, subId, mode = 'kt') {
  const M = S.meta; const [y0, y1] = M.alter_jahre;
  const series = await compareSeries(r, d, mode);
  const grp = series.find((s) => s.grp);
  if (subId === 'alter') {
    const ref = grp && grp.d.pyr ? grp : series[series.length - 1];
    const refName = ref.grp ? ref.name.replace(/ \(\d+\)$/, '') : 'Schweiz';
    const c = chartCard(`Altersaufbau ${y1}`, `Balken: ${esc(shortName(r.id))} ${y1}, schwarze Linie: ${y0}, gepunktet: ${esc(ref.grp ? ref.name : 'Schweiz')} ${y1}. Anteile an der Bevölkerung in Prozent.`, 'statpop');
    box.appendChild(c.card); pyramid(c.div, d, ref.d, [y0, y1], refName);
  } else if (subId === 'entwicklung') {
    const c = chartCard(`Entwicklung ${y0}–${y1}`, '', 'statpop');
    const n = d.ts.y.length - 1;
    const seg = document.createElement('div'); seg.className = 'seg no-print'; seg.setAttribute('role', 'group');
    const opts = { b80: 'ab 80 Jahren', b65: 'ab 65 Jahren', bev: 'Gesamte Bevölkerung' };
    seg.innerHTML = Object.entries(opts).map(([k, l], j) => `<button type="button" data-k="${k}" aria-pressed="${j === 0}">${l}</button>`).join('');
    c.card.querySelector('.card-head').after(seg);
    const drawK = (k) => {
      const v0 = d.ts[k][0]; const v1 = d.ts[k][n];
      c.setSub(`In ${esc(shortName(r.id))} ist die Zahl der Menschen ${k === 'bev' ? '' : opts[k] + ' '}von ${fmtInt(v0)} (${y0}) auf <b>${fmtInt(v1)}</b> (${y1}) ${v1 >= v0 ? 'gestiegen' : 'gesunken'} – <b>${plusMinus(v0 ? (v1 / v0 - 1) * 100 : 0)} %</b>.`);
      indexLines(c.div, series, k, [y0, y1]);
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k));
    };
    seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) drawK(b.dataset.k); });
    box.appendChild(c.card); drawK('b80');
  } else if (subId === 'heimentwicklung') {
    const c = chartCard(`Alters- und Pflegeheime ${y0}–${y1}`, '', 'somed_ts');
    const n = y1 - y0; const name = esc(shortName(r.id));
    const own = d.aph_ts && d.aph_ts.pl.some((x) => x > 0);
    const seg = document.createElement('div'); seg.className = 'seg no-print'; seg.setAttribute('role', 'group');
    seg.innerHTML = Object.entries(APH_TS_OPTS).map(([k, l], j) => `<button type="button" data-k="${k}" aria-pressed="${j === 0}">${l}</button>`).join('');
    c.card.querySelector('.card-head').after(seg);
    const f0 = (x) => fmt(x, { dec: 0 });
    const drawK = (k) => {
      const me = { d };
      let txt;
      if (!own) txt = `${name} hatte zwischen ${y0} und ${y1} kein eigenes Alters- und Pflegeheim. Die Linien zeigen die Versorgung in der Umgebung.`;
      else if (k === 'pl') {
        const a = d.aph_ts.pl[0]; const b = d.aph_ts.pl[n];
        txt = a ? `In ${name} ist die Zahl der Pflegeheimplätze von ${fmtInt(a)} (${y0}) auf <b>${fmtInt(b)}</b> (${y1}) ${b >= a ? 'gestiegen' : 'gesunken'} – <b>${plusMinus((b / a - 1) * 100)} %</b>.`
          : `${y0} gab es in ${name} noch keine Pflegeheimplätze, ${y1} sind es <b>${fmtInt(b)}</b>.`;
      } else {
        const a = aphRate(me, k, 0); const b = aphRate(me, k, n);
        const what = k === 'pl80' ? 'Pflegeheimplätze' : 'Heimbewohnende';
        txt = `In ${name} kamen ${y0} ${a == null ? '–' : f0(a)} ${what} auf 1000 Menschen ab 80, ${y1} <b>${b == null ? '–' : f0(b)}</b>${a && b != null ? ` (${plusMinus((b / a - 1) * 100)} %)` : ''}.`;
      }
      c.setSub(`${txt} Heime stehen am Standort und versorgen auch Nachbargemeinden.`);
      aphLines(c.div, series, k, [y0, y1]);
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k));
    };
    seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) drawK(b.dataset.k); });
    box.appendChild(c.card); drawK('pl80');
    histCards(box, r, d, series, (M.hist || []).filter((x) => S.ind.get(x).sub === 'inanspruchnahme'));
  } else if (subId.startsWith('hist_')) {
    // Rückblick Leistungen / Personal / Kosten / Finanzierung: one line chart per Heim and Spitex indicator
    const sub = subId.slice(5);
    histCards(box, r, d, series, (M.hist || []).filter((x) => S.ind.get(x).sub === sub));
  } else if (subId === 'haushalte' && d.hh) {
    const c = chartCard(`Privathaushalte nach Grösse, ${M.jahr}`, 'Anteil der Haushalte mit 1, 2, … Personen.', 'haushalte');
    box.appendChild(c.card);
    shareBars(c.div, ['1 Person', '2 Personen', '3 Personen', '4 Personen', '5 Personen', '6 und mehr'], series.filter((s) => s.d.hh).map((s) => ({ ...s, values: s.d.hh })));
  } else if (subId === 'bewegungen' && d.bew) {
    const c = chartCard(`Bevölkerungsbewegungen, Durchschnitt ${M.periode[0]}–${M.periode[1]}`, 'Pro Jahr, in Prozent der Bevölkerung.', 'bevnat');
    box.appendChild(c.card); bewChart(c.div, series.filter((s) => s.d.bew));
  } else if (subId === 'inanspruchnahme' || subId === 'leistungen') {
    if (r.e === 'GDE') box.appendChild(lists(r, d, subId));
    if (subId === 'leistungen' && series.some((s) => s.d.aph && s.d.aph.stufen)) {
      const c = chartCard('Pflegetage nach Pflegestufe', 'Wie viel Pflege brauchen die Bewohnerinnen und Bewohner? Stufe 1 = bis 20 Minuten pro Tag, Stufe 12 = mehr als 220 Minuten.', 'somed');
      box.appendChild(c.card);
      shareBars(c.div, Array.from({ length: 12 }, (_, k) => `${k + 1}`), series.filter((s) => s.d.aph && s.d.aph.stufen && s.d.aph.stufen.length).map((s) => ({ ...s, values: s.d.aph.stufen })));
    }
  } else if (subId === 'finanzierung') {
    const aph = series.filter((s) => s.d.aph && s.d.aph.ertrag);
    if (aph.length) {
      const c = chartCard('Woher das Geld der Pflegeheime kommt', 'Anteile am Gesamtertrag. Pflegetaxen: Krankenversicherer, Bewohnende und Restfinanzierung; Pensionstaxen: Hotellerie und Betreuung.', 'somed', false);
      box.appendChild(c.card);
      stackedMix(c.div, aph.map((s) => ({ ...s, mix: s.d.aph.ertrag })), ['Pflegetaxen', 'Pensionstaxen', 'Subventionen', 'Übrige'], ['#1b67b2', '#7eaed9', '#e8701a', '#c7d0d6']);
    }
    const spx = series.filter((s) => s.d.spx && s.d.spx.einnahmen);
    if (spx.length) {
      const c = chartCard('Wer die Spitex-Pflege bezahlt', 'Einnahmen aus der Langzeitpflege nach Zahler.', 'spitex', false);
      box.appendChild(c.card);
      stackedMix(c.div, spx.map((s) => ({ ...s, mix: s.d.spx.einnahmen })), ['Krankenversicherer', 'Klientinnen und Klienten', 'Kanton und Gemeinden'], ['#1b67b2', '#7eaed9', '#e8701a']);
    }
  } else if (subId === 'kennzahlen') {
    const lvl = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirke' : 'Kantone';
    const c = chartCard('Heim und Spitex im Vergleich', `Jeder Punkt ist eine Region (${lvl}${r.e === 'KT' || r.e === 'CH' ? '' : ' im Kanton ' + r.kt}). Rechts oben: viel Pflege im Heim und viel Spitex; links unten: wenig von beidem. Grösse = Einwohner. Beide Achsen sind logarithmisch, damit auch kleine Werte gut lesbar sind.`, 'somed');
    box.appendChild(c.card); peerScatter(c.div, r.id, 'iv_ptage65', 'iv_std65');
  } else if (subId === 'statamb' && r.e === 'GDE') {
    const p = document.createElement('p'); p.className = 'note';
    p.innerHTML = `Dieses Thema wird für Bezirke und Kantone gezeigt. <a href="#/gemeinde/${r.bez}/statamb">Zum ${esc(regionLabel(r.bez, false))} →</a>`;
    box.appendChild(p);
  }
}

/** Rückblick charts for Heim (2012–) and Spitex (2021–) indicators, each over its own years (meta.hist_years) */
function histCards(box, r, d, series, ids) {
  const M = S.meta; const name = esc(shortName(r.id));
  const yrs = (id) => M.hist_years[id];
  const isSpx = (id) => S.ind.get(id).src === 'spitex';
  const notes = [];
  const aph = ids.filter((x) => !isSpx(x)); const spx = ids.filter(isSpx);
  const has = (id) => d.aph_hist && d.aph_hist[id] && d.aph_hist[id].some((v) => v != null);
  if (aph.length && !aph.some(has)) notes.push(`${name} hatte zwischen ${yrs(aph[0])[0]} und ${M.jahr} kein eigenes Alters- und Pflegeheim. Die Heim-Grafiken zeigen ${r.e === 'GDE' ? 'Bezirk, ' : ''}Kanton und Schweiz.`);
  if (spx.length) notes.push(`Spitex-Kennzahlen veröffentlicht das BAG seit ${yrs(spx[0])[0]}. Organisationen ohne Adresse im Kanton sind nach Einwohnern auf seine Gemeinden verteilt.`);
  if (notes.length) { const p = document.createElement('p'); p.className = 'note wide'; p.style.gridColumn = '1 / -1'; p.innerHTML = notes.join(' '); box.appendChild(p); }
  ids.forEach((id) => {
    const i = S.ind.get(id); const y = yrs(id); const y0 = y[0]; const y1 = y[y.length - 1];
    const c = chartCard(`${i.label} ${y0}–${y1}`, '', isSpx(id) ? 'spitex_ts' : 'somed_ts', false);
    box.appendChild(c.card);
    const v = d.aph_hist && d.aph_hist[id];
    const k0 = v ? v.findIndex((x) => x != null) : -1; const k1 = v ? v.length - 1 - [...v].reverse().findIndex((x) => x != null) : -1;
    let txt = k0 >= 0 ? `${name}: ${y[k0]} ${fmtUnit(v[k0], i)}, ${y[k1]} <b>${fmtUnit(v[k1], i)}</b>.` : `Keine Werte für ${name}.`;
    if (M.hist_col && M.hist_col[id]) txt += ` Bis ${y1 - 1}: BAG-Index der Pflegeintensität (gleiche Skala 1–12, ${y1} identisch).`;
    c.setSub(txt);
    histLines(c.div, series, id, [y0, y1]);
  });
}

function lists(r, d, subId) {
  const card = document.createElement('article'); card.className = 'card wide';
  if (subId === 'leistungen' || subId === 'inanspruchnahme') {
    const heime = d.heime || []; const spx = d.spitex || [];
    card.innerHTML = `<h3>Angebote mit Sitz in ${esc(r.n)}</h3>
      ${heime.length ? `<div class="table-scroll"><table class="list-table"><caption class="small muted" style="text-align:left">Alters- und Pflegeheime (${S.meta.jahr})</caption><thead><tr><th>Heim</th><th class="r">Plätze</th><th class="r">Belegung</th><th class="r">Eintrittsalter</th><th class="r">Pflegestufe</th></tr></thead>
        <tbody>${heime.map((h) => `<tr><td>${esc(h.n)}</td><td class="r">${fmtInt(h.pl)}</td><td class="r">${h.bel == null ? '–' : fmt(h.bel, 'aph_bel') + ' %'}</td><td class="r">${h.alter == null ? '–' : fmt(h.alter, 'aph_alter')}</td><td class="r">${h.stufe == null ? '–' : fmt(h.stufe, 'aph_stufe')}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="empty">Kein Alters- und Pflegeheim in ${esc(r.n)}. <a href="#/gemeinde/${r.bez}/${subId}">Angebote im ${esc(regionLabel(r.bez, false))} →</a></p>`}
      ${spx.length ? `<div class="table-scroll" style="margin-top:12px"><table class="list-table"><caption class="small muted" style="text-align:left">Spitex-Organisationen mit Sitz hier (sie arbeiten oft auch in Nachbargemeinden)</caption><thead><tr><th>Organisation</th><th class="r">Klientinnen und Klienten</th><th class="r">Vollzeitstellen</th></tr></thead>
        <tbody>${spx.map((s) => `<tr><td>${esc(s.n)}</td><td class="r">${fmtInt(s.kl)}</td><td class="r">${s.vz == null ? '–' : fmt(s.vz, 'aph_vzplatz')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <p class="src-line"><span>Quelle: BAG,</span> ${srcLink(S.meta.sources.somed.url, S.meta.sources.somed.name)} <span>·</span> ${srcLink(S.meta.sources.spitex.url, S.meta.sources.spitex.name)} <span>· ${S.meta.jahr}</span></p>`;
  }
  return card;
}
