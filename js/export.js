// Export of charts and their numbers: PNG, PDF, PowerPoint, Excel, CSV.
// Libraries are loaded only when the user exports (keeps the app fast).
import { toast, esc } from './ui.js?v=20261113203945';

const LIBS = {
  xlsx: { url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', global: 'XLSX' },
  jspdf: { url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', global: 'jspdf' },
  pptx: { url: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', global: 'PptxGenJS' },
};
const loading = {};
function lib(name) {
  const L = LIBS[name];
  if (window[L.global]) return Promise.resolve(window[L.global]);
  if (!loading[name]) {
    loading[name] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = L.url; s.async = true;
      s.onload = () => res(window[L.global]); s.onerror = () => rej(new Error(`${name} konnte nicht geladen werden`));
      document.head.appendChild(s);
    });
  }
  return loading[name];
}

export const FORMATS = [
  { id: 'png', label: 'Bild (PNG)', needsChart: true },
  { id: 'pdf', label: 'PDF' },
  { id: 'pptx', label: 'PowerPoint' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV (Zahlen)' },
];

const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
const fileName = (t) => (t || 'GAP-Insights').replace(/[^\wäöüÄÖÜéèàç .()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
const today = () => new Date().toLocaleDateString('de-CH');

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

/** chart → PNG data URL with title and source printed in */
export async function chartImage(div, title, source, { width = 1000, height } = {}) {
  if (!div || !div.data) return null;
  const C = '#5b6872';
  const l = { ...div.layout, title: { text: title, x: 0.01, font: { size: 15 } }, margin: { ...div.layout.margin, t: 48, b: Math.max(46, (div.layout.margin || {}).b || 0) + 16 },
    annotations: [...(div.layout.annotations || []), { text: `${source} · GAP-Insights`, xref: 'paper', yref: 'paper', x: 0, y: -0.02, yanchor: 'top', yshift: -18, showarrow: false, font: { size: 10, color: C } }],
    paper_bgcolor: '#fff', width, height: height || Math.max(420, (div.layout.height || 320) + 110) };
  return Plotly.toImage({ data: div.data, layout: l }, { format: 'png', width, height: l.height, scale: 2 });
}

/** PNG data URL → JPEG data URL (white background); keeps PDFs small */
function toJpeg(dataUrl, q = 0.88) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0); res(c.toDataURL('image/jpeg', q)); };
    i.src = dataUrl;
  });
}

const imgSize = (dataUrl) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = dataUrl; });

/** one export item: {title, sentence(html), source, div (Plotly, optional), table {columns, rows}} */
export async function exportItems(format, items, { name } = {}) {
  items = items.filter(Boolean);
  if (!items.length) { toast('Nichts zu exportieren.'); return; }
  const base = fileName(name || items[0].title);
  try {
    toast('Export wird erstellt …');
    if (format === 'png') return await asPng(items[0], base);
    if (format === 'csv') return asCsv(items, base);
    if (format === 'xlsx') return await asXlsx(items, base);
    if (format === 'pdf') return await asPdf(items, base, name);
    if (format === 'pptx') return await asPptx(items, base, name);
  } catch (e) {
    console.error(e); toast(`Export nicht möglich: ${e.message}`);
  }
}

async function asPng(it, base) {
  const url = await chartImage(it.div, it.title, it.source);
  if (!url) { toast('Für diese Karte gibt es kein Bild – bitte Excel oder CSV wählen.'); return; }
  const a = document.createElement('a'); a.href = url; a.download = `${base}.png`; a.click(); toast('Bild gespeichert');
}

function csvCell(v) {
  if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return '';
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function asCsv(items, base) {
  // Swiss Excel: semicolon as separator, point as decimal mark, UTF-8 with BOM
  const parts = items.map((it) => [
    [it.title], ...(it.sentence ? [[strip(it.sentence)]] : []), [],
    it.table.columns, ...it.table.rows, [], ...(it.definition ? [[`Definition: ${it.definition}`]] : []), ...(it.note ? [[`Notiz: ${it.note}`]] : []),
    [it.source], [`Export GAP-Insights, ${today()}`],
  ].map((r) => r.map(csvCell).join(';')).join('\r\n'));
  save(new Blob(['﻿' + parts.join('\r\n\r\n')], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
  toast('CSV gespeichert');
}

async function asXlsx(items, base) {
  const XLSX = await lib('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set();
  items.forEach((it, k) => {
    const aoa = [[it.title], ...(it.sentence ? [[strip(it.sentence)]] : []), [], it.table.columns, ...it.table.rows, [],
      ...(it.definition ? [[`Definition: ${it.definition}`]] : []), ...(it.note ? [[`Notiz: ${it.note}`]] : []), [it.source], [`Export GAP-Insights, ${today()}`]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = it.table.columns.map((c, j) => ({ wch: Math.min(48, Math.max(12, String(c).length + 2, ...it.table.rows.map((r) => String(r[j] ?? '').length + 2))) }));
    let sheet = (it.sheet || it.title).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || `Tabelle ${k + 1}`;
    while (used.has(sheet)) sheet = `${sheet.slice(0, 25)} ${k + 1}`;
    used.add(sheet);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  });
  XLSX.writeFile(wb, `${base}.xlsx`);
  toast('Excel-Datei gespeichert');
}

async function asPdf(items, base, name) {
  const { jsPDF } = await lib('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297; const H = 210; const M = 14;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (k > 0) doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(23, 35, 44);
    doc.text(doc.splitTextToSize(it.title, W - 2 * M), M, M + 4);
    let y = M + 12;
    if (it.sentence) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      const lines = doc.splitTextToSize(strip(it.sentence), W - 2 * M); doc.text(lines, M, y); y += lines.length * 5 + 3;
    }
    if (it.note) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(91, 104, 114);
      const lines = doc.splitTextToSize(`Notiz: ${it.note}`, W - 2 * M); doc.text(lines, M, y); y += lines.length * 5 + 2;
    }
    const img = await chartImage(it.div, it.title, it.source, { width: 1200 });
    if (img) {
      const [iw, ih] = await imgSize(img);
      const maxW = W - 2 * M; const maxH = H - y - M - 8;
      const s = Math.min(maxW / iw, maxH / ih);
      doc.addImage(await toJpeg(img), 'JPEG', M, y, iw * s, ih * s);
    } else {
      tablePdf(doc, it.table, M, y, W - 2 * M, H - M - 10);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(91, 104, 114);
    doc.text(`${it.source} · GAP-Insights · ${today()}${items.length > 1 ? ` · Seite ${k + 1}/${items.length}` : ''}`, M, H - 7);
  }
  save(doc.output('blob'), `${base}.pdf`);
  toast('PDF gespeichert');
}

function tablePdf(doc, table, x, y, w, yMax) {
  const n = table.columns.length; const cw = w / n;
  doc.setFontSize(8.5); doc.setTextColor(23, 35, 44);
  const row = (cells, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    cells.forEach((c, j) => doc.text(doc.splitTextToSize(String(c ?? ''), cw - 2)[0] || '', x + j * cw, y));
    y += 5;
  };
  row(table.columns, true);
  for (const r of table.rows) { if (y > yMax) { doc.text('… (vollständige Tabelle im Excel-Export)', x, y); break; } row(r, false); }
}

async function asPptx(items, base, name) {
  const PptxGenJS = await lib('pptx');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';            // 13.33 x 7.5 in
  pptx.title = name || items[0].title;
  const font = 'Arial';
  if (items.length > 1) {
    const s = pptx.addSlide();
    s.addText(name || 'GAP-Insights', { x: 0.6, y: 2.4, w: 12, h: 1, fontFace: font, fontSize: 36, bold: true, color: '17232C' });
    s.addText(`Zusammengestellt mit GAP-Insights · ${today()}`, { x: 0.6, y: 3.5, w: 12, h: 0.5, fontFace: font, fontSize: 16, color: '5B6872' });
  }
  for (const it of items) {
    const s = pptx.addSlide();
    s.addText(it.title, { x: 0.5, y: 0.3, w: 12.3, h: 0.7, fontFace: font, fontSize: 24, bold: true, color: '17232C' });
    let y = 1.0;
    if (it.sentence) { s.addText(strip(it.sentence), { x: 0.5, y, w: 12.3, h: 0.7, fontFace: font, fontSize: 14, color: '17232C' }); y += 0.75; }
    if (it.note) { s.addText(`Notiz: ${it.note}`, { x: 0.5, y, w: 12.3, h: 0.45, fontFace: font, fontSize: 12, italic: true, color: '5B6872' }); y += 0.5; }
    const img = await chartImage(it.div, it.title, it.source, { width: 1200 });
    if (img) {
      const [iw, ih] = await imgSize(img);
      const maxW = 12.3; const maxH = 7.5 - y - 0.6;
      const sc = Math.min(maxW / iw, maxH / ih);
      s.addImage({ data: img, x: 0.5 + (maxW - iw * sc) / 2, y, w: iw * sc, h: ih * sc });
    } else {
      const rows = [it.table.columns, ...it.table.rows.slice(0, 14)].map((r, j) => r.map((c) => ({ text: String(c ?? ''), options: { bold: j === 0, fontSize: 11, fontFace: font } })));
      s.addTable(rows, { x: 0.5, y, w: 12.3, border: { type: 'solid', color: 'DBE1E5', pt: 0.5 } });
    }
    s.addText(`${it.source} · GAP-Insights`, { x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontFace: font, fontSize: 10, color: '5B6872' });
  }
  await pptx.writeFile({ fileName: `${base}.pptx` });
  toast('PowerPoint gespeichert');
}

/** small dropdown menu next to a button; onPick(formatId) */
export function exportMenu(button, onPick, { formats = FORMATS } = {}) {
  document.querySelectorAll('.xmenu').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'xmenu'; menu.setAttribute('role', 'menu');
  menu.innerHTML = `<div class="xmenu-h">Exportieren als</div>${formats.map((f) => `<button type="button" role="menuitem" data-f="${f.id}">${esc(f.label)}</button>`).join('')}`;
  const r = button.getBoundingClientRect();
  menu.style.top = `${window.scrollY + r.bottom + 6}px`;
  menu.style.left = `${Math.max(8, Math.min(window.scrollX + r.right - 190, window.scrollX + document.documentElement.clientWidth - 200))}px`;
  document.body.appendChild(menu);
  menu.querySelector('button').focus();
  const close = () => { menu.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', key); };
  const outside = (e) => { if (!menu.contains(e.target) && e.target !== button) close(); };
  const key = (e) => {
    if (e.key === 'Escape') { close(); button.focus(); }
    const bs = [...menu.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { bs[(i + 1) % bs.length].focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { bs[(i - 1 + bs.length) % bs.length].focus(); e.preventDefault(); }
  };
  setTimeout(() => { document.addEventListener('click', outside, true); document.addEventListener('keydown', key); });
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { close(); onPick(b.dataset.f); } });
}
