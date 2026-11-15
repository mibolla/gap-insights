// Basis mode: which topics and indicators are shown, and the plain-language context beside the results.
// The Experte mode shows everything and leaves the context texts out.
import { isPro } from './store.js?v=20261115161705';

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
