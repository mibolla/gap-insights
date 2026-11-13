// Gemeindebericht: one function per chapter. Each returns {lead, body} as HTML strings (or null to skip).
// Anatomy of a chapter: Leitfrage -> Kernaussage (lead) -> chart -> explanation -> comparison -> source.
import { S, val, fmt, fmtUnit, fmtInt, compareWord, groupMembers } from './store.js?v=20261113195938';
import { roundProg, model, pval } from './prog.js?v=20261113195938';
import { esc } from './ui.js?v=20261113195938';
import { hbars, groupedBars, stacked, lines, fan, pyramid, dotStrip, num } from './report_svg.js?v=20261113195938';

const pj = (dd, key, v, year) => { const p = dd && dd.prog; if (!p) return null; const k = p.y.indexOf(+year); return k < 0 ? null : p[v][key][k]; };
const pct = (a, b) => (a == null || !b ? null : (a / b - 1) * 100);
const sign = (x, d = 0) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${num(Math.abs(x), d)} %`);
const rp = (x) => (x == null ? '–' : fmtInt(roundProg(x, 'Personen')));
/** 'um +57 % gewachsen' / 'um 26 % zurückgegangen' */
const chg = (x) => (x == null ? 'unverändert geblieben' : x >= 0 ? `um <b>${sign(x)}</b> gewachsen` : `um <b>${num(Math.abs(x))} %</b> zurückgegangen`);
const U = (ind, id) => fmtUnit(val(ind, id), ind);
const idx = (arr) => arr.map((x) => (arr[0] ? (x / arr[0]) * 100 : null));
const sum = (a, i0, i1) => a.slice(i0, i1 + 1).reduce((s, x) => s + (x || 0), 0);
const both = (p) => p.m.map((x, k) => x + p.f[k]);
/** Heime 2012–<J>: places per 1000 80+ per year (null without a Heim in the whole period) */
const pl80 = (dd) => (dd && dd.aph_ts && dd.ts && dd.aph_ts.pl.some((x) => x > 0) ? dd.aph_ts.pl.map((p, k) => (dd.ts.b80[k] ? (p / dd.ts.b80[k]) * 1000 : null)) : null);
/** the Gemeinde if it had a Heim in the first year, else its Bezirk (for statements «seit 2012») */
const heimRef = (ctx) => (pl80(ctx.d) && ctx.d.aph_ts.pl[0] > 0 ? { id: ctx.id, dd: ctx.d, txt: `in ${esc(ctx.name)}` } : { id: ctx.r.bez, dd: ctx.dB, txt: `im Bezirk ${esc(ctx.r.bn)}` });

/** 'älter' / 'jünger' / … from a compareWord result */
const dir = (w, up, down, same) => (!w ? same : w.includes('höher') ? `${w.startsWith('deutlich') ? 'deutlich ' : ''}${up}` : w.includes('tiefer') ? `${w.startsWith('deutlich') ? 'deutlich ' : ''}${down}` : same);

function srcLine(keys) {
  const s = keys.map((k) => S.meta.sources[k]).filter(Boolean).map((x) => `${x.publisher}, ${x.name} (${x.year})`);
  return s.length ? `<p class="src">Quelle: ${esc(s.join(' · '))}</p>` : '';
}
/** small comparison tiles: value for the Gemeinde, Kanton and Schweiz below */
function stats(ctx, inds) {
  return `<div class="stats">${inds.map((k) => {
    const i = S.ind.get(k); const v = val(k, ctx.id);
    const ref = v == null && ctx.r.bez ? `<span class="sv">${U(k, ctx.r.bez)}</span><span class="sl">im Bezirk ${esc(ctx.r.bn)} – kein Wert für die Gemeinde</span>`
      : `<span class="sv">${U(k, ctx.id)}</span>`;
    return `<div class="stat"><span class="sk">${esc(i.short)}</span>${ref}<span class="sc">Kanton ${U(k, ctx.kt)} · Schweiz ${U(k, 'CH')}</span></div>`;
  }).join('')}</div>`;
}
const fig = (svg, cap) => (svg ? `<figure>${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>` : '');
const regionRows = (ctx, f, { bez = true } = {}) => [
  { label: ctx.name, v: f(ctx.id, ctx.d), cls: 'c-me', bold: true },
  ...(bez ? [{ label: `Bezirk ${ctx.r.bn}`, v: f(ctx.r.bez, ctx.dB), cls: 'c-bez' }] : []),
  { label: `Kanton ${ctx.ktName}`, v: f(ctx.kt, ctx.dK), cls: 'c-kt' },
  { label: 'Schweiz', v: f('CH', ctx.dCH), cls: 'c-ch' }];

// ------------------------------------------------------------------ numbers used in several chapters
export function keyNumbers(ctx) {
  const { d, v, j } = ctx; const n = d.ts.y.length - 1;
  const b80 = d.ts.b80[n]; const b80j = pj(d, 'b80', v, j);
  return { n, b80, b80j, g80j: pct(b80j, b80), lo: Math.min(pj(d, 'b80', 'tief', j), pj(d, 'b80', 'hoch', j)), hi: Math.max(pj(d, 'b80', 'tief', j), pj(d, 'b80', 'hoch', j)) };
}

// ------------------------------------------------------------------ 1 · Auf einen Blick
export function blick(ctx) {
  const { name, id, d, j, v } = ctx; const k = keyNumbers(ctx); const a0 = d.ts.y[0];
  const w65 = compareWord(val('a65', id), val('a65', ctx.kt), 'a65');
  const facts = [
    { t: 'heute', s: `${esc(name)} zählt <b>${fmtInt(ctx.r.pop)}</b> Einwohnerinnen und Einwohner; <b>${fmtInt(k.b80)}</b> von ihnen sind 80 oder älter (${U('a80', id)}).`, c: `Kanton ${U('a80', ctx.kt)} · Schweiz ${U('a80', 'CH')}` },
    { t: 'heute', s: `<b>${U('a65', id)}</b> der Bevölkerung sind 65 oder älter – ${esc(w65 || 'ähnlich wie')} im Kanton.`, c: `Kanton ${U('a65', ctx.kt)} · Schweiz ${U('a65', 'CH')}` },
    d.aph && d.aph.heime
      ? { t: 'heute', s: `In ${esc(name)} gibt es <b>${fmtInt(d.aph.heime)} Pflegeheim${d.aph.heime === 1 ? '' : 'e'}</b> mit ${fmtInt(d.aph.plaetze)} Plätzen${d.spitex && d.spitex.length ? ` und ${d.spitex.length} Spitex-Organisation${d.spitex.length === 1 ? '' : 'en'} mit Sitz hier` : ''}.`, c: `Plätze pro 1000 80+: ${U('aph_pl80', id)} · Kanton ${U('aph_pl80', ctx.kt)}` }
      : { t: 'heute', s: `${esc(name)} hat <b>kein eigenes Pflegeheim</b>; die Versorgung läuft über Heime der Region.`, c: `Bezirk ${esc(ctx.r.bn)}: ${U('aph_pl80', ctx.r.bez)} Plätze pro 1000 80+` },
    { t: 'rueckblick', s: `Seit ${a0} ist die Zahl der über 80-Jährigen ${chg(val('g80', id))}.`, c: `Kanton ${sign(val('g80', ctx.kt))} · Schweiz ${sign(val('g80', 'CH'))}` },
    (() => {
      const h = heimRef(ctx); const y = pl80(h.dd); if (!y) return null; const n = y.length - 1;
      return { t: 'rueckblick', s: `Pflegeheimplätze pro 1000 Menschen ab 80 ${h.txt}: <b>${num(y[0])}</b> im Jahr ${a0}, <b>${num(y[n])}</b> im Jahr ${S.meta.jahr} (${sign(pct(y[n], y[0]))}).`,
        c: `Kanton ${sign(val('aph_g_pl80', ctx.kt))} · Schweiz ${sign(val('aph_g_pl80', 'CH'))}` };
    })(),
    { t: 'ausblick', s: `Gemäss BFS-Szenario ${v} leben ${j} rund <b>${rp(k.b80j)}</b> Menschen ab 80 in ${esc(name)} (${sign(k.g80j)}).`, c: `Spannweite tief–hoch: ${rp(k.lo)} bis ${rp(k.hi)}` },
  ];
  const TAG = { heute: `Heute ${S.meta.jahr}`, rueckblick: `Rückblick seit ${a0}`, ausblick: `Prognose ${j}` };
  return {
    lead: `${esc(name)} wird älter: ${k.g80j != null && k.g80j > 0 ? `bis ${j} wächst die Zahl der Menschen ab 80 um rund ${sign(k.g80j)}` : `die Zahl der Menschen ab 80 bleibt bis ${j} etwa gleich`}.`,
    body: `<ol class="facts">${facts.filter(Boolean).map((f) => `<li class="${f.t}"><span class="ftag">${TAG[f.t]}</span><p>${f.s}</p><span class="fc">${f.c}</span></li>`).join('')}</ol>`,
  };
}

// ------------------------------------------------------------------ 2 · Wer lebt hier?
export function bevoelkerung(ctx) {
  const { name, id, d, dK, full } = ctx; const yr = String(S.meta.jahr);
  const w = compareWord(val('a65', id), val('a65', ctx.kt), 'a65');
  const lead = `Die Bevölkerung von ${esc(name)} ist ${dir(w, 'älter', 'jünger', 'etwa gleich alt')} als im Kanton ${esc(ctx.ktName)}: <b>${U('a65', id)}</b> sind 65 oder älter (Kanton ${U('a65', ctx.kt)}, Schweiz ${U('a65', 'CH')}).`;
  const a = d.pyr[yr]; const ref = dK.pyr[yr];
  const sa = both(a); const sr = both(ref); const ta = sum(sa, 0, 20); const tr = sum(sr, 0, 20);
  const s80 = (sum(sa, 16, 20) / ta) * 100; const r80 = (sum(sr, 16, 20) / tr) * 100;
  let body = fig(pyramid(d.pyr.groups, a, ref, { label: `Altersaufbau ${yr}: Anteil jeder Altersgruppe in %`, aName: name, refName: `Kanton ${ctx.ktName}` }),
    `Balken: ${esc(name)}. Linie: Kanton ${esc(ctx.ktName)}. Ragt ein Balken über die Linie hinaus, ist die Altersgruppe in ${esc(name)} stärker vertreten als im Kanton.`);
  body += `<p>Menschen ab 80 machen in ${esc(name)} ${num(s80, 1)} % der Bevölkerung aus, im Kanton ${num(r80, 1)} %. Auf 100 Personen im Erwerbsalter (20–64) kommen ${U('aq', id).replace(' pro 100', '')} Personen ab 65 – im Kanton ${U('aq', ctx.kt).replace(' pro 100', '')}.</p>`;
  body += stats(ctx, full ? ['a65', 'a80', 'aq', 'dalt'] : ['a65', 'a80', 'aq']);
  if (full) {
    const bands = [['0–19', 0, 3], ['20–64', 4, 12], ['65–79', 13, 15], ['80+', 16, 20]];
    const sCH = both(ctx.dCH.pyr[yr]); const tCH = sum(sCH, 0, 20);
    body += `<table class="tab"><caption>Bevölkerung nach Altersgruppen ${yr}</caption><thead><tr><th>Alter</th><th class="n">${esc(name)}</th><th class="n">Anteil</th><th class="n">Kanton</th><th class="n">Schweiz</th></tr></thead><tbody>${bands.map(([l, i0, i1]) =>
      `<tr><td>${l}</td><td class="n">${fmtInt(sum(sa, i0, i1))}</td><td class="n">${num((sum(sa, i0, i1) / ta) * 100, 1)} %</td><td class="n">${num((sum(sr, i0, i1) / tr) * 100, 1)} %</td><td class="n">${num((sum(sCH, i0, i1) / tCH) * 100, 1)} %</td></tr>`).join('')}</tbody></table>`;
  }
  return { lead, body };
}

// ------------------------------------------------------------------ 3 · Wie hat sich das entwickelt?
export function entwicklung(ctx) {
  const { name, id, d, dK, dCH, full } = ctx; const x = d.ts.y; const a0 = x[0];
  const w = compareWord(val('g80', id), val('g80', ctx.kt), 'g80');
  const g = val('g80', id); const kt = `${esc(ctx.ktName)} (${sign(val('g80', ctx.kt))}; Schweiz ${sign(val('g80', 'CH'))})`;
  const lead = `Seit ${a0} ist die Zahl der über 80-Jährigen in ${esc(name)} ${chg(g)} – ${g < 0 ? `im Kanton ${kt} ist sie dagegen gewachsen` : `${dir(w, 'stärker', 'schwächer', 'etwa gleich stark')} als im Kanton ${kt}`}.`;
  const ser = (key) => [{ name, y: idx(d.ts[key]), cls: 'c-me', bold: true }, { name: `Kanton ${ctx.r.kt}`, y: idx(dK.ts[key]), cls: 'c-kt' }, { name: 'Schweiz', y: idx(dCH.ts[key]), cls: 'c-ch' }];
  const f = (v) => num(v);
  let body = fig(lines(x, ser('b80'), { label: `Menschen ab 80, Index ${a0} = 100`, refLine: 100, fmtY: f }),
    `Der Index macht Regionen unterschiedlicher Grösse vergleichbar: 150 heisst 50 % mehr als ${a0}. Bestand ${a0}: ${fmtInt(d.ts.b80[0])}, ${x[x.length - 1]}: ${fmtInt(d.ts.b80[x.length - 1])}.`);
  body += `<p>Die Gesamtbevölkerung ist im selben Zeitraum um ${sign(val('g_bev', id))} gewachsen, die Zahl der Menschen ab 65 um ${sign(val('g65', id))}. ${val('g80', id) > val('g_bev', id) ? 'Die Hochbetagten nehmen also schneller zu als die Bevölkerung insgesamt.' : 'Die Hochbetagten nehmen damit nicht schneller zu als die Bevölkerung insgesamt.'}</p>`;
  if (full) {
    body += `<div class="two">${fig(lines(x, ser('bev'), { label: `Gesamtbevölkerung, Index ${a0} = 100`, refLine: 100, fmtY: f, w: 440, h: 250 }))}${fig(lines(x, ser('b65'), { label: `Menschen ab 65, Index ${a0} = 100`, refLine: 100, fmtY: f, w: 440, h: 250 }))}</div>`;
    const ws = val('wsaldo', id); const gs = val('gsaldo', id);
    if (ws != null && gs != null) body += `<p>${esc(name)} ${ws + gs >= 0 ? 'wächst' : 'schrumpft'} ${Math.abs(ws) > Math.abs(gs) ? 'vor allem durch Wanderung' : 'vor allem durch die natürliche Entwicklung (Geburten minus Todesfälle)'}: Wanderungssaldo ${num(ws, 2)} % pro Jahr, Geburtenüberschuss ${num(gs, 2)} % pro Jahr (Durchschnitt ${S.meta.periode[0]}–${S.meta.periode[1]}).</p>`;
    const keys = Object.keys(d.bew || {});
    if (keys.length) body += `<table class="tab"><caption>Bevölkerungsbewegungen pro Jahr, in % der Bevölkerung (Ø ${S.meta.periode[0]}–${S.meta.periode[1]})</caption><thead><tr><th>Bewegung</th><th class="n">${esc(name)}</th><th class="n">Kanton</th><th class="n">Schweiz</th></tr></thead><tbody>${keys.map((k) =>
      `<tr><td>${esc(k)}</td><td class="n">${num(d.bew[k], 2)}</td><td class="n">${num(dK.bew?.[k], 2)}</td><td class="n">${num(dCH.bew?.[k], 2)}</td></tr>`).join('')}</tbody></table>`;
  }
  return { lead, body };
}

// ------------------------------------------------------------------ 4 · Wie leben ältere Menschen?
export function wohnen(ctx) {
  const { name, id, d, dK, dCH, full } = ctx;
  if (val('al65', id) == null) return null;
  const w = compareWord(val('al65', id), val('al65', ctx.kt), 'al65');
  const lead = `<b>${U('al65', id)}</b> der Menschen ab 65 leben in ${esc(name)} allein – ${esc(w || 'ähnlich wie')} im Kanton (${U('al65', ctx.kt)}).`;
  let body = fig(hbars(regionRows(ctx, (r) => val('al65', r)), { label: 'Menschen ab 65, die allein leben, in %', unit: ' %' }));
  body += `<p>Bei den über 85-Jährigen leben ${U('al85', id)} allein und ${U('koll85', id)} in einem Heim oder einer anderen Kollektivunterkunft (Kanton: ${U('al85', ctx.kt)} bzw. ${U('koll85', ctx.kt)}).</p>`;
  if (full && d.hh) {
    const cats = ['1 Person', '2 Personen', '3 Personen', '4 Personen', '5 Personen', '6 und mehr'];
    body += fig(stacked([{ label: name, parts: d.hh, bold: true }, { label: `Kanton ${ctx.r.kt}`, parts: dK.hh }, { label: 'Schweiz', parts: dCH.hh }], cats,
      ['s0', 's1', 's2', 's3', 's4', 's5'], { label: 'Privathaushalte nach Grösse, in %' }));
    body += stats(ctx, ['hh1', 'hhs', 'al85', 'koll85']);
  } else body += stats(ctx, ['hh1', 'al85']);
  return { lead, body };
}

// ------------------------------------------------------------------ 5 · Wer pflegt und betreut?
export function versorgung(ctx) {
  const { name, id, d, full } = ctx; const bez = ctx.r.bez;
  const hasHeim = d.aph && d.aph.heime;
  const lead = hasHeim
    ? `In ${esc(name)} gibt es <b>${fmtInt(d.aph.heime)} Pflegeheim${d.aph.heime === 1 ? '' : 'e'} mit ${fmtInt(d.aph.plaetze)} Plätzen</b> – ${U('aph_pl80', id).replace('von 1000', 'Plätze pro 1000')} Menschen ab 80 (Kanton ${U('aph_pl80', ctx.kt).replace('von 1000', 'pro 1000')}).`
    : `${esc(name)} hat <b>kein eigenes Pflegeheim</b>. Im Bezirk ${esc(ctx.r.bn)} stehen ${U('aph_pl80', bez).replace('von 1000', 'Plätze pro 1000')} Menschen ab 80 (Kanton ${U('aph_pl80', ctx.kt).replace('von 1000', 'pro 1000')}).`;
  const rowsA = regionRows(ctx, (r) => val('aph_pl80', r)).map((x) => ({ ...x, text: x.v == null ? null : num(x.v) }));
  const rowsS = regionRows(ctx, (r) => val('spx_kl65', r)).map((x) => ({ ...x, text: x.v == null ? null : num(x.v) }));
  let body = fig(hbars(rowsA, { label: `Pflegeheimplätze pro 1000 Menschen ab 80, ${S.meta.jahr}` })) + fig(hbars(rowsS, { label: 'Spitex-Klient/innen pro 1000 Menschen ab 65' }));
  // Rückblick: places per 1000 80+ since the first year
  const own = pl80(d); const ch = ctx.dCH.aph_ts; const nT = ch.y.length - 1;
  const serH = [own && { name, y: own, cls: 'c-me', bold: true }, { name: `Bezirk ${ctx.r.bn}`, y: pl80(ctx.dB), cls: 'c-bez', bold: !own },
    { name: `Kanton ${ctx.r.kt}`, y: pl80(ctx.dK), cls: 'c-kt' }, { name: 'Schweiz', y: pl80(ctx.dCH), cls: 'c-ch' }].filter((x) => x && x.y);
  const gPl = pct(ch.pl[nT], ch.pl[0]); const gB = pct(ctx.dCH.ts.b80[nT], ctx.dCH.ts.b80[0]);
  body += fig(lines(ch.y, serH, { label: `Pflegeheimplätze pro 1000 Menschen ab 80, ${ch.y[0]}–${ch.y[nT]}`, fmtY: (x) => num(x) }),
    `Schweiz: Plätze ${sign(gPl)}, Menschen ab 80 ${sign(gB)} – ${gB > gPl ? 'die Zahl der Plätze wächst langsamer als die Zahl der Hochbetagten' : 'die Zahl der Plätze wächst mit der Zahl der Hochbetagten'}. ${own ? '' : `${esc(name)} hatte in diesen Jahren kein eigenes Heim. `}Heime am Standort, heutige Gemeindegrenzen.`);
  const sk = val('spx_kl65', id);
  body += `<p>${sk != null ? `Spitex-Organisationen mit Sitz in ${esc(name)} betreuen ${num(sk)} von 1000 Menschen ab 65 (Kanton ${num(val('spx_kl65', ctx.kt))}).` : `In ${esc(name)} hat keine Spitex-Organisation ihren Sitz; die Gemeinde wird von Organisationen aus der Umgebung versorgt.`} Heime und Spitex-Organisationen versorgen auch Menschen aus Nachbargemeinden – Werte einer einzelnen Gemeinde sind deshalb immer zusammen mit Bezirk und Kanton zu lesen.</p>`;
  if (full) {
    if (d.heime && d.heime.length) body += `<table class="tab"><caption>Pflegeheime in ${esc(name)} (${S.meta.jahr})</caption><thead><tr><th>Heim</th><th class="n">Plätze</th><th class="n">Belegung</th><th class="n">Ø Eintrittsalter</th><th class="n">Ø Pflegestufe</th></tr></thead><tbody>${d.heime.map((h) =>
      `<tr><td>${esc(h.n)}</td><td class="n">${fmtInt(h.pl)}</td><td class="n">${num(h.bel, 1)} %</td><td class="n">${num(h.alter, 1)}</td><td class="n">${num(h.stufe, 1)}</td></tr>`).join('')}</tbody></table>`;
    if (d.spitex && d.spitex.length) body += `<table class="tab"><caption>Spitex-Organisationen mit Sitz in ${esc(name)} (${S.meta.jahr})</caption><thead><tr><th>Organisation</th><th class="n">Klient/innen</th><th class="n">Stellen (Vollzeit)</th></tr></thead><tbody>${d.spitex.map((s) =>
      `<tr><td>${esc(s.n)}</td><td class="n">${fmtInt(s.kl)}</td><td class="n">${num(s.vz, 1)}</td></tr>`).join('')}</tbody></table>`;
    body += stats(ctx, ['aph_bel', 'aph_stufe', 'spx_std65', 'aph_kbt']);
    // Heime: indicators of Leistungen / Personal / Kosten, first and last year
    const h = heimRef(ctx); const H = (S.meta.hist || []).map((x) => S.ind.get(x)); const y0 = ch.y[0]; const y1 = ch.y[nT];
    const cell = (dd, i, k) => { const a = dd && dd.aph_hist && dd.aph_hist[i.id]; return `<td class="n">${a ? fmt(a[k], i) : '–'}</td>`; };
    if (H.length) body += `<table class="tab"><caption>Pflegeheime ${y0} und ${y1}: Leistungen, Personal und Kosten</caption><thead><tr><th>Kennzahl</th><th class="n" colspan="2">${h.id === id ? esc(name) : `Bezirk ${esc(ctx.r.bn)}`}</th><th class="n" colspan="2">Kanton</th><th class="n" colspan="2">Schweiz</th></tr>
      <tr><th></th>${[0, 1, 2].map(() => `<th class="n">${y0}</th><th class="n">${y1}</th>`).join('')}</tr></thead><tbody>${H.map((i) =>
      `<tr><td>${esc(i.short)} <span class="u">${esc(i.unit)}</span></td>${cell(h.dd, i, 0)}${cell(h.dd, i, nT)}${cell(ctx.dK, i, 0)}${cell(ctx.dK, i, nT)}${cell(ctx.dCH, i, 0)}${cell(ctx.dCH, i, nT)}</tr>`).join('')}</tbody></table>
      <p class="small">Pflegestufe bis ${y1 - 1}: BAG-Index der Pflegeintensität (gleiche Skala 1–12, ${y1} identisch). Kosten in Franken des jeweiligen Jahres (nicht teuerungsbereinigt).</p>`;
    if (d.spx && d.spx.einnahmen) {
      const cats = Object.keys(d.spx.einnahmen);
      const dK = ctx.dK.spx?.einnahmen;
      body += fig(stacked([{ label: name, parts: cats.map((c) => d.spx.einnahmen[c]), bold: true }, ...(dK ? [{ label: `Kanton ${ctx.r.kt}`, parts: cats.map((c) => dK[c]) }] : [])],
        cats, ['s0', 's2', 's4'], { label: 'Wer bezahlt die Spitex? Einnahmen nach Zahler, in %' }));
    }
  } else body += stats(ctx, ['aph_bel', 'spx_std65']);
  return { lead, body };
}

// ------------------------------------------------------------------ 6 · Was kommt auf uns zu?
export function ausblick(ctx) {
  const { name, d, dB, dK, dCH, v, j, full } = ctx; const k = keyNumbers(ctx); const P = d.prog;
  const m = model('bfs2025', v); const ph = model('aph_dummy', v);
  const lead = `Gemäss BFS-Szenario ${v} leben ${j} in ${esc(name)} <b>rund ${rp(k.b80j)} Menschen ab 80</b> – ${sign(k.g80j)} gegenüber ${S.meta.jahr} (${fmtInt(k.b80)}). Spannweite tief–hoch: ${rp(k.lo)} bis ${rp(k.hi)}.`;
  let body = `<div class="etikett"><span class="ek">Prognose</span><b>${esc(m.name)}</b><span>${esc(m.variante)} · Basisjahr ${m.basisjahr} · Zieljahr ${j} · regionalisiert durch die HSLU</span></div>`;
  body += fig(fan({ xObs: d.ts.y, obs: d.ts.b80, xP: P.y, lo: P.tief.b80, mid: P[v].b80, hi: P.hoch.b80, j, label: `Menschen ab 80 in ${name}: beobachtet ${d.ts.y[0]}–${S.meta.jahr} und Szenarien bis ${P.y[P.y.length - 1]}`, fmtV: (x) => fmtInt(roundProg(x, 'Personen')) }),
    `Durchgezogen: beobachtet. Gestrichelt: Szenario ${v}. Fläche: Spannweite zwischen Szenario tief und hoch.`);
  const g = (dd) => pct(pj(dd, 'b80', v, j), pj(dd, 'b80', v, S.meta.jahr));
  const rows = [{ label: name, v: g(d), cls: 'c-me', bold: true }, { label: `Bezirk ${ctx.r.bn}`, v: g(dB), cls: 'c-bez' }, { label: `Kanton ${ctx.ktName}`, v: g(dK), cls: 'c-kt' }, { label: 'Schweiz', v: g(dCH), cls: 'c-ch' }]
    .map((x) => ({ ...x, text: sign(x.v) }));
  body += fig(hbars(rows, { label: `Veränderung der Zahl der Menschen ab 80, ${S.meta.jahr}–${j} (Szenario ${v})` }));
  const bev0 = pj(d, 'bev', v, S.meta.jahr); const bevj = pj(d, 'bev', v, j);
  body += `<p>Die Gesamtbevölkerung entwickelt sich im selben Szenario um ${sign(pct(bevj, bev0))} auf rund ${rp(bevj)}. ${pct(k.b80j, k.b80) > pct(bevj, bev0) + 5 ? 'Der Anteil der Hochbetagten steigt also deutlich.' : ''} Die Rechnung übernimmt die Entwicklung des Kantons nach Alter und Geschlecht; eigene Pläne der Gemeinde (Bauzonen, neue Wohnungen) sind nicht berücksichtigt.</p>`;
  if (ctx.small) body += `<p class="warn">${esc(name)} hat weniger als ${fmtInt(S.meta.report.small)} Einwohnerinnen und Einwohner. Die Prognose ist hier eine grobe Schätzung.</p>`;
  // nursing-home need: placeholder
  const need = pj(d, 'aph', v, j); const today = P.aph_heute || 0;
  body += `<div class="phbox"><span class="ek">Platzhalter – nicht für Planungsentscheide</span><p><b>Pflegeheimplätze ${j}.</b> Würden Menschen ab 80 Pflegeheime gleich häufig nutzen wie ${S.meta.jahr} im Kanton ${esc(ctx.ktName)}, bräuchte es ${j} für die Bevölkerung von ${esc(name)} rund <b>${rp(need)} Plätze</b>${today ? `; heute stehen in der Gemeinde ${fmtInt(today)} Plätze` : '; die Gemeinde hat heute kein eigenes Heim'}.</p><p class="small">${esc(ph.grenzen)} Das Modell des Projekts ersetzt diese Rechnung.</p></div>`;
  if (full) {
    const yr = String(S.meta.jahr); const pyr = P.pyr[v];
    const b = (arr) => [sum(arr, 0, 3), sum(arr, 4, 12), sum(arr, 13, 15), sum(arr, 16, 20)];
    const now = b(pyr[yr]); const fut = pyr[String(j)] ? b(pyr[String(j)]) : null;
    if (fut) body += fig(groupedBars(['0–19', '20–64', '65–79', '80+'].map((l, i) => ({ label: l, items: [{ name: yr, v: now[i], cls: 'c-ch soft', text: fmtInt(Math.round(now[i])) }, { name: String(j), v: fut[i], cls: 'c-me', text: `rund ${rp(fut[i])}` }] })),
      { label: `Bevölkerung nach Altersgruppen, ${yr} und ${j} (Szenario ${v})`, legend: [{ name: yr, cls: 'c-ch soft' }, { name: String(j), cls: 'c-me' }] }));
    const mf = P.pyr_mf && P.pyr_mf[v];
    if (mf && mf[String(j)]) body += fig(pyramid(P.groups, mf[String(j)], mf[yr], { label: `Altersaufbau ${j} (Szenario ${v}) und ${yr}: Anteil jeder Altersgruppe in %`, aName: `${name} ${j}`, refName: `${name} ${yr}` }),
      `Balken: ${j}, Männer links, Frauen rechts; Linie: ${yr}.`);
    const aq = (arr) => (sum(arr, 13, 20) / sum(arr, 4, 12)) * 100;
    body += `<table class="tab"><caption>Szenarien im Vergleich, ${esc(name)} ${j}</caption><thead><tr><th></th><th class="n">${yr}</th>${S.meta.prog.variants.map((vv) => `<th class="n">BFS ${vv}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Bevölkerung</td><td class="n">${fmtInt(pj(d, 'bev', v, yr))}</td>${S.meta.prog.variants.map((vv) => `<td class="n">${rp(pj(d, 'bev', vv, j))}</td>`).join('')}</tr>
      <tr><td>Menschen ab 65</td><td class="n">${fmtInt(pj(d, 'b65', v, yr))}</td>${S.meta.prog.variants.map((vv) => `<td class="n">${rp(pj(d, 'b65', vv, j))}</td>`).join('')}</tr>
      <tr><td>Menschen ab 80</td><td class="n">${fmtInt(pj(d, 'b80', v, yr))}</td>${S.meta.prog.variants.map((vv) => `<td class="n">${rp(pj(d, 'b80', vv, j))}</td>`).join('')}</tr>
      <tr><td>Anteil 80+</td><td class="n">${num((pj(d, 'b80', v, yr) / pj(d, 'bev', v, yr)) * 100, 1)} %</td>${S.meta.prog.variants.map((vv) => `<td class="n">${num((pj(d, 'b80', vv, j) / pj(d, 'bev', vv, j)) * 100, 1)} %</td>`).join('')}</tr>
      <tr><td>Altersquotient</td><td class="n">${num(aq(P.pyr[v][yr]), 1)}</td>${S.meta.prog.variants.map((vv) => `<td class="n">${P.pyr[vv][String(j)] ? num(aq(P.pyr[vv][String(j)]), 1) : '–'}</td>`).join('')}</tr>
      <tr class="ph"><td>Pflegeheimplätze (Platzhalter)</td><td class="n">${fmtInt(today)}</td>${S.meta.prog.variants.map((vv) => `<td class="n">${rp(pj(d, 'aph', vv, j))}</td>`).join('')}</tr></tbody></table>`;
    body += `<table class="tab"><caption>Menschen ab 80 nach Zieljahr (Szenario ${v})</caption><thead><tr><th></th>${S.meta.prog.years.map((y) => `<th class="n">${y}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Anzahl</td>${S.meta.prog.years.map((y) => `<td class="n">${rp(pj(d, 'b80', v, y))}</td>`).join('')}</tr>
      <tr><td>Veränderung</td>${S.meta.prog.years.map((y) => `<td class="n">${sign(pct(pj(d, 'b80', v, y), k.b80))}</td>`).join('')}</tr></tbody></table>`;
    body += `<p class="small">Annahmen der Variante: ${esc(m.annahmen)} Grenzen: ${esc(m.grenzen)}</p>`;
  }
  return { lead, body };
}

// ------------------------------------------------------------------ 7 · Vergleich mit ähnlichen Gemeinden
export function vergleich(ctx) {
  const { name, id, v, j, P } = ctx;
  const gde = S.regions.filter((x) => x.e === 'GDE' && x.kt === ctx.r.kt);
  const peers = groupMembers('size', id);
  const g80j = (x) => pct(pval(P, 'p_b80', x, v, j), pval(P, 'p_b80', x, v, P.years[0]));
  const defs = [
    ['a80', 'Anteil 80+', (x) => val('a80', x), (x) => `${num(x, 1)} %`],
    ['g80', `Veränderung 80+ seit ${S.meta.alter_jahre[0]}`, (x) => val('g80', x), (x) => sign(x)],
    ['p_b80', `Veränderung 80+ bis ${j} (Szenario ${v})`, g80j, (x) => sign(x)],
    ['al65', '65+ allein lebend', (x) => val('al65', x), (x) => `${num(x, 1)} %`],
    ['aph_pl80', 'Heimplätze pro 1000 80+', (x) => val('aph_pl80', x), (x) => num(x)],
    ['spx_kl65', 'Spitex-Klient/innen pro 1000 65+', (x) => val('spx_kl65', x), (x) => num(x)],
  ];
  const rows = defs.map(([, label, f, fv]) => {
    const all = gde.map((x) => f(x.id)); const me = f(id);
    const ranked = all.filter((x) => x != null).sort((a, b) => b - a);
    return { label, all, peers: peers.map(f), me, kt: f(ctx.kt), fmtV: fv, note: me == null ? 'kein Wert' : `Rang ${ranked.indexOf(me) + 1} von ${ranked.length}` };
  }).filter((r) => r.me != null);
  const a80r = rows[0];
  const lead = `Beim Anteil der Menschen ab 80 liegt ${esc(name)} unter den ${a80r.all.filter((x) => x != null).length} Gemeinden des Kantons ${esc(ctx.ktName)} auf <b>${a80r.note}</b> (Rang 1 = höchster Anteil).`;
  const body = `<div class="dleg"><span><i class="d-me"></i>${esc(name)}</span><span><i class="d-peer"></i>ähnliche Grösse im Kanton (${peers.length})</span><span><i class="d-all"></i>alle Gemeinden des Kantons</span><span><i class="d-kt"></i>Kanton</span></div>`
    + fig(dotStrip(rows), `Ähnliche Grösse: die ${peers.length} Gemeinden des Kantons mit der ähnlichsten Einwohnerzahl (${peers.map((p) => esc(S.byId.get(p).n)).join(', ')}). Rang 1 = höchster Wert.`);
  return { lead, body };
}

// ------------------------------------------------------------------ 8 · Fragen für die Planung (rule-based, neutral)
export function planung(ctx) {
  const { name, id, d, v, j, full } = ctx; const R = S.meta.report.rules; const k = keyNumbers(ctx);
  const Q = [];
  Q.push({ p: 10, q: `Wie bereitet sich ${esc(name)} darauf vor, dass ${j} rund ${rp(k.b80j)} Menschen ab 80 hier leben?`,
    why: `Gemäss BFS-Szenario ${v} ${k.g80j >= R.grow80 ? 'wächst ihre Zahl stark' : 'verändert sich ihre Zahl'}: ${sign(k.g80j)} gegenüber heute (${fmtInt(k.b80)}).` });
  const need = pj(d, 'aph', v, j);
  if (d.aph && d.aph.heime) Q.push({ p: 9, q: `Reichen die ${fmtInt(d.aph.plaetze)} Pflegeheimplätze in ${esc(name)} – zusammen mit den Heimen der Region – auch ${j}?`,
    why: `Bei gleicher Nutzung wie heute ergäbe sich rechnerisch ein Bedarf von rund ${rp(need)} Plätzen für die eigene Bevölkerung (Platzhaltermodell). Heime versorgen auch Nachbargemeinden.` });
  else Q.push({ p: 9, q: `Mit welchen Pflegeheimen der Region ist die Versorgung der Einwohnerinnen und Einwohner von ${esc(name)} geregelt – und reicht das ${j}?`,
    why: `${esc(name)} hat kein eigenes Heim. Bei gleicher Nutzung wie heute bräuchte die Bevölkerung ${j} rechnerisch rund ${rp(need)} Plätze (Platzhaltermodell).` });
  const al = val('al65', id); const alk = val('al65', ctx.kt);
  if (al != null && alk != null) Q.push({ p: al - alk >= R.alone_pp ? 8 : 4, q: `Wie werden die ${num(al, 1)} % allein lebenden Menschen ab 65 im Alltag erreicht und unterstützt?`,
    why: `${al - alk >= R.alone_pp ? 'Der Anteil liegt über' : 'Der Anteil liegt im Bereich'} dem Kanton (${num(alk, 1)} %). Allein lebende Menschen brauchen bei Krankheit früher Hilfe von aussen.` });
  const P = d.prog; const yr = String(S.meta.jahr);
  const aq = (arr) => (sum(arr, 13, 20) / sum(arr, 4, 12)) * 100;
  if (P.pyr[v][String(j)]) {
    const a0 = aq(P.pyr[v][yr]); const a1 = aq(P.pyr[v][String(j)]);
    Q.push({ p: a1 - a0 >= R.aq_pp ? 7 : 3, q: 'Wer leistet künftig Pflege, Betreuung und Freiwilligenarbeit?',
      why: `Auf 100 Personen im Erwerbsalter kommen ${j} rund ${num(a1)} Personen ab 65 – heute sind es ${num(a0)}.` });
  }
  const hr = heimRef(ctx); const gh = val('aph_g_pl80', hr.id);
  if (gh != null && gh <= -15) Q.push({ p: 7, q: `Die Zahl der Pflegeheimplätze hält ${hr.txt} nicht mit der Zahl der Hochbetagten Schritt – welche Angebote fangen das auf?`,
    why: `Seit ${S.meta.alter_jahre[0]} sind die Plätze pro 1000 Menschen ab 80 ${hr.txt} um ${num(Math.abs(gh))} % gesunken (Kanton ${sign(val('aph_g_pl80', ctx.kt))}). Mehr Pflege zu Hause, betreutes Wohnen oder Heime der Region können das ausgleichen.` });
  const s = val('spx_kl65', id); const sk = val('spx_kl65', ctx.kt);
  if (s == null) Q.push({ p: 5, q: `Welche Spitex-Organisation versorgt ${esc(name)}, und wächst ihr Angebot mit dem Bedarf?`, why: 'In der Gemeinde hat keine Spitex-Organisation ihren Sitz; ihre Leistungen erscheinen in der Statistik bei der Nachbargemeinde.' });
  else if (sk && Math.abs(s / sk - 1) >= R.spx_rel) Q.push({ p: 6, q: s < sk ? 'Weshalb erreicht die Spitex hier weniger ältere Menschen als im Kanton?' : 'Ist das gut ausgebaute Spitex-Angebot auch für den wachsenden Bedarf gerüstet?',
    why: `${num(s)} von 1000 Menschen ab 65 sind Spitex-Klient/innen von Organisationen mit Sitz in der Gemeinde, im Kanton ${num(sk)}. Mögliche Gründe: Angebot, Bedarf oder Sitz der Organisationen.` });
  const sel = Q.sort((a, b) => b.p - a.p).slice(0, full ? 5 : 3);
  return {
    lead: `${sel.length} Fragen, die sich aus den Zahlen für ${esc(name)} ergeben.`,
    body: `<ol class="qs">${sel.map((x) => `<li><p class="q">${x.q}</p><p class="why">${x.why}</p></li>`).join('')}</ol><p class="small">${esc(S.meta.report.disclaimer)}</p>`,
  };
}

// ------------------------------------------------------------------ 9 · Daten und Methode
export function methode(ctx, usedSrc) {
  const { name, id, v, j, full } = ctx; const R = S.meta.report;
  const keys = [...new Set([...usedSrc, 'gemeinden', 'swisstopo'])];
  let body = `<table class="tab src-tab"><caption>Datenquellen</caption><thead><tr><th>Daten</th><th>Herausgeber</th><th>Stand</th><th>Verwendet für</th></tr></thead><tbody>${keys.map((k) => {
    const s = S.meta.sources[k]; if (!s) return '';
    const link = s.url ? `<a href="${esc(s.url)}">${esc(s.name)}</a>` : esc(s.name);
    return `<tr><td>${link}${s.url_method && !s.url_method.startsWith('#') ? ` · <a href="${esc(s.url_method)}">${esc(s.method_label || 'Methode')}</a>` : ''}</td><td>${esc(s.publisher)}</td><td>${esc(s.year)}</td><td>${esc(s.use)}</td></tr>`;
  }).join('')}</tbody></table>`;
  if (usedSrc.includes('bfs_szen')) {
    const m = model('bfs2025', v); const ph = model('aph_dummy', v);
    const box = (x, cls) => `<div class="decl ${cls}"><span class="ek">${x.status === 'platzhalter' ? 'Platzhalter-Prognose' : 'Prognose'}</span><h4>${esc(x.name)}</h4><dl>
      <dt>Variante</dt><dd>${esc(x.variante)}${x.code && !x.variante.includes(x.code) ? ` (${esc(x.code)})` : ''}</dd>
      <dt>Herausgeber</dt><dd>${esc(x.herausgeber)}, Publikation ${x.publikation}, Basisjahr ${x.basisjahr}, Horizont ${x.horizont}</dd>
      <dt>Zieljahr im Bericht</dt><dd>${j}</dd>
      <dt>Annahmen</dt><dd>${esc(x.annahmen)}</dd>
      <dt>Regionalisierung</dt><dd>${esc(x.regionalisierung)}</dd>
      <dt>Grenzen</dt><dd>${esc(x.grenzen)}</dd>
      <dt>Verweise</dt><dd>${x.link_daten ? `<a href="${esc(x.link_daten)}">Daten</a> · ` : ''}${x.link_methode ? `<a href="${esc(x.link_methode)}">Methode</a>` : ''}${x.link_regionalisierung ? ` · <a href="${esc(x.link_regionalisierung)}">Regionalisierung (HSLU)</a>` : ''}</dd></dl></div>`;
    body += `<div class="two decls">${box(m, '')}${box(ph, 'ph')}</div>`;
  }
  body += `<h3>Begriffe</h3><dl class="defs">${R.definitions.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
  body += `<h3>Rundung und Raumbezug</h3><p>${esc(R.rounding)} Gemeinden nach dem Stand des amtlichen Gemeindeverzeichnisses; Bezirk und Kanton nach der heutigen Einteilung. Pflegeheime und Spitex-Organisationen zählen in der Gemeinde ihres Standorts.</p>`;
  if (full) {
    const rows = S.meta.themen.flatMap((t) => t.sub.flatMap((sub) => S.meta.indicators.filter((i) => i.sub === sub.id && i.src !== 'bfs_szen' && i.src !== 'aph_dummy')
      .map((i) => ({ t: `${t.label} › ${sub.label}`, i }))));
    let last = '';
    body += `<h3 class="annex">Anhang: alle Kennzahlen für ${esc(name)}</h3><table class="tab annex-tab"><thead><tr><th>Kennzahl</th><th class="n">${esc(name)}</th><th class="n">Bezirk</th><th class="n">Kanton</th><th class="n">Schweiz</th></tr></thead><tbody>${rows.map(({ t, i }) => {
      const head = t !== last ? `<tr class="grp"><td colspan="5">${esc(t)}</td></tr>` : ''; last = t;
      const c = (x) => `<td class="n">${fmt(val(i.id, x), i)}</td>`;
      return `${head}<tr><td>${esc(i.short)} <span class="u">${esc(i.unit)}</span></td>${c(id)}${c(ctx.r.bez)}${c(ctx.kt)}${c('CH')}</tr>`;
    }).join('')}</tbody></table>`;
  }
  return { lead: `Dieser Bericht stützt sich auf ${keys.length} Datensätze. Beobachtete Werte reichen bis ${S.meta.jahr}; alle Werte danach sind Szenario-Rechnungen${usedSrc.includes('bfs_szen') ? ` (${v === 'mittel' ? 'Referenzszenario' : 'Szenario ' + v}, Zieljahr ${j})` : ''}.`, body };
}
