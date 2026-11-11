// Workflow A "Gemeinde zuerst": region header, portrait tiles, topic pages with comparison switch.
import { S, val, region, parents, detail, fmt, fmtUnit, fmtInt, plusMinus, shortName, regionLabel, compareWord,
  prefs, setPrefs, groupMembers, groupLabel, ebeneLabel } from './store.js?v=20261112004657';
import { createMap } from './map.js?v=20261112004657';
import { indicatorCard, chartCard, pyramid, indexLines, shareBars, stackedMix, bewChart, peerScatter } from './cards.js?v=20261112004657';
import { omnibox } from './search.js?v=20261112004657';
import { esc, main } from './ui.js?v=20261112004657';

const TILES = ['bev', 'a80', 'g80', 'al65', 'aph_pl80', 'spx_kl65', 'hh1', 'wsaldo'];

export async function render(id, sub, focusInd) {
  const r = region(id);
  if (!r) { main().innerHTML = `<div class="wrap page"><p class="empty">Diese Region gibt es nicht. <a href="#/">Zur Startseite</a></p></div>`; return; }
  setPrefs({ last: id });
  const d = await detail(id);
  main().innerHTML = '';
  main().appendChild(header(r, d));
  const panel = topicPanel(r, sub); const bar = compactBar(r, sub);
  main().appendChild(bar); main().appendChild(panel); wireCompact(panel, bar);
  const page = document.createElement('div'); page.className = 'wrap page'; main().appendChild(page);
  // mini map
  const mm = document.getElementById('miniMap');
  if (mm && r.e !== 'CH') { const m = createMap(mm, { interactive: false, mini: true }); m.select(id); }
  if (!sub) await portrait(page, r, d);
  else await topic(page, r, d, sub);
  if (focusInd) requestAnimationFrame(() => document.getElementById(`ind-${focusInd}`)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
}

function header(r, d) {
  const crumbs = ['CH', ...(r.e === 'GDE' ? [`KT:${r.kt}`, r.bez] : r.e === 'BEZ' ? [`KT:${r.kt}`] : r.e === 'KT' ? [] : [])];
  const ts = d.ts; const n = ts.y.length - 1;
  const g80 = ts.b80[0] ? (ts.b80[n] / ts.b80[0] - 1) * 100 : null;
  const el = document.createElement('section'); el.className = 'rhead';
  el.innerHTML = `<div class="wrap rhead-in"><div>
      <nav class="crumbs" aria-label="Räumliche Ebene">${crumbs.map((c) => `<a href="#/gemeinde/${c}">${esc(c === 'CH' ? 'Schweiz' : shortName(c))}</a><span class="sep">›</span>`).join('')}<span>${esc(shortName(r.id))}</span></nav>
      <h1>${esc(r.e === 'GDE' ? r.n : regionLabel(r.id, false))} <span class="kind">${ebeneLabel[r.e]}${r.e !== 'CH' && r.e !== 'KT' ? ' · ' + r.kt : ''}</span></h1>
      <div class="keyfacts num"><span><b>${fmtInt(r.pop)}</b> Einwohner</span>
        <span><b>${fmt(val('a65', r.id), 'a65')} %</b> ab 65</span>
        <span><b>${fmtInt(ts.b80[n])}</b> ab 80${g80 != null ? ` (${plusMinus(g80)} % seit ${ts.y[0]})` : ''}</span>
        ${d.aph ? `<span><b>${fmtInt(d.aph.heime)}</b> Pflegeheim${d.aph.heime === 1 ? '' : 'e'} · ${fmtInt(d.aph.plaetze)} Plätze</span>` : r.e === 'GDE' ? '<span>kein Pflegeheim</span>' : ''}
        ${d.spitex && d.spitex.length ? `<span><b>${d.spitex.length}</b> Spitex-Organisation${d.spitex.length === 1 ? '' : 'en'} mit Sitz hier</span>` : ''}</div>
    </div><div class="mini-map" id="miniMap" aria-hidden="true"></div></div>`;
  return el;
}

// ------------------------------------------------------------------ topic panel (one row per Thema) + compact sticky bar
let topicCleanup = null;
export function teardown() { if (topicCleanup) { topicCleanup(); topicCleanup = null; } }

const chip = (t, s, base, sub) => (s.soon
  ? `<span class="chip soon" title="in Vorbereitung">${esc(s.label)}</span>`
  : `<a class="chip t-${t.color}${s.id === sub ? ' on' : ''}" href="${base}/${s.id}"${s.id === sub ? ' aria-current="page"' : ''}>${esc(s.label)}</a>`);

function topicPanel(r, sub) {
  const base = `#/gemeinde/${r.id}`;
  const cur = sub ? S.sub.get(sub) : null;
  const el = document.createElement('nav'); el.className = 'topics'; el.id = 'topics'; el.setAttribute('aria-label', 'Themen');
  el.innerHTML = `<div class="wrap topics-in">
    <a class="ov${!sub ? ' on' : ''}" href="${base}"${!sub ? ' aria-current="page"' : ''}><span class="ov-t">Überblick</span><span class="ov-s">8 Kennzahlen auf einen Blick</span></a>
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
async function topic(page, r, d, subId) {
  const sub = S.sub.get(subId);
  if (!sub || sub.soon) { page.innerHTML = '<p class="empty">Dieses Thema ist in Vorbereitung.</p>'; return; }
  let mode = prefs().mode || 'kt';
  const modes = r.e === 'GDE' ? ['kt', 'nb', 'size', 'kanton', 'own'] : r.e === 'BEZ' ? ['kt', 'kanton'] : ['kt'];
  if (!modes.includes(mode)) mode = 'kt';
  page.innerHTML = `<div class="page-head"><div><span class="eyebrow">${esc(sub.thema.label)}</span><h2>${esc(sub.label)}</h2></div>
    ${modes.length > 1 ? `<div class="compare no-print"><span class="label">Vergleichen mit</span><div class="seg" role="group" aria-label="Vergleich">
      ${modes.map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === mode}">${groupLabel[m]}</button>`).join('')}</div></div>` : ''}</div>
    <div id="ownBox" class="no-print"></div><div class="cards" id="special"></div><div class="cards" id="indCards"></div>`;
  const draw = () => {
    const box = document.getElementById('indCards'); box.innerHTML = '';
    S.meta.indicators.filter((i) => i.sub === subId).forEach((i) => box.appendChild(indicatorCard(i.id, r.id, { mode })));
    ownBox(r, mode, draw);
  };
  page.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m; setPrefs({ mode });
    page.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    draw();
  }));
  await special(document.getElementById('special'), r, d, subId);
  draw();
}

function ownBox(r, mode, redraw) {
  const box = document.getElementById('ownBox');
  if (mode !== 'own') { box.innerHTML = ''; return; }
  const own = prefs().own || [];
  box.innerHTML = `<div class="card"><h3>Eigene Auswahl</h3><p class="small muted">Zum Beispiel die Gemeinden Ihrer Versorgungsregion. Die Auswahl bleibt in diesem Browser gespeichert.</p>
    <div class="chips">${own.map((x) => `<button class="chip" type="button" data-rm="${x}">${esc(shortName(x))} ×</button>`).join('') || '<span class="muted small">Noch keine Gemeinden gewählt.</span>'}</div><div id="ownSearch"></div></div>`;
  box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { setPrefs({ own: own.filter((x) => x !== b.dataset.rm) }); redraw(); }));
  omnibox(document.getElementById('ownSearch'), { id: 'omniOwn', compact: true, placeholder: 'Gemeinde hinzufügen …', filter: (it) => it.go.startsWith('#/gemeinde/GDE:'),
    onPick: (it) => { const gid = it.go.split('/')[2]; setPrefs({ own: [...new Set([...own, gid])] }); redraw(); } });
}

async function special(box, r, d, subId) {
  const M = S.meta; const [y0, y1] = M.alter_jahre;
  const refs = parents(r.id).filter((x) => x !== r.bez);           // Kanton + Schweiz
  const dRefs = await Promise.all(refs.map((x) => detail(x)));
  const series = [{ id: r.id, d }, ...refs.map((x, k) => ({ id: x, d: dRefs[k] }))];
  if (subId === 'alter') {
    const c = chartCard(`Altersaufbau ${y1}`, `Balken: ${esc(shortName(r.id))} ${y1}, schwarze Linie: ${y0}, blau gepunktet: Schweiz ${y1}. Anteile an der Bevölkerung in Prozent.`, 'statpop');
    box.appendChild(c.card); pyramid(c.div, d, series[series.length - 1].d, [y0, y1]);
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
  } else if (subId === 'haushalte' && d.hh) {
    const c = chartCard(`Privathaushalte nach Grösse, ${M.jahr}`, 'Anteil der Haushalte mit 1, 2, … Personen.', 'haushalte');
    box.appendChild(c.card);
    shareBars(c.div, ['1 Person', '2 Personen', '3 Personen', '4 Personen', '5 Personen', '6 und mehr'], series.filter((s) => s.d.hh).map((s) => ({ id: s.id, values: s.d.hh })));
  } else if (subId === 'bewegungen' && d.bew) {
    const c = chartCard(`Bevölkerungsbewegungen, Durchschnitt ${M.periode[0]}–${M.periode[1]}`, 'Pro Jahr, in Prozent der Bevölkerung.', 'bevnat');
    box.appendChild(c.card); bewChart(c.div, series.filter((s) => s.d.bew));
  } else if (subId === 'inanspruchnahme' || subId === 'leistungen') {
    if (r.e === 'GDE') box.appendChild(lists(r, d, subId));
    if (subId === 'leistungen' && series.some((s) => s.d.aph && s.d.aph.stufen)) {
      const c = chartCard('Pflegetage nach Pflegestufe', 'Wie viel Pflege brauchen die Bewohnerinnen und Bewohner? Stufe 1 = bis 20 Minuten pro Tag, Stufe 12 = mehr als 220 Minuten.', 'somed');
      box.appendChild(c.card);
      shareBars(c.div, Array.from({ length: 12 }, (_, k) => `${k + 1}`), series.filter((s) => s.d.aph && s.d.aph.stufen).map((s) => ({ id: s.id, values: s.d.aph.stufen })));
    }
  } else if (subId === 'finanzierung') {
    const aph = series.filter((s) => s.d.aph);
    if (aph.length) {
      const c = chartCard('Woher das Geld der Pflegeheime kommt', 'Anteile am Gesamtertrag. Pflegetaxen: Krankenversicherer, Bewohnende und Restfinanzierung; Pensionstaxen: Hotellerie und Betreuung.', 'somed', false);
      box.appendChild(c.card);
      stackedMix(c.div, aph.map((s) => ({ id: s.id, mix: s.d.aph.ertrag })), ['Pflegetaxen', 'Pensionstaxen', 'Subventionen', 'Übrige'], ['#1b67b2', '#7eaed9', '#e8701a', '#c7d0d6']);
    }
    const spx = series.filter((s) => s.d.spx);
    if (spx.length) {
      const c = chartCard('Wer die Spitex-Pflege bezahlt', 'Einnahmen aus der Langzeitpflege nach Zahler.', 'spitex', false);
      box.appendChild(c.card);
      stackedMix(c.div, spx.map((s) => ({ id: s.id, mix: s.d.spx.einnahmen })), ['Krankenversicherer', 'Klientinnen und Klienten', 'Kanton und Gemeinden'], ['#1b67b2', '#7eaed9', '#e8701a']);
    }
  } else if (subId === 'kennzahlen') {
    const lvl = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirke' : 'Kantone';
    const c = chartCard('Heim und Spitex im Vergleich', `Jeder Punkt ist eine Region (${lvl}${r.e === 'KT' || r.e === 'CH' ? '' : ' im Kanton ' + r.kt}). Rechts oben: viel Pflege im Heim und viel Spitex; links unten: wenig von beidem. Grösse = Einwohner.`, 'somed');
    box.appendChild(c.card); peerScatter(c.div, r.id, 'iv_ptage65', 'iv_std65');
  } else if (subId === 'statamb' && r.e === 'GDE') {
    const p = document.createElement('p'); p.className = 'note';
    p.innerHTML = `Dieses Thema wird für Bezirke und Kantone gezeigt. <a href="#/gemeinde/${r.bez}/statamb">Zum ${esc(regionLabel(r.bez, false))} →</a>`;
    box.appendChild(p);
  }
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
      <p class="src-line">Quelle: BAG, Kennzahlen der Schweizer Pflegeheime und der Spitex ${S.meta.jahr}</p>`;
  }
  return card;
}
