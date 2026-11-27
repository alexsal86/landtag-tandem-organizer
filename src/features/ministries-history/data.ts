/**
 * Belegte Namensgeschichte der Ministerien Baden-Württembergs seit 1952.
 *
 * Grundlage sind die Bekanntmachungen der Landesregierung über die Abgrenzung
 * der Geschäftsbereiche der Ministerien und die zugehörigen Bezeichnungsakte im
 * Gesetzblatt. Jede Phase nennt ihre Quelle und ob sie im Original geprüft ist.
 * Nicht geprüfte Zwischenstufen sind ausdrücklich als solche gekennzeichnet.
 */

export type SourceKind = "gesetzblatt" | "chronik" | "sekundaer";

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
  from: string;
  to: string;
  cabinet: string;
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

export const legislativePeriods: LegislativePeriod[] = [
  { number: 1, from: "1952-04-25", to: "1956-05-08", cabinet: "Maier / Müller I" },
  { number: 2, from: "1956-05-09", to: "1960-06-22", cabinet: "Müller II / Kiesinger I" },
  { number: 3, from: "1960-06-23", to: "1964-06-10", cabinet: "Kiesinger II" },
  { number: 4, from: "1964-06-11", to: "1968-06-11", cabinet: "Kiesinger III / Filbinger I" },
  { number: 5, from: "1968-06-12", to: "1972-06-11", cabinet: "Filbinger II" },
  { number: 6, from: "1972-06-12", to: "1976-06-01", cabinet: "Filbinger III" },
  { number: 7, from: "1976-06-02", to: "1980-05-31", cabinet: "Filbinger IV" },
  { number: 8, from: "1980-06-01", to: "1984-05-31", cabinet: "Späth I" },
  { number: 9, from: "1984-06-01", to: "1988-05-31", cabinet: "Späth II" },
  { number: 10, from: "1988-06-01", to: "1992-06-10", cabinet: "Späth III / Teufel I" },
  { number: 11, from: "1992-06-11", to: "1996-06-11", cabinet: "Teufel II" },
  { number: 12, from: "1996-06-12", to: "2001-06-11", cabinet: "Teufel III" },
  { number: 13, from: "2001-06-12", to: "2006-06-10", cabinet: "Teufel IV / Oettinger I" },
  { number: 14, from: "2006-06-11", to: "2011-05-11", cabinet: "Oettinger II / Mappus" },
  { number: 15, from: "2011-05-12", to: "2016-05-11", cabinet: "Kretschmann I" },
  { number: 16, from: "2016-05-12", to: "2021-05-11", cabinet: "Kretschmann II" },
  { number: 17, from: "2021-05-12", to: "2026-05-12", cabinet: "Kretschmann III" },
  { number: 18, from: "2026-05-13", to: "2031-05-12", cabinet: "Özdemir" },
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

export const sourceKindLabels: Record<SourceKind, string> = {
  gesetzblatt: "Gesetzblatt",
  chronik: "Chronik",
  sekundaer: "Sekundärquelle",
};
