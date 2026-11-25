// Basis mode: which topics and indicators are shown, and the plain-language context beside the results.
// The Experte mode shows everything and leaves the context texts out.
import { isPro } from './store.js?v=20261125230606';

/** topics only shown in the Experte mode */
export const PRO_SUBS = new Set(['bewegungen', 'kosten', 'finanzierung', 'kennzahlen', 'statamb']);
/** indicators of the Basis mode (cards, Rückblick buttons, forecast buttons) */
const CORE = new Set(['bev', 'a65', 'a80', 'g_bev', 'g80', 'hh1', 'al65', 'aph_pl80', 'spx_kl65', 'aph_g_pl80',
  'aph_bel', 'aph_alter', 'spx_stdfall', 'aph_vzplatz', 'spx_klvz', 'p_b80', 'p_a80', 'p_aph']);
export const isCore = (id) => CORE.has(id);
/** the indicators to show: all in the Experte mode, the core ones in the Basis mode (never an empty list) */
export function lean(ids, key = (x) => x) {
  if (isPro()) return ids;
  const c = ids.filter((x) => CORE.has(key(x)));
  return c.length ? c : ids.slice(0, 1);
}

/** one or two sentences per topic: what is this about? */
export const INTRO = {
  alter: 'Wie viele ältere Menschen leben hier – und wie verändert sich das? Die Zahl der Menschen ab 80 ist die wichtigste Grösse für die Planung von Pflege und Betreuung, denn in diesem Alter steigt der Bedarf deutlich.',
  haushalte: 'Wer allein lebt, hat im Alter seltener jemanden im Haus, der hilft. Die Haushaltstruktur zeigt, wie gross dieser Kreis ist.',
  inanspruchnahme: 'Wie viel Pflege wird heute genutzt – im Heim und zu Hause mit der Spitex? Die Zahlen zeigen die Nutzung, nicht den Bedarf: Wo es wenig Plätze gibt, kann auch wenig genutzt werden.',
  leistungen: 'Was leisten Pflegeheime und Spitex? Auslastung, Eintrittsalter und Pflegestunden zeigen, wie die Angebote gebraucht werden.',
  personal: 'Pflege braucht Menschen. Die Kennzahlen zeigen, wie viel Personal im Heim und in der Spitex für die Betreuung da ist.',
};

/** per indicator: why does this number matter? */
export const WHY = {
  bev: 'Die Grösse der Gemeinde bestimmt, welche Angebote sie selbst tragen kann und wo sie mit Nachbarn zusammenarbeitet.',
  a65: 'Ab 65 beginnt für die meisten der Ruhestand. Ein hoher Anteil heisst: mehr Nachfrage nach altersgerechtem Wohnen, Mobilität und Begegnung.',
  a80: 'Ab 80 steigt der Bedarf an Pflege und Betreuung stark. Dieser Anteil ist die zentrale Planungsgrösse.',
  g_bev: 'Wächst die Gemeinde insgesamt, wachsen meist auch die Aufgaben – aber nicht alle Altersgruppen gleich schnell.',
  g80: 'Wie schnell die Gruppe ab 80 wächst, zeigt, wie rasch zusätzliche Pflege und Betreuung nötig werden.',
  hh1: 'Wer allein wohnt, ist bei Krankheit oder Gebrechlichkeit eher auf Hilfe von aussen angewiesen.',
  al65: 'Allein lebende ältere Menschen brauchen früher Unterstützung durch Spitex, Nachbarschaft oder ein Heim.',
  aph_pl80: 'So viele Pflegeheimplätze stehen am Ort für 1000 Menschen ab 80 bereit. Heime versorgen auch Nachbargemeinden – der Blick auf Bezirk und Kanton gehört dazu.',
  spx_kl65: 'So viele Menschen werden zu Hause von der Spitex betreut, bezogen auf 1000 Menschen ab 65. Ein hoher Wert kann heissen, dass viele länger daheim leben können.',
  aph_g_pl80: 'Sinkt der Wert, wächst die Bevölkerung ab 80 schneller als das Platzangebot.',
  aph_bel: 'Eine hohe Auslastung heisst: Es gibt wenig freie Plätze. Ab etwa 95 % wird es eng.',
  aph_alter: 'Ein hohes Eintrittsalter zeigt, dass Menschen lange zu Hause leben, bevor sie ins Heim ziehen.',
  spx_stdfall: 'So viele Stunden Spitex erhält eine Person im Durchschnitt pro Jahr. Mehr Stunden heissen aufwendigere Pflege zu Hause.',
  aph_vzplatz: 'Mehr Stellen pro Platz heissen mehr Zeit für die Bewohnerinnen und Bewohner – oder aufwendigere Pflege.',
  spx_klvz: 'So viele Klientinnen und Klienten betreut eine Vollzeitstelle. Je höher der Wert, desto weniger Zeit bleibt pro Person.',
  p_b80: 'Die Zahl der Menschen ab 80 bestimmt den künftigen Bedarf an Pflege. Das mittlere Szenario des BFS gilt als das wahrscheinlichste; tief und hoch zeigen die Spannweite.',
  p_a80: 'Der Anteil zeigt, wie stark die Alterung das Gemeindeleben prägen wird – unabhängig davon, ob die Gemeinde wächst.',
  p_aph: 'Eine einfache Hochrechnung: Wenn künftig gleich viele von 1000 Menschen ab 80 einen Heimplatz brauchen wie heute im Kanton, sind so viele Plätze nötig.',
};
export const whyHTML = (id) => (!isPro() && WHY[id] ? `<p class="ctx"><b>Warum das zählt</b>${WHY[id]}</p>` : '');

/** indicators shown together in one card, switched with buttons (order and button labels as given).
 *  Spitex und Altersheime: per Unterthema one card per source (Pflegeheime, Spitex). The same card shows the 2024 comparison
 *  (Heute: bars + map) and the time series (Rückblick: lines; Heime 2012–2024, Spitex 2021–2024). */
export const IND_GROUPS = [
  { ids: ['a65', 'a80', 'aq', 'dalt', 'aus', 'bev'], label: 'Bevölkerung: Altersstruktur',
    btn: { a65: 'Anteil ab 65', a80: 'Anteil ab 80', aq: 'Altersquotient', dalt: 'Durchschnittsalter', aus: 'Anteil Ausland', bev: 'Einwohner' } },
  { ids: ['g80', 'g65', 'g_bev'], label: 'Bevölkerung: Veränderung seit 2012',
    btn: { g80: 'ab 80', g65: 'ab 65', g_bev: 'Gesamte Bevölkerung' } },
  { ids: ['hh1', 'hhs', 'al65', 'al85', 'koll85'], label: 'Haushalte und Wohnen im Alter',
    btn: { hh1: 'Einpersonenhaushalte', hhs: 'Haushaltsgrösse', al65: 'Allein ab 65', al85: 'Allein ab 85', koll85: 'Im Heim ab 85' } },
  // Inanspruchnahme
  { src: 'aph', ids: ['aph_pl80', 'aph_kl80'], label: 'Pflegeheime: Inanspruchnahme',
    btn: { aph_pl80: 'Plätze pro 1000 ab 80', aph_kl80: 'Bewohnende pro 1000 ab 80' } },
  { src: 'aph', ids: ['aph_g_pl80', 'aph_g_pl', 'aph_g_kl80'], label: 'Pflegeheime: Veränderung seit 2012',
    btn: { aph_g_pl80: 'Plätze pro 1000 ab 80', aph_g_pl: 'Zahl der Plätze', aph_g_kl80: 'Bewohnende pro 1000 ab 80' } },
  { src: 'spx', ids: ['spx_kl65', 'spx_std65'], label: 'Spitex: Inanspruchnahme',
    btn: { spx_kl65: 'Klienten pro 1000 ab 65', spx_std65: 'Stunden pro Person ab 65' } },
  // Leistungen
  { src: 'aph', ids: ['aph_bel', 'aph_alter', 'aph_dauer', 'aph_frauen', 'aph_ausserkt', 'aph_fluk', 'aph_klheim'], label: 'Pflegeheime: Belegung und Bewohnende',
    btn: { aph_bel: 'Belegung', aph_alter: 'Eintrittsalter', aph_dauer: 'Aufenthaltsdauer', aph_frauen: 'Frauenanteil', aph_ausserkt: 'Aus anderen Kantonen', aph_fluk: 'Fluktuation', aph_klheim: 'Heimgrösse' } },
  { src: 'aph', ids: ['aph_stufe', 'aph_leicht2', 'aph_leicht3', 'aph_stufe3', 'aph_schwer4', 'aph_mittel48', 'aph_schwer9'], label: 'Pflegeheime: Pflegestufen',
    btn: { aph_stufe: 'Durchschnitt', aph_leicht2: 'Stufe 0–2', aph_leicht3: '0–3', aph_stufe3: '3', aph_schwer4: '4–12', aph_mittel48: '4–8', aph_schwer9: '9–12' } },
  { src: 'spx', ids: ['spx_stdfall', 'spx_stdkl', 'spx_hws', 'spx_ber', 'spx_beh', 'spx_grund', 'spx_frauen'], label: 'Spitex: Leistungen',
    btn: { spx_stdfall: 'Stunden pro Fall', spx_stdkl: 'Stunden pro Klient', spx_hws: 'Anteil Hauswirtschaft', spx_ber: 'Abklärung, Beratung', spx_beh: 'Behandlungspflege', spx_grund: 'Grundpflege', spx_frauen: 'Frauenanteil' } },
  // Personal
  { src: 'aph', ids: ['aph_vzplatz', 'aph_vzbt', 'aph_qual', 'aph_qualpt', 'aph_pflant', 'aph_verwant'], label: 'Pflegeheime: Personal',
    btn: { aph_vzplatz: 'Stellen pro Platz', aph_vzbt: 'Stellen pro 1000 Tage', aph_qual: 'Qualifiziert', aph_qualpt: 'Qualifiziert pro 1000 Pflegetage', aph_pflant: 'Anteil Pflege', aph_verwant: 'Anteil Verwaltung' } },
  { src: 'spx', ids: ['spx_klvz', 'spx_stdvz', 'spx_hwsvz', 'spx_tert', 'spx_pflant', 'spx_admant', 'spx_penspfl', 'spx_pensadm'], label: 'Spitex: Personal',
    btn: { spx_klvz: 'Klienten pro Stelle', spx_stdvz: 'Pflegestunden pro Stelle', spx_hwsvz: 'Hauswirtschaft pro Stelle', spx_tert: 'Tertiärabschluss', spx_pflant: 'Anteil Pflege', spx_admant: 'Anteil Administration', spx_penspfl: 'Pensum Pflege', spx_pensadm: 'Pensum Administration' } },
  // Kosten
  { src: 'aph', ids: ['aph_kbt', 'aph_kvg', 'aph_pensk', 'aph_kvgant', 'aph_lohnvz'], label: 'Pflegeheime: Kosten',
    btn: { aph_kbt: 'Kosten pro Tag', aph_kvg: 'KVG-Pflege pro Tag', aph_pensk: 'Pension pro Tag', aph_kvgant: 'Anteil KVG-Pflege', aph_lohnvz: 'Personalaufwand pro Stelle' } },
  { src: 'spx', ids: ['spx_aufkl', 'spx_chfstd', 'spx_hwsstd', 'spx_persant', 'spx_lohnvz'], label: 'Spitex: Kosten',
    btn: { spx_aufkl: 'Aufwand pro Klient', spx_chfstd: 'Einnahmen pro Pflegestunde', spx_hwsstd: 'Einnahmen pro HWS-Stunde', spx_persant: 'Anteil Personalaufwand', spx_lohnvz: 'Personalaufwand pro Stelle' } },
  // Finanzierung
  { src: 'aph', ids: ['aph_pens', 'aph_pfltax', 'aph_subv', 'aph_penstag', 'aph_marge'], label: 'Pflegeheime: Finanzierung',
    btn: { aph_pens: 'Anteil Pensionstaxen', aph_pfltax: 'Anteil Pflegetaxen', aph_subv: 'Anteil Subventionen', aph_penstag: 'Pensionstaxe pro Tag', aph_marge: 'Betriebsergebnis' } },
  { src: 'spx', ids: ['spx_ktgem', 'spx_versstd', 'spx_klstd', 'spx_ktgemant', 'spx_marge'], label: 'Spitex: Finanzierung',
    btn: { spx_ktgem: 'Kanton + Gemeinden pro Std.', spx_versstd: 'Versicherer pro Std.', spx_klstd: 'Klienten pro Std.', spx_ktgemant: 'Anteil Kanton + Gemeinden', spx_marge: 'Betriebsergebnis' } },
];
/** the topics of «Spitex und Altersheime» whose cards follow this logic, and the explanation shown above them */
export const CARD_LOGIC_SUBS = new Set(['inanspruchnahme', 'leistungen', 'personal', 'kosten', 'finanzierung']);
export const cardLogic = (zeit, pro) => (zeit === 'rueckblick'
  ? `<b>Rückblick:</b> dieselben Karten wie in «Heute» – je Quelle eine Karte, die Knöpfe wählen die Kennzahl. Hier als Zeitreihe: Pflegeheime 2012–${'{J}'}, Spitex 2021–${'{J}'} (das BAG veröffentlicht Spitex-Kennzahlen seit 2021).`
  : `<b>Heute ${'{J}'}:</b> je Quelle (Pflegeheime, Spitex) eine Karte, die Knöpfe wählen die Kennzahl. Die Balken vergleichen mit Bezirk, Kanton und Schweiz${pro ? '; «Auf Karte zeigen» legt den Wert aller Gemeinden, Bezirke oder Kantone daneben' : ''}. Den Verlauf derselben Kennzahlen zeigt der Rückblick.`);
export const groupOf = (id) => IND_GROUPS.find((g) => g.ids.includes(id)) || null;
