// Omnibox: one field for Gemeinde, Bezirk, Kanton, Thema and Frage.
import { S, fmtInt } from './store.js?v=20261113203945';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  const items = [];
  for (const r of S.regions) {
    if (r.e === 'CH') continue;
    const kind = r.e === 'GDE' ? 'Gemeinden' : r.e === 'BEZ' ? 'Bezirke' : 'Kantone';
    const label = r.e === 'GDE' ? r.n : r.e === 'BEZ' ? `Bezirk ${r.n}` : `Kanton ${r.n}`;
    items.push({ kind, label, meta: `${r.e === 'KT' ? '' : r.kt + ' · '}${fmtInt(r.pop)} Einw.`, key: norm(`${r.n} ${r.kt}`), go: `#/gemeinde/${r.id}`, pop: r.pop, rank: r.e === 'GDE' ? 0 : r.e === 'BEZ' ? 1 : 2 });
  }
  for (const q of S.meta.questions) items.push({ kind: 'Fragen', label: q.text, meta: '', key: norm(`${q.text} ${q.syn}`), go: `#/frage/${q.id}`, rank: 0 });
  for (const t of S.meta.themen) for (const s of t.sub) {
    if (s.soon) continue;
    items.push({ kind: 'Themen', label: s.label, meta: t.label, key: norm(`${s.label} ${t.label}`), go: `#/thema/${s.id}`, rank: 0 });
  }
  INDEX = items; return items;
}

function search(q) {
  const n = norm(q).trim(); if (!n) return [];
  const words = n.split(/\s+/);
  const hits = [];
  for (const it of index()) {
    if (!words.every((w) => it.key.includes(w))) continue;
    const starts = it.key.startsWith(words[0]) || it.key.includes(' ' + words[0]);
    hits.push({ ...it, score: (starts ? 0 : 1) + it.rank * 0.1 - (it.pop ? Math.log10(it.pop) * 0.01 : 0) });
  }
  hits.sort((a, b) => a.score - b.score);
  const groups = { Gemeinden: [], Fragen: [], Themen: [], Bezirke: [], Kantone: [] };
  for (const h of hits) if (groups[h.kind].length < (h.kind === 'Gemeinden' ? 6 : 3)) groups[h.kind].push(h);
  return Object.entries(groups).filter(([, v]) => v.length);
}

/** mount an omnibox; onPick(item) defaults to navigating to item.go */
export function omnibox(slot, { placeholder = 'Gemeinde, Thema oder Frage eingeben …', compact = false, id = 'omni', onPick, filter } = {}) {
  slot.innerHTML = `<div class="omni${compact ? ' compact' : ''}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-owns="${id}-list">
    <input id="${id}" type="search" autocomplete="off" spellcheck="false" placeholder="${placeholder}" aria-label="${placeholder}" aria-controls="${id}-list">
    <div class="omni-list" id="${id}-list" role="listbox" hidden></div></div>`;
  const box = slot.firstElementChild; const input = box.querySelector('input'); const list = box.querySelector('.omni-list');
  let flat = []; let active = -1;
  const close = () => { list.hidden = true; box.setAttribute('aria-expanded', 'false'); active = -1; };
  const pick = (it) => { close(); input.value = ''; input.blur(); (onPick || ((x) => { location.hash = x.go; }))(it); };
  const render = () => {
    let groups = search(input.value);
    if (filter) groups = groups.map(([k, v]) => [k, v.filter(filter)]).filter(([, v]) => v.length);
    flat = groups.flatMap(([, v]) => v);
    if (!input.value.trim()) { close(); return; }
    list.innerHTML = groups.length ? groups.map(([k, v]) => `<div class="omni-group">${k}</div>` + v.map((it) => {
      const i = flat.indexOf(it);
      return `<div class="omni-item" role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${i === active}"><span>${it.label}</span><span class="meta">${it.meta}</span></div>`;
    }).join('')).join('') : '<div class="omni-empty">Nichts gefunden. Versuchen Sie einen Gemeindenamen oder ein Stichwort wie „Spitex“.</div>';
    list.hidden = false; box.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => { active = flat.length ? 0 : -1; render(); active = flat.length ? 0 : -1; render(); });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { active = Math.min(flat.length - 1, active + 1); render(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { if (flat[active >= 0 ? active : 0]) pick(flat[active >= 0 ? active : 0]); ev.preventDefault(); }
    else if (ev.key === 'Escape') close();
  });
  list.addEventListener('mousedown', (ev) => { const o = ev.target.closest('.omni-item'); if (o) { ev.preventDefault(); pick(flat[+o.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { input, focus: () => input.focus() };
}
