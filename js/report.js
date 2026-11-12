// Gemeindebericht: options dialog and assembly of a self-contained HTML report (inline CSS + SVG, no scripts needed).
import { S, region, detail, fmtInt, fmt, setPrefs, prefs } from './store.js?v=20261112112608';
import { loadProg, roundProg } from './prog.js?v=20261112112608';
import { esc, toast } from './ui.js?v=20261112112608';
import * as story from './report_story.js?v=20261112112608';
import { locatorKanton, locatorCH } from './report_svg.js?v=20261112112608';

const FN = { blick: story.blick, bevoelkerung: story.bevoelkerung, entwicklung: story.entwicklung, wohnen: story.wohnen,
  versorgung: story.versorgung, ausblick: story.ausblick, vergleich: story.vergleich, planung: story.planung };
const V = window.GAP_BUILD ? `?v=${window.GAP_BUILD}` : '';
const fill = (s, ctx) => String(s || '').replaceAll('{name}', ctx.name).replaceAll('{a0}', S.meta.alter_jahre[0]).replaceAll('{j}', ctx.j);
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
const appBase = () => `${location.origin}${location.pathname}`;

// ------------------------------------------------------------------ dialog
export function openReportDialog(id) {
  const r = region(id); if (!r || r.e !== 'GDE') return;
  const R = S.meta.report; const p = prefs();
  const st = { level: p.reportLevel || 'kompakt', j: +(p.zieljahr || S.meta.prog.default_year), v: p.variant || S.meta.prog.default_variant,
    off: new Set(p.reportOff || []) };
  document.querySelector('dialog.rdlg')?.remove();
  const dlg = document.createElement('dialog'); dlg.className = 'rdlg'; dlg.setAttribute('aria-labelledby', 'rdlgTitle');
  const opt = R.chapters.filter((c) => c.opt);
  dlg.innerHTML = `<form method="dialog" class="rdlg-in">
    <div class="rdlg-head"><span class="eyebrow">Gemeindebericht</span><h2 id="rdlgTitle">Bericht für ${esc(r.n)} (${esc(r.kt)})</h2>
      <p class="muted small">Eine HTML-Datei mit allen Themen als zusammenhängende Geschichte – zum Lesen, Weitergeben und Drucken.</p></div>
    <fieldset class="rd-level"><legend>Umfang</legend>${Object.entries(R.levels).map(([k, l]) =>
      `<label class="lvl"><input type="radio" name="level" value="${k}" ${k === st.level ? 'checked' : ''}><span><span><b>${esc(l.label)}</b> · ${esc(l.pages)}</span><span class="muted small">${esc(l.desc)}</span></span></label>`).join('')}</fieldset>
    <fieldset><legend>Ausblick</legend>
      <div class="rd-row"><span class="pl-lab">Zieljahr</span><div class="seg" role="group" aria-label="Zieljahr">${S.meta.prog.years.map((y) => `<button type="button" data-j="${y}" aria-pressed="${y === st.j}">${y}</button>`).join('')}</div></div>
      <div class="rd-row"><span class="pl-lab">Variante</span><div class="seg" role="group" aria-label="Variante">${S.meta.prog.variants.map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === st.v}">BFS ${v}</button>`).join('')}</div></div></fieldset>
    <fieldset><legend>Kapitel</legend><div class="rd-chaps">${opt.map((c) =>
      `<label><input type="checkbox" name="ch" value="${c.id}" ${st.off.has(c.id) ? '' : 'checked'}${c.only ? ` data-only="${c.only}"` : ''}> ${esc(fill(c.title, { name: r.n, j: st.j }))}${c.only ? ' <span class="muted small">(nur Ausführlich)</span>' : ''}</label>`).join('')}</div>
      <p class="muted small">«Auf einen Blick», «Fragen für die Planung» und «Daten und Methode» sind immer enthalten.</p></fieldset>
    <p class="small muted rd-ex">Beispiel ansehen: <a href="beispiele/GAP-Insights_Bericht_Sursee_kompakt.html" target="_blank" rel="noopener">Sursee kompakt</a> · <a href="beispiele/GAP-Insights_Bericht_Sursee_ausfuehrlich.html" target="_blank" rel="noopener">Sursee ausführlich</a></p>
    <div class="rdlg-foot"><button type="button" class="btn ghost" data-act="close">Abbrechen</button>
      <button type="button" class="btn" data-act="preview">Vorschau im neuen Tab</button>
      <button type="button" class="btn primary" data-act="download">HTML herunterladen</button></div></form>`;
  document.body.appendChild(dlg);
  const sync = () => {
    dlg.querySelectorAll('[data-only]').forEach((c) => { c.disabled = c.dataset.only !== st.level; c.closest('label').classList.toggle('dis', c.disabled); });
    dlg.querySelectorAll('[data-j]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.j === st.j)));
    dlg.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.v)));
  };
  const opts = () => {
    const chapters = [...dlg.querySelectorAll('input[name="ch"]')].filter((c) => c.checked && !c.disabled).map((c) => c.value);
    setPrefs({ reportLevel: st.level, reportOff: [...dlg.querySelectorAll('input[name="ch"]')].filter((c) => !c.checked).map((c) => c.value) });
    return { level: st.level, j: st.j, v: st.v, chapters };
  };
  dlg.addEventListener('change', (ev) => { if (ev.target.name === 'level') { st.level = ev.target.value; sync(); } });
  dlg.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.j) { st.j = +b.dataset.j; sync(); return; }
    if (b.dataset.v) { st.v = b.dataset.v; sync(); return; }
    const act = b.dataset.act;
    if (act === 'close') { dlg.close(); return; }
    if (act === 'preview' || act === 'download') {
      const win = act === 'preview' ? window.open('', '_blank') : null;     // open synchronously: popup blockers
      b.disabled = true; const old = b.textContent; b.textContent = 'Wird erstellt …';
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
      } finally { b.disabled = false; b.textContent = old; }
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
  sync();
  dlg.showModal();
}

export const fileName = (r, o) => `GAP-Insights_Bericht_${r.n.replace(/[^\p{L}\p{N}]+/gu, '-')}_${o.j}_${o.level}.html`;

// ------------------------------------------------------------------ assembly
export async function buildReport(id, { level = 'kompakt', j = S.meta.prog.default_year, v = S.meta.prog.default_variant, chapters = null, base = null } = {}) {
  const r = region(id); const R = S.meta.report; const full = level === 'ausfuehrlich';
  const [d, dB, dK, dCH, P, css, logo] = await Promise.all([detail(id), detail(r.bez), detail(`KT:${r.kt}`), detail('CH'), loadProg(),
    fetch(`css/report.css${V}`).then((x) => x.text()), logoDataUrl()]);
  const ctx = { id, r, name: r.n, d, dB, dK, dCH, P, v, j: +j, full, level, kt: `KT:${r.kt}`, ktName: region(`KT:${r.kt}`).n, small: r.pop < R.small };
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
<div class="bar"><a class="brand" href="${esc(link)}" aria-label="GAP-Insights: ${esc(r.n)} in der App öffnen"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">GAP-Insights</span></a>
  <span class="bar-what">Gemeindebericht ${esc(r.n)}</span>
  <button type="button" class="no-print" onclick="window.print()">Drucken / als PDF</button>
  <a class="org" href="${HSLU}" title="Hochschule Luzern – Gesundheit"><img src="${logo}" alt="HSLU Hochschule Luzern" width="170" height="26"></a></div>
<header class="cover"><div class="cover-in">
  <div class="cover-text">
    <p class="eyebrow">Gemeindebericht · ${esc(lv.label)}</p>
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(R.subtitle)}</p>
    <p class="where">Gemeinde im Bezirk ${esc(r.bn)}, Kanton ${esc(ctx.ktName)}</p>
    <div class="kf"><span><b>${fmtInt(r.pop)}</b>Einwohner ${S.meta.jahr}</span><span><b>${fmt(story.keyNumbers(ctx).b80 / r.pop * 100, { dec: 1 })} %</b>ab 80 Jahren</span>
      <span><b>${d.aph && d.aph.heime ? fmtInt(d.aph.plaetze) : '–'}</b>Pflegeheimplätze</span><span><b>${fmtInt(roundProg(story.keyNumbers(ctx).b80j, 'Personen'))}</b>ab 80 im Jahr ${j} (rund)</span></div>
  </div>
  <div class="cover-maps">${locatorKanton(id)}${locatorCH(id)}</div>
</div>
<dl class="meta"><div><dt>Umfang</dt><dd>${esc(lv.label)} (${esc(lv.pages)})</dd></div><div><dt>Ausblick</dt><dd>BFS-Szenario ${esc(v)}, Zieljahr ${j}</dd></div>
  <div><dt>Datenstand</dt><dd>${S.meta.jahr} (Zeitreihen ab ${S.meta.alter_jahre[0]})</dd></div><div><dt>Erstellt</dt><dd>${esc(today)}</dd></div>
  <div><dt>In der App</dt><dd><a href="${esc(link)}">${esc(r.n)} in GAP-Insights öffnen</a></dd></div></dl>
</header>
<div class="layout">
  <nav class="toc no-print" aria-label="Inhalt"><p>Inhalt</p><ol>${out.map(({ c }) => `<li><a href="#${c.id}">${esc(fill(c.title, ctx))}</a></li>`).join('')}</ol></nav>
  <main>${wrapT(sections)}</main>
</div>
<footer class="foot"><a class="org-small" href="${HSLU}" title="Hochschule Luzern – Gesundheit"><img src="${logo}" alt="HSLU Hochschule Luzern" width="118" height="18"></a><p>GAP-Insights · Hochschule Luzern – Gesundheit · Bericht für ${esc(r.n)} (${esc(r.kt)}), erstellt am ${esc(today)}. Daten: BFS, BAG, swisstopo. Prognosen: BFS-Szenarien 2025, regionalisiert durch die HSLU.</p>
<p><a href="${esc(link)}">${esc(link)}</a></p></footer>
</body></html>`;
}
