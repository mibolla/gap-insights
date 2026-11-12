// Landing page: hero (search, rotating facts, map), scroll story, choice of entry, compact sources.
import { S, val, region, detail, fmtInt, fmt, quantiles, classOf, plusMinus, prefs } from './store.js?v=20261112123207';
import { createMap, legendHTML, reduced } from './map.js?v=20261112123207';
import { omnibox } from './search.js?v=20261112123207';
import { esc, main } from './ui.js?v=20261112123207';
import { loadProg, pval } from './prog.js?v=20261112123207';

let cleanup = [];
export function teardown() { cleanup.forEach((f) => f()); cleanup = []; }

function colourBy(map, indId, level = 'gde') {
  map.clear(); map.setLevel(level);
  const ids = S.regions.filter((r) => r.e === (level === 'gde' ? 'GDE' : level === 'kt' ? 'KT' : 'BEZ')).map((r) => r.id);
  const vals = ids.map((id) => val(indId, id));
  const br = quantiles(vals);
  map.choropleth(new Map(ids.map((id, k) => [id, classOf(vals[k], br)])));
  const i = S.ind.get(indId);
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

  const chapters = [
    { n: 'Kapitel 1', title: 'Älter werden', big: `${plusMinus(ch('g80'))} %`, text: `So stark ist die Zahl der Menschen ab 80 Jahren in der Schweiz von ${y0} bis ${y1} gewachsen. Der Anteil der Menschen ab 65 beträgt heute ${fmt(ch('a65'), 'a65')} %. Die Karte zeigt den Anteil der über 80-Jährigen in jeder Gemeinde.`,
      src: `BFS STATPOP ${y0}–${y1}`, map: (m) => colourBy(m, 'a80'), thema: 'alter', q: 'entwicklung', cap: `Anteil der Menschen ab 80 Jahren, ${y1}` },
    { n: 'Kapitel 2', title: 'Allein leben', big: `${fmt(ch('al65'), 'al65')} %`, text: `der Menschen ab 65, die in einem Privathaushalt leben, leben allein. Bei den über 85-Jährigen sind es ${fmt(ch('al85'), 'al85')} %. Das ist wichtig für die Planung von Unterstützung im Alltag.`,
      src: `BFS STATPOP ${M.jahr}, Haushalte`, map: (m) => colourBy(m, 'al65'), thema: 'haushalte', q: 'allein', cap: 'Anteil der Menschen ab 65, die allein leben' },
    { n: 'Kapitel 3', title: 'Pflege im Heim', big: fmt(ch('aph_pl80'), 'aph_pl80'), text: `Langzeitplätze in Alters- und Pflegeheimen gibt es in der Schweiz pro 1000 Menschen ab 80. Die Kantone unterscheiden sich stark. Die Punkte zeigen die Gemeinden mit einem eigenen Heim – Heime versorgen auch die Nachbargemeinden.`,
      src: `BAG / SOMED ${M.jahr}`, map: (m) => { const l = colourBy(m, 'aph_pl80', 'kt'); m.dots((M.facts[4].set || []).map((id) => ({ id, r: 2.4 }))); return l; }, thema: 'inanspruchnahme', q: 'plaetze', cap: 'Pflegeheimplätze pro 1000 Menschen ab 80, nach Kanton' },
    { n: 'Kapitel 4', title: 'Pflege zu Hause', big: fmt(ch('spx_kl65'), 'spx_kl65'), text: `von 1000 Menschen ab 65 erhalten Leistungen der Spitex. Die Spitex ist für viele die erste Unterstützung, damit sie zu Hause bleiben können. Die Karte zeigt die Kantone.`,
      src: `BAG / Spitex-Statistik ${M.jahr}`, map: (m) => colourBy(m, 'spx_kl65', 'kt'), thema: 'inanspruchnahme', q: 'spitex', cap: 'Spitex-Klientinnen und -Klienten pro 1000 Menschen ab 65, nach Kanton' },
    { n: 'Kapitel 5', title: 'Blick nach vorn', big: `${fmtInt(Math.round(M.prog_ch.mittel.b80['2040'] / 1000) * 1000)}`,
      text: `Menschen ab 80 werden 2040 in der Schweiz leben – gemäss BFS-Referenzszenario (mittel), heute sind es ${fmtInt(Math.round(M.prog_ch.mittel.b80['2024'] / 1000) * 1000)}. Die Karte zeigt die erwartete Zunahme bis 2040 in jeder Gemeinde. Jede Prognose nennt ihr Modell und ihre Variante.`,
      src: 'BFS-Szenarien 2025–2055, regionalisiert (HSLU)', map: (m) => { colourProg(m, 'p_b80', 2040); return '<div class="legend"><span>Zunahme Menschen ab 80, 2024–2040 (BFS mittel)</span></div>'; },
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
    <div class="story-head"><div><span class="eyebrow">Was die Daten zeigen</span><h2 id="storyTitle">Fünf Blicke auf das Älterwerden in der Schweiz</h2></div>
      <a class="btn small" href="#choice">Story überspringen →</a></div>
    <div class="story-grid">
      <div class="story-cards">${chapters.map((c, k) => `
        <article class="story-card${k === 0 ? ' active' : ''}" data-k="${k}">
          <span class="n">${c.n} von ${chapters.length}</span><h3>${c.title}</h3>
          <span class="big num">${c.big}</span><p>${c.text}</p>
          <span class="src">Quelle: ${c.src}</span>
          <div class="exits"><a class="btn small" href="#/thema/${c.thema}">Thema ${esc(S.sub.get(c.thema).label)}</a><a class="btn small" href="#/frage/${c.q}">${esc(S.q.get(c.q).text)}</a>
          <button class="btn small primary" type="button" data-us="${c.q}">Und bei uns?</button></div>
        </article>`).join('')}
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
  const map = createMap(heroEl, { onClick: (id, pt) => mapCard(heroEl, id, pt, () => pendingQ) });
  cleanup.push(map.drift());

  // ---- rotating facts linked to the map
  const facts = M.facts; let fi = 0; let paused = false;
  const tEl = document.getElementById('factText'); const sEl = document.getElementById('factSrc'); const lEl = document.getElementById('heroLegend');
  const show = (k) => {
    fi = (k + facts.length) % facts.length; const f = facts[fi];
    tEl.classList.add('fade');
    setTimeout(() => {
      const tag = { heute: 'Heute', rueckblick: 'Rückblick', ausblick: 'Prognose' }[f.zeit] || '';
      tEl.innerHTML = `${tag ? `<span class="ftag ${f.zeit}">${tag}</span> ` : ''}${f.go ? `<a href="${f.go}">${esc(f.text)}</a>` : esc(f.text)}`;
      sEl.textContent = `Quelle: ${f.src} · ${fi + 1}/${facts.length}`; tEl.classList.remove('fade');
      if (f.mode === 'set') {
        map.clear(); map.setLevel('gde'); map.highlight(f.set, { prog: !!f.prog });
        lEl.innerHTML = `<div class="legend"><span class="dot ${f.prog ? 'prog' : 'blue'}"></span> ${fmtInt(f.set.length)} Gemeinden hervorgehoben${f.prog ? ' (Prognose, BFS mittel)' : ''}</div>`;
      }
      else if (f.mode === 'ktval') {   // forecast per Kanton (e.g. growth of 80+ until 2040)
        map.clear(); map.setLevel('kt');
        const ids = Object.keys(f.vals); const vals = ids.map((k) => f.vals[k]); const br = quantiles(vals);
        map.choropleth(new Map(ids.map((k, n) => [k, classOf(vals[n], br)])));
        lEl.innerHTML = legendHTML(br, (x) => `+${fmt(x, { dec: 0 })} %`, 'Zunahme 80+ bis 2040 (Prognose, BFS mittel)');
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
  if (!reduced()) { const t = setInterval(() => { if (!paused && !document.hidden) show(fi + 1); }, 7000); cleanup.push(() => clearInterval(t)); }

  // ---- scroll story: sticky map recoloured per chapter
  const smap = createMap(document.getElementById('storyMap'), { onClick: (id) => { location.hash = `#/gemeinde/${id}`; } });
  const sLeg = document.getElementById('storyLegend'); const sCap = document.getElementById('storyCap');
  const dots = main().querySelectorAll('.story-dots span'); const cards = main().querySelectorAll('.story-card');
  const activate = (k) => {
    cards.forEach((c, j) => c.classList.toggle('active', j === k)); dots.forEach((d, j) => d.classList.toggle('on', j === k));
    sCap.textContent = chapters[k].cap; sLeg.innerHTML = chapters[k].map(smap);
  };
  activate(0);
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) activate(+e.target.dataset.k); }), { rootMargin: '-45% 0px -45% 0px' });
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
    <h4>${esc(r.n)} <span class="muted small">(${r.kt})</span></h4>
    <p class="small num">${fmtInt(r.pop)} Einwohner · über 80: ${fmtInt(b1)} <span class="muted">(${plusMinus(b0 ? (b1 / b0 - 1) * 100 : 0)} % seit ${d.ts.y[0]})</span></p>
    <div class="actions"><a class="btn small primary" href="#/gemeinde/${id}">Portrait öffnen →</a></div>
    <div class="small"><span class="muted">Fragen zu ${esc(r.n)}:</span><br>
      <a href="#/frage/allein/${id}">Wie viele leben allein?</a> · <a href="#/frage/plaetze/${id}">Genug Heimplätze?</a> · <a href="#/frage/entwicklung/${id}">Entwicklung 80+</a></div>`;
  card.querySelector('.close').onclick = () => card.remove();
  container.appendChild(card);
  card.querySelector('a').focus({ preventScroll: true });
}


/** colour the map by the forecast change 2024 -> year (BFS mittel) */
async function colourProg(map, indId, year) {
  const P = await loadProg();
  const ids = S.regions.filter((r) => r.e === 'GDE').map((r) => r.id);
  const vals = ids.map((id) => { const a = pval(P, indId, id, 'mittel', 2024); const b = pval(P, indId, id, 'mittel', year); return a ? (b / a - 1) * 100 : null; });
  const br = quantiles(vals);
  map.clear(); map.setLevel('gde');
  map.choropleth(new Map(ids.map((id, k) => [id, classOf(vals[k], br)])));
}
