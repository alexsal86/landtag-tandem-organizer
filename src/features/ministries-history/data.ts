/**
 * Belegte Namensgeschichte der Ministerien Baden-Württembergs seit 1952.
 *
 * Grundlage sind die Bekanntmachungen der Landesregierung über die Abgrenzung
 * der Geschäftsbereiche der Ministerien und die zugehörigen Bezeichnungsakte im
 * Gesetzblatt. Jede Phase nennt ihre Quelle und ob sie im Original geprüft ist.
 * Nicht geprüfte Zwischenstufen sind ausdrücklich als solche gekennzeichnet.
 */

export type SourceKind = "gesetzblatt" | "chronik" | "system" | "sekundaer";

export interface MinistrySource {
  kind: SourceKind;
  /** Zitierfähige Fundstelle, z. B. "GBl. 1954 S. 109". */
  citation: string;
  detail?: string;
  url?: string;
}

export interface MinistryPhase {
  id: string;
  /** Ressortlinie; entspricht den IDs aus parlis_ministry_lines, ergänzt um Sonderlinien. */
  lineId: string;
  name: string;
  /** Beginn (ISO-Datum); "1952-07-08" ist die Gründungsbekanntmachung. */
  from: string;
  /** Ende (ISO-Datum) oder null, wenn die Bezeichnung heute noch gilt. */
  to: string | null;
  note?: string;
  source: MinistrySource;
  /** true = Bezeichnung im Gesetzblatt im Original geprüft. */
  verified: boolean;
}

export interface LegislativePeriod {
  number: number;
  /** Beginn laut election_history_periods (starts_on). */
  from: string;
  /** Ende laut election_history_periods (ends_on bzw. erwartetes Ende). */
  to: string;
  cabinet: string;
  /** true = Ende steht noch aus (erwartetes Ende). */
  expected?: boolean;
  source: MinistrySource;
}

/** Eine Ministerin oder ein Minister mit Amtszeit und Ressortlinie. */
export interface MinisterTerm {
  id: string;
  lineId: string;
  name: string;
  party: string;
  from: string;
  /** null = im Amt. */
  to: string | null;
  /** Ressortbezeichnung während der Amtszeit, wenn sie vom Linientitel abweicht. */
  office?: string;
  note?: string;
}

export interface Finding {
  id: string;
  topic: string;
  previous: string;
  corrected: string;
  source: MinistrySource;
}

export interface RessortLine {
  id: string;
  label: string;
  /** Kurzzeichen für die Kontinuität: ● dieselbe Behörde, ◐ Kern gleich, ○ neu/aufgelöst. */
  marker: "●" | "◐" | "○";
}

const gbl = (year: number, page: number, issue: string, detail?: string, file?: string): MinistrySource => ({
  kind: "gesetzblatt",
  citation: `GBl. ${year} S. ${page}`,
  detail,
  url: file ? `https://www.landtag-bw.de/files/live/sites/LTBW/files/dokumente/gesetzblaetter/${year}/${file}` : undefined,
});

const chronik = (citation: string, detail?: string): MinistrySource => ({ kind: "chronik", citation, detail });
const system = (detail?: string): MinistrySource => ({
  kind: "system",
  citation: "election_history_periods (Wahlperioden-Blatt 1952–2026)",
  detail,
  url: "https://www.landtag-bw.de/resource/blob/618426/0fbd0f925d6293b2ad676a2761069f3f/17_0139_28012026.pdf",
});
const sekundaer = (citation: string, detail?: string): MinistrySource => ({ kind: "sekundaer", citation, detail });

export const ressortLines: RessortLine[] = [
  { id: "state", label: "Staatsministerium", marker: "●" },
  { id: "interior", label: "Inneres", marker: "●" },
  { id: "justice", label: "Justiz", marker: "◐" },
  { id: "finance", label: "Finanzen", marker: "●" },
  { id: "education", label: "Kultus und Schule", marker: "●" },
  { id: "science", label: "Wissenschaft, Forschung und Kunst", marker: "◐" },
  { id: "economy", label: "Wirtschaft", marker: "◐" },
  { id: "social", label: "Arbeit und Soziales", marker: "◐" },
  { id: "rural", label: "Landwirtschaft und Ländlicher Raum", marker: "◐" },
  { id: "environment", label: "Umwelt", marker: "○" },
  { id: "transport", label: "Verkehr", marker: "○" },
  { id: "housing", label: "Landesentwicklung und Wohnen", marker: "○" },
  { id: "displaced", label: "Vertriebene und Kriegsgeschädigte (1952–1960)", marker: "○" },
  { id: "europe", label: "Bundes- und Europaangelegenheiten", marker: "○" },
  { id: "family", label: "Familie, Frauen, Weiterbildung und Kunst (1992–1996)", marker: "○" },
];

/**
 * Beginn und Ende stammen aus der Systemtabelle election_history_periods, gefüllt aus dem
 * geprüften Wahlperioden-Blatt der Arbeitsmappe. Die Enden sind keine Schätzungen: es sind die
 * in der Tabelle hinterlegten (bzw. bei Periode 18 das erwartete) Enden.
 */
export const legislativePeriods: LegislativePeriod[] = [
  { number: 1, from: "1952-03-25", to: "1956-03-31", cabinet: "Maier / Müller I", source: system("Beginn der Verfassunggebenden Landesversammlung; ab 19.11.1953 erster Landtag.") },
  { number: 2, from: "1956-04-01", to: "1960-03-31", cabinet: "Müller II / Kiesinger I", source: system("Sonderregelung: vor der 3. Wahlperiode lagen April und Mai 1960.") },
  { number: 3, from: "1960-06-01", to: "1964-05-31", cabinet: "Kiesinger II", source: system("Wiederholungswahl am 12.03.1961 in zwei Wahlkreisen.") },
  { number: 4, from: "1964-06-01", to: "1968-05-31", cabinet: "Kiesinger III / Filbinger I", source: system() },
  { number: 5, from: "1968-06-01", to: "1972-05-31", cabinet: "Filbinger II", source: system() },
  { number: 6, from: "1972-06-01", to: "1976-05-31", cabinet: "Filbinger III", source: system() },
  { number: 7, from: "1976-06-01", to: "1980-05-31", cabinet: "Filbinger IV / Späth I", source: system() },
  { number: 8, from: "1980-06-01", to: "1984-05-31", cabinet: "Späth I", source: system() },
  { number: 9, from: "1984-06-01", to: "1988-05-31", cabinet: "Späth II", source: system() },
  { number: 10, from: "1988-06-01", to: "1992-05-31", cabinet: "Späth III / Teufel I", source: system() },
  { number: 11, from: "1992-06-01", to: "1996-05-31", cabinet: "Teufel II", source: system() },
  { number: 12, from: "1996-06-01", to: "2001-05-31", cabinet: "Teufel III", source: system("Erste regulär fünfjährige Wahlperiode.") },
  { number: 13, from: "2001-06-01", to: "2006-05-31", cabinet: "Teufel IV / Oettinger I", source: system() },
  { number: 14, from: "2006-06-01", to: "2011-04-30", cabinet: "Oettinger II / Mappus", source: system("Wahlperiode wegen Verfassungsänderung 2008 um einen Monat verkürzt.") },
  { number: 15, from: "2011-05-01", to: "2016-04-30", cabinet: "Kretschmann I", source: system() },
  { number: 16, from: "2016-05-01", to: "2021-04-30", cabinet: "Kretschmann II", source: system() },
  { number: 17, from: "2021-05-01", to: "2026-04-30", cabinet: "Kretschmann III", source: system() },
  { number: 18, from: "2026-05-01", to: "2031-04-30", cabinet: "Özdemir", expected: true, source: system("Reguläres, noch zukünftiges Ende; vorbehaltlich vorzeitiger Auflösung.") },
];

export const ministryPhases: MinistryPhase[] = [
  // Staatsministerium
  {
    id: "state-1952", lineId: "state", name: "Staatsministerium", from: "1952-07-08", to: null,
    note: "Abschnitt I: Verfassungsfragen, Verkehr mit dem Landtag, Beziehungen zum Bund, Vertretung beim Bund.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Bekanntmachung der vorläufigen Regierung über die Abgrenzung der Geschäftsbereiche der Ministerien vom 8. Juli 1952", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "state-1992", lineId: "state", name: "Staatsministerium mit Geschäftsbereichen des Ministers (Bundes- und Europaangelegenheiten, Verwaltungsreform, Medienpolitik)", from: "1992-07-14", to: "1996-06-17",
    note: "Erwin Vetter als Minister im Staatsministerium; der eigene Abschnitt für Bundes- und Europaangelegenheiten blieb daneben bestehen.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt I", "GBl199223.pdf"),
    verified: true,
  },

  // Inneres
  {
    id: "interior-1952", lineId: "interior", name: "Innenministerium", from: "1952-07-08", to: "1960-07-04",
    note: "Auffangressort: Gesundheitswesen (Nr. 9), Bau- und Siedlungswesen (Nr. 12), Landesplanung (Nr. 13), Verkehr (Nr. 16), Vermessung (Nr. 17).",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt III", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "interior-1960", lineId: "interior", name: "Innenministerium (mit Vertriebenen, Flüchtlingen und Kriegsgeschädigten)", from: "1960-07-05", to: null,
    note: "Das Vertriebenenministerium wird in das Innenministerium eingegliedert; ab 7.7.1960 führt ein Staatssekretär den Restgeschäftsbereich.",
    source: gbl(1960, 133, "Nr. 14 vom 27.7.1960", "Verordnung vom 5. Juli 1960", "GBl196014.pdf"),
    verified: true,
  },
  {
    id: "interior-1992", lineId: "interior", name: "Innenministerium mit Vertriebenen, Flüchtlingen, Aussiedlern und Kriegsgeschädigten sowie Lastenausgleich", from: "1992-07-14", to: "2026-05-12",
    note: "Abschnitt III Nr. 11 und 12 in der Fassung von 1992.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "interior-2026", lineId: "interior", name: "Ministerium des Inneren, für Digitalisierung und Europa", from: "2026-05-13", to: null,
    note: "Namensstand der 18. Wahlperiode aus dem PARLIS-Ressortbestand; kein Gesetzblattabgleich.",
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Justiz
  {
    id: "justice-1952", lineId: "justice", name: "Justizministerium", from: "1952-07-08", to: "1991-02-11",
    note: "Die Bezeichnung „Ministerium der Justiz“ ist für die Zwischenzeit nicht im Original geprüft. 1991 wird die Überschrift ausdrücklich (wieder) auf „Justizministerium“ gefasst.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt II", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "justice-1991", lineId: "justice", name: "Justizministerium (JuM)", from: "1991-02-12", to: "2026-05-12",
    source: gbl(1991, 65, "Bekanntmachung vom 4. Februar 1991, in Kraft 12.2.1991", "Abschnitt II, Kurzzeichen JuM"),
    verified: true,
  },
  {
    id: "justice-2026", lineId: "justice", name: "Ministerium der Justiz und für Migration", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Finanzen
  {
    id: "finance-1952", lineId: "finance", name: "Finanzministerium", from: "1952-07-08", to: null,
    note: "Abschnitt V: Finanzpolitik, Haushalt, Landesvermögen, Besoldung, Steuern, Statistik.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt V", "GBl195207.pdf"),
    verified: true,
  },

  // Kultus
  {
    id: "education-1952", lineId: "education", name: "Kultministerium", from: "1952-07-08", to: "1954-08-05",
    note: "Abschnitt IV: Bildung und Erziehung, Kunst- und Kulturpflege, Religionsgemeinschaften, Rundfunk und Presse.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt IV", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "education-1954", lineId: "education", name: "Kultusministerium", from: "1954-08-06", to: "1996-06-17",
    note: "Beschluss vom 19. Juli 1954, verkündet am 6. August 1954. Die Umbenennung erfolgte durch eine eigene Bezeichnungs-Bekanntmachung, nicht durch Änderung der Geschäftsbereiche. Ab 1978 zusätzlich „und Sport“ (nicht im Original geprüft).",
    source: gbl(1954, 109, "Nr. 17 vom 6.8.1954", "Bekanntmachung der Landesregierung über die Bezeichnung des Kultusministeriums vom 19. Juli 1954", "GBl195417.pdf"),
    verified: true,
  },
  {
    id: "education-1996", lineId: "education", name: "Ministerium für Kultus, Jugend und Sport (Kultusministerium; KM)", from: "1996-06-18", to: "2026-05-12",
    note: "Weiterbildung und Kunstpflege gehen 1992 an das neue Familien- und Kunstministerium; 1996 kommen Jugend und Sport in den Namen.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt IV", "GBl199618.pdf"),
    verified: true,
  },
  {
    id: "education-2026", lineId: "education", name: "Ministerium für Kultus", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Wissenschaft
  {
    id: "science-1992", lineId: "science", name: "Ministerium für Wissenschaft und Forschung (Wissenschaftsministerium; MWF)", from: "1992-07-14", to: "1996-06-17",
    note: "Die Kunst wird am selben Tag aus diesem Haus herausgelöst.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt V", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "science-1996", lineId: "science", name: "Ministerium für Wissenschaft, Forschung und Kunst", from: "1996-06-18", to: null,
    note: "1996 kommen Kunst- und Musikhochschulen sowie die Kunstpflege zurück.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt V", "GBl199618.pdf"),
    verified: true,
  },

  // Wirtschaft
  {
    id: "economy-1952", lineId: "economy", name: "Wirtschaftsministerium", from: "1952-07-08", to: "1972-09-30",
    note: "Abschnitt VI: Industrie, Handwerk, Handel, Preise, Geld- und Kreditwesen, Energie, Bergbau.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt VI", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "economy-1972", lineId: "economy", name: "Ministerium für Wirtschaft, Mittelstand und Verkehr", from: "1972-10-01", to: "1984-07-14",
    note: "Der Verkehr kommt zum 1.10.1972 aus dem Innenministerium hinzu.",
    source: gbl(1972, 400, "Nr. 16 vom 16.8.1972", "Zweites Gesetz über die Änderung von Zuständigkeiten der Ministerien", "GBl197216.pdf"),
    verified: true,
  },
  {
    id: "economy-1984", lineId: "economy", name: "Ministerium für Wirtschaft, Mittelstand und Technologie", from: "1984-07-15", to: "2026-05-12",
    note: "Der Verkehr geht 1984 an das Innenministerium. Ob die Langform zwischen 1992 und 2001 geändert wurde, ist nicht im Original geklärt; „Wirtschaftsministerium“ ist ab 1993 als Kurzform belegt.",
    source: gbl(1984, 390, "Nr. 14 vom 13.7.1984", "Bekanntmachung vom 2. Juli 1984", "GBl198414.pdf"),
    verified: true,
  },
  {
    id: "economy-2026", lineId: "economy", name: "Ministerium für Wirtschaft, Handwerk und Tourismus", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Arbeit und Soziales
  {
    id: "social-1952", lineId: "social", name: "Arbeitsministerium", from: "1952-07-08", to: "1966-12-15",
    note: "Abschnitt VIII: Arbeitsrecht und Arbeitsschutz, Sozialversicherung, Kriegsopferversorgung. Sozialhilfe und Gesundheitswesen liegen bis 1972 beim Innenministerium.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt VIII", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "social-1966", lineId: "social", name: "Arbeits- und Sozialministerium", from: "1966-12-16", to: "1972-09-30",
    note: "Bezeichnung ab dem Kabinett Filbinger I (16.12.1966); im Gesetzblatt ab Januar 1967 belegt.",
    source: gbl(1967, 9, "Nr. 2 vom 10.2.1967", "Verordnung des Arbeits- und Sozialministeriums vom 20. Januar 1967", "GBl196702.pdf"),
    verified: true,
  },
  {
    id: "social-1972", lineId: "social", name: "Ministerium für Arbeit, Gesundheit und Sozialordnung", from: "1972-10-01", to: "1984-07-14",
    note: "Sozialhilfe und Gesundheitsvorsorge kommen zum 1.7.1972 hinzu, die Bezeichnung ändert sich zum 1.10.1972.",
    source: gbl(1972, 404, "Nr. 16 vom 16.8.1972", "Bekanntmachung vom 25. Juli 1972", "GBl197216.pdf"),
    verified: true,
  },
  {
    id: "social-1984", lineId: "social", name: "Ministerium für Arbeit, Gesundheit, Familie und Sozialordnung", from: "1984-07-15", to: "1991-02-11",
    source: gbl(1984, 390, "Nr. 14 vom 13.7.1984", "Bekanntmachung vom 2. Juli 1984, Abschnitt IX", "GBl198414.pdf"),
    verified: true,
  },
  {
    id: "social-1991", lineId: "social", name: "Ministerium für Arbeit, Gesundheit, Familie und Frauen (Sozialministerium; SM)", from: "1991-02-12", to: "1992-07-13",
    note: "Der Kurzname „Sozialministerium“ ist bereits Teil der amtlichen Überschrift.",
    source: gbl(1991, 65, "Bekanntmachung vom 4. Februar 1991, in Kraft 12.2.1991"),
    verified: true,
  },
  {
    id: "social-1992", lineId: "social", name: "Ministerium für Arbeit, Gesundheit und Sozialordnung (Sozialministerium; SM)", from: "1992-07-14", to: "1996-06-17",
    note: "Familie und Frauen gehen an das neue Familien- und Kunstministerium, der Kurzname bleibt.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt IX", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "social-1996", lineId: "social", name: "Sozialministerium (SM)", from: "1996-06-18", to: "2026-05-12",
    note: "Der Kurzname wird zur alleinigen amtlichen Bezeichnung – nicht erst 2001.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt IX", "GBl199618.pdf"),
    verified: true,
  },
  {
    id: "social-2026", lineId: "social", name: "Ministerium für Soziales, Arbeit und Gesundheit", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Landwirtschaft
  {
    id: "rural-1952", lineId: "rural", name: "Landwirtschaftsministerium", from: "1952-07-08", to: "1953-05-03",
    note: "Abschnitt VII: Landwirtschaftsförderung, Bodenreform, Siedlung, Jagd und Fischerei, Forstwirtschaft, Domänen.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt VII", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "rural-1953", lineId: "rural", name: "Ministerium für Ernährung, Landwirtschaft und Forsten", from: "1953-05-04", to: "1962-02-15",
    note: "Umbenennung zum 4.5.1953 (Chronik); im Gesetzblatt ab August 1953 belegt.",
    source: gbl(1953, 118, "Nr. 19 vom 25.8.1953", "Verordnung des Ministeriums für Ernährung, Landwirtschaft und Forsten vom 12. August 1953", "GBl195319.pdf"),
    verified: true,
  },
  {
    id: "rural-1962", lineId: "rural", name: "Ministerium für Ernährung, Landwirtschaft, Weinbau und Forsten", from: "1962-02-16", to: "1972-09-30",
    note: "Regierungsbeschluss vom 16.2.1962; ein Gesetzblattakt dazu existiert nicht. Erste gesetzblattliche Verwendung am 18.4.1962.",
    source: gbl(1962, 32, "Nr. 5 vom 9.5.1962", "Anordnung des Ministeriums für Ernährung, Landwirtschaft, Weinbau und Forsten vom 18. April 1962", "GBl196205.pdf"),
    verified: true,
  },
  {
    id: "rural-1972", lineId: "rural", name: "Ministerium für Ernährung, Landwirtschaft und Umwelt", from: "1972-10-01", to: "1987-06-30",
    note: "Umwelt und Naturschutz kommen 1972 hinzu. Die Zwischenstufen „Umwelt und Forsten“ (ab 1980/81) und die Zusammenführung zum „Ländlichen Raum“ sind nicht im Original geprüft.",
    source: gbl(1972, 404, "Nr. 16 vom 16.8.1972", "Bekanntmachung vom 25. Juli 1972, Abschnitt VII", "GBl197216.pdf"),
    verified: true,
  },
  {
    id: "rural-1987", lineId: "rural", name: "Ministerium für Ländlichen Raum, Ernährung, Landwirtschaft und Forsten", from: "1987-07-01", to: "1996-06-17",
    note: "So die Ressortbezeichnung der 11. Wahlperiode (Chronik); kein Gesetzblattabgleich.",
    source: chronik("Chronik der Landesregierungen, 11. Wahlperiode 1992–1996"),
    verified: false,
  },
  {
    id: "rural-1996", lineId: "rural", name: "Ministerium Ländlicher Raum (MLR)", from: "1996-06-18", to: "2026-05-12",
    note: "Die Kurzform wird erst 1996 amtliche Überschrift – nicht schon 1987.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt VIII", "GBl199618.pdf"),
    verified: true,
  },
  {
    id: "rural-2026", lineId: "rural", name: "Ministerium für Ländlichen Raum, Landwirtschaft und Heimat", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Umwelt
  {
    id: "environment-1992", lineId: "environment", name: "Umweltministerium (UM)", from: "1992-07-14", to: "1996-06-17",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt X", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "environment-1996", lineId: "environment", name: "Ministerium für Umwelt und Verkehr (UVM)", from: "1996-06-18", to: "2026-05-12",
    note: "Das Verkehrsministerium wird 1996 in dieses Haus eingegliedert.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt X", "GBl199618.pdf"),
    verified: true,
  },
  {
    id: "environment-2026", lineId: "environment", name: "Ministerium für Umwelt, Klima und Energiewirtschaft", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Verkehr
  {
    id: "transport-1991", lineId: "transport", name: "Verkehrsministerium (VM)", from: "1991-02-12", to: "1996-06-17",
    note: "Eigener Abschnitt XII; der Verkehr war zuvor beim Innen-, ab 1972 beim Wirtschaftsministerium.",
    source: gbl(1991, 65, "Bekanntmachung vom 4. Februar 1991, in Kraft 12.2.1991", "Abschnitt XII"),
    verified: true,
  },
  {
    id: "transport-1996", lineId: "transport", name: "Abschnitt gestrichen; Verkehr im Ministerium für Umwelt und Verkehr", from: "1996-06-18", to: "2026-05-12",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Artikel 1 Nr. 9", "GBl199618.pdf"),
    verified: true,
  },
  {
    id: "transport-2026", lineId: "transport", name: "Ministerium für Verkehr", from: "2026-05-13", to: null,
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Landesentwicklung und Wohnen
  {
    id: "housing-2026", lineId: "housing", name: "Ministerium für Landesentwicklung und Wohnen", from: "2026-05-13", to: null,
    note: "Zuvor eigenständig seit 2011; davor beim Wirtschafts- bzw. Innenressort. Kein Gesetzblattabgleich.",
    source: sekundaer("PARLIS-Ressortbestand, 18. Wahlperiode"),
    verified: false,
  },

  // Vertriebene
  {
    id: "displaced-1952", lineId: "displaced", name: "Ministerium für Heimatvertriebene und Kriegsgeschädigte", from: "1952-07-08", to: "1953-09-13",
    note: "Abschnitt IX: Angelegenheiten der Vertriebenen, Sowjetzonenflüchtlinge, Kriegsgeschädigten, Soforthilfe und Lastenausgleich.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt IX", "GBl195207.pdf"),
    verified: true,
  },
  {
    id: "displaced-1953", lineId: "displaced", name: "Ministerium für Vertriebene, Flüchtlinge und Kriegsgeschädigte", from: "1953-09-14", to: "1960-07-04",
    note: "Umbenennung zum 14.9.1953 (Chronik); im Gesetzblatt 1960 belegt.",
    source: gbl(1960, 15, "Verordnung vom 9. Februar 1960", "Verordnung des Ministeriums für Vertriebene, Flüchtlinge und Kriegsgeschädigte"),
    verified: true,
  },
  {
    id: "displaced-1960", lineId: "displaced", name: "Aufgelöst – in das Innenministerium eingegliedert", from: "1960-07-05", to: null,
    note: "Eingliederung durch Organisationsverordnung der Landesregierung nach Art. 70 Abs. 2 der Verfassung, nicht durch die Geschäftsbereiche-Bekanntmachung.",
    source: gbl(1960, 133, "Nr. 14 vom 27.7.1960", "Verordnung über die Eingliederung des Ministeriums für Vertriebene, Flüchtlinge und Kriegsgeschädigte in das Innenministerium vom 5. Juli 1960", "GBl196014.pdf"),
    verified: true,
  },

  // Bundes- und Europaangelegenheiten
  {
    id: "europe-1991", lineId: "europe", name: "Ministerium für Bundes- und Europaangelegenheiten (Europaministerium; MBE)", from: "1991-02-12", to: "1992-07-13",
    source: gbl(1991, 65, "Bekanntmachung vom 4. Februar 1991, in Kraft 12.2.1991", "Abschnitt XI"),
    verified: true,
  },
  {
    id: "europe-1992", lineId: "europe", name: "Geschäftsbereiche des Ministers im Staatsministerium", from: "1992-07-14", to: "1996-06-17",
    note: "Der Abschnitt XI bleibt formal bestehen und wird erst 1996 gestrichen.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "europe-1996", lineId: "europe", name: "Abschnitt gestrichen", from: "1996-06-18", to: null,
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Artikel 1 Nr. 9", "GBl199618.pdf"),
    verified: true,
  },

  // Familie, Frauen, Weiterbildung und Kunst
  {
    id: "family-1992", lineId: "family", name: "Ministerium für Familie, Frauen, Weiterbildung und Kunst", from: "1992-07-14", to: "1996-06-17",
    note: "Neu gebildet aus Teilen des Kultus- und des Wissenschaftsministeriums (Weiterbildung, Kunst, Frauen, Familie).",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt VI", "GBl199223.pdf"),
    verified: true,
  },
  {
    id: "family-1996", lineId: "family", name: "Aufgelöst – Personalabwicklung beim Innenministerium", from: "1996-06-18", to: null,
    note: "Abschnitt I Nr. 15 überträgt die Abwicklung der Personalangelegenheiten des bisherigen Ministeriums dem Innenministerium.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Artikel 1 Nr. 2", "GBl199618.pdf"),
    verified: true,
  },
];

/** Wahlperioden, in die eine Namensphase fällt (Überlappung mit dem Periodenzeitraum). */
export function periodsForPhase(
  phase: Pick<MinistryPhase, "from" | "to">,
  periods: LegislativePeriod[] = legislativePeriods,
): number[] {
  const start = Date.parse(phase.from);
  const end = phase.to ? Date.parse(phase.to) : Number.POSITIVE_INFINITY;
  return periods
    .filter(period => Date.parse(period.from) <= end && Date.parse(period.to) >= start)
    .map(period => period.number);
}

/** Phasen einer Ressortlinie, chronologisch sortiert. */
export function phasesForLine(lineId: string, phases: MinistryPhase[] = ministryPhases): MinistryPhase[] {
  return phases
    .filter(phase => phase.lineId === lineId)
    .slice()
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** Phasen, die in einer Wahlperiode gelten. */
export function phasesForPeriod(periodNumber: number, phases: MinistryPhase[] = ministryPhases): MinistryPhase[] {
  return phases.filter(phase => periodsForPhase(phase).includes(periodNumber));
}

export const findings: Finding[] = [
  {
    id: "social-1996",
    topic: "Sozialministerium",
    previous: "Kurzname erst ab 2001",
    corrected: "Kurzname „Sozialministerium“ ist ab 12.2.1991 Teil der amtlichen Überschrift und ab 18.6.1996 die alleinige Bezeichnung.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt IX", "GBl199618.pdf"),
  },
  {
    id: "rural-1996",
    topic: "Ländlicher Raum",
    previous: "Ministerium Ländlicher Raum von 1987 bis 2001",
    corrected: "Die Kurzform wird erst am 18.6.1996 amtliche Überschrift; 1992–1996 lautet sie „Ländlicher Raum, Ernährung, Landwirtschaft und Forsten“.",
    source: gbl(1996, 490, "Nr. 18 vom 26.7.1996", "Bekanntmachung vom 18. Juni 1996, Abschnitt VIII", "GBl199618.pdf"),
  },
  {
    id: "science-1992",
    topic: "Wissenschaft",
    previous: "„Wissenschaft und Kunst“ bis 1996",
    corrected: "Ab 14.7.1992 heißt das Haus „Ministerium für Wissenschaft und Forschung“; die Kunst geht an das neue Familien- und Kunstministerium.",
    source: gbl(1992, 621, "Nr. 23 vom 29.9.1992", "Bekanntmachung vom 14. Juli 1992, Abschnitt V", "GBl199223.pdf"),
  },
  {
    id: "education-1954",
    topic: "Kultusministerium",
    previous: "Umbenennung „im August 1954“ ohne Datum",
    corrected: "Beschluss vom 19.7.1954, verkündet am 6.8.1954 durch eine eigene Bezeichnungs-Bekanntmachung.",
    source: gbl(1954, 109, "Nr. 17 vom 6.8.1954", "Bekanntmachung über die Bezeichnung des Kultusministeriums", "GBl195417.pdf"),
  },
  {
    id: "rural-1962",
    topic: "Weinbau",
    previous: "Zusatz „Weinbau“ ab 1966",
    corrected: "Zusatz ab dem Regierungsbeschluss vom 16.2.1962. Ein Gesetzblattakt dazu existiert nicht; erste Verwendung am 18.4.1962.",
    source: gbl(1962, 32, "Nr. 5 vom 9.5.1962", "Anordnung vom 18. April 1962", "GBl196205.pdf"),
  },
  {
    id: "social-1966",
    topic: "Arbeits- und Sozialministerium",
    previous: "ab 1968 „Ministerium für Arbeit und Soziales“, ab 1976 „Arbeit, Gesundheit und Sozialordnung“",
    corrected: "„Arbeits- und Sozialministerium“ ab 16.12.1966 (im Gesetzblatt ab Januar 1967); „Arbeit, Gesundheit und Sozialordnung“ bereits ab 1.10.1972.",
    source: gbl(1967, 9, "Nr. 2 vom 10.2.1967", "Verordnung des Arbeits- und Sozialministeriums vom 20. Januar 1967", "GBl196702.pdf"),
  },
  {
    id: "displaced-1960",
    topic: "Vertriebenenministerium",
    previous: "1952–1960 „Ministerium für Heimatvertriebene und Kriegsgeschädigte“, Auflösung unklar",
    corrected: "Ab 14.9.1953 „für Vertriebene, Flüchtlinge und Kriegsgeschädigte“; Auflösung durch Eingliederung in das Innenministerium zum 5.7.1960.",
    source: gbl(1960, 133, "Nr. 14 vom 27.7.1960", "Eingliederungsverordnung vom 5. Juli 1960", "GBl196014.pdf"),
  },
  {
    id: "names-1952",
    topic: "Gründungsnamen 1952",
    previous: "„Ministerium für Wirtschaft“, „für Landwirtschaft und Ernährung“, „für Arbeit“, „der Justiz“",
    corrected: "Die Bekanntmachung von 1952 nennt Justizministerium, Wirtschaftsministerium, Landwirtschaftsministerium und Arbeitsministerium.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abgrenzung der Geschäftsbereiche der Ministerien vom 8. Juli 1952", "GBl195207.pdf"),
  },
  {
    id: "europe-1952",
    topic: "Bundesangelegenheiten",
    previous: "eigenes Ministerium ab 1953",
    corrected: "Weder 1952 noch 1972 existiert ein Abschnitt für Bundesangelegenheiten; die Minister für Bundesangelegenheiten hatten keinen eigenen Geschäftsbereich.",
    source: gbl(1952, 21, "Nr. 7 vom 15.7.1952", "Abschnitt I Nr. 3 (Beziehungen zum Bund)", "GBl195207.pdf"),
  },
];

/**
 * Amtszeiten der Ministerinnen und Minister je Ressortlinie.
 * Grundlage sind die Chronik der Landesregierungen (LpB) und die Ministerlisten der Ressorts;
 * "bis" ist der belegte Amtsantritt der Nachfolge, nicht ein geschätztes Enddatum.
 */
export const ministerSourceNote = "Chronik der Landesregierungen (LpB) und Ministerlisten der Ressorts; „bis“ = Amtsantritt der Nachfolge.";

export const ministers: MinisterTerm[] = [
  // Staatsministerium / Minister im Staatsministerium
  { id: "state-vetter", lineId: "state", name: "Erwin Vetter", party: "CDU", from: "1992-06-11", to: "1996-06-12", office: "Minister im Staatsministerium (Bundes- und Europaangelegenheiten, Verwaltungsreform, Medienpolitik)" },
  { id: "state-palmer", lineId: "state", name: "Christoph-E. Palmer", party: "CDU", from: "1998-11-11", to: "2004-11-10", office: "Staatsministerium, ab 2001 auch europäische Angelegenheiten" },
  { id: "state-mueller", lineId: "state", name: "Ulrich Müller", party: "CDU", from: "2004-11-10", to: "2005-04-21", office: "Staatsministerium und europäische Angelegenheiten" },
  { id: "state-staechele", lineId: "state", name: "Willi Stächele", party: "CDU", from: "2005-04-21", to: "2008-06-04", office: "Staatsministerium und europäische Angelegenheiten" },
  { id: "state-reinhart", lineId: "state", name: "Wolfgang Reinhart", party: "CDU", from: "2008-06-04", to: "2010-02-10", office: "Staatsministerium, Bundes- und Europaangelegenheiten" },
  { id: "state-rau", lineId: "state", name: "Helmut Rau", party: "CDU", from: "2010-02-24", to: "2011-05-12", office: "Minister im Staatsministerium" },
  { id: "state-krebs", lineId: "state", name: "Silke Krebs", party: "GRÜNE", from: "2011-05-12", to: "2016-03-18", office: "Ministerin im Staatsministerium" },
  { id: "state-schopper", lineId: "state", name: "Theresa Schopper", party: "GRÜNE", from: "2018-10-09", to: "2021-05-12", office: "Staatsministerin (politische Koordination)" },

  // Inneres
  { id: "interior-ulrich", lineId: "interior", name: "Fritz Ulrich", party: "SPD", from: "1952-04-25", to: "1956-05-09" },
  { id: "interior-renner", lineId: "interior", name: "Viktor Renner", party: "SPD", from: "1956-05-09", to: "1960-06-23" },
  { id: "interior-filbinger", lineId: "interior", name: "Hans Filbinger", party: "CDU", from: "1960-06-23", to: "1966-12-16" },
  { id: "interior-krause", lineId: "interior", name: "Walter Krause", party: "SPD", from: "1966-12-16", to: "1972-06-08" },
  { id: "interior-schiess", lineId: "interior", name: "Karl Schiess", party: "CDU", from: "1972-06-08", to: "1978-02-22" },
  { id: "interior-spaeth", lineId: "interior", name: "Lothar Späth", party: "CDU", from: "1978-02-22", to: "1978-08-30" },
  { id: "interior-palm", lineId: "interior", name: "Guntram Palm", party: "CDU", from: "1978-08-30", to: "1980-06-04" },
  { id: "interior-herzog", lineId: "interior", name: "Roman Herzog", party: "CDU", from: "1980-06-04", to: "1983-10-05" },
  { id: "interior-eyrich", lineId: "interior", name: "Heinz Eyrich", party: "CDU", from: "1983-10-05", to: "1984-06-06", note: "zugleich Justizminister" },
  { id: "interior-schlee", lineId: "interior", name: "Dietmar Schlee", party: "CDU", from: "1984-06-06", to: "1992-06-11" },
  { id: "interior-birzele", lineId: "interior", name: "Frieder Birzele", party: "SPD", from: "1992-06-11", to: "1996-06-11" },
  { id: "interior-schaeuble", lineId: "interior", name: "Thomas Schäuble", party: "CDU", from: "1996-06-11", to: "2004-07-14" },
  { id: "interior-rech", lineId: "interior", name: "Heribert Rech", party: "CDU", from: "2004-07-14", to: "2011-05-12" },
  { id: "interior-gall", lineId: "interior", name: "Reinhold Gall", party: "SPD", from: "2011-05-12", to: "2016-05-12" },
  { id: "interior-strobl", lineId: "interior", name: "Thomas Strobl", party: "CDU", from: "2016-05-12", to: "2026-05-13" },
  { id: "interior-hagel", lineId: "interior", name: "Manuel Hagel", party: "CDU", from: "2026-05-13", to: null },

  // Justiz
  { id: "justice-renner", lineId: "justice", name: "Viktor Renner", party: "SPD", from: "1952-04-25", to: "1953-05-15" },
  { id: "justice-maier", lineId: "justice", name: "Reinhold Maier", party: "FDP/DVP", from: "1953-05-15", to: "1953-07-11", note: "kommissarisch" },
  { id: "justice-schmid", lineId: "justice", name: "Richard Schmid", party: "SPD", from: "1953-07-11", to: "1953-10-07", note: "Staatssekretär mit der Leitung des Ministeriums beauftragt" },
  { id: "justice-haussmann", lineId: "justice", name: "Wolfgang Haußmann", party: "FDP/DVP", from: "1953-10-07", to: "1966-12-16" },
  { id: "justice-schieler", lineId: "justice", name: "Rudolf Schieler", party: "SPD", from: "1966-12-16", to: "1972-06-08" },
  { id: "justice-bender", lineId: "justice", name: "Traugott Bender", party: "CDU", from: "1972-06-08", to: "1977-11-02" },
  { id: "justice-palm", lineId: "justice", name: "Guntram Palm", party: "CDU", from: "1977-11-02", to: "1978-08-30" },
  { id: "justice-eyrich", lineId: "justice", name: "Heinz Eyrich", party: "CDU", from: "1978-08-30", to: "1991-01-13" },
  { id: "justice-ohnewald", lineId: "justice", name: "Helmut Ohnewald", party: "CDU", from: "1991-01-22", to: "1992-06-11" },
  { id: "justice-schaeuble", lineId: "justice", name: "Thomas Schäuble", party: "CDU", from: "1992-06-11", to: "1996-06-11" },
  { id: "justice-goll-1", lineId: "justice", name: "Ulrich Goll", party: "FDP/DVP", from: "1996-06-11", to: "2002-12-12" },
  { id: "justice-werwigk", lineId: "justice", name: "Corinna Werwigk-Hertneck", party: "FDP/DVP", from: "2002-12-12", to: "2004-07-22" },
  { id: "justice-goll-2", lineId: "justice", name: "Ulrich Goll", party: "FDP/DVP", from: "2004-07-28", to: "2011-05-12" },
  { id: "justice-stickelberger", lineId: "justice", name: "Rainer Stickelberger", party: "SPD", from: "2011-05-12", to: "2016-05-12" },
  { id: "justice-wolf", lineId: "justice", name: "Guido Wolf", party: "CDU", from: "2016-05-12", to: "2021-05-12" },
  { id: "justice-gentges", lineId: "justice", name: "Marion Gentges", party: "CDU", from: "2021-05-12", to: "2026-05-13" },
  { id: "justice-oppelt", lineId: "justice", name: "Moritz Oppelt", party: "CDU", from: "2026-05-13", to: null },

  // Finanzen
  { id: "finance-frank", lineId: "finance", name: "Karl Frank", party: "FDP/DVP", from: "1952-04-25", to: "1960-06-23" },
  { id: "finance-mueller", lineId: "finance", name: "Hermann Müller", party: "FDP/DVP", from: "1960-06-23", to: "1966-12-16" },
  { id: "finance-angstmann", lineId: "finance", name: "Kurt Angstmann", party: "SPD", from: "1966-12-16", to: "1968-06-12" },
  { id: "finance-gleichauf", lineId: "finance", name: "Robert Gleichauf", party: "CDU", from: "1968-06-12", to: "1980-06-04" },
  { id: "finance-palm", lineId: "finance", name: "Guntram Palm", party: "CDU", from: "1980-06-04", to: "1991-01-13" },
  { id: "finance-mayervorfelder", lineId: "finance", name: "Gerhard Mayer-Vorfelder", party: "CDU", from: "1991-01-22", to: "1998-11-11" },
  { id: "finance-stratthaus", lineId: "finance", name: "Gerhard Stratthaus", party: "CDU", from: "1998-11-11", to: "2008-06-04" },
  { id: "finance-staechele", lineId: "finance", name: "Willi Stächele", party: "CDU", from: "2008-06-04", to: "2011-05-12" },
  { id: "finance-schmid", lineId: "finance", name: "Nils Schmid", party: "SPD", from: "2011-05-12", to: "2016-05-12" },
  { id: "finance-sitzmann", lineId: "finance", name: "Edith Sitzmann", party: "GRÜNE", from: "2016-05-12", to: "2021-05-12" },
  { id: "finance-bayaz", lineId: "finance", name: "Danyal Bayaz", party: "GRÜNE", from: "2021-05-12", to: null },

  // Kultus und Schule
  { id: "education-schenkel", lineId: "education", name: "Gotthilf Schenkel", party: "SPD", from: "1952-04-25", to: "1953-10-07" },
  { id: "education-simpfendoerfer", lineId: "education", name: "Wilhelm Simpfendörfer", party: "CDU", from: "1953-10-07", to: "1958-07-21" },
  { id: "education-storz", lineId: "education", name: "Gerhard Storz", party: "CDU", from: "1958-07-21", to: "1964-06-11" },
  { id: "education-hahn", lineId: "education", name: "Wilhelm Hahn", party: "CDU", from: "1964-06-11", to: "1978-05-11" },
  { id: "education-herzog", lineId: "education", name: "Roman Herzog", party: "CDU", from: "1978-05-11", to: "1980-06-04" },
  { id: "education-mayervorfelder", lineId: "education", name: "Gerhard Mayer-Vorfelder", party: "CDU", from: "1980-06-04", to: "1991-01-13" },
  { id: "education-schultzhector", lineId: "education", name: "Marianne Schultz-Hector", party: "CDU", from: "1991-01-13", to: "1995-07-19" },
  { id: "education-schavan", lineId: "education", name: "Annette Schavan", party: "CDU", from: "1995-07-19", to: "2005-10-05" },
  { id: "education-rau", lineId: "education", name: "Helmut Rau", party: "CDU", from: "2005-10-05", to: "2010-02-24" },
  { id: "education-schick", lineId: "education", name: "Marion Schick", party: "parteilos", from: "2010-02-24", to: "2011-05-12" },
  { id: "education-warminski", lineId: "education", name: "Gabriele Warminski-Leitheußer", party: "SPD", from: "2011-05-12", to: "2013-01-23" },
  { id: "education-stoch", lineId: "education", name: "Andreas Stoch", party: "SPD", from: "2013-01-23", to: "2016-05-12" },
  { id: "education-eisenmann", lineId: "education", name: "Susanne Eisenmann", party: "CDU", from: "2016-05-12", to: "2021-05-12" },
  { id: "education-schopper", lineId: "education", name: "Theresa Schopper", party: "GRÜNE", from: "2021-05-12", to: "2026-05-13" },
  { id: "education-jung", lineId: "education", name: "Andreas Jung", party: "CDU", from: "2026-05-13", to: null },

  // Wissenschaft, Forschung und Kunst
  { id: "science-engler", lineId: "science", name: "Helmut Engler", party: "CDU", from: "1978-05-11", to: "1991-01-13", office: "Wissenschaft und Kunst" },
  { id: "science-trotha", lineId: "science", name: "Klaus von Trotha", party: "CDU", from: "1991-01-13", to: "2001-06-12", office: "Wissenschaft und Kunst, ab 1992 Wissenschaft und Forschung" },
  { id: "science-frankenberg", lineId: "science", name: "Peter Frankenberg", party: "CDU", from: "2001-06-12", to: "2011-05-12", office: "Wissenschaft, Forschung und Kunst" },
  { id: "science-bauer", lineId: "science", name: "Theresia Bauer", party: "GRÜNE", from: "2011-05-12", to: "2022-09-28" },
  { id: "science-olschowski", lineId: "science", name: "Petra Olschowski", party: "GRÜNE", from: "2022-09-28", to: null },

  // Wirtschaft
  { id: "economy-veit", lineId: "economy", name: "Hermann Veit", party: "SPD", from: "1952-04-25", to: "1960-06-23" },
  { id: "economy-leuze", lineId: "economy", name: "Eduard Leuze", party: "FDP/DVP", from: "1960-06-23", to: "1966-12-16" },
  { id: "economy-schwarz", lineId: "economy", name: "Hans-Otto Schwarz", party: "SPD", from: "1966-12-16", to: "1972-06-08" },
  { id: "economy-eberle", lineId: "economy", name: "Rudolf Eberle", party: "CDU", from: "1972-06-08", to: "1984-11-17", note: "im Amt verstorben; ab 1972 mit Verkehr" },
  { id: "economy-herzog", lineId: "economy", name: "Martin Herzog", party: "CDU", from: "1984-12-11", to: "1989-09-27" },
  { id: "economy-schaufler", lineId: "economy", name: "Hermann Schaufler", party: "CDU", from: "1989-09-27", to: "1992-06-11" },
  { id: "economy-spoeri", lineId: "economy", name: "Dieter Spöri", party: "SPD", from: "1992-06-11", to: "1996-06-12" },
  { id: "economy-doering", lineId: "economy", name: "Walter Döring", party: "FDP/DVP", from: "1996-06-12", to: "2004-07-14" },
  { id: "economy-pfister", lineId: "economy", name: "Ernst Pfister", party: "FDP/DVP", from: "2004-07-14", to: "2011-05-12" },
  { id: "economy-schmid", lineId: "economy", name: "Nils Schmid", party: "SPD", from: "2011-05-12", to: "2016-05-12", office: "Finanzen und Wirtschaft" },
  { id: "economy-hoffmeister", lineId: "economy", name: "Nicole Hoffmeister-Kraut", party: "CDU", from: "2016-05-12", to: null, office: "Wirtschaft, Arbeit und Wohnungsbau; ab 2021 Wirtschaft, Arbeit und Tourismus; ab 2026 Wirtschaft, Handwerk und Tourismus" },

  // Arbeit und Soziales
  { id: "social-hohlwegler", lineId: "social", name: "Ermin Hohlwegler", party: "SPD", from: "1952-04-25", to: "1960-06-23", office: "Arbeitsministerium" },
  { id: "social-schuettler", lineId: "social", name: "Josef Schüttler", party: "CDU", from: "1960-06-23", to: "1968-06-12", office: "Arbeitsministerium, ab 16.12.1966 Arbeits- und Sozialministerium" },
  { id: "social-hirrlinger", lineId: "social", name: "Walter Hirrlinger", party: "SPD", from: "1968-06-12", to: "1972-06-08", office: "Arbeits- und Sozialministerium" },
  { id: "social-griesinger", lineId: "social", name: "Annemarie Griesinger", party: "CDU", from: "1972-06-08", to: "1980-06-04", office: "Arbeit, Gesundheit und Sozialordnung" },
  { id: "social-schlee", lineId: "social", name: "Dietmar Schlee", party: "CDU", from: "1980-06-04", to: "1984-06-06", office: "Arbeit, Gesundheit und Sozialordnung" },
  { id: "social-schaefer", lineId: "social", name: "Barbara Schäfer", party: "CDU", from: "1984-06-06", to: "1992-06-11", office: "Arbeit, Gesundheit, Familie und Sozialordnung" },
  { id: "social-solinger", lineId: "social", name: "Helga Solinger", party: "SPD", from: "1992-06-11", to: "1996-06-12", office: "Arbeit, Gesundheit und Sozialordnung" },
  { id: "social-vetter", lineId: "social", name: "Erwin Vetter", party: "CDU", from: "1996-06-12", to: "1998-11-11", office: "Sozialministerium" },
  { id: "social-repnik", lineId: "social", name: "Friedhelm Repnik", party: "CDU", from: "1998-11-11", to: "2004-07-14", office: "Sozialministerium" },
  { id: "social-goenner", lineId: "social", name: "Tanja Gönner", party: "CDU", from: "2004-07-14", to: "2005-04-29", office: "Sozialministerium" },
  { id: "social-renner", lineId: "social", name: "Andreas Renner", party: "CDU", from: "2005-04-29", to: "2006-02-01", office: "Sozialministerium" },
  { id: "social-stolz", lineId: "social", name: "Monika Stolz", party: "CDU", from: "2006-02-01", to: "2011-05-12", office: "Arbeit und Soziales, ab 2010 Arbeit und Sozialordnung, Familien und Senioren" },
  { id: "social-altpeter", lineId: "social", name: "Katrin Altpeter", party: "SPD", from: "2011-05-12", to: "2016-05-12", office: "Arbeit und Sozialordnung, Familie, Frauen und Senioren" },
  { id: "social-lucha", lineId: "social", name: "Manne Lucha", party: "GRÜNE", from: "2016-05-12", to: "2026-05-13", office: "Soziales und Integration, ab 2021 Soziales, Gesundheit und Integration" },
  { id: "social-hildenbrand", lineId: "social", name: "Oliver Hildenbrand", party: "GRÜNE", from: "2026-05-13", to: null, office: "Soziales, Arbeit und Gesundheit" },

  // Landwirtschaft und Ländlicher Raum
  { id: "rural-herrmann", lineId: "rural", name: "Friedrich Herrmann", party: "FDP/DVP", from: "1952-04-25", to: "1953-10-07", office: "Landwirtschaftsministerium" },
  { id: "rural-leibfried", lineId: "rural", name: "Eugen Leibfried", party: "CDU", from: "1953-10-07", to: "1968-06-12", office: "Ernährung, Landwirtschaft und Forsten, ab 1962 mit Weinbau" },
  { id: "rural-bruenner", lineId: "rural", name: "Friedrich Brünner", party: "CDU", from: "1968-06-12", to: "1976-06-02", office: "Ernährung, Landwirtschaft, Weinbau und Forsten" },
  { id: "rural-weiser", lineId: "rural", name: "Gerhard Weiser", party: "CDU", from: "1976-06-02", to: "1996-06-10", office: "Ernährung, Landwirtschaft und Umwelt, ab 1987 Ländlicher Raum" },
  { id: "rural-staiblin", lineId: "rural", name: "Gerdi Staiblin", party: "CDU", from: "1996-06-11", to: "2001-06-11", office: "Ministerium Ländlicher Raum" },
  { id: "rural-staechele", lineId: "rural", name: "Willi Stächele", party: "CDU", from: "2001-06-12", to: "2005-04-28", office: "Ernährung und Ländlicher Raum" },
  { id: "rural-hauk-1", lineId: "rural", name: "Peter Hauk", party: "CDU", from: "2005-04-29", to: "2010-02-23", office: "Ländlicher Raum, ab 2006 mit Verbraucherschutz" },
  { id: "rural-koeberle", lineId: "rural", name: "Rudolf Köberle", party: "CDU", from: "2010-02-24", to: "2011-05-11", office: "Ländlicher Raum und Verbraucherschutz" },
  { id: "rural-bonde", lineId: "rural", name: "Alexander Bonde", party: "GRÜNE", from: "2011-05-12", to: "2016-05-11", office: "Ländlicher Raum und Verbraucherschutz" },
  { id: "rural-hauk-2", lineId: "rural", name: "Peter Hauk", party: "CDU", from: "2016-05-12", to: "2026-05-12", office: "Ländlicher Raum, Landwirtschaft und Verbraucherschutz" },
  { id: "rural-gentges", lineId: "rural", name: "Marion Gentges", party: "CDU", from: "2026-05-13", to: null, office: "Ländlicher Raum, Landwirtschaft und Heimat" },

  // Umwelt
  { id: "environment-weiser", lineId: "environment", name: "Gerhard Weiser", party: "CDU", from: "1976-06-02", to: "1987-06-30", office: "Umwelt im Geschäftsbereich Landwirtschaft", note: "kein eigenes Umweltministerium" },
  { id: "environment-vetter", lineId: "environment", name: "Erwin Vetter", party: "CDU", from: "1987-07-01", to: "1992-06-11" },
  { id: "environment-schaefer", lineId: "environment", name: "Harald B. Schäfer", party: "SPD", from: "1992-06-11", to: "1996-06-11" },
  { id: "environment-schaufler", lineId: "environment", name: "Hermann Schaufler", party: "CDU", from: "1996-06-11", to: "1998-10-13", office: "Umwelt und Verkehr" },
  { id: "environment-schaeuble", lineId: "environment", name: "Thomas Schäuble", party: "CDU", from: "1998-10-14", to: "1998-11-10", office: "Umwelt und Verkehr" },
  { id: "environment-mueller", lineId: "environment", name: "Ulrich Müller", party: "CDU", from: "1998-11-11", to: "2004-07-13", office: "Umwelt und Verkehr" },
  { id: "environment-mappus", lineId: "environment", name: "Stefan Mappus", party: "CDU", from: "2004-07-14", to: "2005-04-28", office: "Umwelt und Verkehr" },
  { id: "environment-goenner", lineId: "environment", name: "Tanja Gönner", party: "CDU", from: "2005-04-29", to: "2011-05-11", office: "Umwelt und Verkehr, ab 2010 Umwelt" },
  { id: "environment-untersteller", lineId: "environment", name: "Franz Untersteller", party: "GRÜNE", from: "2011-05-12", to: "2021-05-11", office: "Umwelt, Klima und Energiewirtschaft" },
  { id: "environment-walker", lineId: "environment", name: "Thekla Walker", party: "GRÜNE", from: "2021-05-12", to: null, office: "Umwelt, Klima und Energiewirtschaft" },

  // Verkehr
  { id: "transport-eberle", lineId: "transport", name: "Rudolf Eberle", party: "CDU", from: "1972-06-08", to: "1984-11-17", note: "Verkehr im Wirtschaftsressort, kein eigenes Ministerium" },
  { id: "transport-schaeuble-1", lineId: "transport", name: "Thomas Schäuble", party: "CDU", from: "1991-01-13", to: "1992-06-10" },
  { id: "transport-schaufler", lineId: "transport", name: "Hermann Schaufler", party: "CDU", from: "1992-06-11", to: "1998-10-13" },
  { id: "transport-schaeuble-2", lineId: "transport", name: "Thomas Schäuble", party: "CDU", from: "1998-10-14", to: "1998-11-10" },
  { id: "transport-mueller", lineId: "transport", name: "Ulrich Müller", party: "CDU", from: "1998-11-11", to: "2004-07-13" },
  { id: "transport-mappus", lineId: "transport", name: "Stefan Mappus", party: "CDU", from: "2004-07-14", to: "2005-04-28" },
  { id: "transport-rech", lineId: "transport", name: "Heribert Rech", party: "CDU", from: "2005-04-29", to: "2010-02-23", note: "Verkehr als Abteilung des Innenministeriums" },
  { id: "transport-goenner", lineId: "transport", name: "Tanja Gönner", party: "CDU", from: "2010-02-24", to: "2011-05-11" },
  { id: "transport-hermann", lineId: "transport", name: "Winfried Hermann", party: "GRÜNE", from: "2011-05-12", to: "2026-05-12" },
  { id: "transport-razavi", lineId: "transport", name: "Nicole Razavi", party: "CDU", from: "2026-05-13", to: null },

  // Landesentwicklung und Wohnen
  { id: "housing-razavi", lineId: "housing", name: "Nicole Razavi", party: "CDU", from: "2021-05-12", to: "2026-05-12" },
  { id: "housing-schopper", lineId: "housing", name: "Theresa Schopper", party: "GRÜNE", from: "2026-05-13", to: null },

  // Vertriebene
  { id: "displaced-fiedler", lineId: "displaced", name: "Eduard Fiedler", party: "BHE", from: "1952-04-25", to: "1960-06-23", office: "für Heimatvertriebene und Kriegsgeschädigte, ab 1953 für Vertriebene, Flüchtlinge und Kriegsgeschädigte" },

  // Bundes- und Europaangelegenheiten
  { id: "europe-farny", lineId: "europe", name: "Oskar Farny", party: "CDU", from: "1953-10-07", to: "1960-06-23", office: "Minister für Bundesangelegenheiten (ohne eigenes Ministerium)" },
  { id: "europe-seifriz", lineId: "europe", name: "Adalbert Seifriz", party: "CDU", from: "1966-12-16", to: "1972-06-08", office: "Minister für Bundesangelegenheiten (ohne eigenes Ministerium)" },
  { id: "europe-eyrich", lineId: "europe", name: "Heinz Eyrich", party: "CDU", from: "1991-01-22", to: "1992-06-11", office: "Minister für Bundes- und Europaangelegenheiten" },
  { id: "europe-vetter", lineId: "europe", name: "Erwin Vetter", party: "CDU", from: "1992-06-11", to: "1996-06-12", office: "Minister im Staatsministerium" },

  // Familie, Frauen, Weiterbildung und Kunst
  { id: "family-ungersoyka", lineId: "family", name: "Brigitte Unger-Soyka", party: "SPD", from: "1992-06-11", to: "1996-06-11" },
];

export const sourceKindLabels: Record<SourceKind, string> = {
  gesetzblatt: "Gesetzblatt",
  chronik: "Chronik",
  system: "Systemdaten",
  sekundaer: "Sekundärquelle",
};
