// Gemeindebericht: options dialog and assembly of a self-contained HTML report (inline CSS + SVG, no scripts needed).
import { S, region, detail, fmtInt, fmt, setPrefs, prefs, wappen, groupMembers, groupLabelFor, shortName } from './store.js?v=20261115122634';
import { loadProg, roundProg } from './prog.js?v=20261115122634';
import { esc, toast } from './ui.js?v=20261115122634';
import * as story from './report_story.js?v=20261115122634';
import { locatorKanton, locatorCH } from './report_svg.js?v=20261115122634';

const FN = { blick: story.blick, bevoelkerung: story.bevoelkerung, entwicklung: story.entwicklung, wohnen: story.wohnen,
  versorgung: story.versorgung, ausblick: story.ausblick, vergleich: story.vergleich, planung: story.planung };
const V = window.GAP_BUILD ? `?v=${window.GAP_BUILD}` : '';
/** texts that depend on the level of the report (Gemeinde-, Bezirks-, Kantonsbericht) */
export function levelTexts(r) {
  const kt = region(`KT:${r.kt}`);
  if (r.e === 'BEZ') return { art: 'Bezirksbericht', name: `Bezirk ${r.n}`, in_name: `im Bezirk ${r.n}`, of_name: `des Bezirks ${r.n}`,
    ref: `KT:${r.kt}`, refLab: 'Kanton', refName: `Kanton ${kt.n}`, im: 'im Kanton', imName: `im Kanton ${kt.n}`, mid: null, unitDat: 'im Bezirk',
    where: `Bezirk im Kanton ${kt.n}`, vers_hint: ' – Werte eines Bezirks sind deshalb Standortwerte, die auch Nachbarbezirke versorgen',
    disk: 'im Bezirk', pool: 'BEZ', pool_one: 'ein Bezirk des Kantons', poolPl: `Bezirke des Kantons ${kt.n}`, poolDat: `Bezirken des Kantons ${kt.n}` };
  if (r.e === 'KT') return { art: 'Kantonsbericht', name: `Kanton ${r.n}`, in_name: `im Kanton ${r.n}`, of_name: `des Kantons ${r.n}`,
    ref: 'CH', refLab: 'Schweiz', refName: 'Schweiz', im: 'in der Schweiz', imName: 'in der Schweiz', mid: null, unitDat: 'im Kanton',
    where: 'Kanton der Schweiz', vers_hint: ' – Kantonswerte fassen alle Gemeinden zusammen und sind genau',
    disk: 'im Kanton', pool: 'KT', pool_one: 'ein Kanton', poolPl: 'Kantone der Schweiz', poolDat: 'Kantonen der Schweiz' };
  return { art: 'Gemeindebericht', name: r.n, in_name: `in ${r.n}`, of_name: `von ${r.n}`,
    ref: `KT:${r.kt}`, refLab: 'Kanton', refName: `Kanton ${kt.n}`, im: 'im Kanton', imName: `im Kanton ${kt.n}`, mid: r.bez, midName: `Bezirk ${r.bn}`, unitDat: 'in der Gemeinde',
    where: `Gemeinde im Bezirk ${r.bn}, Kanton ${kt.n}`, vers_hint: ' – die Gemeinde ist deshalb immer zusammen mit Bezirk und Kanton zu lesen',
    disk: 'in der Gemeinde', pool: 'GDE', pool_one: 'eine Gemeinde des Kantons', poolPl: `Gemeinden des Kantons ${kt.n}`, poolDat: `Gemeinden des Kantons ${kt.n}` };
}
/** comparison groups offered in the report («Vergleichen mit», without the standard) */
export const reportModes = (r) => (r.e === 'GDE' ? ['size', 'nb', 'kanton', 'own'] : ['kanton', 'own']);
const fill = (s, ctx) => {
  const L = ctx.L || {};
  let t = String(s || '').replaceAll('{a0}', S.meta.alter_jahre[0]).replaceAll('{j}', ctx.j);
  for (const k of ['in_name', 'art', 'vers_hint', 'disk', 'pool_one', 'grp_txt']) t = t.replaceAll(`{${k}}`, (k === 'grp_txt' ? ctx.grpTxt : L[k]) ?? '');
  return t.replaceAll('{name}', ctx.name);
};
const HSLU = 'https://www.hslu.ch/de-ch/gesundheit/';
let LOGO = null;
/** HSLU logo as data URI, so the downloaded report stays a single file */
function logoDataUrl() {
  if (!LOGO) {
    LOGO = fetch(`img/hslu.png${V}`).then((x) => x.blob()).then((b) => new Promise((res) => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
    }));
  }
  return LOGO;
}
/** Wappen of the Gemeinde as data URI (null if missing) */
const wappenDataUrl = (id) => { const u = wappen(id); return !u ? Promise.resolve(null) : fetch(u).then((x) => (x.ok ? x.blob() : null))
  .then((b) => b && new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); })).catch(() => null); };
const appBase = () => `${location.origin}${location.pathname}`;

// ------------------------------------------------------------------ dialog
export function openReportDialog(id) {
  const r = region(id); if (!r || !['GDE', 'BEZ', 'KT'].includes(r.e)) return; const L = levelTexts(r);
  const R = S.meta.report; const p = prefs();
  const st = { level: p.reportLevel || 'kompakt', j: +(p.zieljahr || S.meta.prog.default_year), v: p.variant || S.meta.prog.default_variant,
    off: new Set(p.reportOff || []), mode: reportModes(r).includes(p.reportMode || p.mode) ? (p.reportMode || p.mode) : reportModes(r)[0] };
  document.querySelector('dialog.rdlg')?.remove();
  const dlg = document.createElement('dialog'); dlg.className = 'rdlg'; dlg.setAttribute('aria-labelledby', 'rdlgTitle');
  const opt = R.chapters.filter((c) => c.opt);
  dlg.innerHTML = `<form method="dialog" class="rdlg-in">
    <button type="button" class="rdlg-x" data-act="close" aria-label="Schliessen" title="Schliessen (Esc)">×</button>
    <div class="rdlg-head"><span class="eyebrow">${L.art}</span><h2 id="rdlgTitle">Bericht für ${esc(L.name)}${r.e === 'KT' ? '' : ` (${esc(r.kt)})`}</h2>
      <p class="muted small">Eine HTML-Datei mit allen Themen – zum Lesen, Weitergeben und Drucken.</p></div>
    <fieldset class="rd-level"><legend>Umfang</legend>${Object.entries(R.levels).map(([k, l]) =>
      `<label class="lvl"><input type="radio" name="level" value="${k}" ${k === st.level ? 'checked autofocus' : ''}><span><span><b>${esc(l.label)}</b> · ${esc(l.pages)}</span><span class="muted small">${esc(l.desc)}</span></span></label>`).join('')}</fieldset>
    <fieldset><legend>Ausblick</legend>
      <div class="rd-row"><span class="pl-lab">Zieljahr</span><div class="seg" role="group" aria-label="Zieljahr">${S.meta.prog.years.map((y) => `<button type="button" data-j="${y}" aria-pressed="${y === st.j}">${y}</button>`).join('')}</div></div>
      <div class="rd-row"><span class="pl-lab">Variante</span><div class="seg" role="group" aria-label="Variante">${S.meta.prog.variants.map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === st.v}">BFS ${v}</button>`).join('')}</div></div></fieldset>
    <fieldset><legend>Vergleichen mit</legend>
      <div class="rd-grp"><div class="seg wrap" role="group" aria-label="Vergleichen mit">${reportModes(r).map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === st.mode}">${esc(groupLabelFor(m, r.e))}</button>`).join('')}</div></div>
      <p class="muted small rd-own"></p></fieldset>
    <fieldset><legend>Kapitel</legend><div class="rd-chaps">${opt.map((c) =>
      `<label><input type="checkbox" name="ch" value="${c.id}" ${st.off.has(c.id) ? '' : 'checked'}${c.only ? ` data-only="${c.only}"` : ''}> ${esc(fill(c.title, { name: L.name, j: st.j, L }))}${c.only ? ' <span class="muted small">(ausführlich)</span>' : ''}</label>`).join('')}</div>
      <p class="muted small rd-ex">Immer dabei: Auf einen Blick, Fragen für die Planung, Daten und Methode.${r.e !== 'GDE' ? '' : ` Beispiel: <a href="beispiele/GAP-Insights_Bericht_Sursee_kompakt.html" target="_blank" rel="noopener">kompakt</a> · <a href="beispiele/GAP-Insights_Bericht_Sursee_ausfuehrlich.html" target="_blank" rel="noopener">ausführlich</a>`}</p></fieldset>
    <div class="rdlg-foot"><button type="button" class="btn ghost" data-act="close">Abbrechen</button>
      <button type="button" class="btn primary" data-act="download">Bericht herunterladen</button></div></form>`;
  document.body.appendChild(dlg);
  const sync = () => {
    dlg.querySelectorAll('[data-only]').forEach((c) => { c.disabled = c.dataset.only !== st.level; c.closest('label').classList.toggle('dis', c.disabled); });
    dlg.querySelectorAll('[data-j]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.j === st.j)));
    dlg.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.v)));
    dlg.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)));
    const n = groupMembers(st.mode, id).length;
    dlg.querySelector('.rd-own').textContent = st.mode === 'own' ? (n ? `Ihre Auswahl: ${groupMembers('own', id).map(shortName).join(', ')}.` : 'Ihre Eigene Auswahl ist noch leer – stellen Sie sie in einem Thema unter «Vergleichen mit» zusammen.') : `${n} ${L.pool === 'GDE' ? 'Gemeinden' : L.pool === 'BEZ' ? 'Bezirke' : 'Kantone'} im Vergleich.`;
  };
  const opts = () => {
    const chapters = [...dlg.querySelectorAll('input[name="ch"]')].filter((c) => c.checked && !c.disabled).map((c) => c.value);
    setPrefs({ reportLevel: st.level, reportOff: [...dlg.querySelectorAll('input[name="ch"]')].filter((c) => !c.checked).map((c) => c.value) });
    setPrefs({ reportMode: st.mode });
    return { level: st.level, j: st.j, v: st.v, chapters, mode: st.mode };
  };
  dlg.addEventListener('change', (ev) => { if (ev.target.name === 'level') { st.level = ev.target.value; sync(); } });
  // a click on the darkened area around the dialog closes it (press and release outside, not while a report is built)
  let busy = false; let downOutside = false;
  const outside = (ev) => { const b = dlg.getBoundingClientRect();
    return ev.target === dlg && (ev.clientX < b.left || ev.clientX > b.right || ev.clientY < b.top || ev.clientY > b.bottom); };
  dlg.addEventListener('pointerdown', (ev) => { downOutside = outside(ev); });
  dlg.addEventListener('click', async (ev) => {
    if (outside(ev)) { if (downOutside && !busy) dlg.close(); downOutside = false; return; }
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.j) { st.j = +b.dataset.j; sync(); return; }
    if (b.dataset.v) { st.v = b.dataset.v; sync(); return; }
    if (b.dataset.m) { st.mode = b.dataset.m; sync(); return; }
    const act = b.dataset.act;
    if (act === 'close') { dlg.close(); return; }
    if (act === 'preview' || act === 'download') {
      const win = act === 'preview' ? window.open('', '_blank') : null;     // open synchronously: popup blockers
      b.disabled = true; busy = true; const old = b.textContent; b.textContent = 'Wird erstellt …';
      try {
        const o = opts(); const html = await buildReport(id, o);
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        if (win) win.location.href = url;
        else {
          const a = document.createElement('a'); a.href = url; a.download = fileName(r, o); document.body.appendChild(a); a.click(); a.remove();
          toast('Bericht heruntergeladen');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        dlg.close();
      } catch (e) {
        console.error(e); if (win) win.close();
        toast('Der Bericht konnte nicht erstellt werden.');
      } finally { b.disabled = false; busy = false; b.textContent = old; }
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
  sync();
  dlg.showModal();
}

export const fileName = (r, o) => `GAP-Insights_Bericht_${levelTexts(r).name.replace(/[^\p{L}\p{N}]+/gu, '-')}_${o.j}_${o.level}.html`;

// ------------------------------------------------------------------ assembly
export async function buildReport(id, { level = 'kompakt', j = S.meta.prog.default_year, v = S.meta.prog.default_variant, chapters = null, base = null, mode = null } = {}) {
  const r = region(id); const R = S.meta.report; const full = level === 'ausfuehrlich'; const L = levelTexts(r);
  if (!reportModes(r).includes(mode)) mode = reportModes(r)[0];
  const [d, dB, dK, dCH, P, css, logo, wap] = await Promise.all([detail(id), L.mid ? detail(L.mid) : null, detail(L.ref), detail('CH'), loadProg(),
    fetch(`css/report.css${V}`).then((x) => x.text()), logoDataUrl(), wappenDataUrl(id)]);
  const grp = groupMembers(mode, id); const gl = groupLabelFor(mode, r.e);
  const grpTxt = mode === 'own' ? (grp.length ? `die ${grp.length} Regionen Ihrer eigenen Auswahl` : 'Ihre eigene Auswahl (leer)') : mode === 'nb' ? 'die Nachbargemeinden'
    : mode === 'size' ? 'die Gemeinden ähnlicher Grösse im Kanton' : r.e === 'KT' ? 'alle anderen Kantone' : r.e === 'BEZ' ? 'die übrigen Bezirke des Kantons' : 'die übrigen Gemeinden des Kantons';
  const grpShort = mode === 'kanton' ? (r.e === 'KT' ? 'übrige Kantone' : r.e === 'BEZ' ? 'übrige Bezirke im Kanton' : 'übrige Gemeinden im Kanton') : gl;
  const ctx = { id, r, L, name: L.name, d, dB, dK, dCH, P, v, j: +j, full, level, kt: L.ref, ktName: L.refName, small: r.e === 'GDE' && r.pop < R.small, mode, grp, grpLabel: grpShort, grpTxt };
  const want = R.chapters.filter((c) => (!c.only || c.only === level) && (!c.opt || !chapters || chapters.includes(c.id)));
  const out = []; const used = [];
  for (const c of want) {
    if (c.id === 'methode') continue;
    const res = FN[c.id](ctx); if (!res) continue;
    (c.src || []).forEach((s) => { if (!used.includes(s)) used.push(s); });
    out.push({ c, res });
  }
  if (!used.includes('statpop')) used.unshift('statpop');
  const mc = R.chapters.find((c) => c.id === 'methode');
  out.push({ c: mc, res: story.methode(ctx, used) });
  const today = new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  const lv = R.levels[level];
  const title = fill(R.title, ctx);
  const n = d.ts.y.length - 1;
  const sections = out.map(({ c, res }, k) => `
  <section class="ch" id="${c.id}" aria-labelledby="h-${c.id}">
    <header class="ch-head"><span class="ch-nr">${k + 1}</span><div><p class="ch-q">${esc(fill(c.frage, ctx))}</p><h2 id="h-${c.id}">${esc(fill(c.title, ctx))}</h2></div></header>
    <p class="ch-intro">${esc(fill(c.intro, ctx))}</p>
    <p class="lead">${res.lead}</p>
    ${res.body}
    ${c.src && c.id !== 'methode' ? `<p class="src">Quelle: ${esc(c.src.filter((s) => used.includes(s)).map((s) => { const x = S.meta.sources[s]; return `${x.publisher}, ${x.name} (${x.year})`; }).join(' · '))}</p>` : ''}
  </section>`).join('');
  const link = `${base || appBase()}#/gemeinde/${id}`;
  const wrapT = (h) => h.replace(/<table /g, '<div class="tw"><table ').replace(/<\/table>/g, '</table></div>');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · GAP-Insights</title>
<meta name="generator" content="GAP-Insights ${esc(window.GAP_BUILD || '')}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Noto+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>${css}</style></head>
<body>
<div class="bar"><a class="brand" href="${esc(link)}" aria-label="GAP-Insights: ${esc(L.name)} in der App öffnen"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">GAP-Insights</span></a>
  <span class="bar-what">${L.art} ${esc(L.name)}</span>
  <button type="button" class="no-print" onclick="window.print()">Drucken / als PDF</button>
  <a class="org" href="${HSLU}" title="Hochschule Luzern – Gesundheit"><img src="${logo}" alt="HSLU Hochschule Luzern" width="170" height="26"></a></div>
<header class="cover"><div class="cover-in">
  <div class="cover-text">
    <p class="eyebrow">${L.art} · ${esc(lv.label)}</p>
    <h1>${wap ? `<img class="wappen" src="${wap}" alt="Wappen ${esc(L.name)}">` : ''}${esc(title)}</h1>
    <p class="sub">${esc(fill(R.subtitle, ctx))}</p>
    <p class="where">${esc(L.where)}</p>
    <div class="kf"><span><b>${fmtInt(r.pop)}</b>Einwohner ${S.meta.jahr}</span><span><b>${fmt(story.keyNumbers(ctx).b80 / r.pop * 100, { dec: 1 })} %</b>ab 80 Jahren</span>
      <span><b>${d.aph && d.aph.heime ? fmtInt(d.aph.plaetze) : '–'}</b>Pflegeheimplätze</span><span><b>${fmtInt(roundProg(story.keyNumbers(ctx).b80j, 'Personen'))}</b>ab 80 im Jahr ${j} (rund)</span></div>
  </div>
  <div class="cover-maps">${locatorKanton(id)}${locatorCH(id)}</div>
</div>
<dl class="meta"><div><dt>Umfang</dt><dd>${esc(lv.label)} (${esc(lv.pages)})</dd></div><div><dt>Ausblick</dt><dd>BFS-Szenario ${esc(v)}, Zieljahr ${j}</dd></div><div><dt>Vergleich</dt><dd>${esc(gl)}${grp.length ? ` (${grp.length})` : ''}</dd></div>
  <div><dt>Datenstand</dt><dd>${S.meta.jahr} (Zeitreihen ab ${S.meta.alter_jahre[0]})</dd></div><div><dt>Erstellt</dt><dd>${esc(today)}</dd></div>
  <div><dt>In der App</dt><dd><a href="${esc(link)}">${esc(L.name)} in GAP-Insights öffnen</a></dd></div></dl>
</header>
<div class="layout">
  <nav class="toc no-print" aria-label="Inhalt"><p>Inhalt</p><ol>${out.map(({ c }, k) => `<li><a href="#${c.id}"><span class="tt"><span class="tn">${k + 1}</span>${esc(fill(c.title, ctx))}</span><span class="tq">${esc(fill(c.frage, ctx))}</span></a></li>`).join('')}</ol></nav>
  <main>${wrapT(sections)}</main>
</div>
<footer class="foot"><a class="org-small" href="${HSLU}" title="Hochschule Luzern – Gesundheit"><img src="${logo}" alt="HSLU Hochschule Luzern" width="118" height="18"></a><p>GAP-Insights · Hochschule Luzern – Gesundheit · ${L.art} für ${esc(L.name)}${r.e === 'KT' ? '' : ` (${esc(r.kt)})`}, erstellt am ${esc(today)}. Daten: BFS, BAG, swisstopo. Prognosen: BFS-Szenarien 2025, regionalisiert durch die HSLU.</p>
<p><a href="${esc(link)}">${esc(link)}</a></p></footer>
<script>
/* highlight the chapter in view in the table of contents */
(function () {
  var links = [].slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var bar = document.querySelector('.bar'); var cur = -1; var ticking = false;
  function update() {
    ticking = false;
    var line = (bar ? bar.getBoundingClientRect().bottom : 0) + 40, k = -1;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= line) k = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) k = secs.length - 1;
    if (k === cur) return; cur = k;
    links.forEach(function (a, i) { a.classList.toggle('on', i === k); if (i === k) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();
</script>
</body></html>`;
}
