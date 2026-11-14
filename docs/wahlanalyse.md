# Wahlanalyse unter Daten

`/daten?dataTool=wahlanalyse` öffnet die zentrale Wahlanalyse. Unter
`dataTool=rechner` bleiben Sitzrechner, Kandidatenpflege und die bisherigen
Werkzeuge erreichbar. Die Ergebnisimporte verändern keine Mandate oder Personen. Wahlergebnisse bleiben
in den vorhandenen Analysetabellen; historische Perioden werden explizit verknüpft.
Belegte fehlende Periodentermine lassen sich separat durch Super-Admins ergänzen.

## Einrichtung

1. `20261114130000_election_analysis.sql` erstellt sechs unabhängige Tabellen,
   Zugriffsschutz und Auswahlindizes.
2. `20261114131000_election_analysis_data.sql` übernimmt die zusätzlichen
   Analyseblätter der bereitgestellten Arbeitsmappe: 5 Wahlen, 30 Landesergebnisse,
   2.100 Parteiergebnisse auf Wahlkreisebene, 420 Beteiligungszeilen,
   133 Wanderungsbeziehungen und 399 demografische Anteile.

Der Generator `scripts/import-election-analysis.py workbook.xlsx output.sql`
benötigt openpyxl. Er liest ausschließlich die Ergebnis-, Beteiligungs-, Wanderungs-
und Demografieblätter. Er liest/importiert keine Abgeordneten oder Periodentermine.
Der ursprüngliche Workbook-Seed speichert keine Quellenlinks oder Datei-/Zeilenherkunft;
die neue amtliche Prüfung dokumentiert Quelle, Prüfsumme und Datenstand gesondert. Fachliche Hinweise,
Vorläufigkeit und Vergleichseinschränkungen bleiben erhalten. Stabile fachliche
Primärschlüssel und `ON CONFLICT DO NOTHING` verhindern, dass eine erneute Übernahme
Daten dupliziert oder bereits korrigierte Analysewerte überschreibt. Ungültige oder
doppelte Schlüssel brechen die Generierung ab.

Die Analysedaten sind zentral und für angemeldete Nutzer aller Tenants lesbar,
soweit das Wahljahr veröffentlicht ist. Nur `is_superadmin` erlaubt Schreibzugriffe.
Es gibt keinen anonymen Zugriff. Veröffentlicht sind die fünf importierten Wahlen;
Vorläufigkeit einzelner Ergebnisse ist ein fachlicher Datenstatus und wird dadurch
nicht zu einem endgültigen Ergebnis umgedeutet.

## Auswertungen

- Landesergebnisse: Parteianteile, absolute Stimmen und Sitze für fünf ausgewählte
  Parteien. Optional wird genau eine Vergleichswahl zusätzlich geladen. Änderungen
  sind Prozentpunkte; es erfolgt keine Sitzberechnung aus den importierten Anteilen.
  Sitze 2026 stehen nur in der maßgeblichen Zweitstimmenzeile.
- Wahlkreisvergleich: eine Partei, Wahl und Stimmenart, Rangliste und zehn stärkste
  Wahlkreise. Die beiden Tabellenblätter mit Prozenten und absoluten Stimmen werden
  je Jahr/Stimmenart/Wahlkreis verknüpft. Diese Resultate werden keinem Mandat oder
  keiner Person zugeschrieben.
- Beteiligung: 70 Wahlkreise, nach Wahl und genau einer Stimmenart. Landesweite
  Kennzahlen werden nur bei vollständigen 70 Wahlkreisen aus absoluten Zahlen
  berechnet, nie als ungewichteter Durchschnitt von Prozenten. Erst- und
  Zweitstimmenzeilen werden nicht zusammenaddiert.
- Wählerwanderung: eine Zielpartei und Wahl, Landesebene, mit Zustrom/Abstrom/Saldo.
  Positive Salden bedeuten Zugewinne dieser Zielpartei. Es sind Modellschätzungen,
  teilweise gerundet und teilweise nur als Saldo vorhanden. Fehlende Bruttoströme
  werden nicht aus dem Saldo erfunden. Beziehungen verschiedener Zielparteien
  werden nicht zu einer angeblichen Gesamtwanderung addiert.
- Alter/Geschlecht: repräsentative Statistik, drei Geschlechtsauswahlen, Altersgruppen,
  Parteienvergleich. 2026 ausschließlich Zweitstimmen und jüngste Gruppe 16–24;
  davor 18–24. „Insgesamt“ ist ein eigener vorhandener Wert, kein Mittelwert der
  Altersgruppen. Es werden keine absoluten Personenzahlen aus Anteilen abgeleitet.

2026 sind die Wahlkreiswerte vorläufig, die Landeswerte laut Arbeitsmappe endgültig.
Die Ansicht kennzeichnet dies und setzt deren Summen nicht automatisch gleich.
2006/Wahlkreis 59 enthält den Hinweis zur Berechnung auf dem Zuschnitt 2011.
Nur fünf Parteien sind enthalten; Summen werden nicht als vollständige Wahlresultate
oder vollständige Sitzverteilung ausgegeben. Leere Werte bleiben unbekannt. Die
Excel-Anteile (0–1) werden beim Import einmal auf Prozentwerte (0–100) umgerechnet.

## Datenmenge und Bedienung

Initial lädt nur der kleine Wahljahrindex. Erst der gewählte Reiter lädt seine Daten,
serverseitig gefiltert nach Jahr/Stimmenart und gegebenenfalls Partei oder Geschlecht.
Damit werden typischerweise 5, 70, 8–10 oder 35 Zeilen statt des gesamten Bestands
übertragen. Anfragen werden bei Wechsel abgebrochen, der Cache ist benutzer- und
filterbezogen (60 Sekunden Aktualität, 2 Minuten nach Verlassen). Die Importdaten
werden nicht in das Frontend-Bundle aufgenommen; Diagrammcode lädt erst im Tool.

Tabellen zeigen zuerst 25 Zeilen und lassen sich erweitern. Jede Auswertung bietet
CSV-Export der geladenen/gefilterten Daten mit fachlichen Statushinweisen. CSV nutzt
UTF-8-BOM, Semikolon und deutsche Dezimaltrennung; problematische Zeichen am Anfang
von Textzellen werden gegen Tabellenkalkulationsformeln abgesichert. URL-Parameter
für Wahl, Stimmenart, Reiter, Partei und Geschlecht bleiben beim Werkzeugwechsel
und Teilen des Links erhalten. Vergleichswahl und Tabellen-Altersgruppe sind lokale
Ansichtseinstellungen. Zahlen sind zusätzlich zu den Diagrammen als Tabelle zugänglich.

Typprüfung: `npm run typecheck:election-analysis`.

Wahlkreisvergleich und Wahlbeteiligung haben getrennte Spalten für Nummer und
Wahlkreisname. Die Spaltenköpfe mit Doppelpfeil sortieren per Klick auf-/absteigend;
der aktive Pfeil zeigt die Richtung. Zahlen werden nach ihrem Rohwert sortiert,
fehlende Angaben bleiben in beiden Richtungen unten. Die Sortierung umfasst alle
gefilterten Zeilen vor der Begrenzung auf zunächst 25 sichtbare Einträge und löst
keine zusätzlichen Datenbankabfragen aus.

## Historische Analyse: erste Ausbaustufe P0–P3 (14.11.2026)

Neue Bereiche unter **Daten → Wahlanalyse**:

- **Wahlkreis-Steckbrief**: einer der 70 Wahlkreise, verfügbare Wahlen 2006–2026,
  Stimmenanteile/absolute Stimmen, Veränderungen zur Vorwahl, Grunddaten,
  Zwei-Jahres-Vergleich, CSV und erst beim Aufklappen geladene Mandatshistorie.
- **Swing / Veränderungsatlas**: zwei Wahlen, bis zu fünf Parteien,
  Prozentpunktdifferenz, absolute Stimmendifferenz oder Abweichung vom Landestrend.
  Tabellen lassen sich auf-/absteigend sortieren. Die Karte verwendet dieselben
  berechneten Werte wie die Tabelle, für eine ausgewählte Partei.
- **Erst-/Zweitstimmen 2026**: getrennte absolute Ergebnisse und Anteile,
  Differenzen, Rangliste, Landesvergleich, CSV und Karte, sobald amtliche
  periodenspezifische Geometrien verifiziert und eingebunden sind.
- **Datenprüfung**: ausgewähltes Jahr, nachvollziehbare Codes und CSV-Bericht für
  Zahlen-, Nenner-, Beteiligungs-, Summen- und Statuskonflikte.

Aus der historischen Wahlkreiskarte führt „Wahlkreis-Steckbrief öffnen“ zum
entsprechenden Jahr und zur gesicherten Nummer. Der Link ist bei unbekannten
Nummern und Wahlen außerhalb des vorhandenen Analysedatensatzes nicht verfügbar.
Die URL verwendet `dataTool=wahlanalyse`, `analysisSection=profile|swing|split|quality`,
`analysisYear`, `analysisBallot`, `analysisDistrict`, `analysisBefore`,
`analysisParties`, `analysisMetric` und `profileMetric`. Filterwechsel navigieren
innerhalb der Anwendung, ohne vollständiges Neuladen.

### Vergleichsregeln

`research/calculations.ts` enthält die gemeinsamen fachlichen Funktionen:

- Swing: neuer Anteil − alter Anteil, in **Prozentpunkten**, nicht Prozent.
- Stimmendifferenz: neue Stimmen − alte Stimmen.
- Relativer Swing: Wahlkreis-Swing − Landes-Swing. Nur bei gemeinsam bestätigtem,
  finalem Landes-/Wahlkreisstand je Wahl (`data_release`) verfügbar.
- Erst-/Zweitstimmendifferenz: Erstanteil − Zweitanteil beziehungsweise
  Erststimmen − Zweitstimmen; jeder Anteil verwendet seinen eigenen gültigen Nenner.
- Beteiligung: Wählende / Wahlberechtigte × 100. Erst- und Zweitstimmen zählen
  dieselben Menschen, deshalb je Wahl und Wahlkreis nur ein Beteiligungsdatensatz.
- Fehlend bleibt `null`; eine echte gemessene Null bleibt 0. AfD vor 2013 ist
  unbekannt/nicht angetreten, kein gemessener Nullwert. Linien überspringen diese
  Werte nicht durch Verbindung. Nicht erfasste Parteien bleiben eine Restkategorie;
  fünf Parteien ergeben keine vollständige Wahl.

Gleiche Namen und Nummern beweisen keine historische Gebietsidentität.
`election_analysis_versions` speichert die explizite Version je Wahl und Nummer;
`identity_key` wird erst auf Grundlage geprüfter Geometrien gesetzt. Unbekannte
Grenzen sind standardmäßig ausgeschlossen. Ein gesonderter Schalter erlaubt einen
explizit gewarnten explorativen Vergleich; bestätigte unterschiedliche Zuschnitte
bleiben ausgeschlossen. Vorläufig/final hat einen eigenen ausdrücklichen Schalter.
Der rekonstruierte Waldshuter Vergleichswert 2006 bleibt gekennzeichnet.
Einzelstimme bis 2021 und Zweitstimme ab 2026 sind keine identischen Wahlsysteme.
Die Rohzeitreihe zeigt vorhandene Messwerte, behauptet aber keine unveränderten Grenzen.

### Datenbank und Zugriffe

Migrationen `20261114140000_election_analysis_research.sql` und
`20261114141000_election_period_sources.sql` ergänzen die vorhandenen Tabellen;
sie ersetzen keine Ergebnisdaten und ändern keine Mandatszuordnungen.

- `election_analysis_years.period_id`: Fremdschlüssel zur vorhandenen Periode.
- `election_analysis_versions`: explizite Wahlkreisversion und separat bestätigte
  Verbindung zum historischen Wahlkreis. Die Datenbank prüft Periode und Nummer.
- `election_analysis_geographies`: amtliche Quelle, Prüfsumme, Jahr, Asset und Prüfung.
- `election_analysis_candidates`: verifizierte Direktkandidaturergebnisse mit
  Version-Fremdschlüssel. `person_id` bleibt ohne bestätigte Identität leer. Diese
  fünf Parteikandidaturen sind keine vollständige Kandidatenliste aller Parteien.
- `election_analysis_source_reviews`: Datenstand, Quellenarchiv-Prüfsummen und Bericht.
- `election_analysis_period_proposals`: getrennte belegte Terminvorschläge.

RLS bleibt aktiv: zentrale Schreibrechte ausschließlich Super-Admins,
veröffentlichte Analysejahre und geprüfte Quellen/Geometrien für authentifizierte
Leser. RPCs laufen mit **SECURITY INVOKER**, nicht mit erweiterten Leserechten.
Es gibt keinen Vollimport historischer Personen in den Browser.

Steckbrief-RPC: ein Wahlkreis, höchstens zehn ausgewählte Jahre.
Vergleichs-RPC: zwei Wahlen und höchstens fünf ausgewählte Parteien.
Kandidaturen: gewähltes Jahr/Parteien, höchstens 350 Zeilen.
Mandatshistorie: erst nach Öffnen, nur ausdrücklich bestätigte Zuordnungen und
freigegebene Perioden. React Query trennt Nutzer und Filter im Cache; Filterwechsel
können laufende Anfragen abbrechen. Tabellen zeigen zunächst 25 Zeilen, sortieren
aber vor der Darstellung den gesamten bereits begrenzten Ergebnissatz.

### Administration: Perioden und historische Verbindungen

Unter **Wahldaten & Mandatshistorie → Legislaturperioden** zeigt die gewählte
Periode amtliche Vorschläge. „Fehlende belegte Termine ergänzen“ ruft den
superadminbeschränkten RPC `apply_verified_election_period` auf. Er sperrt den
Periodendatensatz und ergänzt ausschließlich leere Felder. Vorhandene Termine und
Quellen werden nicht überschrieben; die bestehende Mandatsvererbung bleibt wirksam.
Der bestehende Audit-Trigger protokolliert die Änderung. Entwürfe zuerst speichern.

Unter **Wahlkreise → Verbindung zur Wahlanalyse prüfen** kann der Super-Admin
jeweils einen Wahlkreis innerhalb derselben Wahl bestätigen. Vorher werden beide
Bezeichnungen angezeigt. Dies bestätigt **keine** Gebietsidentität mit anderen
Jahren. Erst dann werden bereits freigegebene Mandate im Analyse-Steckbrief gelesen.
Es werden keine Personen anhand ihrer Namen zusammengeführt.

Voraussichtliches Periodenende und tatsächliches Ende sind getrennt. Bestehende
in der Zukunft liegende Endtermine bleiben gespeichert und werden als
`ends_on_is_expected` markiert; die Ansichten weisen den Erwartungscharakter aus.
Administratoren können dieses Kennzeichen und `expected_ends_on` bearbeiten.
Ein noch nicht feststehendes Ende gilt nicht als belegtes Ausscheiden.

### Wiederholbarer amtlicher Ergebnisabgleich 2026

```sh
python scripts/review-election-2026.py --output work/official-2026
# vorzugsweise mit einem aktuellen Export der drei bestehenden Tabellen:
python scripts/review-election-2026.py --baseline snapshot.json --output work/official-2026
# erneute Verarbeitung archivierter Originalseiten ohne Netzwerk:
python scripts/review-election-2026.py --archive work/official-2026/originals --output work/review-again
```

Snapshotformat: `{ "state": [...], "districts": [...], "turnout": [...] }`,
jeweils vollständige aktuelle Tabellenzeilen einschließlich `data_release`, Notizen
und Sitzangaben. Ohne Snapshot wird der Repository-Seed als **nicht live geprüfte**
Vergleichsbasis verwendet. Die generierte SQL prüft erwartete Altwerte trotzdem
gegen die tatsächliche Datenbank und bricht bei manuellen Abweichungen vollständig ab.

Das Skript lädt die amtliche Landespräsentation und 70 Wahlkreisseiten, verlangt
explizit „Endgültiges Ergebnis“, prüft Vollständigkeit, getrennte Nenner, alle
Parteistimmen und Landes-/Wahlkreissummen. Formatänderungen führen zum Abbruch.
Original-HTML, SHA-256, normalisierte Werte, Feldabweichungen (`review.json`) und
`apply.sql` werden archiviert. Sitzangaben, manuelle Notizen und Namen bleiben
unangetastet; Kandidatur-Neuanlagen überschreiben keine vorhandenen Einträge.
Erst nach vollständiger Zahlenprüfung erzeugt die SQL einen gemeinsamen finalen
Datenstand. Wiederholung desselben Patches ist idempotent. Bei Konflikten neuen
Live-Snapshot erzeugen, Bericht prüfen und manuelle Werte ausdrücklich entscheiden.
Keine stillen `ON CONFLICT DO UPDATE`-Ergebnisimporte.

### Amtliche Geometrien

```sh
python scripts/review-election-geographies.py --output work/geographies
# anschließend Bericht prüfen, die beiden originalen GeoJSON-Assets nach
# public/data/election-analysis/ kopieren und die erzeugte apply.sql anwenden.
```

Das Skript lädt die offiziellen 2021-/2026-ZIP-Dateien, prüft je 70 eindeutige
Nummern und vergleicht die Koordinaten bei gleichem CRS nach Normalisierung der
Ringorientierung und Startpunkte. Nur exakte kanonische Gleichheit setzt eine
gemeinsame Identität. Abweichende Digitalisierung wird nicht als bewiesene
Grenzänderung ausgegeben, sondern bleibt für die Identitätsprüfung offen.
Keine heutigen Grenzen werden für frühere Wahlperioden eingesetzt.
Der Browser reprojiziert amtliches EPSG:31467 über den vorhandenen GeoJSON-Adapter
in WGS84 und verwirft ungültige Koordinaten. Die bisherige Karten-GeoJSON wird
nicht ohne Originalabgleich als bestätigte 2026-Geometrie verwendet.

### Prüffunktionen und ergänzte Tests

```sh
node scripts/validate-election-analysis.mjs snapshot-for-validation.json
```

Validierungsformat: `{ "results": [...], "turnout": [...], "state": [...] }`.
Die CLI verwendet dieselben TypeScript-Funktionen wie die Oberfläche und liefert
JSON mit Fehlercodes sowie Exitcode 1 bei Zahlenfehlern. Abweichungen von mehr als
0,051 Prozentpunkten überschreiten die Toleranz amtlich gerundeter Angaben.

Neu hinterlegt: `research/calculations.test.ts`, `research/hooks.test.ts`,
`supabase/tests/election_analysis_access.sql` sowie das Logikszenario
„Wahlanalyse: Datenqualität und Vergleichbarkeit“ im Selbsttest-Center.
**Auf ausdrücklichen Wunsch wurden diese Tests in dieser Sitzung nicht ausgeführt.**
Es gibt deshalb keine Aussage über bestandene Laufzeit-, Integrations-, E2E- oder
Performance-Tests. TypeScript-Kompilierung ist davon getrennt.

### Offene Datenlücken und notwendige Schritte

Stand 14.11.2026: Die Cloud-Allowlist blockiert die Originaldownloads noch mit
HTTP 403. Einzelne amtliche Webseiten waren über die Recherche lesbar, aber ein
vollständiger Abgleich aller 70 Originalseiten und beider Geodatensätze war nicht
möglich. **Es wird deshalb kein endgültiger Ergebnispatch und keine behauptete
Geometriegleichheit mitgeliefert.** Karten zeigen bis zur Verifikation einen
verständlichen Hinweis, keine ungeprüfte Ersatzgeometrie. Die vorhandenen Zahlen
bleiben auswertbar; unbestätigte historische Vergleiche sind ausdrücklich gewarnt.

1. Die beiden Schema-/Quellenmigrationen über den bestehenden Supabase-Prozess
   anwenden; hier bestand kein administrativer Live-Datenbankzugang.
2. Downloads freigeben und die beiden Review-Skripte ausführen. Formatparser und
   GIS-Vergleich müssen beim ersten vollständigen Lauf gegen Originale überprüft
   werden. Berichte prüfen, Assets versionieren und Ergebnis-/Geometriepatch anwenden.
3. Historische Verbindungen im Super-Admin bestätigen und Perioden freigeben.
4. Fehlende tatsächliche Periodenanfänge/-enden separat amtlich belegen. Die
   Wahltage aller 18 Perioden sind belegt; daraus werden keine Mandatsanfänge abgeleitet.
5. Frühere Grenzstände, vollständige Kandidaturen und verifizierte Personenbezüge
   ergänzen, bevor Wiederwahl-/Amtsinhabereffekte statistisch ausgewertet werden.

Amtliche Quellen und Befunde: [Quellenprotokoll](elections/sources-and-gaps.md).
P4 ist als separate Erweiterung unten beschrieben; P5 bleibt ein gesondertes
Folgepaket. P6 bleibt ein
[technisches und wissenschaftliches Konzept](elections/research-concept.md).


## Zweite Ausbaustufe: P4 – Beteiligung und Stimmenentwicklung

`analysisSection=turnout-trend` öffnet **Beteiligung & Stimmen**. Die bestehende
Beteiligungsansicht bleibt unverändert. Der neue Vergleich verwendet zwei Wahlen,
eine ausgewählte Partei und genau eine Stimmenart je Wahl. Bei 2026 kann die
Stimmenart gewählt werden; vor 2026 gilt die Einzelstimme.

Die Ansicht zeigt:

- Änderungen von Beteiligung und Parteianteil in Prozentpunkten;
- Änderungen von Wahlberechtigten, Wählenden, gültigen Stimmen und Parteistimmen
  in absoluten Zahlen;
- die Grunddaten beider Wahlen in einer umschaltbaren, sortierbaren Tabelle;
- ein Streudiagramm mit Beteiligungsänderung auf X und Anteilsänderung auf Y;
- deskriptives Pearson-r mit Zahl vollständiger Paare und ausgeschlossener Fälle;
- Wahlkreisfilter, Einstieg in den Steckbrief und CSV einschließlich Rohwerten,
  Veränderungen, Ergebnisständen und Ausschlussgründen.

Tabelle, Diagramm, Korrelation und Export verwenden dieselbe gefilterte Auswahl.
Für das Diagramm werden zusätzlich beide Kennzahlen benötigt. Bei weniger als
3 vollständigen Paaren oder konstanter X-/Y-Kennzahl bleibt r unbekannt. Es gibt
keine Kausalaussage und keinen Rückschluss auf individuelle Wählerbewegungen.
Ungeprüfte Grenzen und gemischte vorläufige/finale Ergebnisse sind standardmäßig
ausgeschlossen und nur ausdrücklich mit Warnung einzubeziehen. Unterschiedliche
Stände von Parteiergebnis und Beteiligungsnenner innerhalb derselben Wahl werden
auch dann nicht verrechnet. Fehlende Einzelwerte bleiben unbekannt; keine
Division und kein Aufsummieren von Erst- und Zweitstimmen-Wählenden.

Migration `20261114142000_election_turnout_comparison.sql` ergänzt ausschließlich
einen lesenden `SECURITY INVOKER`-RPC. Er fragt höchstens zwei Jahre × 70 Wahlkreise
für eine Partei, passende Beteiligungsdaten und explizite Wahlkreisversionen ab.
Die vorhandenen RLS-Regeln gelten unverändert. Es werden keine Wahlergebnisse,
Mandate oder Verwaltungsdaten verändert. Anfragen sind abbrechbar, nach Nutzer und
Auswahl gecacht und laden keine anderen Wahljahre vor.

`research/turnoutModel.ts` kapselt Vergleich und Korrelation. `voteFactors` und
`decomposeVotes` bereiten die in [research-concept.md](elections/research-concept.md)
definierte Shapley-Zerlegung über alle 24 Reihenfolgen vor. Die Zerlegung wird
**noch nicht in der produktiven Oberfläche angeboten**, da mathematische Tests
auf Wunsch nicht ausgeführt und die methodische Freigabe noch offen sind.

Ergänzt, nicht ausgeführt: `turnoutModel.test.ts` (Differenzen, fehlende Werte,
Grenzen/Status, keine doppelte Beteiligung, Korrelation, Summenidentität und
Symmetrie der Zerlegung), begrenzte RPC-Hooktests, SQL-Zugriffstests und ein weiterer
Logikschritt im Selbsttest-Center. Der separat ausgeführte TypeScript-Abgleich
ersetzt keine Laufzeit- oder Integrationstests.

Die neue Migration muss nach den beiden P0–P3-Migrationen angewendet werden.
Amtliche Originaldownloads sind weiterhin durch HTTP 403 blockiert; diese Stufe
ändert deshalb keine Vorläufigkeitskennzeichen und behauptet keine bestätigte
historische Gebietsidentität. Ohne Originalprüfung bleiben die entsprechenden
Vergleiche standardmäßig ausgeschlossen. Kein administrativer Live-DB-Zugang
stand zum Einspielen der Migration zur Verfügung.
