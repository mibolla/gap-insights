// Landing page: hero (search, rotating facts, map), scroll story, choice of entry, compact sources.
import { S, val, region, detail, fmtInt, fmt, fmtUnit, quantiles, classOf, plusMinus, prefs, dataUrl, regionLabel, wappen } from './store.js?v=20261115174328';

/** a clicked Gemeinde → the region of the preferred level («Ebene» in the top bar) */
const toLevel = (id) => {
  const r = region(id); const e = prefs().ebene || 'GDE';
  if (!r || r.e !== 'GDE' || e === 'GDE') return id;
  return e === 'BEZ' ? r.bez : e === 'KT' ? `KT:${r.kt}` : 'CH';
};
import { createMap, legendHTML, reduced } from './map.js?v=20261115174328';
import { omnibox } from './search.js?v=20261115174328';
import { tagpflegeChapter, tagpflegeSteps } from './tagpflege.js?v=20261115174328';
import { esc, main } from './ui.js?v=20261115174328';
import { loadProg, pval, roundProg } from './prog.js?v=20261115174328';

let cleanup = [];
export function teardown() { cleanup.forEach((f) => f()); cleanup = []; }

/** region name for map tooltips */
function tipName(r) {
  if (r.e === 'GDE') return `<b>${esc(r.n)}</b> (${r.kt})`;
  if (r.e === 'BEZ') return `<b>Bezirk ${esc(r.n)}</b> (${r.kt})`;
  return `<b>Kanton ${esc(r.n)}</b>`;
}

/** colour the map by an indicator; setTip (optional) receives a tooltip showing that indicator */
function colourBy(map, indId, level = 'gde', setTip = null) {
  map.clear(); map.setLevel(level);
  const ids = S.regions.filter((r) => r.e === (level === 'gde' ? 'GDE' : level === 'kt' ? 'KT' : 'BEZ')).map((r) => r.id);
  const vals = ids.map((id) => val(indId, id));
  const br = quantiles(vals);
  map.choropleth(new Map(ids.map((id, k) => [id, classOf(vals[k], br)])));
  const i = S.ind.get(indId);
  if (setTip) setTip((id) => { const r = region(id); return r ? `${tipName(r)} · ${esc(i.short)}: ${i.unit.startsWith('pro') ? fmt(val(indId, id), i) : fmtUnit(val(indId, id), i)}` : ''; });
  return legendHTML(br, (x) => fmt(x, i) + (i.unit === '%' ? ' %' : ''), i.short);
}

export function render() {
  teardown();
  const M = S.meta; const [y0, y1] = M.alter_jahre;
  const ch = (k) => val(k, 'CH');
  const last = prefs().last;
  const lastR = last && region(last);
  const themes = M.themen.map((t) => `<div class="t-block"><div class="t-name"><span class="dot ${t.color}"></span>${esc(t.label)}</div>
      <div class="chips">${t.sub.map((s) => (s.soon ? `<span class="chip soon" title="in Vorbereitung">${esc(s.label)}</span>` : `<a class="chip" href="#/thema/${s.id}">${esc(s.label)}</a>`)).join('')}</div></div>`).join('');
  const qs = M.questions.map((q) => `<li><a href="#/frage/${q.id}">${esc(q.text)}</a></li>`).join('');
  const srcs = Object.values(M.sources).map((s) => `<div class="src-row"><span class="pub">${esc(s.publisher)}</span>
      <span>${esc(s.name)} · <span class="num">${esc(s.year)}</span><br><span class="use">${esc(s.use)}</span></span>
      <a href="${s.url}" target="_blank" rel="noopener" aria-label="${esc(s.name)} (öffnet neues Fenster)">↗</a></div>`).join('');

  // scroll-driven chapters: each step is its own card; scrolling to it calls ctl.go(step)
  const ageCh = { n: '', title: 'Die Schweiz wird älter', big: '<span class="age-year" data-age="year">2012</span>',
      text: 'Drei Jahre pro Sekunde: Jede Gemeinde färbt sich nach dem Anteil der Menschen ab 80 – bis 2024 beobachtet, danach das mittlere BFS-Szenario. Je dunkler, desto älter. Weiter scrollen: die Kantone im Rennen.',
      extra: `<p class="age-beat" data-age="beat"></p>
        <div data-age="ktblock" hidden><div class="age-counters"><div><b class="num" data-age="chv">–</b><span>Anteil ab 80 in der Schweiz</span></div><div><b class="num" data-age="grow">–</b><span>Zunahme seit 2012, in Prozentpunkten</span></div></div></div>
        <div data-age="gdeblock"><div class="age-counters"><div><b class="num" data-age="n">–</b><span>Gemeinden mit mindestens 10 % ab 80</span></div><div><b class="num" data-age="med">–</b><span>Anteil ab 80 in der mittleren Gemeinde</span></div></div>
        <div class="age-mini"><span class="small muted">Gemeinden mit mindestens 10 % ab 80</span><div data-age="chart"></div></div></div>`,
      src: 'BFS STATPOP 2012–2024 · BFS-Szenarien 2025–2055, mittel, regionalisiert (HSLU)', steps: [{ title: 'Die Kantone im Rennen', text: 'Die Kantone fliegen aus der Karte in ein Balkenrennen 2012 → 2055 – sortiert nach dem Anteil der Menschen ab 80, mit Spuren alle fünf Jahre. Die violette Linie ist die Schweiz: Start 2012, Marke 2024, Ziel 2055.' }], ctl: {},
      thema: 'alter', q: 'zukunft80', cap: 'Anteil der Menschen ab 80 je Gemeinde, 2012–2055' };
  ageCh.map = (m, t, alive) => ageChapter(m, t, alive, { scope: document.getElementById('story'), stepMode: true, ctl: ageCh.ctl, initStep: () => ageCh.s || 0 });
  const tagCh = { id: 'tag', title: 'Ein Tag Pflege', big: '<span data-tp="visits">0</span>',
    text: `Spitex-Besuche bisher heute. Ein Durchschnittstag im Zeitraffer: Die Pflegeheime leuchten nach ihrem Dienstplan, die Spitex fährt von ihren Standorten zu den Menschen in ihrem Bezirk – und in Nachbarbezirke ohne eigene Spitex – jeder Funke ist ein Besuch. Die Kurven zeigen, wie viele Menschen gerade im Dienst sind.`,
    extra: `<div class="tp-clock" data-tp="clock"></div><div class="tp-duty"><span class="small muted">Im Dienst über 24 Stunden (Personen)</span><div data-tp="duty"></div></div>
      <div class="tp-ctrl"><button class="btn small" type="button" data-tp="play">Pause</button><select data-tp="speed" aria-label="Geschwindigkeit"><option value="48">½ Stunde pro Sekunde</option><option value="24">1 Stunde pro Sekunde</option><option value="12" selected>2 Stunden pro Sekunde</option><option value="6">4 Stunden pro Sekunde</option></select></div>
      <p class="small muted" data-tp="tot"></p>`,
    src: `BAG Kennzahlen Pflegeheime und Spitex ${M.jahr} · BFS Spitex-Statistik 2012–${M.jahr} · BFS STATPOP · Tagesverlauf, Dienstpläne und Wege modelliert`,
    thema: 'inanspruchnahme', q: 'spitex', steps: tagpflegeSteps(), ctl: {}, cap: 'Ein Tag Pflege' };
  tagCh.map = (m, t, alive) => tagpflegeChapter(m, t, alive, { scope: main().querySelector('.story-card[data-ch="tag"]'), setCap: (x) => { const c = document.getElementById('storyCap'); if (c) c.textContent = x; }, ctl: tagCh.ctl, initStep: () => tagCh.s || 0 });
  const chapters = [
    { n: 'Kapitel 1', title: 'Älter werden', big: `${plusMinus(ch('g80'))} %`, text: `So stark ist die Zahl der Menschen ab 80 Jahren in der Schweiz von ${y0} bis ${y1} gewachsen. Der Anteil der Menschen ab 65 beträgt heute ${fmt(ch('a65'), 'a65')} %. Die Karte zeigt den Anteil der über 80-Jährigen in jeder Gemeinde.`,
      src: `BFS STATPOP ${y0}–${y1}`, map: (m, t) => colourBy(m, 'a80', 'gde', t), thema: 'alter', q: 'entwicklung', cap: `Anteil der Menschen ab 80 Jahren, ${y1}` },
    ageCh,
    tagCh,
    { n: 'Kapitel 2', title: 'Allein leben', big: `${fmt(ch('al65'), 'al65')} %`, text: `der Menschen ab 65, die in einem Privathaushalt leben, leben allein. Bei den über 85-Jährigen sind es ${fmt(ch('al85'), 'al85')} %. Das ist wichtig für die Planung von Unterstützung im Alltag.`,
      src: `BFS STATPOP ${M.jahr}, Haushalte`, map: (m, t) => colourBy(m, 'al65', 'gde', t), thema: 'haushalte', q: 'allein', cap: 'Anteil der Menschen ab 65, die allein leben' },
    { n: 'Kapitel 3', title: 'Pflege im Heim', big: fmt(ch('aph_pl80'), 'aph_pl80'), text: `Langzeitplätze in Alters- und Pflegeheimen gibt es in der Schweiz pro 1000 Menschen ab 80. Die Kantone unterscheiden sich stark. Die Punkte zeigen die Heime an ihrem Standort (Grösse = Plätze) – Heime versorgen auch die Nachbargemeinden.`,
      src: `BAG / SOMED ${M.jahr}`, map: (m, t, alive) => { const l = colourBy(m, 'aph_pl80', 'kt', t); heimPoints(m, alive); return l; }, thema: 'inanspruchnahme', q: 'plaetze', cap: 'Pflegeheimplätze pro 1000 Menschen ab 80, nach Kanton' },
    (() => { const H = M.heime; const far = region(H.max_gde);
      return { n: '', title: 'Heime in der Nähe', big: `${fmt(H.anteil_5km, { dec: 1 })} %`,
        text: `der Menschen ab 80 leben in einer Gemeinde, deren Mitte höchstens 5 km vom nächsten Alters- und Pflegeheim entfernt ist. Jeder Punkt ist eines der ${fmtInt(H.heime)} Heime – je grösser, desto mehr Plätze. In ${H.far_gde} Gemeinden sind es mehr als 10 km, am weitesten in ${esc(far ? far.n : '')} (${fmt(H.max_km, { dec: 0 })} km).`,
        src: `BAG / SOMED ${M.jahr} · Standorte: geo.admin.ch (Adressen 2023)`, map: (m, t, alive) => colourHeime(m, t, alive),
        thema: 'inanspruchnahme', q: 'plaetze', cap: 'Alters- und Pflegeheime und Distanz der Gemeinden zum nächsten Heim' }; })(),
    (() => { const P = M.spitaeler;
      return { n: '', title: 'Spitäler', big: `${fmt(P.faelle / 1e6, { dec: 1 })} Mio.`,
        text: `stationäre Fälle haben die ${fmtInt(P.spitaeler)} Spitäler der Schweiz ${M.jahr} behandelt – die Hälfte davon nur ${P.haelfte} Spitäler, allen voran ${esc(P.groesstes)} mit ${fmtInt(P.groesstes_faelle)} Fällen. Die Fläche jeder Blase entspricht den Fällen eines Spitals, die Farbe dem Spitaltyp.`,
        src: `BAG, Kennzahlen der Schweizer Spitäler ${M.jahr} · Standorte: geo.admin.ch (Adressen 2023)`, map: (m, t, alive) => colourSpitaeler(m, t, alive),
        ext: M.sources.kzp.url, extLabel: 'Kennzahlen der Spitäler (BAG)', cap: `Spitäler ${M.jahr} – Blasengrösse: stationäre Fälle pro Jahr` }; })(),
    { n: 'Kapitel 4', title: 'Pflege zu Hause', big: fmt(ch('spx_kl65'), 'spx_kl65'), text: `von 1000 Menschen ab 65 erhalten Leistungen der Spitex. Die Spitex ist für viele die erste Unterstützung, damit sie zu Hause bleiben können. Die Karte zeigt die Kantone.`,
      src: `BAG / Spitex-Statistik ${M.jahr}`, map: (m, t) => colourBy(m, 'spx_kl65', 'kt', t), thema: 'inanspruchnahme', q: 'spitex', cap: 'Spitex-Klientinnen und -Klienten pro 1000 Menschen ab 65, nach Kanton' },
    (() => { const X = M.spitex;
      return { n: '', title: 'Spitex vor Ort', big: `${fmt(X.privat1, { dec: 0 })} %`,
        text: `der Spitex-Klientinnen und -Klienten werden ${M.jahr} von privaten, gewinnorientierten Organisationen betreut – ${X.y0} waren es ${fmt(X.privat0, { dec: 0 })} %. Die gemeinnützigen Spitex betreuen noch ${fmt(X.gemein1, { dec: 0 })} % (${X.y0}: ${fmt(X.gemein0, { dec: 0 })} %). Jede Blase ist eine Organisation, ihre Fläche entspricht den Klientinnen und Klienten.`,
        src: `BAG, Kennzahlen Krankenpflege und Hilfe zu Hause ${X.y0}–${M.jahr} · Standorte: geo.admin.ch (Adressen 2023)`, map: (m, t, alive) => colourSpitex(m, t, alive),
        thema: 'inanspruchnahme', q: 'spitex', cap: `Spitex-Organisationen ${M.jahr} – Blasengrösse: Klientinnen und Klienten` }; })(),
    { n: 'Kapitel 5', title: 'Blick nach vorn', big: `${fmtInt(Math.round(M.prog_ch.mittel.b80['2040'] / 1000) * 1000)}`,
      text: `Menschen ab 80 werden 2040 in der Schweiz leben – gemäss BFS-Referenzszenario (mittel), heute sind es ${fmtInt(Math.round(M.prog_ch.mittel.b80['2024'] / 1000) * 1000)}. Die Karte zeigt die erwartete Zunahme bis 2040 in jeder Gemeinde. Jede Prognose nennt ihr Modell und ihre Variante.`,
      src: 'BFS-Szenarien 2025–2055, regionalisiert (HSLU)', map: (m, t, alive) => colourProg(m, 'p_b80', 2040, 'Zunahme 80+ 2024–2040', t, alive),
      thema: 'alter', q: 'zukunft80', cap: 'Zunahme der Menschen ab 80 bis 2040, BFS mittel (in %)' },
  ];

  main().innerHTML = `
  <section class="hero wrap" aria-labelledby="heroTitle">
    <div class="hero-grid">
      <div class="hero-left">
        <span class="eyebrow">Gesundheit und Alter in der Schweiz</span>
        <div><h1 id="heroTitle">Gesundheit und Alter – <em>Gemeinde für Gemeinde.</em></h1>
        <p class="lead">Kennzahlen zu Bevölkerung, Spitex und Pflegeheimen für alle ${fmtInt(S.regions.filter((r) => r.e === 'GDE').length)} Gemeinden der Schweiz – verständlich und mit Quelle.</p></div>
        <div id="heroSearch"></div>
        <p class="pending small muted" id="pending" hidden></p>
        <div class="examples">Beispiele:
          <a class="chip" href="#/gemeinde/GDE:1103">Sursee</a>
          <a class="chip" href="#/frage/plaetze">Pflegeheimplätze</a>
          <a class="chip" href="#/frage/allein">Wie viele leben allein?</a>
          ${lastR ? `<a class="chip" href="#/gemeinde/${lastR.id}">Zuletzt: ${esc(lastR.n)}</a>` : ''}
        </div>
        <div class="fact" aria-live="polite">
          <p class="fact-text" id="factText"></p>
          <div class="fact-foot"><button type="button" id="factPrev" aria-label="Vorherige Aussage">‹</button><button type="button" id="factNext" aria-label="Nächste Aussage">›</button><span id="factSrc"></span></div>
        </div>
      </div>
      <div class="hero-map">
        <div id="heroMap"></div>
        <div id="heroLegend" class="small"></div>
      </div>
    </div>
    <div class="srcstrip"><span>Daten: BFS · BAG · swisstopo · Stand ${M.jahr} · <a href="#sources">Datengrundlage</a></span><a class="scrollcue" href="#story">↓ Entdecken, was die Daten zeigen</a></div>
  </section>

  <section class="story wrap" id="story" aria-labelledby="storyTitle">
    <div class="story-head"><div><span class="eyebrow">Was die Daten zeigen</span><h2 id="storyTitle">${['Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf'][chapters.length - 3] || chapters.length} Blicke auf das Älterwerden in der Schweiz</h2></div>
      <a class="btn small" href="#choice">Story überspringen →</a></div>
    <div class="story-grid">
      <div class="story-cards">${chapters.map((c, k) => `
        <article class="story-card${k === 0 ? ' active' : ''}${c.steps ? ' has-steps' : ''}" data-k="${k}" data-s="0"${c.id ? ` data-ch="${c.id}"` : ''}>
          <span class="n">Kapitel ${k + 1} von ${chapters.length}${c.steps ? ` · Schritt 1 von ${c.steps.length + 1}` : ''}</span><h3>${c.title}</h3>
          <span class="big num">${c.big}</span><p>${c.text}</p>${c.extra || ''}
          ${c.steps ? `<p class="scrollhint" aria-hidden="true"><span>↓</span> Weiter scrollen – dieses Kapitel hat ${c.steps.length + 1} Schritte</p>` : ''}
          <span class="src">Quelle: ${c.src}</span>
          <div class="exits">${c.thema ? `<a class="btn small" href="#/thema/${c.thema}">Thema ${esc(S.sub.get(c.thema).label)}</a><a class="btn small" href="#/frage/${c.q}">${esc(S.q.get(c.q).text)}</a>
          <button class="btn small primary" type="button" data-us="${c.q}">Und bei uns?</button>` : `<a class="btn small" href="${c.ext}" target="_blank" rel="noopener">${esc(c.extLabel)} ↗</a>`}</div>
        </article>${(c.steps || []).map((st, i) => `
        <article class="story-card step" data-k="${k}" data-s="${i + 1}">
          <span class="n">Kapitel ${k + 1} · Schritt ${i + 2} von ${c.steps.length + 1}</span><h3>${st.title}</h3><p>${st.text}</p>
          ${i < c.steps.length - 1 ? '<p class="scrollhint" aria-hidden="true"><span>↓</span> Weiter scrollen</p>' : '<p class="small muted">Ende des Kapitels – weiter mit dem nächsten Kapitel.</p>'}
        </article>`).join('')}`).join('')}
      </div>
      <div class="story-map"><div class="story-dots" aria-hidden="true">${chapters.map((_, k) => `<span class="${k === 0 ? 'on' : ''}"></span>`).join('')}</div>
        <p class="cap" id="storyCap">${chapters[0].cap}</p><div id="storyMap"></div><div id="storyLegend" class="small"></div></div>
    </div>
  </section>

  <section class="choice wrap" id="choice" aria-labelledby="choiceTitle">
    <h2 id="choiceTitle">Wie möchten Sie einsteigen?</h2>
    <div class="choice-grid">
      <div class="choice-card"><span class="eyebrow">Gemeinde zuerst</span><h3>Meine Gemeinde</h3>
        <p class="muted">Alle Kennzahlen für eine Gemeinde, einen Bezirk oder einen Kanton – mit Vergleich.</p>
        <div id="choiceSearch"></div><a class="btn small" href="#heroTitle">Auf der Karte wählen ↑</a></div>
      <div class="choice-card"><span class="eyebrow">Thema zuerst</span><h3>Ein Thema</h3>${themes}</div>
      <div class="choice-card"><span class="eyebrow">Frage zuerst</span><h3>Eine Frage</h3><ul class="qlist">${qs}</ul></div>
    </div>
  </section>

  <section class="sources wrap" id="sources" aria-labelledby="srcTitle">
    <h2 id="srcTitle">Datengrundlage</h2>
    <div class="src-grid">${srcs}</div>
    <p class="small muted" style="margin-top:12px">Alle Daten sind öffentlich (Open Government Data) und werden für alle Gemeinden gleich aufbereitet. <a href="#/daten">Methodik und Hinweise →</a></p>
  </section>`;

  // ---- search with optional pending question ("Und bei uns?")
  let pendingQ = null;
  const pend = document.getElementById('pending');
  const pickGemeinde = (it) => { location.hash = pendingQ && it.go.startsWith('#/gemeinde/') ? `#/frage/${pendingQ}/${it.go.split('/')[2]}` : it.go; };
  const hero = omnibox(document.getElementById('heroSearch'), { id: 'omniHero', onPick: pickGemeinde });
  omnibox(document.getElementById('choiceSearch'), { id: 'omniChoice', compact: true, placeholder: 'Gemeinde suchen …', filter: (it) => it.go.startsWith('#/gemeinde/') });
  main().querySelectorAll('[data-us]').forEach((b) => b.addEventListener('click', () => {
    pendingQ = b.dataset.us; pend.hidden = false;
    pend.innerHTML = `Wählen Sie Ihre Gemeinde für die Frage „${esc(S.q.get(pendingQ).text)}“ – im Suchfeld oder auf der Karte. <button class="btn small ghost" type="button" id="pendX">Abbrechen</button>`;
    document.getElementById('pendX').onclick = () => { pendingQ = null; pend.hidden = true; };
    document.getElementById('heroTitle').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    setTimeout(() => hero.focus(), 400);
  }));

  // ---- hero map + click card
  const heroEl = document.getElementById('heroMap');
  const map = createMap(heroEl, { onClick: (id, pt) => { const t = toLevel(id); map.select(t === 'CH' || t === id ? null : t, { zoomTo: false }); mapCard(heroEl, t, pt, () => pendingQ); } });
  const onLevel = () => { heroEl.querySelector('.map-card')?.remove(); map.select(null); };
  document.addEventListener('ebene', onLevel); cleanup.push(() => document.removeEventListener('ebene', onLevel));
  // slow ambient drift; paused while the animated entries run, resumed afterwards unless the user has touched the map
  let stopDrift = map.drift(), touched = false;
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => heroEl.addEventListener(ev, () => { touched = true; }, { passive: true }));
  cleanup.push(() => stopDrift());

  // ---- rotating facts linked to the map
  // entries 2 and 3: the animated story «Die Schweiz wird älter» (Gemeinden 2012 → 2055, then the Kanton race) on the hero map
  const AGE_SRC = 'BFS STATPOP 2012–2024 · BFS-Szenario mittel bis 2055';
  const facts = [M.facts[0],
    { mode: 'age', tag: 'Zeitreise', src: AGE_SRC, html: 'Die Schweiz wird älter: <b class="age-y" data-age="year">2012</b> – jede Gemeinde färbt sich nach dem Anteil der Menschen ab 80. Erreicht eine Gemeinde 10 %, leuchtet sie auf.' },
    { mode: 'agebars', tag: 'Zeitreise', src: AGE_SRC, html: 'Die Kantone im Rennen: <b class="age-y" data-age="year">2012</b> – wo leben anteilmässig am meisten Menschen ab 80? Die violette Linie ist die Schweiz.' },
    { mode: 'day', tag: 'Ein Tag Pflege', src: `BAG Kennzahlen Pflegeheime und Spitex ${M.jahr} · Tagesverlauf und Wege modelliert`, html: 'Ein Tag Pflege im Zeitraffer: Die Pflegeheime leuchten nach ihrem Dienstplan, die Spitex fährt von ihren Standorten zu den Menschen in ihrem Bezirk – jeder Funke ist ein Besuch, rund 116’000 an einem Tag.' },
    { mode: 'staff', tag: 'Personal', src: `BAG Kennzahlen Pflegeheime und Spitex ${M.jahr} · BFS STATPOP`, html: 'Wie viel Pflegepersonal gibt es pro 1000 Menschen ab 80? Links die Pflegeheime, rechts die Spitex, je Bezirk – dann fliegen die Kantone in den Vergleich und werden zu ihren Wappen.' },
    ...M.facts.slice(1)];
  let fi = 0; let paused = false;
  const heroSec = main().querySelector('.hero');
  let ageRun = null;                                         // the running hero animation: { alive, ctl }
  const killAge = () => { if (ageRun) { ageRun.alive = false; ageRun = null; if (!touched) { map.reset(); stopDrift = map.drift(); } } };
  cleanup.push(() => { if (ageRun) { ageRun.alive = false; ageRun = null; } });
  const isAge = (f) => f.mode === 'age' || f.mode === 'agebars';
  let staffRun = null;                                       // hero entry «Personal»: staff maps → Kanton scatter (js/tagpflege.js)
  const killStaff = () => { if (staffRun) { staffRun.alive = false; staffRun = null; if (!touched) { map.reset(); stopDrift = map.drift(); } } };
  cleanup.push(() => { if (staffRun) { staffRun.alive = false; staffRun = null; } });
  let dayRun = null;                                         // hero entry «Ein Tag Pflege»: the day over the interactive map (drift and zoom keep working)
  const killDay = () => { if (dayRun) { dayRun.alive = false; dayRun = null; } };
  cleanup.push(killDay);
  const startDay = () => {
    if (dayRun) return;
    map.clear(); map.setLevel('gde'); heroEl.querySelector('.map-card')?.remove(); lEl.innerHTML = '';
    const run = dayRun = { alive: true };
    tagpflegeChapter(map, null, () => run.alive, { overlay: true, legendEl: lEl, onDone: () => { if (dayRun === run) show(fi + 1); } });
  };
  const startStaff = () => {
    if (staffRun) return;
    stopDrift(); map.reset(); heroEl.querySelector('.map-card')?.remove(); map.select(null); lEl.innerHTML = '';
    const run = staffRun = { alive: true };
    tagpflegeChapter(map, null, () => run.alive, { legendEl: lEl, auto: { maps: 5.5, scatter: 10.5 }, onDone: () => { if (staffRun === run) show(fi + 1); } });
  };
  const renderText = (f) => {
    const tag = f.tag || { heute: 'Heute', rueckblick: 'Rückblick', ausblick: 'Prognose' }[f.zeit] || '';
    const cls = f.tag ? 'ausblick anim' : f.zeit;
    tEl.innerHTML = `${tag ? `<span class="ftag ${cls}">${tag}</span> ` : ''}${f.html || (f.go ? `<a href="${f.go}">${esc(f.text)}</a>` : esc(f.text))}`;
    sEl.textContent = `Quelle: ${f.src} · ${fi + 1}/${facts.length}`;
  };
  const showText = (k) => { fi = k; tEl.classList.add('fade'); setTimeout(() => { renderText(facts[fi]); tEl.classList.remove('fade'); }, reduced() ? 0 : 350); };
  const startAge = (bars) => {
    if (ageRun) { if (bars) ageRun.ctl.toBars?.(); else ageRun.ctl.toMap?.(); return; }
    stopDrift(); map.reset(); heroEl.querySelector('.map-card')?.remove(); map.select(null); lEl.innerHTML = '';
    const run = ageRun = { alive: true, ctl: {} };
    ageChapter(map, null, () => run.alive, { scope: heroSec, rowMin: 11, speed: 5, ctl: run.ctl,
      onPhase: (ph) => { if (ageRun !== run) return; const want = ph === 'bars' ? 'agebars' : 'age'; if (facts[fi].mode !== want) showText(facts.findIndex((x) => x.mode === want)); },
      onDone: () => { if (ageRun === run) show(fi + 1); } })
      .then((h) => { if (ageRun !== run) return; lEl.innerHTML = h; if (bars) setTimeout(() => run.ctl.toBars?.(), 60); });
  };
  const tEl = document.getElementById('factText'); const sEl = document.getElementById('factSrc'); const lEl = document.getElementById('heroLegend');
  const show = (k) => {
    fi = (k + facts.length) % facts.length; const f = facts[fi];
    if (!isAge(f)) killAge();
    if (f.mode !== 'staff') killStaff();
    if (f.mode !== 'day') killDay();
    tEl.classList.add('fade');
    setTimeout(() => {
      renderText(f); tEl.classList.remove('fade');
      if (isAge(f)) startAge(f.mode === 'agebars');
      else if (f.mode === 'staff') startStaff();
      else if (f.mode === 'day') startDay();
      else if (f.mode === 'set') {
        map.clear(); map.setLevel('gde'); map.highlight(f.set, { prog: !!f.prog });
        lEl.innerHTML = `<div class="legend"><span class="dot ${f.prog ? 'prog' : 'blue'}"></span> ${fmtInt(f.set.length)} Gemeinden hervorgehoben${f.prog ? ' (Prognose, BFS mittel)' : ''}</div>`;
      }
      else if (f.mode === 'ktval') {   // forecast per Kanton (e.g. growth of 80+ until 2040)
        map.clear(); map.setLevel('kt');
        const ids = Object.keys(f.vals); const vals = ids.map((k) => f.vals[k]); const br = quantiles(vals);
        map.choropleth(new Map(ids.map((k, n) => [k, classOf(vals[n], br)])));
        lEl.innerHTML = legendHTML(br, (x) => `+${fmt(x, { dec: 0 })} %`, 'Zunahme 80+ bis 2040 (Prognose, BFS mittel)');
      }
      else if (f.mode === 'spitex') {   // Spitex organisations as bubbles (as in the story chapter «Spitex vor Ort»)
        const k = fi; lEl.innerHTML = '';
        colourSpitex(map, null, () => fi === k).then((h) => { if (fi === k) lEl.innerHTML = h; });
      }
      else if (f.mode === 'spitaeler') {   // Spitäler as bubbles (as in the story chapter «Spitäler»)
        const k = fi; lEl.innerHTML = '';
        colourSpitaeler(map, null, () => fi === k).then((h) => { if (fi === k) lEl.innerHTML = h; });
      }
      else if (f.mode === 'heime') {   // Pflegeheime as animated points (as in the story chapter «Heime in der Nähe»)
        const k = fi; lEl.innerHTML = '';
        colourHeime(map, null, () => fi === k).then((h) => { if (fi === k) lEl.innerHTML = h; });
      }
      else if (f.mode === 'scale') lEl.innerHTML = colourBy(map, f.ind);
      else lEl.innerHTML = colourBy(map, f.ind, 'kt');
    }, reduced() ? 0 : 350);
  };
  show(0);
  document.getElementById('factPrev').onclick = () => show(fi - 1);
  document.getElementById('factNext').onclick = () => show(fi + 1);
  const box = tEl.closest('.fact');
  box.addEventListener('mouseenter', () => { paused = true; }); box.addEventListener('mouseleave', () => { paused = false; });
  box.addEventListener('focusin', () => { paused = true; }); box.addEventListener('focusout', () => { paused = false; });
  if (!reduced()) { const t = setInterval(() => { if (!paused && !ageRun && !staffRun && !dayRun && !document.hidden) show(fi + 1); }, 7000); cleanup.push(() => clearInterval(t)); }

  // ---- scroll story: sticky map recoloured per chapter
  let storyTip = null;                                    // tooltip of the active chapter (shows its indicator)
  let dead = false; cleanup.push(() => { dead = true; });  // stops chapter animations when leaving the page
  const smap = createMap(document.getElementById('storyMap'), { onClick: (id) => { location.hash = `#/gemeinde/${toLevel(id)}`; },
    tip: (id) => (storyTip ? storyTip(id) : '') });
  const sLeg = document.getElementById('storyLegend'); const sCap = document.getElementById('storyCap');
  const dots = main().querySelectorAll('.story-dots span'); const cards = main().querySelectorAll('.story-card');
  let gen = 0;                                            // each activation gets its own generation; older ones stop
  const activate = (k) => {
    if (k === shown) return;
    const my = ++gen;
    dots.forEach((d, j) => d.classList.toggle('on', j === k));
    sCap.textContent = chapters[k].cap;
    storyTip = null; shown = k;
    const leg = chapters[k].map(smap, (f) => { if (shown === k) storyTip = f; }, () => my === gen && !dead);
    if (leg && typeof leg.then === 'function') leg.then((h) => { if (shown === k) sLeg.innerHTML = h; });   // forecast maps load their data first
    else sLeg.innerHTML = leg;
  };
  let shown = -1;
  activate(0);
  const onCard = (el) => {   // a card reached the middle of the screen: its chapter, and in scroll-driven chapters its step
    const k = +el.dataset.k, st = +(el.dataset.s || 0);
    cards.forEach((c) => c.classList.toggle('active', c === el));
    if (k !== shown) activate(k);
    const c = chapters[k]; c.s = st; c.ctl?.go?.(st);
  };
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) onCard(e.target); }), { rootMargin: '-45% 0px -45% 0px' });
  cards.forEach((c) => io.observe(c)); cleanup.push(() => io.disconnect());
}

async function mapCard(container, id, pt, pendingQ) {
  container.querySelector('.map-card')?.remove();
  const r = region(id); if (!r) return;
  if (pendingQ()) { location.hash = `#/frage/${pendingQ()}/${id}`; return; }
  const d = await detail(id);
  const b0 = d.ts.b80[0]; const b1 = d.ts.b80[d.ts.b80.length - 1];
  const card = document.createElement('div'); card.className = 'map-card';
  const left = Math.min(Math.max(8, pt.x - 150), container.clientWidth - 308); const top = Math.min(pt.y + 12, container.clientHeight - 190);
  card.style.left = `${left}px`; card.style.top = `${Math.max(8, top)}px`;
  card.innerHTML = `<button class="close" type="button" aria-label="Schliessen">×</button>
    <h4>${esc(r.e === 'GDE' ? r.n : regionLabel(id, false))}${r.kt && r.e !== 'KT' ? ` <span class="muted small">(${r.kt})</span>` : ''}</h4>
    <p class="small num">${fmtInt(r.pop)} Einwohner · über 80: ${fmtInt(b1)} <span class="muted">(${plusMinus(b0 ? (b1 / b0 - 1) * 100 : 0)} % seit ${d.ts.y[0]})</span></p>
    <div class="actions"><a class="btn small primary" href="#/gemeinde/${id}">Portrait öffnen →</a></div>
    <div class="small"><span class="muted">Fragen zu ${esc(r.n)}:</span><br>
      <a href="#/frage/allein/${id}">Wie viele leben allein?</a> · <a href="#/frage/plaetze/${id}">Genug Heimplätze?</a> · <a href="#/frage/entwicklung/${id}">Entwicklung 80+</a></div>`;
  card.querySelector('.close').onclick = () => card.remove();
  container.appendChild(card);
  card.querySelector('a').focus({ preventScroll: true });
}


/** Pflegeheime as points (size = places) over the Gemeinden shaded by the distance to the nearest Heim; returns the legend */
let HEIME = null;
const loadHeime = () => (HEIME = HEIME || fetch(dataUrl('heime.json')).then((r) => r.json()));
const abbr = (x, n = 40) => (x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x);
async function colourHeime(map, setTip = null, alive = () => true) {
  const H = await loadHeime();
  if (!alive()) return '';
  const KM = [2, 5, 10]; const cls = (d) => (d == null ? -1 : KM.filter((b) => d > b).length);
  const ids = S.regions.filter((r) => r.e === 'GDE').map((r) => r.id);
  map.clear(); map.setLevel('gde');
  map.choropleth(new Map(ids.map((id) => [id, cls(H.d[id])])));
  // approximate locations first, then large before small: exact and small Heime stay on top and can be hovered
  const order = H.x.map((_, k) => k).sort((i, j) => (H.a[j] - H.a[i]) || (H.p[j] - H.p[i]));
  map.points(order.map((k) => ({ x: H.x[k], y: H.y[k], r: 1.3 + Math.sqrt(H.p[k]) * 0.26, id: H.g[k], cls: H.a[k] ? 'approx' : '',
    tip: `<b>${esc(abbr(H.n[k]))}</b><br>${esc(H.o[k])} · ${fmtInt(H.p[k])} Plätze${H.a[k] ? '<br><span class="muted">Lage ungefähr (Gemeindemitte)</span>' : ''}` })), { animate: true });
  if (setTip) setTip((id) => { const r = region(id); const d = H.d[id]; return r ? `${tipName(r)} · nächstes Heim ${d == null ? '–' : `${fmt(d, { dec: 1 })} km`}` : ''; });
  const ramp = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)'].map((c) => `<span style="background:${c}"></span>`).join('');
  return `<div class="legend"><span>Distanz zum nächsten Heim</span><span>bis 2 km</span><span class="ramp">${ramp}</span><span>über 10 km</span>
    <span class="pt-key"><i></i> Heim (Grösse = Plätze)</span><span class="pt-key"><i class="ring"></i> Lage ungefähr</span></div>`;
}

/** the real Heim locations as small points over another map (chapter «Pflege im Heim») */
async function heimPoints(map, alive = () => true) {
  const H = await loadHeime(); if (!alive()) return;
  const order = H.x.map((_, k) => k).sort((i, j) => (H.a[j] - H.a[i]) || (H.p[j] - H.p[i]));
  map.points(order.map((k) => ({ x: H.x[k], y: H.y[k], r: 1 + Math.sqrt(H.p[k]) * 0.2, id: H.g[k], cls: H.a[k] ? 'approx' : '',
    tip: `<b>${esc(abbr(H.n[k]))}</b><br>${esc(H.o[k])} · ${fmtInt(H.p[k])} Plätze${H.a[k] ? '<br><span class="muted">Lage ungefähr (Gemeindemitte)</span>' : ''}` })));
}

/** Spitäler as bubbles: area = stationäre Fälle, colour = Spitaltyp; returns the legend */
let SPITAL = null;
const loadSpitaeler = () => (SPITAL = SPITAL || fetch(dataUrl('spitaeler.json')).then((r) => r.json()));
async function colourSpitaeler(map, setTip = null, alive = () => true) {
  const P = await loadSpitaeler();
  if (!alive()) return '';
  map.clear(); map.setLevel('gde');
  // largest first (data are sorted by cases), so small Spitäler stay on top and can be hovered
  map.points(P.x.map((x, k) => ({ x, y: P.y[k], r: Math.max(1.6, Math.sqrt(P.c[k]) * 0.11), id: P.g[k], cls: `sp sp-${P.t[k]}${P.a[k] ? ' approx' : ''}`,
    tip: `<b>${esc(abbr(P.n[k]))}</b><br>${esc(P.o[k])} · ${fmtInt(P.c[k])} stationäre Fälle${P.b[k] ? ` · ${fmtInt(P.b[k])} Betten` : ''}`
      + `<br><span class="muted">${esc(P.gruppen[P.t[k]])}${P.st[k] > 1 ? ` · ${P.st[k]} Standorte, Fälle aller Standorte` : ''}${P.a[k] ? ' · Lage ungefähr' : ''}</span>` })), { animate: true });
  if (setTip) {
    const per = new Map(); P.g.forEach((g, k) => { const v = per.get(g) || [0, 0]; per.set(g, [v[0] + 1, v[1] + P.c[k]]); });
    setTip((id) => { const r = region(id); if (!r) return ''; const v = per.get(id);
      return `${tipName(r)} · ${v ? `${v[0]} Spital${v[0] > 1 ? 'äler' : ''} mit Sitz hier, ${fmtInt(v[1])} stationäre Fälle` : 'kein Spital mit Sitz hier'}`; });
  }
  const keys = Object.entries(P.gruppen).map(([c, l]) => `<span class="pt-key"><i class="sp-${c}"></i> ${esc(l.replace('Allgemeinspital, ', ''))}</span>`).join('');
  return `<div class="legend"><span>Fläche = stationäre Fälle ${M_jahr()}</span>${keys}</div>`;
}
const M_jahr = () => S.meta.jahr;

/** Spitex organisations as bubbles: area = Klientinnen und Klienten, colour = Trägergruppe; returns the legend */
let SPITEX = null;
const loadSpitex = () => (SPITEX = SPITEX || fetch(dataUrl('spitex.json')).then((r) => r.json()));
async function colourSpitex(map, setTip = null, alive = () => true) {
  const X = await loadSpitex();
  if (!alive()) return '';
  map.clear(); map.setLevel('gde');
  map.points(X.x.map((x, k) => ({ x, y: X.y[k], r: Math.max(1.4, Math.sqrt(X.c[k]) * 0.2), id: X.g[k], cls: `sx sx-${X.t[k]}${X.a[k] ? ' approx' : ''}`,
    tip: `<b>${esc(abbr(X.n[k]))}</b><br>${esc(X.o[k])} · ${fmtInt(X.c[k])} Klientinnen und Klienten${X.v[k] ? ` · ${fmt(X.v[k], { dec: 0 })} Vollzeitstellen` : ''}`
      + `<br><span class="muted">${esc(X.gruppen[X.t[k]])}${X.a[k] ? ' · Lage ungefähr' : ''}</span>` })), { animate: true });
  if (setTip) {
    const per = new Map(); X.g.forEach((g, k) => { const v = per.get(g) || [0, 0]; per.set(g, [v[0] + 1, v[1] + X.c[k]]); });
    setTip((id) => { const r = region(id); if (!r) return ''; const v = per.get(id);
      return `${tipName(r)} · ${v ? `${v[0]} Spitex-Organisation${v[0] > 1 ? 'en' : ''} mit Sitz hier, ${fmtInt(v[1])} Klientinnen und Klienten` : 'keine Spitex-Organisation mit Sitz hier'}`; });
  }
  const keys = Object.entries(X.gruppen).map(([c, l]) => `<span class="pt-key"><i class="sx-${c}"></i> ${esc(l)}</span>`).join('');
  return `<div class="legend"><span>Fläche = Klientinnen und Klienten ${M_jahr()}</span>${keys}</div>`;
}

/** colour the map by the forecast change 2024 -> year (BFS mittel, quintiles); returns the legend */
async function colourProg(map, indId, year, label, setTip = null, alive = () => true) {
  const P = await loadProg();
  if (!alive()) return '';                                 // another chapter was shown while loading
  const ids = S.regions.filter((r) => r.e === 'GDE').map((r) => r.id);
  const vals = ids.map((id) => { const a = pval(P, indId, id, 'mittel', 2024); const b = pval(P, indId, id, 'mittel', year); return a ? (b / a - 1) * 100 : null; });
  const br = quantiles(vals);
  map.clear(); map.setLevel('gde');
  map.choropleth(new Map(ids.map((id, k) => [id, classOf(vals[k], br)])));
  if (setTip) {
    const at = new Map(ids.map((id, k) => [id, k]));
    const noun = { p_b80: 'Menschen ab 80', p_b65: 'Menschen ab 65', p_bev: 'Einwohner' }[indId] || '';
    setTip((id) => {
      const r = region(id); const k = at.get(id); if (!r || k === undefined) return '';
      const a = pval(P, indId, id, 'mittel', 2024); const b = pval(P, indId, id, 'mittel', year);
      return `${tipName(r)} · ${noun}: ${fmtInt(a)} (2024) → rund ${fmtInt(roundProg(b))} (${year}) · ${vals[k] == null ? '–' : plusMinus(vals[k], 0) + ' %'}`;
    });
  }
  return legendHTML(br, (x) => `${plusMinus(x, 0)} %`, label);
}

/** «Die Schweiz wird älter»: share 80+ per Gemeinde animated 2012 → 2055 (3 years per second, classed violet ramp).
 *  Runs while the chapter is shown; the card (data-age=…) shows year, story beat, counters and a small line chart. */
let ALT = null;
const loadAlterung = () => (ALT = ALT || fetch(dataUrl('alterung.json')).then((r) => r.json()));
const AGE_BR = [40, 60, 80, 100, 120, 150];                 // class breaks in per mille: <4, 4–6, 6–8, 8–10, 10–12, 12–15, ≥15 %
const AGE_COL = [0, 1, 2, 3, 4, 5, 6].map((k) => `var(--a${k})`);
const ageCls = (v) => (v < 0 ? -1 : AGE_BR.filter((b) => v >= b).length);
let AGE_UID = 0;
/** opts: speed (years per second), scope (element holding the data-age controls), rowMin (bar row height), onPhase('map'|'bars'), onDone (after the race instead of looping), ctl (receives toMap/toBars) */
async function ageChapter(map, setTip = null, alive = () => true, opts = {}) {
  const uid = ++AGE_UID;
  const SPEED = opts.speed || 3;   // years per second (story chapter 3, hero entries 5)
  const A = await loadAlterung();
  if (!alive()) return '';
  const Y = A.years, n = A.ids.length, Y0 = Y[0], Y1 = Y[Y.length - 1];
  const valAt = (y, i) => {
    if (y <= Y0) return A.a[0][i];
    for (let k = 1; k < Y.length; k++) if (y <= Y[k]) { const a = A.a[k - 1][i], b = A.a[k][i]; return a < 0 || b < 0 ? b : a + (b - a) * (y - Y[k - 1]) / (Y[k] - Y[k - 1]); }
    return A.a[Y.length - 1][i];
  };
  const stat = (y) => { const v = []; for (let i = 0; i < n; i++) { const x = valAt(y, i); if (x >= 0) v.push(x); } v.sort((a, b) => a - b); return { n: v.filter((x) => x >= 100).length, med: v[v.length >> 1] / 10 }; };
  const series = Y.map((y) => [y, stat(y).n]);
  const nLast = series[series.length - 1][1];
  const beats = [
    [Y0, `${Y0}: Nur ${series[0][1]} Gemeinden haben mindestens 10 % Menschen ab 80 – vor allem Tessiner und Bündner Täler, aus denen Junge wegziehen.`],
    [2018, 'Beobachtet: Jedes Jahr wird die Karte etwas dunkler. Mehr Menschen erreichen das hohe Alter.'],
    [A.obs_to + 1, `Ab ${A.obs_to + 1} Szenario: 2026 wird der Jahrgang 1946 achtzig – bis 2044 folgen die geburtenstarken Jahrgänge bis 1964.`],
    [2035, 'Szenario: Die Färbung erreicht die Agglomerationen und das Mittelland.'],
    [2045, `Szenario: ${Y1} haben ${fmtInt(nLast)} von ${fmtInt(n)} Gemeinden mindestens 10 % Menschen ab 80 – fast jede zweite.`],
  ];
  const q = (k) => (opts.scope || main()).querySelector(`[data-age="${k}"]`);
  // small line chart: one series, observed solid, scenario dashed
  const W = 300, H = 92, maxN = Math.max(...series.map((s) => s[1]));
  const sx = (y) => 6 + (y - Y0) / (Y1 - Y0) * (W - 12), sy = (v) => H - 16 - v / maxN * (H - 28);
  const line = (pts) => pts.map(([y, v], i) => `${i ? 'L' : 'M'}${sx(y).toFixed(1)} ${sy(v).toFixed(1)}`).join('');
  const chart = q('chart');
  if (chart) {
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gemeinden mit mindestens 10 % ab 80, ${Y0} bis ${Y1}">
      <line class="ax" x1="6" x2="${W - 6}" y1="${H - 16}" y2="${H - 16}"/>
      <path class="obs" d="${line(series.filter((s) => s[0] <= A.obs_to))}"/><path class="sce" d="${line(series.filter((s) => s[0] >= A.obs_to))}"/>
      ${[Y0, A.obs_to, Y1].map((y, j) => `<text x="${sx(y)}" y="${H - 2}" text-anchor="${['start', 'middle', 'end'][j]}">${y}</text>`).join('')}
      <text class="val" x="${sx(Y1)}" y="${sy(maxN) - 5}" text-anchor="end">${fmtInt(maxN)}</text>
      <circle class="dot" r="4.5" cx="${sx(Y0)}" cy="${sy(series[0][1])}"/></svg>`;
  }
  const dot = chart && chart.querySelector('.dot');
  let y = reduced() ? 2040 : Y0, run = !reduced(), hold = 0, last = performance.now(), shownY = null;
  const cls = new Int8Array(n).fill(-2);
  const prev = new Float32Array(n).fill(-1); let prevY = null;
  // light signal when a Gemeinde reaches 10 % ab 80: a glow starts inside its boundary and runs outwards
  const NS = 'http://www.w3.org/2000/svg';
  const root = map.svg.firstElementChild; root.querySelector('.age-fx')?.remove();
  const fx = document.createElementNS(NS, 'g'); fx.setAttribute('class', 'age-fx'); root.appendChild(fx);
  const flash = (id) => {
    if (reduced() || fx.childElementCount > 240) return;
    const p = map.paths.get(id); const c = S.geo.c[id.slice(4)]; if (!p || !c) return;
    const f = p.cloneNode(); f.removeAttribute('data-id'); f.removeAttribute('style'); f.setAttribute('class', 'age-flash');
    const r = document.createElementNS(NS, 'circle'); r.setAttribute('cx', c[0]); r.setAttribute('cy', c[1]); r.setAttribute('r', 16); r.setAttribute('class', 'age-ring');
    [f, r].forEach((e) => { e.addEventListener('animationend', () => e.remove()); fx.appendChild(e); });
  };
  const paint = () => {
    const paths = map.paths;
    const fwd = prevY != null && y > prevY && y - prevY < 1;
    for (let i = 0; i < n; i++) {
      const v = valAt(y, i);
      if (fwd && prev[i] >= 0 && prev[i] < 100 && v >= 100) flash(A.ids[i]);
      prev[i] = v;
      const c = ageCls(v); if (c !== cls[i]) { cls[i] = c; const p = paths.get(A.ids[i]); if (p) p.style.fill = c < 0 ? '' : AGE_COL[c]; }
    }
    prevY = y;
    const yi = Math.floor(y), st = stat(y);
    const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
    set('year', yi); set('n', fmtInt(st.n)); set('med', `${fmt(st.med, { dec: 1 })} %`);
    set('beat', beats.reduce((b, x) => (y >= x[0] ? x[1] : b), beats[0][1]));
    set('mode', yi <= A.obs_to ? 'beobachtet' : 'Szenario');
    const sc = q('scrub'); if (sc && document.activeElement !== sc) sc.value = y;
    if (dot) { dot.setAttribute('cx', sx(y)); dot.setAttribute('cy', sy(st.n)); }
  };
  map.clear(); map.setLevel('gde');
  const at = new Map(A.ids.map((id, i) => [id, i]));
  if (setTip) setTip((id) => { const r = region(id); const i = at.get(id); if (!r || i === undefined) return ''; const v = valAt(y, i);
    return `${tipName(r)} · ab 80: ${v < 0 ? '–' : `${fmt(v / 10, { dec: 1 })} %`} (${Math.floor(y)}${Math.floor(y) > A.obs_to ? ', Szenario' : ''})`; });
  // ---- after the map: the Kantone fly out of the map and become an animated bar chart (2012 → 2055) with traces
  const K = A.kt, nk = K.ids.length;
  const kAt = (yy, j) => { if (yy <= Y0) return K.a[0][j]; for (let k = 1; k < Y.length; k++) if (yy <= Y[k]) { const a = K.a[k - 1][j], b = K.a[k][j]; return a + (b - a) * (yy - Y[k - 1]) / (Y[k] - Y[k - 1]); } return K.a[Y.length - 1][j]; };
  const chAt = (yy) => { if (yy <= Y0) return A.ch[0]; for (let k = 1; k < Y.length; k++) if (yy <= Y[k]) return A.ch[k - 1] + (A.ch[k] - A.ch[k - 1]) * (yy - Y[k - 1]) / (Y[k] - Y[k - 1]); return A.ch[Y.length - 1]; };
  const TRACE = [Y0, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, Y1];
  const VMAX = Math.ceil(Math.max(...K.a[Y.length - 1]) / 10) * 10 + 10;
  const box = map.container; const ov = document.createElementNS(NS, 'svg'); ov.setAttribute('class', 'age-bars');
  ov.setAttribute('aria-label', `Anteil der Menschen ab 80 nach Kanton, ${Y0} bis ${Y1}`); ov.setAttribute('role', 'img');
  box.appendChild(ov);
  let L = null;   // layout in px of the overlay
  const ktName = (j) => region(K.ids[j])?.n || K.ids[j].slice(3);
  const pw = (t) => t.length * 6.1 + 16;   // pill width estimate (11px text)
  const pillBox = (anchor, w) => (anchor === 'end' ? -w - 3 : anchor === 'start' ? 3 : -w / 2);
  const pill = (cls, x, y, anchor, t) => { const w = pw(t), bx = pillBox(anchor, w);
    return `<g class="pin ${cls}" data-anchor="${anchor}" transform="translate(${x} ${y})"><rect x="${bx}" y="-8.5" width="${w}" height="17" rx="8.5"/><text x="${bx + w / 2}" y="3.8" text-anchor="middle">${t}</text></g>`; };
  const setPill = (g, t, cx) => {   // live pill: centred on the line, kept inside the overlay
    const w = pw(t); let bx = -w / 2; if (cx + bx < 4) bx = 4 - cx; if (cx + bx + w > L.w - 4) bx = L.w - 4 - w - cx;
    const r = g.querySelector('rect'), tx = g.querySelector('text'); r.setAttribute('x', bx); r.setAttribute('width', w); tx.setAttribute('x', bx + w / 2); tx.textContent = t;
  };
  const buildBars = () => {
    const rowMin = box.clientWidth < 560 ? 13 : (opts.rowMin || 14.5);   // phones always get readable rows   // phones: the box grows so 26 rows stay readable
    box.style.height = `${Math.max(box.clientHeight, 44 + nk * rowMin + 30)}px`;
    const w = box.clientWidth, h = box.clientHeight; ov.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const top = 44, rowH = (h - top - 30) / nk, icon = Math.min(30, rowH * 1.9), x0 = icon + 40, x1 = w - 48;
    L = { w, h, top, rowH, icon, x0, x1, sx: (v) => x0 + Math.max(0, v) / VMAX * (x1 - x0) };
    const fs = Math.max(9.5, Math.min(12.5, rowH * 0.72));
    const yT = top - 5, yB = top + nk * rowH + 3, xs = L.sx(A.ch[0]), i24 = Y.indexOf(A.obs_to);
    ov.innerHTML = `<defs><linearGradient id="ageBand${uid}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--a3);stop-opacity:.06"/><stop offset="1" style="stop-color:var(--a6);stop-opacity:.3"/></linearGradient></defs>
      <text class="hd" x="${x0}" y="14">Anteil ab 80 nach Kanton</text><text class="hd yr" x="${x1 + 44}" y="14" text-anchor="end"></text>
      <g class="rows">${K.ids.map((id, j) => `<g class="row" data-j="${j}"><title></title>
        <image class="wap" href="${wappen(id)}" x="4" y="${rowH * 0.04}" width="${icon}" height="${rowH * 0.92}" preserveAspectRatio="xMidYMid meet"/>
        <text class="ab" x="${icon + 8}" y="${rowH / 2}" dy=".35em" style="font-size:${fs}px">${id.slice(3)}</text>
        <rect class="bar" x="${x0}" y="${rowH * 0.14}" height="${rowH * 0.72}" width="${x1 - x0}" rx="2"/>
        <g class="tr">${TRACE.map((t) => `<line data-t="${t}" y1="${rowH * 0.14}" y2="${rowH * 0.86}" hidden/>`).join('')}</g>
        <text class="val" y="${rowH / 2}" dy=".35em" style="font-size:${fs}px"></text></g>`).join('')}</g>
      <g class="chx"><rect class="band" x="${xs}" y="${yT}" height="${yB - yT}" width="0" fill="url(#ageBand${uid})"/>
        <line class="c0" x1="${xs}" x2="${xs}" y1="${yT}" y2="${yB + 6}"/>
        <line class="c24" y1="${yT}" y2="${yB + 6}" x1="${L.sx(A.ch[i24])}" x2="${L.sx(A.ch[i24])}"/>
        ${pill('p0', xs, yB + 14, 'end', `${Y0} · ${fmt(A.ch[0] / 10, { dec: 1 })} %`)}${pill('p24', L.sx(A.ch[i24]), yB + 14, 'start', `${A.obs_to} · ${fmt(A.ch[i24] / 10, { dec: 1 })} %`)}
        <g class="live"><line class="cl" y1="${yT}" y2="${yB}"/><circle class="knob" cy="${yT}" r="3.5"/>${pill('pl', 0, top - 16, 'middle', '')}</g></g>
      <g class="sil"></g>`;
  };
  let rank = []; const rowY = (r) => L.top + r * L.rowH;
  const slot = (p, r) => {   // matrix that puts a Kanton silhouette into the icon slot of rank r
    const b = p.getBBox(); const s = Math.min(L.icon / b.width, (L.rowH * 0.92) / b.height);
    return `matrix(${s},0,0,${s},${4 + L.icon / 2 - s * (b.x + b.width / 2)},${rowY(r) + L.rowH / 2 - s * (b.y + b.height / 2)})`;
  };
  const rerank = (yy) => {
    rank = K.ids.map((_, j) => j).sort((a, b) => kAt(yy, b) - kAt(yy, a));
    rank.forEach((j, r) => {
      const g = ov.querySelector(`.row[data-j="${j}"]`); g.style.transform = `translate(0px, ${rowY(r)}px)`;
      const p = ov.querySelector(`.sil path[data-j="${j}"]`); if (p && p.dataset.landed) p.style.transform = slot(p, r);
    });
  };
  const drawBars = (yy, grow = false) => {
    const yi = Math.floor(yy);
    ov.querySelector('.yr').textContent = `${yi}${yi > A.obs_to ? ' · Szenario' : ''}`;
    // Schweiz: fixed start (2012), moving line, growth band, pins at 2012, 2024 and the end
    const cv = chAt(yy), cx = L.sx(cv), xs = L.sx(A.ch[0]), end = yy >= Y1 - 1e-6;
    ov.querySelector('.chx .band').setAttribute('width', Math.max(0, cx - xs));
    ov.querySelector('.chx .live').style.transform = `translate(${cx}px, 0px)`;
    const on24 = yy >= A.obs_to; ov.querySelectorAll('.chx .c24, .chx .p24').forEach((e) => e.classList.toggle('on', on24));
    const lt = `${end ? Y1 : 'Schweiz'} · ${fmt(cv / 10, { dec: 1 })} % · +${fmt((cv - A.ch[0]) / 10, { dec: 1 })} Pp. seit ${Y0}`;
    const pl = ov.querySelector('.chx .pl'); setPill(pl, lt, cx); pl.classList.toggle('final', end);
    ov.querySelectorAll('.row').forEach((g) => {
      const j = +g.dataset.j, v = kAt(yy, j), c = AGE_COL[ageCls(v)];
      const bar = g.querySelector('.bar'); bar.style.transition = grow ? 'transform .8s ease, fill .8s' : 'none';
      bar.style.transform = `scaleX(${(L.sx(v) - L.x0) / (L.x1 - L.x0)})`; bar.style.fill = c;
      const vt = g.querySelector('.val'); vt.setAttribute('x', L.sx(v) + 5); vt.textContent = `${fmt(v / 10, { dec: 1 })} %`;
      g.querySelector('title').textContent = `Kanton ${ktName(j)}: ${fmt(v / 10, { dec: 1 })} % ab 80 (${yi}${yi > A.obs_to ? ', Szenario' : ''})`;
      g.querySelectorAll('.tr line').forEach((l) => { const t = +l.dataset.t; const on = t <= yy + 1e-6 && t > Y0 - 1; l.toggleAttribute('hidden', !on); if (on) { const x = L.sx(kAt(t, j)); l.setAttribute('x1', x); l.setAttribute('x2', x); } });
    });
    const top = rank[0], bot = rank[rank.length - 1];
    pace(yy);
    if (top != null) set('beat', `Kantone ${yi}: am ältesten ist ${ktName(top)} (${fmt(kAt(yy, top) / 10, { dec: 1 })} %), am jüngsten ${ktName(bot)} (${fmt(kAt(yy, bot) / 10, { dec: 1 })} %).`);
  };
  const set = (k, v) => { const e = q(k); if (e) e.textContent = v; };
  const pace = (yy) => { const c = chAt(yy); set('chv', `${fmt(c / 10, { dec: 1 })} %`); set('grow', `+${fmt((c - A.ch[0]) / 10, { dec: 1 })}`); };
  const blocks = (kt) => { const a = q('ktblock'), b = q('gdeblock'); if (a) a.hidden = !kt; if (b) b.hidden = kt; };
  let phase = 'map', pt = 0, lastRank = null;   // phases: map → pre → fly → rewind → bars → back → map
  const toBars = () => {
    map.reset(); phase = 'pre'; pt = 0; fx.innerHTML = '';
  };
  const fly = () => {
    buildBars();
    const rootCTM = root.getScreenCTM(), ob = ov.getBoundingClientRect();
    const m0 = `matrix(${rootCTM.a},${rootCTM.b},${rootCTM.c},${rootCTM.d},${rootCTM.e - ob.left},${rootCTM.f - ob.top})`;
    rank = K.ids.map((_, j) => j).sort((a, b) => kAt(y, b) - kAt(y, a));
    const sil = ov.querySelector('.sil');
    K.ids.forEach((id, j) => {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', S.geo.kt[id.slice(3)] || ''); p.dataset.j = j;
      p.style.fill = AGE_COL[ageCls(kAt(y, j))]; p.style.transform = m0; sil.appendChild(p);
    });
    rerank(y); drawBars(y);
    box.classList.add('age-barmode'); blocks(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rank.forEach((j, r) => { const p = sil.querySelector(`path[data-j="${j}"]`); p.style.transitionDelay = `${(r * 0.025).toFixed(3)}s`; p.style.transform = slot(p, r); p.style.fill = 'var(--a5)'; p.dataset.landed = 1; });
    }));
    phase = 'fly'; pt = 0; opts.onPhase?.('bars');
  };
  const toMap = () => {
    box.classList.remove('age-barmode'); ov.classList.remove('landed'); blocks(false); box.style.height = ''; phase = 'back'; pt = 0;
  };
  const tick = (now) => {
    if (!alive()) { fx.remove(); ov.remove(); box.classList.remove('age-barmode'); box.style.height = ''; blocks(false); return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (phase === 'map') {
      if (run) { if (y >= Y1) { hold += dt; if (hold > 1.2) { hold = 0; if (opts.stepMode) { y = Y0; prevY = null; } else toBars(); } } else y = Math.min(Y1, y + dt * SPEED); }   // 3 years per second
      const k = y >= Y1 ? -1 : Math.round(y * 10); if (k !== shownY) { shownY = k; paint(); }   // the last step always draws 2055
    } else if (phase === 'pre') { pt += dt; if (pt > 0.7) fly(); }                       // zoom back to the whole Schweiz first
    else if (phase === 'fly') { pt += dt; if (pt > 2.2) { phase = 'rewind'; pt = 0; ov.classList.add('landed'); y = Y0; rerank(y); drawBars(y, true); } }
    else if (phase === 'rewind') { pt += dt; if (pt > 1.1) { phase = 'bars'; pt = 0; } }
    else if (phase === 'bars') {
      if (run) { if (y >= Y1) { hold += dt; if (hold > 3.5) { hold = 0; if (opts.onDone) { run = false; opts.onDone(); } else if (opts.stepMode) { phase = 'rewind'; pt = 0; y = Y0; rerank(y); drawBars(y, true); } else toMap(); } } else y = Math.min(Y1, y + dt * SPEED); }
      const k = y >= Y1 ? -1 : Math.round(y * 20); if (k !== shownY) { shownY = k; const r = Math.floor(y); if (r !== lastRank) { lastRank = r; rerank(y); } drawBars(y);
        set('year', Math.floor(y)); set('mode', Math.floor(y) <= A.obs_to ? 'beobachtet' : 'Szenario'); const sc = q('scrub'); if (sc && document.activeElement !== sc) sc.value = y; }
    } else if (phase === 'back') { pt += dt; if (pt > 0.7) { ov.innerHTML = ''; phase = 'map'; y = Y0; prevY = null; shownY = null; opts.onPhase?.('map'); } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // controls live in the legend (wired once the legend is in the page)
  setTimeout(() => {
    const b = q('play'), sc = q('scrub'), bm = q('toMap'), bb = q('toBars'); if (!b || !sc) return;
    b.textContent = run ? 'Pause' : 'Abspielen';
    b.onclick = () => { run = !run; if (run && y >= Y1) { y = Y0; hold = 0; } b.textContent = run ? 'Pause' : 'Abspielen'; };
    sc.oninput = () => { y = +sc.value; hold = 0; shownY = null; prevY = null; if (phase === 'bars') { rerank(y); drawBars(y); } };
    if (bb) bb.onclick = () => { if (phase === 'map') { hold = 0; toBars(); } };
    if (bm) bm.onclick = () => { if (phase !== 'map' && phase !== 'back') { hold = 0; toMap(); } };
  }, 0);
  if (opts.ctl) {   // external control (hero entries): switch views, restart
    opts.ctl.toBars = () => { if (phase === 'map') { hold = 0; toBars(); } };
    opts.ctl.toMap = () => { if (phase !== 'map' && phase !== 'back') { hold = 0; toMap(); } };
    opts.ctl.play = () => { run = true; const b = q('play'); if (b) b.textContent = 'Pause'; };
    opts.ctl.phase = () => phase;
    opts.ctl.go = (st) => (st ? opts.ctl.toBars() : opts.ctl.toMap());
    if (opts.initStep && opts.initStep()) setTimeout(() => opts.ctl.go(opts.initStep()), 0);
  }
  const steps = AGE_COL.map((c) => `<span style="background:${c}"></span>`).join('');
  const labs = AGE_COL.map((_, k) => `<span>${k ? AGE_BR[k - 1] / 10 : ''}</span>`).join('');
  return `<div class="legend age-leg"><span>Anteil ab 80 (%)</span><span class="age-steps"><span class="sw">${steps}</span><span class="tk">${labs}</span></span><span class="age-key"><i></i> Lichtsignal: Gemeinde erreicht 10 %</span></div>
    <div class="age-ctrl"><button class="btn small" type="button" data-age="play">Pause</button><span class="age-seg"><button type="button" data-age="toMap">Karte</button><button type="button" data-age="toBars">Kantone</button></span><span class="num" data-age="mode">beobachtet</span>
      <input type="range" data-age="scrub" min="${Y0}" max="${Y1}" step="0.1" value="${y}" aria-label="Jahr"></div>`;
}
