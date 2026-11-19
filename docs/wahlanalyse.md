# Wahlanalyse unter Daten

`/daten` öffnet direkt die zentrale Wahlanalyse. Die Navigation verwendet vier
Säulen mit `dataTab` und eine Unteransicht mit `sub`; `analysisSection` wird für
bestehende Links synchron gehalten. `dataTool=rechner` führt zum gesetzlichen
BW-2026-Sitzrechner. Der vereinfachte Rechner und die provisorische lokale
Kandidatentabelle wurden entfernt; bestehende Browserdaten werden nicht gelöscht.
Die Ergebnisimporte verändern keine Mandate oder Personen. Wahlergebnisse bleiben
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
  Sitze 2026 stehen nur in der maßgeblichen Zweitstimmenzeile. Unter der
  Ergebnistabelle zeigt ein skalierender Halbkreis je hinterlegtem Sitz einen
  Punkt, von links nach rechts SPD, GRÜNE, FDP, CDU, AfD. Parteien ohne Sitze
  werden ausgelassen; fehlende Sitzangaben werden nicht ergänzt. Die Zahl in
  der Mitte zählt die dargestellten Sitze, keine aus Parteianteilen errechneten
  Mandate und keine abgeleitete Parlamentsmehrheit.
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
P4 ist als separate Erweiterung unten beschrieben; P5 ist als dritte Erweiterung unten beschrieben. P6 ist nach ausdrücklicher Scope-Erweiterung als exploratives Forschungslabor
umgesetzt; siehe [Methodik und Grenzen](elections/research-concept.md).


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


## Dritte Ausbaustufe: P5 – Mandate und Kandidaturen

**Mandate & Kandidaturen** (`analysisSection=mandates`) bietet eine eigene
Legislaturauswahl über alle veröffentlichten historischen Perioden. Zunächst wird
nur diese Periode über den bestehenden `get_election_history_period` geladen.
Eine frühere Periode wird erst nach ausdrücklicher Auswahl zusätzlich geladen;
kein Vorladen der gesamten Mandats- oder Personenhistorie.

Die Ansicht enthält erfasste Direkt-, historische Zweit- und Listenmandate je
Partei, separat Nachrücker-Einträge und ungeklärte Listenarten. Die Zählung ist
keine Bestätigung der vollständigen Sitzverteilung. Identische Wahleinträge einer
bestätigten Personen-ID werden zusammengefasst; widersprüchliche Kombinationen
von Partei/Mandatsart werden ausgeschlossen und gezählt. Unverknüpfte historische
Namen bleiben eigenständige erfasste Einträge und werden niemals zusammengeführt.

Mandatstabelle: Partei, Wahlkreis, Mandatsart/Eintritt, Amtsintervall, abgeschlossene
Kalendertage (einschließlich Anfang und Ende), CSV und Sortierung. Fehlende,
zukünftige oder nur regulär erwartete Endtermine ergeben keine abgeschlossene
Dauer. Es wird keine Gesamtdauer über möglicherweise überlappende Intervalle
summiert. Wiederwahlzahlen laden über die bestehende personenbezogene
Zusammenfassung erst beim Aufklappen und bleiben bei unvollständiger
Personenhistorie als „erfasste gewählte Perioden“ gekennzeichnet.

Zwei ausdrücklich ausgewählte Perioden zeigen dieselben bestätigten Personen,
erneute Wahl und Wechsel zwischen Direkt- und Listenmandat. Nachrücker zählen
nicht als gewählte Vorperiode. Lücken zwischen den ausgewählten Perioden bleiben
möglich; die Darstellung behauptet keine lückenlose Amtsinhaberschaft.
Direktparteiwechsel benötigen explizit bestätigte historische Verknüpfungen,
dieselbe geprüfte Gebietsidentität und eindeutige Direktwahleinträge. Gleiche
Nummern oder Namen genügen nicht. Fehlende Vergleichspaare sind unbekannt,
keine nachgewiesene Zahl null von Wechseln.

### Kandidaturvollständigkeit und Personenverknüpfung

Migration `20261114143000_election_candidate_coverage.sql` legt nur Prüfmetadaten
an und ergänzt `election_analysis_candidates.data_release`; Mandate oder
Kandidaturergebnisse werden nicht importiert oder verändert.

Im Super-Admin unter **Kandidaturen & Ergebnisse**:

1. Alle Wahlkreiskandidaturen einschließlich erfolgloser Personen erfassen und
   bestätigte Personen verknüpfen. Keine Rekonstruktion aus Mandaten.
2. „Amtliche Kandidatur einer bestätigten Person zuordnen“ öffnen. Namen,
   persönliche Ergebnisse und amtliche Quelle gegenüberstellen; dann jeweils
   ausdrücklich die Identität bestätigen. Der RPC
   `confirm_analysis_candidate_identity` ist ausschließlich Super-Admins erlaubt,
   sperrt die beteiligten Datensätze und prüft Stimmen, Anteile, Stimmenart,
   Wahlkreis-/Periodenbeziehung und einen geprüften endgültigen Datenstand.
   Bereits anders verknüpfte amtliche Personen werden nicht überschrieben.
3. Amtliche vollständige Sollzahl der Wahlkreiskandidaturen und HTTPS-Quelle
   eintragen. Vollständigkeit erst nach unabhängiger Quellenprüfung bestätigen.
   Die DB verlangt die Sollzahl, alle historischen Wahlkreise und für jede
   Wahlkreiskandidatur Stimmen, Anteil und bekannten Wahlausgang. Reine
   Listenkandidaturen ohne Wahlkreis sind nicht Teil dieser Sollzahl.
4. Änderungen an Kandidaturen oder historischen Wahlkreisen setzen den Prüfvermerk
   automatisch zurück. Bei erneuter Prüfung ist eine neue Bestätigung erforderlich.

`review-election-2026.py` schreibt bei neuen amtlichen Kandidaturen nun den
geprüften Ergebnisstand mit. Bereits vorhandene leere Metadaten lassen sich bei
expliziter Identitätsbestätigung nur gegen das passende amtliche endgültige
Erststimmenergebnis und dessen verifizierten Quellenbericht ergänzen.
Bestehende abweichende Stände bleiben geschützt. Die neue Migration deshalb vor
neuen amtlichen Ergebnispatches anwenden.

Erst nach bestätigter Vollständigkeit öffnet die Auswertung persönliche
Kandidaturergebnisse. Parteireferenzen und amtliche Kandidaturdaten werden erst
beim Aufklappen geladen (ein Jahr, Zweitstimmen, höchstens 350 Parteizeilen und
350 amtliche Kandidaturen für die fünf erfassten Parteien). Eine Differenz in PP
erscheint nur bei zusätzlich bestätigter Person, geprüfter Wahlkreisverbindung,
übereinstimmenden Kandidatenstimmen/-anteilen und gleichem endgültigem Datenstand.
Vor 2026 gibt es keine unabhängige Parteizweitstimme; bei nicht erfassten Parteien
bleibt die Referenz unbekannt. Die Kennzahl ist deskriptiv und weder individuelle
Stimmensplittingzahl noch kausaler Amtsinhabereffekt. Wissenschaftliche
Amtsinhabermodelle werden auch bei vollständigen Daten nicht automatisch aktiviert.

Ergänzt, **nicht ausgeführt**: `mandateModel.test.ts`, `mandateHooks.test.ts`,
SQL-Fixtures in `supabase/tests/election_candidate_coverage.sql` und ein weiterer
Logikschritt im Selbsttest-Center. TypeScript wird separat geprüft.
Die Migration wurde hier mangels administrativem Live-DB-Zugang nicht eingespielt.
Amtliche Vollimporte, bestätigte historische Grenzen und Personenverbindungen
bleiben Datenvoraussetzungen; die Auswertung ersetzt diese Prüfungen nicht.


## Vierte Ausbaustufe: P6 – exploratives Forschungslabor

Unter **Wahlforschung** (`analysisSection=research`) sind vier getrennt geladene
Werkzeuge verfügbar. `researchTool=typology|structure|flows|scenario` steuert den
aktiven Bereich. Bestehende RLS gelten; das Labor hat keine Schreibzugriffe.
Es gibt keine neuen Datenbanktabellen oder Migrationen für P6.

### Wahlkreisgruppen

Eine Wahl oder optional zwei ausdrücklich ausgewählte Wahlen, zwei bis sechs
Gruppen. Ergebnisse werden mit Silhouette, Adjusted Rand Index (ARI) zwischen
k-means-/Ward-Zuordnung, mehreren k-means-Startwerten und 12 reproduzierbaren
80-Prozent-Teilstichproben beurteilt. Fehlgeschlagene Teilstichproben werden gezählt.
Eine hohe Übereinstimmung bestätigt Stabilität innerhalb dieser Annahmen, keine
inhaltliche Wahrheit oder unabhängige Prognosegüte.

Merkmale: Parteianteile einschließlich Rest und Wahlbeteiligung; bei zwei Wahlen
zusätzlich Änderungen. Parteianteile werden wurzeltransformiert, danach werden
alle Merkmale standardisiert. Konstante Merkmale haben keinen Einfluss. Historisch
nicht vorhandene AfD-Werte werden nicht nullgefüllt; gemeinsame Merkmale lassen
AfD dann weg, die jeweilige Restkategorie enthält alle übrigen Parteien.

k-means++ verwendet acht feste Starts und die kleinste Fehlerquadratsumme, Ward
minimiert den Zuwachs innerhalb der Gruppen. Silhouette nutzt euklidische Abstände
im transformierten Merkmalsraum. Resampling verwendet dieselbe Skalierung; es ist
keine unabhängige Validierung. Gruppenmittel sind ungewichtete Wahlkreismittel.
Grenzänderungen sind ausgeschlossen; unbekannte Grenzen und gemischte Stände sind
nur nach ausdrücklicher Warnbestätigung einzubeziehen. Ein Zweijahresvergleich ist
keine vollständige Langzeittypologie. Gruppen und Methodik können exportiert werden.

### Strukturmodelle

CSV lokal einlesen: UTF-8, maximal 2 MB und 70 Zeilen, Pflichtspalten
`district_number` und `year`, optional `district_name`, ein bis sechs numerische
Merkmale. Nummern müssen eindeutig 1–70 sein, Jahr muss zur ausgewählten Wahl
passen. Namen werden nicht zum Verknüpfen benutzt. Leere Zahlen bleiben unbekannt;
keine implizite Ersetzung durch 0. Dezimalkomma ist bei Semikolontrennung möglich,
Tausendertrennzeichen sind nicht erlaubt.

Vor Berechnung sind eine HTTPS-Quelle, Definition/Einheit und die persönliche
Bestätigung des amtlichen Ursprungs sowie des korrekten Gebietszuschnitts nötig.
Die App verifiziert diese externe Quelle nicht. Datei und Metadaten bleiben im
Arbeitsspeicher dieser Ansicht; es erfolgt kein Upload und keine Wahldatenänderung.
Ein Ansichts-/Wahlwechsel verwirft die Datei. Dateiname und SHA-256 stehen im Export.

Das Modell erklärt jeweils einen Parteianteil durch genau ein ausgewähltes
Strukturmerkmal mit Achsenabschnitt. Mindestens zehn vollständige Paare sind nötig.
Anzeige: Koeffizienten, R², RMSE, Leave-one-out-RMSE, Residuen, Hebelwerte und
Cook-Distanz. Unberechenbare Kennzahlen bleiben unbekannt. Die Zuordnung nach
Nummer ist erst nach der ausdrücklichen Zuschnittprüfung verwendbar. Es gibt keine
multivariate Kontrolle, räumliche Unabhängigkeit, Signifikanzbehauptung, kausale
Aussage oder individuelle Inferenz. OLS-Werte können außerhalb 0–100 liegen.

### Wanderungsannahmen

Vorhandene landesweite Schätzungen werden nach Wahl und Zielpartei geladen.
Für eine Partnerbeziehung kann ein angenommener Gegenstrom und eine selbst
gewählte Saldo-Sensitivität angegeben werden. Für Saldo s und Gegenstrom c:
`Zustrom = max(s, 0) + c`, `Abstrom = max(-s, 0) + c`.

Bandbreiten entstehen ausschließlich aus eingegebenen Annahmen, nicht aus einer
statistischen Unsicherheitsschätzung. Vorhandene Bruttoströme bleiben erhalten.
Bestandsgrößen der Partner/Gesamtwählerzahl werden nicht abgeglichen; die Rechnung
ist keine empirische Wanderungsrekonstruktion oder konsistente Gesamtmatrix.
Keine lokale Verteilung oder individuellen Wechsel. CSV enthält Quellenhinweise,
vorhandene Werte, Eingabeannahmen und hypothetische Intervalle.

### Szenariolabor

Voraussetzung: 70 vollständige Wahlkreise einer Stimmenart mit demselben
Ergebnisstand. Landesbasis wird aus deren gültigen Stimmen gewichtet berechnet,
nicht aus gemischten finalen Landes-/vorläufigen Wahlkreiswerten. Quelle und
Vorläufigkeit bleiben sichtbar. Gewünschte Parteiveränderungen gelten als uniformer
Swing in PP, Gegenbuchung erfolgt in der Restkategorie. Optional kann eine einzelne
regionale Abweichung gewählt werden. Beteiligung/Bezugsgrößen bleiben konstant.

Ungültige Landesannahmen werden zurückgewiesen. Lokale Werte außerhalb des
zulässigen Bereichs werden auf den Simplex `Anteil >= 0, Summe = 100` projiziert:
kleinster euklidischer Abstand zur angenommenen Anteilsliste. Die Oberfläche zeigt
Anzahl korrigierter Wahlkreise sowie angenommene und tatsächlich erreichte
Landesanteile getrennt. Die Karte verwendet dieselben Änderungen wie die Tabelle
und nur verifizierte periodenspezifische Geometrien. Ergebnisse und Annahmen sind
exportierbar; URL-Parameter teilen das hypothetische Szenario.

Aus diesen Anteilen werden keine Direktmandate oder Sitze berechnet. Es fehlen ein
vollständig geprüftes Wahlrechtsmodell und vollständige Kandidaturen je Periode.
Das Labor wird ausdrücklich nicht als belastbare Wahlprognose bezeichnet.

### Datenumfang und Verifikation

Nur der aktive Bereich wird geladen. Gruppenbildung lädt höchstens zwei ausdrücklich
ausgewählte Wahljahre, Strukturmodell und Szenario eines; Wanderung lädt nur Wahl,
Zielpartei und die kleine Partnerliste. Die vorhandene Query-Infrastruktur mit gezielten Jahr-/Stimmenart-/Partei-Filtern,
Abbruchsignalen und nutzerbezogenen Caches wird wiederverwendet. Der Labor-Hook lädt höchstens
350 Parteizeilen, 70 Beteiligungszeilen und 70 Versionen je ausgewählter Wahl;
OLS nur 70 Zeilen einer Partei und die 70 passenden Beteiligungszeilen, keine
Landestabelle oder anderen Stimmenarten. Rohdaten aus
anderen Perioden oder vollständige Mandats-/Personenregister werden nicht geladen.

`research/lab/models.test.ts` und das Logikszenario im Selbsttest-Center wurden
**ergänzt, nicht ausgeführt**. Sie enthalten Rechenfälle für Gruppenstabilität,
CSV-Jahr/Nullwerte, bekannte Geraden/Leave-one-out, Simplex-Summen und lokale
Korrekturen sowie Saldoerhaltung. Der TypeScript-Abgleich ersetzt diese Tests nicht.
Es gibt keine behauptete empirische, wissenschaftliche oder Wahlrechtsvalidierung.
Die amtlichen Originaldownloads sind weiterhin durch HTTP 403 blockiert; P6 hebt
keine offenen P0-Daten- oder Geometrieprüfungen auf.

## Fünfte Erweiterung: Sitzmodell, Freigabecockpit und Analysearbeitsräume

Beauftragt wurden alle vorgeschlagenen Erweiterungen **außer regionalen Szenarien**.
Die vorhandene einzelne regionale P6-Annahme wird nicht erweitert; neu gespeicherte
Arbeitsräume dieses Ausbaus betreffen landesweite Szenarien.

### Migrationen und amtliche Landesbasis

1. `20261114144000_analysis_workspaces.sql`: tenantbezogene Szenariospeicherung,
   feinräumige Ergebnistabelle, RLS, Import-/Lese-RPCs; direkte/Listen-Sitze in der
   vorhandenen Landestabelle. Ein fehlender Original-Hash in Quellenprüfungen darf
   nun NULL sein, statt einen Hash zu erfinden.
2. `20261114145000_verified_2026_state_parties.sql`: alle 21 Landeslisten aus der
   amtlichen Endfeststellung des Landeswahlausschusses vom 27.03.2026 ergänzen.
   Zahlen/Metadaten nur bei fehlenden oder bereits passenden Werten vervollständigen.
   Abweichende manuelle Zahlen bleiben geschützt. Die bestehende Landestabelle
   bleibt die einzige Quelle; es gibt keine zweite konkurrierende Ergebnisdatenbank.

Die Quelle enthält 157 Sitze: GRÜNE 56, CDU 56, AfD 35, SPD 10. Die fünf bisherigen
Fokusparteien bleiben in den bisherigen Ansichten erhalten; der Simulator liest
ausdrücklich die vollständige Landesliste. Wahlkreiswerte werden dadurch nicht
endgültig, frühere Wahlrechte nicht nachträglich verändert. Quellen und offene
Originaldownloads sind in [sources-and-gaps.md](elections/sources-and-gaps.md) dokumentiert.

### Sitz- und Mandatssimulator 2026

**Wahlforschung → Sitze & Mandate 2026**, `researchTool=seats`. Version
`bw-lwg-2026-v1`, ausschließlich für 2026. Der Rechenkern liegt in
`research/simulator/seats.ts`, Eingabe-/Personenlogik in `electionFile.ts`.

- Alle einzeln erfassten Landeslisten; keine aggregierte „Restpartei“.
- Mindestens 5 % aller ursprünglichen gültigen Zweitstimmen, exakt ganzzahlig geprüft.
- Sainte-Laguë-Höchstzahlen durch ganzzahlige Kreuzprodukte, kein Fließkomma-Los.
- 120 Grundsitze abzüglich Sonderdirektmandate; erfolgreiche Einzelbewerber und
  Direktgewinner nicht teilnehmender Parteien behalten ihre Direktmandate.
- Erforderliche Zweitstimmenbereinigung ist eine gesonderte Kreuzinformation.
  Fehlt sie, erfolgt keine erfundene Verteilung. Auch Nullabzüge müssen für jede
  teilnehmende Partei explizit angegeben werden. Die sitzwirksame Erststimmensumme
  dieser Gewinner muss angegeben oder aus vollständigen Kandidaturen berechnet sein.
- Überhang verbleibt bei der Partei; die kleinste ausreichende Gesamtgröße wird
  über monotone Höchstzahlverteilung gesucht. Beim letzten Ausgleichsgleichstand
  erhalten alle gleichrangigen Parteien einen Sitz. Ein Grundsitzgleichstand
  benötigt dagegen eine ausdrückliche Losannahme.
- Die Mehrheitsklausel berücksichtigt alle sitzwirksamen Stimmen; ihre Zusatzsitze
  werden separat ausgewiesen. Erschöpfte Listen werden nicht mit anderen Personen
  oder Parteien aufgefüllt. Nicht verteilbare Sitze bleiben unbesetzt.
- Die Rechengrenze von 10.000 Sitzen ist ein Abbruch, keine gesetzliche Obergrenze.
  Nicht unterstützte degenerierte Sonderfälle werden zurückgewiesen.

Standardmodus: Landes-Zweitstimmen aus der vollständigen vorhandenen Tabelle und
getrennt eingegebene Direktmandatsannahmen. Swing und Log-Ratio verwenden die
amtlichen Erststimmenergebnisse je Wahlkreis und Wahlvorschlag. Der Simulator
prüft deren Summen und die amtliche Sitzreferenz. In der manuellen
Wahlkreisansicht können die Ergebnisse mit Namen aus der veröffentlichten
Wahlhistorie ergänzt werden. Kippannahmen können für mehrere Wahlkreise zusammen
übernommen, entfernt und im Szenario gespeichert werden.

Gespeicherte Szenarien können weiterhin vollständige Wahlkreisdaten und
Landeslisten als eigene Grundlage enthalten. Unvollständige Erststimmensummen
und doppelte Kandidaturen werden in solchen Snapshots zurückgewiesen. Eine Landesliste nutzt dieselben Personen-IDs wie die
Wahlkreiskandidaturen; Direktgewinner werden bei der Listenbesetzung übersprungen.
`listsComplete=false` lässt Listenpersonen ausdrücklich unbekannt. Bei vollständigen,
aber erschöpften Listen werden die unbesetzten Ansprüche angezeigt.

Erst- und Zweitstimmenänderungen sind getrennte Eingaben. Zweitstimmenänderungen
werden gegen die Sonstigen gebucht und proportional auf deren einzelne Landeslisten verteilt. Unter **Direktmandate** lässt sich das Wahlkreismodell auswählen. Ältere Szenarien bleiben bei den manuellen
Annahmen. Swing überträgt Zweitstimmenänderungen in Prozentpunkten. Log-Ratio
gewichtet das Erststimmenprofil mit dem Verhältnis der neuen zu den amtlichen
Zweitstimmen, mit einer halben Stimme zur Stabilisierung bei Nullwerten. Beide
Modelle rechnen nur mit vorhandenen Kandidaturen und erhalten die Stimmen der
Einzelbewerbungen sowie die gültigen Erststimmen jedes Wahlkreises. Bei
unveränderten Zweitstimmen bleiben die amtlichen Erststimmen exakt erhalten.
Modellwahl und Version werden im Szenarioschnappschuss gespeichert. Die
Wahlkreissicht zeigt Direktmandate und Kippfälle auch bei offener Sitzverteilung.

Manuelle Erststimmenanteile
werden nur bei vorhandener Nominierung geändert und ggf. projiziert; die Zahl
korrigierter Wahlkreise ist sichtbar. Anteile werden summenerhaltend in ganze Stimmen
umgerechnet; diese numerische Rundung ist kein amtlicher Losentscheid. Bei Änderungen
werden alte Sonderfallbereinigungen nicht automatisch übernommen. Auch manuelle
Bereinigungsfelder werden bei Änderungen der Annahmen zurückgesetzt.

Der unveränderte amtliche Referenzfall wird beim Öffnen separat verglichen. Bei
Abweichung bleibt die Szenarioausgabe gesperrt. Dies ersetzt keine ausgeführten
Unit-/Integrations-/Wahlrechtstests und ist keine amtliche Freigabe. Kein Ergebnis
wird als belastbare Wahlprognose bezeichnet und keine historische Mandatszeile geändert.

### Landestrends Baden-Württemberg

Super-Admins können unter **Administration → Wahldaten → Landestrends** Umfragen
erfassen, bearbeiten und für die Auswahl im Simulator veröffentlichen. Erfasst
werden Institut, Auftraggeber, Quelle, Veröffentlichung, Feldzeit, Befragte,
Methode, Umfragetyp und Zweitstimmenanteile. Für eine Sitzprojektion müssen die
sechs Hauptparteien und die übrigen Werte insgesamt exakt 100 Prozent ergeben.
Weitere separat ausgewiesene Parteien können einzeln erfasst werden.

Die ausgewählte Umfrage bildet den Nullpunkt der Regler. Swing ist die
Voreinstellung. Das Wahlkreismodell überträgt die Differenz zwischen dem amtlichen
Zweitstimmenergebnis von 2026 und den simulierten Zweitstimmen auf das Erststimmenprofil
von 2026. Der verbleibende Sammelwert wird im Verhältnis der amtlichen Stimmen auf
die übrigen Landeslisten verteilt. Gespeicherte Szenarien enthalten die verwendete
Umfrage als Schnappschuss.

### Schwellenanalyse

Parteisitze: Raster −2 bis +2 PP um das aktuelle Szenario, Auflösung 0,1 PP und
Gegenbuchung bei den Sonstigen. Direktmandate bleiben konstant.
Fehlende Sonderfallinformationen ergeben unbekannte Rasterpunkte. Das Raster
behauptet keine exakten kontinuierlichen Übergangsschwellen und ist exportierbar.

Wahlkreise bei vollständigen Kandidaturen: minimale ganze Erststimmenübertragung
vom stärksten Gegenbewerber zur gewählten Kandidatur, damit diese **alle** anderen
Kandidaturen strikt überholt. Übrige Stimmen bleiben konstant; ein bloßer Gleichstand
ist kein sicherer Sieg. Dies ist eine explizite hypothetische Übertragungsrechnung,
keine beobachtete Wählerbewegung und keine individuelle Wechselanalyse.

### Daten- und Freigabecockpit

Unter **Datenqualität** werden Zahlenplausibilität, endgültiger Quellenabgleich,
Landesparteivollständigkeit, Geometrien, historische Links, Periodentermine,
Mandatseinträge, Kandidaturvollständigkeit und Wahlrechtsverifikation getrennt gezeigt.
Ein veröffentlichter Datensatz ist nicht automatisch endgültig oder vollständig.
Nur passende Quellenprüfungen belegen die jeweilige Ebene; die neue Landesquelle
bestätigt keine Wahlkreiswerte. Das Cockpit ist lesend und lädt keinen kompletten
Personenbestand. Einträge/Anzahlen und vorhandene Termine werden nicht als extern
bestätigte historische Vollständigkeit ausgegeben.

### Szenarien speichern, teilen und vergleichen

`election_analysis_scenarios` speichert Name, Beschreibung, Modellversion, Auswahl,
Datenstand sowie eingefrorene Eingabe- und Ergebnisschnappschüsse. Standard ist
„Nur ich“; optional lesen aktive Mitglieder des gleichen Büros mit. Fremde Tenants
haben keinen Zugriff. Nur der Eigentümer ändert/löscht, Updates vergleichen eine
Revision und scheitern bei zwischenzeitlichen Änderungen. Tenant und Eigentümer
sind unveränderlich. Account-/Tenant-Löschung entfernt die zugehörigen Szenarien.
Szenarien verändern keine amtlichen oder historischen Wahldaten.

**Gespeicherte Szenarien** lädt 20 Metadatensätze pro Seite. Öffnen lädt eine einzelne
Grundlage; Vergleich lädt nur zwei ausdrücklich ausgewählte Ergebnisse ohne ihre
vollen Eingabedateien. Direkter Vergleich nur bei gleicher Wahl, Stimmenart und
Modellversion. Unterschiedliche Datenstände werden gekennzeichnet. Shares werden
in PP, Sitzmodelle in Sitzen verglichen. Export und tenantgeschützte Links sind möglich.

Ein gespeicherter Share-Datenstand verwendet keine still aktualisierte Karte.
Ohne im Schnappschuss gesicherte Originalgeometrie bleibt die Karte unbekannt;
Tabellen/Annahmen bleiben reproduzierbar. „Grundlage lösen“ wechselt ausdrücklich
zu aktuellen Daten. Lokale Dateien werden nur beim ausdrücklichen Speichern als
Szenario ins aktive Büro übertragen; eine öffentliche Freigabe gibt es nicht.

### Analyseberichte

Die gesamte Wahlanalyse bietet **Bericht herunterladen** und **Drucken / PDF**.
Ein Bericht ist eine eigenständige statische HTML-Datei mit den aktuell dargestellten
Tabellen, SVG-Diagrammen/Kartenausschnitten, Eingabeannahmen, Auswahl-URL, Zeitpunkt,
Quellen und Einschränkungen. Skripte/aktive Inhalte und Verwaltungs-/Speicherformulare
werden entfernt, Kontrollwerte als Text eingefroren. Zum PDF wird die Druckfunktion
des Browsers verwendet. Die Datei lädt keine externen Ressourcen nach.

Der Bericht umfasst ausdrücklich sichtbare Tabellenzeilen, nicht verdeckte
Vollbestände. Vorher „Weitere anzeigen“ benutzen oder den vollständigen CSV-Export
der jeweiligen Ansicht verwenden. Gemeinde-/Szenariolisten sind weiterhin paginiert.
Ein Bericht behauptet keine wissenschaftliche oder amtliche Freigabe der Ergebnisse.

### Gemeinde- und Wahlbezirksebene

**Gemeinden & Wahlbezirke**, `researchTool=municipal`: Filter nach Wahl, Stimmenart,
Wahlkreis, Gebietsebene und Partei; Suche, Seitensortierung und CSV der geladenen
Seite. Abfragen liefern maximal 25 Ergebniszeilen und einen kleinen Parteienindex.
Fehlende Gemeindedaten werden nicht aus Wahlkreisergebnissen herunterskaliert.
Ohne echte historische Geometrien wird keine Gemeindekarte erfunden.

Zentrale Tabelle `election_analysis_local_results`: natürliche Schlüssel aus Jahr,
Stimmenart, Wahlkreis, Ebene, amtlichem Gebietsschlüssel und Partei. Gemeinden/
Gemeindeanteile nutzen den achtstelligen AGS, Wahlbezirke `AGS:Bezirk`. Der Wahlkreis
ist Teil des Schlüssels, weil Gemeinden mehrere Wahlkreise berühren können.
`boundary_key`, Quelle, Datenstand und Vorläufigkeit sind explizit. Gemeinde- und
Wahlbezirksebene werden nie zusammenaddiert. Leere Wahlberechtigte/Wählende bleiben
NULL, tatsächliche Nullwerte bleiben 0; bei gültigen Stimmen 0 ist der Anteil unbekannt.

Super-Admins können CSV bis 5.000 Zeilen / 2 MB strukturell prüfen, eine Vorschau
ansehen und erst nach Quellen-/Zuschnittprüfung übernehmen. Pflichtspalten:
`unit_key;name;party;eligible;voters;valid_votes;votes`. Die gewählte Wahl/Stimmenart/
Nummer/Ebene gilt für den Import. Änderungen der Auswahl heben die Prüfung auf.
Nur geprüfte Zeilen veröffentlichten Wahljahrs sind für reguläre Nutzer lesbar.
RLS begrenzt alle zentralen Schreibrechte auf Super-Admins. Der Import ist
wiederholbar: identische Zeilen werden übersprungen, abweichende vorhandene Werte
bleiben geschützt und werden als Konflikte gemeldet. Datenbank-Constraints prüfen
auch über Parteizeilen hinweg Nenner, Datenstand, Zuschnitt und Stimmenobergrenze;
ein widersprüchlicher Batch wird vollständig zurückgerollt.

Echte Gemeinde-/Wahlbezirksdaten sind noch nicht bereitgestellt. Die Oberfläche und
Übernahmewege sind funktionsfähig vorbereitet, es werden keine fiktiven Gemeinden
oder Messwerte angelegt.

### Verifikation und manuelle Schritte

Ergänzte, **nicht ausgeführte** Tests: `simulator/seats.test.ts`, `workspaces.test.ts`,
SQL-Fixtures `supabase/tests/analysis_workspaces.sql` und ein Logikschritt im
Selbsttest-Center. Sie decken amtliche Referenz, Sperrklausel, Los, Überhang/Ausgleich,
Mehrheitsklausel, Sonderbereinigung, Listenerschöpfung, Snapshot-Auswahl,
Tenant-/Eigentümerrechte, CSV-Nullwerte und Berichtssanitierung ab.
TypeScript wird separat geprüft; keine bestandenen Laufzeit-/E2E-Tests behauptet.

Die beiden neuen Migrationen nach den bisherigen Wahlanalyse-Migrationen anwenden.
Kein administrativer Live-Datenbankzugang steht hier zum Einspielen zur Verfügung.
Vollständige Wahlkreiskandidaturen und Landeslisten für Personensimulationen sowie
echte Gemeindequellen anschließend amtlich einlesen. Der komplette Originalabgleich
aller Wahlkreise und Geometrien bleibt wegen HTTP 403 weiterhin offen; der neue
Landesabgleich löst ausschließlich die vollständig belegte Landesebene 2026.
### Swing-Atlas: Karte, Auswahl und Vergleich

Der Swing-Atlas verwendet die vorhandene `AnalysisMap` und die geprüften Vergleiche aus `research/calculations.ts`. Kartenklick, Tastaturauswahl, Rangliste und Tabellenlink wählen einen Wahlkreis im Atlas aus; der Steckbrief bleibt eine separate Aktion. Die Auswahl wird als `atlasDistrict` in der URL erhalten. Suche nach Namen oder exakter Nummer filtert Tabelle, Kennzahlen, Ranglisten und den Export der Kartenpartei; andere Kartenflächen werden abgeblendet. Der Landeswert bleibt ein Landeswert.

Prozentpunkte sind die Standardansicht, die Abweichung vom Landestrend ist eine eigene Kennzahl mit den bestehenden gemeinsamen Datenstandbedingungen. Stimmenveränderungen verwenden tatsächliche Parteistimmen, keine Hochrechnung aus Prozentpunkten. Die feste symmetrische Farbskala beträgt ±10 PP beziehungsweise ±10.000 Stimmen. Extremwerte werden farblich gesättigt, numerisch vollständig angezeigt. Die optionale automatische Skala orientiert sich an allen Wahlkreisen der Kartenpartei. Unbekannte oder ausgeschlossene Vergleiche sind schraffiert und gehen weder als Null noch als Gewinne/Verluste in Ranglisten ein. Eine gemessene Null wird separat gezählt. Stimmenarten, vorläufige Ergebnisse, Ergebnisstände und Warnungen bleiben sichtbar. Der Vergleich zwischen Einzelstimme und Erst-/Zweitstimme ist kein Nachweis individueller Wählerwechsel.

### Korrektur bei `verified_bw_state` (SQL-Editor)

Falls `20261114145000_verified_2026_state_parties.sql` mit „relation verified_bw_state does not exist“ abbricht, die aktualisierte Datei vollständig erneut ausführen. Sie verwendet einen einzigen atomaren `DO`-Block mit einer lokalen JSON-Konstante statt einer temporären Tabelle. Der erneute Aufruf ist auch bei bereits vorhandenen Teilständen möglich: vorhandene Datensätze werden nicht dupliziert und abweichende manuelle Werte bleiben geschützt. Voraussetzung bleibt die vorherige Migration `20261114144000_analysis_workspaces.sql`.

### Wahlperioden aus der ergänzten Arbeitsmappe

`20261114150000_workbook_election_periods.sql` übernimmt das Blatt „Wahlperioden“ mit Wahltag, Beginn und Ende aller 18 Perioden samt Quellen. Fehlende Historienfelder werden ergänzt; abweichende vorhandene Termine bleiben zur manuellen Prüfung erhalten. Die bestehenden Trigger übernehmen Periodentermine auf geeignete Mandate. Das reguläre Ende 30.04.2031 bleibt voraussichtlich. Das Freigabecockpit meldet übereinstimmende belegte Termine als „Belegt“ statt pauschal „Prüfen“.

Reproduzierbar mit `python scripts/import-election-periods.py workbook.xlsx output.sql`. Dieser separate Periodenimport ergänzt ausdrücklich die Historie; Ergebnisimporte bleiben davon unabhängig. Die Migration enthält zusätzlich die Anpassung des bestehenden Übernahme-RPC für voraussichtliche Endtermine. Auf Wunsch wurden keine Tests ausgeführt.

## Landesgeschichte 1952–2026 und Wanderungsmatrix 2006

Migration `20261115140000_election_state_history.sql` ergänzt historische
Landesergebnisse ausschließlich der bisherigen Fokusparteien, landesweite
Beteiligungsbezugsgrößen sowie die vollständige modellierte Wanderungsmatrix
2001 → 2006. Neue Ansichten: „Landesgeschichte“, „Wanderungsmatrix“ und
„Quellenabgleich“. Weitere historische Parteien werden nicht importiert.
Quellenkonflikte bleiben dokumentiert; bestehende Zahlen werden nicht ersetzt.
Umfang, Herkunft, offener Konflikt 2021 und der nicht auf Live ausgeführte
Migrationsstand sind in
[der Importdokumentation](election-analysis/sources/state-history-workbook.md)
beschrieben. Keine Tests ausgeführt.

### Wahlbeteiligung in „Vergangene Wahlen“

Die Landeszeitreihe und die Beteiligungsdetails sind unter „Vergangene Wahlen“
zusammengeführt. Für die oben ausgewählte Wahl / Legislaturperiode lassen sich
Landes- und Wahlkreisdaten einblenden. Wahlkreise werden nur für diese Wahl und
Stimmenart geladen; fehlende Daten werden ausdrücklich angezeigt. Suche,
Sortierung, Vollständigkeitskennzahlen, Quellen und Datenstatus bleiben erhalten.
Ab 2026 können die Beteiligungsdetails getrennt nach Erst- und Zweitstimme
angezeigt werden, während die Zeitreihe weiterhin die Zweitstimme verwendet.
Alte Links mit `analysisSection=turnout` öffnen die integrierten Details.

Datenbestände und Berechnungen bleiben unverändert: Landeswerte verwenden in
beiden Darstellungen `election_analysis_state_totals` und `stateTotalMetrics`.
Die Summe vollständiger Wahlkreisdaten bleibt separat gekennzeichnet und wird
nicht mit dem Landesdatensatz gleichgesetzt; unterschiedliche Datenstände können
abweichen. Keine Tests ausgeführt.

### Ergänzte historische Originalwahlkreisergebnisse

`20261117100000_workbook_district_history.sql` ergänzt fehlende Wahlkreisanteile
und Beteiligungsquoten 1956–2026 sowie getrennte Erststimmendaten 2026. Bestehende
Ergebnisse bleiben erhalten; das neue Wahlkreis-Arbeitsmappenaudit dokumentiert
Übereinstimmungen und Konflikte beim Einspielen. Die 74 Originalwahlkreise 1952
bleiben bis zur regional eindeutigen Zuordnung archiviert. Alle sieben Blätter,
weitere Nutzungsmöglichkeiten und Einschränkungen sind in
[der Quellenbewertung](election-analysis/sources/district-history-workbook.md)
dokumentiert. Keine Tests ausgeführt; kein Live-Datenbankimport.

### Kandidaturen mit Wahlkreisergebnissen verknüpfen

Die historische Wahlkreisansicht zeigt für die ausgewählte Periode und den
gewählten Wahlkreis die erfassten Kandidaturen samt zugehörigem Analyseergebnis.
`get_election_candidate_results` liest ausschließlich diesen Wahlkreis und
veröffentlichte Perioden/Jahre unter bestehendem RLS. Die Zuordnung nutzt vorhandene
Kandidatur-IDs, dieselbe Periode, die bestätigte historische Wahlkreisverbindung und
die Partei (einschließlich FDP/DVP → FDP). Mehrere Kandidaturen derselben Partei
verhindern die Zuordnung. Vor 2026 gilt `candidate`/Einzelstimme, ab 2026
`first_vote`/Erststimme; Zweitstimmen werden nie als persönliches Ergebnis gelesen.

Persönlich gespeicherte Stimmen/Anteile und das zugeordnete Ergebnis bleiben
getrennt sichtbar. Abweichungen oberhalb 0,00001 Prozentpunkten oder unterschiedliche
absolute Stimmen werden gekennzeichnet. Vorläufigkeit, Datenstand und Quellenhinweise
bleiben am Ergebnis sichtbar. Die Verknüpfung bestätigt keine Originalquelle oder
vollständige Kandidatenabdeckung. Fehlende Daten bleiben unbekannt. Mandatsnamen,
Fraktionen, Nachfolge oder spätere Parteizugehörigkeit erzeugen keine Kandidaturen.
Die Abgeordneten-/Personenregister und die widersprüchlichen Excel-Werte werden
nicht verändert. Neue Ergebnisimporte sind durch die Leseverknüpfung nach Ablauf
des kurzen Abfragecaches verfügbar, ohne persönlichen Ergebnisstand zu überschreiben.

Migration: `20261117110000_link_candidate_district_results.sql`. Ein Logikschritt
im Selbsttest-Center wurde ergänzt, auf ausdrücklichen Wunsch aber nicht ausgeführt.
Kein Live-Datenbankimport in dieser Sitzung.
Die gleiche Zuordnung ist auch im Wahlkreis-Steckbrief der Wahlanalyse sichtbar;
dort wird ausschließlich die zum ausgewählten Jahr gehörende bestätigte Verbindung
verwendet. Erststimmen bleiben unabhängig von einer Zweitstimmenauswahl ausdrücklich
als Erststimmen beschriftet.

### Kandidaturen automatisch hinterlegen (Administration)

`20261117120000_assemble_history_candidacy_results.sql` schließt die bisherige
Lücke zwischen importierten Mandatseinträgen und der eigenen Kandidaturtabelle.
Die Migration führt alle vorhandenen Perioden einmal zusammen. Anschließend
synchronisieren Statement-Trigger Änderungen an Mandaten, Kandidaturen,
Perioden/Wahlkreisen, Analysejahren, Wahlkreisversionen und Ergebnissen automatisch
pro betroffener Periode. Der Browser führt keine Schreiboperation beim Öffnen aus.

Vorhandene `connection_id`-Verbindungen sind die Identitätsgrundlage. Eine bereits
hinterlegte eindeutige `person_id` wird wiederverwendet; andernfalls erhält die
bestehende Verbindung genau einen Personendatensatz. Anzeigenamen dienen nur der
Beschriftung; gleichnamige Personen werden nicht zusammengeführt. Unterschiedliche
bestehende Personen-IDs werden nicht überschrieben.

Ursprüngliche Wahleinzüge erzeugen, soweit eindeutig, Kandidaturen mit belegtem
Wahlausgang. Der in der vorhandenen Quelle zugeordnete Wahlkreis wird auch für
gewählte Listenkandidierende übernommen. Echte landesweite Listeneinträge ohne
Wahlkreis behalten ein Ergebnis ohne persönlichen Wahlkreisanteil. Bereits
vorhandene erfolglose Kandidaturen erhalten ebenfalls passende Ergebnisse;
fehlende erfolglose Personen oder Kandidaturen werden nicht erfunden.
Nachrückmandate erzeugen keine neuen Wahlkandidaturen. Bestehende Mandatsdaten,
Grenzzuordnungen, Kandidaturränge, Listenplätze und Personenverbindungen bleiben
erhalten. Die Mandatsvalidierung und der Audit laufen weiter. Würde ein Trigger
Mandatstermine bei der Verknüpfung ändern, wird nur diese Zuordnung zurückgerollt.

Persönliche Ergebnisse kommen bis 2021 aus Einzelstimmen, ab 2026 aus Erststimmen.
Zweitstimmen sind ausgeschlossen. Übereinstimmung von Periode, Wahljahr,
Wahlkreisverbindung und Partei sowie eine eindeutige Parteikandidatur sind
Voraussetzungen. Fehlende Stimmen werden nicht aus gerundeten Anteilen errechnet.
Bekannte Vergleichswerte auf Zuschnitt 2011 (Waldshut 2006) werden nicht als
persönliches Ergebnis des ursprünglichen Wahlkreises übernommen.

Für 1952 bindet ein explizites Quellenmanifest 222 gelieferte CDU-/SPD-/FDP-Anteile
an die exakten ursprünglichen Mandats- und Wahlkreis-UUIDs des versionierten
Mitgliederimports. Die damalige regionale Nummer oder technische Geometrie-ID wird
dafür nicht verwendet. Diese Bindung vergibt keine Kartengeometrien, benennt keine
Wahlkreise um und beansprucht keine unabhängig verifizierte Quelle. Nicht separat
ausgewiesene kleinere Parteien werden nicht aus Sonstige rekonstruiert.

Die Ergebnisspalten werden tatsächlich in `election_history_candidacies` ergänzt,
sodass die bestehende Administration und weitere Historienleser sie unmittelbar
verwenden. Fünf Nachkommastellen, Quellenhinweise, Datenstand und Vorläufigkeit
bleiben gespeichert. `result_snapshot` verfolgt pro Zahlenfeld ausschließlich die
von dieser Zusammenführung übernommenen Werte. Nur unverändert automatische Werte
werden bei einer späteren Quellenänderung aktualisiert; manuelle Zahlen bleiben
geschützt. Abweichende vorhandene Ergebnisse werden nicht still ersetzt.

Die Administration zeigt statt des bisherigen manuellen Identitätsformulars den
Zusammenführungsstatus der gewählten Periode. Echte Konflikte, fehlende Quellen und
Validierungsprobleme stehen separat in `election_history_assembly_issues`; sie sind
keine ausstehende Bestätigung pro Kandidatur. Die unabhängige Vollständigkeitsprüfung
aller Kandidierenden bleibt erhalten und wird nicht allein durch vorhandene
Abgeordnete als erfüllt erklärt. RLS und ein expliziter Superadmincheck schützen
die Zusammenführung; nur die ausgewählte Periode wird im Browser geladen.

Keine Tests ausgeführt. Ein passender Logikschritt zur Feldherkunft wurde im
Selbsttest-Center ergänzt, aber nicht ausgeführt. Kein Live-Datenbankzugang steht
in dieser Sitzung zum Einspielen zur Verfügung. Die tatsächlichen Ergänzungs- und
Konfliktzahlen zeigt der Status nach Anwendung der Migration.

### SQL-Editor: Syntaxfehler bei `ballot_type <> CASE`

Die aktualisierte `20261117120000_assemble_history_candidacy_results.sql` behebt den
Parserfehler „syntax error at end of input“ am `CASE`-Ausdruck der
PL/pgSQL-`IF`-Bedingung: Der komplette Vergleichswert `CASE … END` ist jetzt
geklammert. Die Datei kann vollständig erneut ausgeführt werden. Bereits vorhandene
Tabellen und Policies werden weiterverwendet, Quelleneinträge nicht überschrieben
und die beiden automatischen Zusammenführungstrigger pro Tabelle neu installiert.
Die eigentliche Zusammenführung bleibt wiederholbar und schützt manuelle Zahlen.
Falls der SQL-Editor noch „current transaction is aborted“ meldet, zuerst `ROLLBACK;`
ausführen und danach die aktualisierte Datei vollständig starten. Keine Tests
oder Live-Datenbankausführungen in dieser Sitzung.

### SQL-Editor: Anführungszeichen im 1952er Datenstand

Die Zusammenführungsmigration enthält zusätzlich die Korrektur des fehlenden
schließenden Anführungszeichens beim 1952er `r.data_release`. Dieses verursachte
die Folgemeldung „trailing junk after numeric literal“ am SHA-256 in `r.notes`.
Bei diesem Fehler die aktualisierte `20261117120000_assemble_history_candidacy_results.sql`
vollständig erneut ausführen, gegebenenfalls nach `ROLLBACK;` bei einer weiterhin
abgebrochenen SQL-Editor-Transaktion. Keine Tests oder Live-Ausführung erfolgt.

### Bestätigte Ergebnisfehler aus dem Version-6-Abgleich

`20261117130000_reviewed_district_corrections.sql` aktualisiert gezielt die
Originalwahlkreise Tübingen/Balingen 2016 und Sigmaringen 2026 einschließlich
absoluter Stimmen und Bezugszahlen. Ein atomarer Altstandsvergleich schützt
abweichende manuelle Daten; Konflikte und Änderungen werden protokolliert. Der
Excel-Generator berücksichtigt zusätzlich die fünf konkret bestätigten
2006-Berichtigungen. Die vollständige Version 6 mit den übrigen 2006-Änderungen
ist noch nicht als Datei verfügbar. Umfang, Originalquellen und Grenzen sind im
[gezielten Korrekturbericht](election-analysis/sources/reviewed-election-corrections.md)
dokumentiert. Keine Tests ausgeführt; kein Live-Datenbankimport.

### Wahlkreisergebnis im Abgeordnetenprofil

Unter **Daten → Abgeordnete** zeigt die Detailansicht einen Abschnitt
„02 Wahlkreisergebnis“, passend zur im Profil ausgewählten Legislaturperiode.
Das eigene persönliche Ergebnis steht zuerst und erhält einen kontrastreichen
Balken; weitere eindeutig erfasste Kandidierende werden mit Namen und Partei
gezeigt, sonst ausschließlich als Parteiergebnis. Stimmenzahlen und Anteile,
Einzel-/Erststimme, Direkt-/Listenmandat, Nachrücken, Vorläufigkeit und Quellen
bleiben sichtbar. Die vorhandenen Profilfarben unterstützen Dark- und Light-Mode.

Der neue lesende Invoker-RPC `get_analysis_deputy_election_result` lädt ausschließlich
den gewählten veröffentlichten Mandatseintrag und dessen Wahlkreis. Persönliche
Kandidaturen werden über IDs derselben Periode zugeordnet, niemals über Namen.
Analyseergebnisse benötigen eine bestätigte Verbindung desselben Wahljahrs;
Zweitstimmen und bekannte umgerechnete Waldshut-2006-Vergleichswerte sind ausgeschlossen.
Vorhandene persönliche Zahlen haben Vorrang; Abweichungen zum Parteiergebnis werden
kenntlich gemacht, ohne Zahlen verschiedener Quellen zu mischen. 1952 kann die
zuvor hinterlegte persönliche Kandidatur auch ohne Analyse-Geometrieverbindung
angezeigt werden. Fehlt die persönliche Zuordnung, wird dies ausdrücklich angezeigt.

„Sonstige“ ist nur ein rechnerischer Rest: Alle dargestellten absoluten Stimmen
müssen mit den gültigen Wahlkreisstimmen einen gemeinsamen Datenstand und dieselbe
Vorläufigkeit haben, dürfen den Nenner nicht überschreiten und keine mehrdeutigen
Parteikandidaturen oder bereits aggregierten Sonstige-Zeilen enthalten. Andernfalls
wird kein Rest erfunden. Namen unbekannter Gegenkandidaturen bleiben unbekannt;
die Anzeige behauptet keine vollständige Kandidatenliste oder Quellenverifikation.

Migration: `20261117140000_deputy_profile_election_result.sql`. Der Profilreader
bleibt vollständig lesend und verändert keine Mandate. Ein Logikschritt im
Selbsttest-Center wurde ergänzt, aber auf Wunsch nicht ausgeführt. Keine Tests
oder Live-Datenbankausführung in dieser Sitzung.

Das Abgeordnetenprofil gliedert die Auswahl nun unter „01 Mandatshistorie“.
„02 Wahlkreisergebnisse“ fasst Ergebnisbalken links und die bestehenden Details der
ausgewählten Legislaturperiode rechts zusammen. Parteikürzel stehen klein neben
den Namen; Prozentwerte bleiben rechtsbündig und fett. Absolute Stimmen sind im
aufklappbaren Quellenbereich weiterhin vorhanden. Bei wenig Platz stapeln sich die
Spalten. Diese Layoutanpassung benötigt keine zusätzliche Datenbankmigration.
Keine Tests ausgeführt.

Das kompakte Abgeordnetenprofil blendet „Dokumentierter Beginn“ aus. Die
Mandatshistorie reicht nur von der ersten bis zur letzten dokumentierten
Mitgliedschaft; dazwischenliegende Perioden ohne Mitgliedschaft bleiben schraffiert
und nicht auswählbar. `deputyTenureCoverage` vereinigt bekannte Mandatsintervalle
pro Periode, zeigt Teilmandate an ihrer tatsächlichen relativen Position und zählt
Überlappungen nicht doppelt. Fehlende Termine werden nicht ergänzt. Die Füllung
endet spätestens am heutigen Berliner Kalendertag; zukünftige oder unbekannte Zeit
bleibt schraffiert. Der Nenner ist der dokumentierte Periodenzeitraum einschließlich
eines gegebenenfalls ausdrücklich voraussichtlichen Periodenendes.

Abschnittsüberschriften und 01/02 sind kräftiger. Ergebnisnamen sind kleiner als
die weiterhin hervorgehobenen Prozentwerte. Rechts stehen nur Zeitraum und
Wahlkreis (gegebenenfalls mit dem Hinweis auf ein voraussichtliches Ende); doppelte
Perioden-, Parteien-, Mandatsart- und Einzugsangaben entfallen. Unter den Balken
bleibt die zur Interpretation notwendige Stimmenart als knapper Hinweis stehen.
Keine neue Migration; Logikschritt ergänzt, aber keine Tests ausgeführt.

### Vier Säulen unter Daten

| `dataTab` | Bereich | `sub` |
| --- | --- | --- |
| `land` | Landesdaten & Trends | `state`, `history`, `demographics`, `flows` |
| `wahlkreise` | Wahlkreise & Regionen | `profile`, `districts`, `swing`, `split` |
| `parlament` | Parlament & Mandate | `deputies`, `mandates` |
| `simulation` | Rechner & Wahlforschung | `seats`, `research` |

Beispiel: `/daten?dataTab=wahlkreise&sub=profile&analysisYear=2021&analysisDistrict=37`.
Der gesetzliche Rechner unter `sub=seats` verwendet unverändert `research/simulator`
und das BW-Wahlrecht 2026. Im Szenariolabor bleiben Wahlkreisgruppen, Strukturmodelle,
Wanderungsannahmen, hypothetische Verschiebungen, Gemeinden/Wahlbezirke und
gespeicherte Szenarien erreichbar. „Beteiligung & Stimmen“ ist dort ein weiteres
Forschungswerkzeug (`researchTool=turnout`); alte `analysisSection=turnout-trend`-Links
öffnen es weiterhin. Alte Beteiligungs- und Matrixlinks bleiben ebenfalls erhalten.

Datenqualität und Quellenabgleich stehen in der Fußzeile „Datenprüfung &
Quellenprotokoll“ (`analysisCheck=quality|sources`, optional `analysisCheckYear`).
Ihre Jahresauswahl ist unabhängig von der Hauptansicht. Bestehende direkte Links
auf diese Prüfungen öffnen die Fußzeile. Das Personenarchiv lädt weiterhin keinen
Analyse-Jahresindex, solange die Datenprüfung geschlossen bleibt. Schwere Module
bleiben lazy geladen. Alle Ansichten verwenden Inter Tight und semantische
Oberflächenfarben; Parteifarben bleiben fachliche Diagramm-/Kartenkodierungen.

Das Matrix-Widget mit Feedbackquoten und offenen FAQ-/Routing-Triggern steht jetzt
unter `/administration?adminSection=users&adminSubSection=matrix-widget` hinter der
bestehenden Admin-Zugriffsprüfung. Es wird nicht mehr mit Wahldaten geladen.

Der zusammengeführte Stand erhält auch die inzwischen ergänzten
Kandidatur-/Wahlkreisergebnisse und Teilzeit-Mandatsbalken im Personenprofil.
Historische Wahlkreisansichten sind für die veröffentlichten Jahre erreichbar;
fehlende Daten bleiben als solche erkennbar. Wahlkreislinks aus Mandaten verwenden
nur die Nummer derselben Wahl ab 1956, keine Namens- oder jahrübergreifende
Identitätsableitung. Beteiligungsdetails sind mit `historyDetails=turnout`
einblendbar und bookmarkbar; Quellenhinweise historischer Wahlkreise bleiben sichtbar.

### Zusammensetzung des Landtags im Abgeordnetenprofil

Die rechte Spalte neben „02 Wahlkreisergebnisse“ zeigt jetzt
„03 Zusammensetzung des Landtags“. Sie verwendet die vorhandene weiße
Halbkreis-Grafik der Landesergebnisse, auch bei dunklem Profil. Die gemeinsame
Reihenfolge lautet SPD, GRÜNE, FDP, CDU, AfD, REP, NPD; weitere erfasste Parteien
folgen danach. Sitze werden ausschließlich aus Daten der im Profil ausgewählten
Legislaturperiode geladen. Zeitraum und gegebenenfalls voraussichtliches Ende
stehen wieder direkt unter „01 Mandatshistorie“.

Die Grafik nutzt direkt den gespeicherten Partei-/Fraktionssnapshot der gewählten
veröffentlichten Periode in `election_history_periods`: `seat_distribution`,
`seat_total`, Bezugsstand, Quellenadresse und gegebenenfalls Stichtag. Sie zählt
keine Mandate und verwendet keine abgeleitete Parlamentssumme aus einer Parteiauswahl.
Eine unvollständige Verteilung oder unbekannte Gesamtsitzzahl bleibt sichtbar.
Wahl-, Periodenbeginn- und spätere Stichtagsverteilungen werden getrennt bezeichnet.
Ein Punkt entspricht einem erfassten Sitz; die Umrandung markiert die zugeordnete
Partei, keine tatsächliche Sitznummer oder persönliche Sitzposition. Historische
Parteilabels bleiben in der Legende erhalten; FDP/DVP wird für die Anordnung bei FDP
eingeordnet. Keine zusätzliche Migration für diese Profilansicht erforderlich;
die vorhandenen Periodensitzzahlen müssen wie für die übrigen Ansichten verfügbar
sein. Keine Tests ausgeführt.

### Bedienung und vollständige Wahlkreis-Zeitreihen

Die sekundäre Bereichsnavigation verwendet wie die Hauptnavigation Grün für die
aktive Auswahl. In „Vergangene Wahlen“ stehen Hinweise und Quellen beider Tabellen
hinter Info-Icons; vollständige Inhalte erscheinen beim Hover oder Tastaturfokus.
In „Alter & Geschlecht“ steht die Altersauswahl direkt neben dem Geschlechtsfilter;
der Tabellenkörper ist weiß, die Methodik steht unter den Ergebnissen. Die
Methodik der Wählerwanderung folgt ebenfalls unter den Auswertungen.

Wahlkreis-Steckbriefe teilen ihre explizit gewählten Jahre mit
`research/seriesYears.ts` in höchstens zehn Jahre je `get_analysis_district_series`-
Aufruf. So bleiben alle 18 Wahlen verfügbar, ohne die bestehende RPC-Grenze zu
überschreiten. Jeder Antwortblock wird unverändert validiert und zusammengeführt;
ein fehlerhafter Block ergibt einen sichtbaren Fehler statt einer unvollständigen
Zeitreihe. Stimmenarten, fehlende Werte, Datenstände und Geometrieprüfungen bleiben
erhalten. Keine zusätzliche Datenbankmigration erforderlich.

Die Bewerberchronik zeigt weitere Kandidierende einzeln untereinander, mit
einheitlichen Tabellenabständen und rechts ausgerichteten Anteilen. Im
Abgeordnetenprofil bleiben Fotos ohne überlagernden Verlauf; Fotoangabe, Bildnachweis und
Bearbeitung liegen als Overlay auf dem durchgehend hohen Foto; ein aufhellender
Verlauf wird nicht eingeblendet. Die Überschriften 02/03 beginnen auf derselben
Höhe, bei wenig Platz werden die Abschnitte weiterhin untereinander angezeigt.

### Kandidaturen ohne Mandat im Abgeordnetenprofil

Die Zeitleiste „Mandate & Wahlteilnahmen“ umfasst die veröffentlichten Perioden
von der ersten bis zur letzten erfassten Kandidatur oder Mitgliedschaft. Eine
Kandidatur ohne erfasstes Mandat bleibt schraffiert, erhält einen Rahmen und den
Zusatz „Kandidatur“ und ist anklickbar. Ihre Auswahl zeigt den dokumentierten
Wahlausgang (beispielsweise „Nicht gewählt“), Partei, Wahlkreis, vorhandene Stimmen,
Anteil und Quellen. Unbekannte Ausgänge bleiben offen. Die dargestellte Mandatszeit
und die Zahl der Legislaturperioden mit Mandat werden dadurch nicht erhöht.

Der neue lesende Zugriff lädt höchstens 200 Kandidaturen ausschließlich für die
eindeutig bestätigte Personen-ID der ausgewählten Mandatshistorie und filtert
bereits serverseitig auf veröffentlichte Perioden. Keine Namensverknüpfung, keine
Nutzung des Super-Admin-Laufbahn-RPC, keine neue Migration oder Datenänderung.
Ein Logikschritt im Selbsttest-Center ist ergänzt; auf Wunsch keine Tests ausgeführt.
