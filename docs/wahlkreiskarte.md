# Wahlkreise BW

- Die Suche findet Wahlkreise nach Namen (ohne Beachtung der Großschreibung) oder exakter Nummer. Enter wählt den ersten Treffer; Escape schließt die Trefferliste. Die Auswahl zoomt auf die Grenze oder, wenn sie fehlt, auf den Mittelpunkt.
- Ein Klick auf eine Zahl oder Gebietsfläche zeigt Informationen und bearbeitbare Arbeitsnotizen in der Seitenleiste, ohne Klick-Popup. Die Statistik zeigt das ausgewählte Gebiet; „Gesamtübersicht anzeigen“ hebt die Auswahl auf.
- CDU wird schwarz, FDP/DVP gelb mit schwarzer Schrift dargestellt. Karte, Parteibadges und Legende verwenden dieselben Farben; die Legende enthält CDU, SPD, GRÜNE, FDP/DVP und AfD.
- Unter „Ebenen“ lassen sich farbige Wahlkreisflächen und Nummernkreise getrennt schalten. Verwaltungsgrenzen und Kreisverbände bleiben eigene Ebenen.
- „Zeitreise“ beginnt immer bei der ältesten freigegebenen Legislaturperiode und läuft dann in Wahljahresfolge durch alle Perioden. Die Karte wird dabei nicht neu aufgebaut; Ausschnitt und Zoom bleiben erhalten. Die nächste Periode und ihr bestätigter Grenzstand werden vorab geladen, sodass kein leerer Zwischenzustand erscheint. Schlägt das Laden fehl, hält die Zeitreise an und nennt die betroffene Periode, statt sie zu überspringen. Die Parteifilter-Auswahl bleibt beim Wechsel der Legislaturperiode erhalten. Der Wechsel blendet den neuen Grenzstand weich ein; der Fortschritt steht als Statusanzeige auf der Karte und verschiebt die Werkzeugleiste nicht.
- Auf kleinen Bildschirmen öffnet „Ebenen & Infos“ die einklappbare Seitenleiste. Die Suche bleibt sichtbar.
- Fehlende, leere oder unbrauchbare WGS84-Grenzdaten werden mit einer aufklappbaren Gebietsliste angezeigt. Ein defektes Polygon verhindert nicht die Darstellung der anderen Gebiete.
- Die Kartenebenen verwenden Leaflets Reihenfolge: Kacheln 200, Polygone 400, Marker 600, Tooltips 650, Popups 700. Keine einzelnen Ebenen unter die Kacheln setzen.
- Flächen werden über die Datensatz-ID zugeordnet, da Wahlkreise und Verwaltungsgrenzen dieselbe Nummer haben können.

## Prüfung

```sh
npx vitest run src/features/election-districts/mapModel.test.ts
npm run test:selftest
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --project=election-map
```

Die Browserprüfung verwendet synthetische Identitäten, Wahlkreise und Kartenkacheln; alle externen Anfragen werden abgefangen. Sie prüft Ebenenreihenfolge, Hover-Texte, getrennte Ebenenschalter, Farben bei gleichen Gebietsnummern, Kreisverbandsgrenzen, neue Polygone nach einem Datenabruf, Zoom, Suchzentrierung und mobile Bedienung. Live-Daten und Schreibvorgänge werden dabei nicht geprüft. Ohne systemweites Chromium kann Playwright seinen installierten Chromium verwenden (Umgebungsvariable weglassen).

Im Selbsttest-Center gibt es zusätzlich das Szenario „Wahlkreiskarte: Suche und Grenzdaten“ mit reinen Logikprüfungen.

## Zentrale Wahldaten und Mandatshistorie

Super-Admin → **Wahldaten & Mandatshistorie**
(`/administration?adminSection=superadmin&adminSubSection=election-history`).

### Einrichtung und Import

Migrationen in dieser Reihenfolge einspielen:

1. `20261114090000_central_election_history.sql`: zentrale Tabellen und Super-Admin-Schreibrechte.
2. `20261114100000_election_history_period_loading.sql`: historische Nummern/Geometrien,
   unbekannte Datumsangaben und das Laden je einzelner Legislaturperiode.
3. `20261114110000_historical_election_members.sql`: 18 Perioden, 1.272 damalige
   Wahlkreisdatensätze und 2.559 Mandatseinträge aus der bereitgestellten Tabelle.

Der Import legt neue Perioden als Entwurf an. Bereits vorhandene Perioden mit
passender Nummer bleiben erhalten. Stabile Datensatz-IDs verhindern Duplikate bei
erneuter Ausführung; bestehende Datensätze werden nicht überschrieben.
Datei-, Blatt- und Zeilenherkunft sowie Quellenlinks werden nicht importiert.
Das Skript `scripts/import-election-history.py input.xlsx output.sql` erzeugt
SQL mit openpyxl; die Excel-Datei wird nicht als App-Asset ausgeliefert.

Importierte Namen werden als `person_name` am Mandat gespeichert. Gleiche Namen
werden nicht automatisch zu einer globalen Personenidentität zusammengeführt.
Die Administration erlaubt die bewusste Verknüpfung mit einer Person; die Suche
lädt erst ab zwei Anfangsbuchstaben höchstens 20 Treffer. Nach Bestätigung einer
vollständigen Identität/Historie kann die Wiederwahlzusammenfassung abgerufen
werden. Nachrücken zählt dabei nicht als Wahl.

Originalbezeichnungen wie Erst-, Zweit-, Landeslistenmandat und historische
Partei-/Fraktionsangaben bleiben erhalten. Unbekannte Amtsdaten bleiben NULL,
ein Wahljahr ersetzt weder einen Wahltag noch einen Mandatsbeginn. Der Import
erfindet keine Stimmenzahlen und legt keine unbelegten Kandidaturen an.
Landeslistenmandate ohne Wahlkreis erhalten keine künstliche Gebietszuordnung.

Acht Kombinationen aus Periode und überlieferter Nummer tragen widersprüchliche
Namen. Dort bleibt die gesicherte Nummer leer; die überlieferte Angabe steht in
`number_label` und die Zuordnung ist zur Prüfung markiert. Historische Gebiete
bleiben nach Periode und Datensatz-ID getrennt. Vor Freigabe in der Vorschau prüfen.

### Historische Umrisse

Die Datei enthält keine Grenzgeometrien. Beim Wahlkreis kann eine WGS84-Polygon-
oder MultiPolygon-Geometrie als GeoJSON hinterlegt werden. Ohne diese Geometrie
ist der damalige Wahlkreis in der Mitgliederübersicht und der Wahlkreisauswahl
verfügbar, aber nicht als vermeintlich belegte Fläche auf der Karte. Aktuelle
Grenzen werden nicht anhand gleicher Nummern oder Namen auf frühere Perioden
übertragen. Historische Geometrien verändern keine bestehenden Geodaten oder
Tenant-Notizen. Historische Nummern dürfen unbekannt sein; NULL ist keine neue
oder erfundene Wahlkreisnummer.

### Laden und Anzeige

- Initial wird nur der kleine Periodenindex gelesen. Danach lädt
  `get_election_history_period` ausschließlich die gewählte Legislatur mit ihren
  Mandaten, Kandidaturen, Wahlkreisen und den dort verknüpften Personen.
- Es gibt keine „Alle Perioden“-Abfrage und keinen globalen Personen-Vollabruf.
  Die Daten bleiben nach Benutzer und Periode getrennt gecacht (60 Sekunden
  Aktualität, 2 Minuten nach Verlassen); laufende Anfragen werden beim Wechsel
  abgebrochen. Die Excel-Datei und Importdaten werden nicht ins Frontend gebündelt.
- Ansichten zeigen zunächst 25 Einträge, weitere explizit auf Anforderung.
  Die öffentliche Mitgliederübersicht ist zunächst eingeklappt.
- Wiederwahlzahlen werden erst beim Aufklappen für die einzelne bestätigte Person
  serverseitig aggregiert; dafür werden keine früheren Perioden vollständig geladen.
- Normale Tenants lesen nur freigegebene Perioden. Die Administration sieht auch
  Entwürfe. Veröffentlichung und die aktuelle Standardperiode werden zentral
  gepflegt; RLS und das vorhandene Änderungsprotokoll bleiben wirksam.
- Ohne freigegebene historische Perioden bleibt die bestehende Wahlkreiskarte nutzbar.
  Fremdschlüssel verhindern Verknüpfungen zwischen verschiedenen Perioden.

### Periodendaten für Mandate übernehmen

`20261114120000_inherit_election_mandate_dates.sql` ergänzt getrennte Kennzeichen
für aus der Periode übernommene Anfangs-/Enddaten. Die Migration ergänzt nur bei
der 18. Periode bereits fehlende Daten aus den in der Administration gespeicherten
Periodenwerten. Es werden keine Kalendertage fest im SQL hinterlegt und der Wahltag
wird nicht als Mandatsbeginn verwendet.

Künftige Änderungen am Periodenbeginn/-ende aktualisieren geerbte Mandatsdaten
transaktional. Individuell gesetzte Daten bleiben erhalten. Nachrücker erhalten
keinen geerbten Beginn; bekannte vorzeitige Austritte (Kennzeichen oder eindeutiger
Hinweis im Bemerkungstext) erhalten kein pauschales Periodenende. Leere Eingaben
verwenden wieder die verfügbaren Periodenvorgaben, soweit diese Regeln es erlauben.
Bei individuellen Änderungen im Editor wird die Übernahme für das jeweilige Datum
aufgehoben. Ungültige Zeiträume werden durch Datenbankregeln zurückgewiesen.

Die Periodenvorschau unterscheidet Wahlkreiszuordnung und persönliche
Wahlergebnisse. Zugeordnete Mandate erscheinen ausschließlich beim jeweiligen
Wahlkreis, einschließlich Zeitraum. Nur Mandate ohne `district_id` stehen im
separaten Abschnitt „Mandate ohne Wahlkreis“. Die importierte 18. Periode enthält
154 zugeordnete und drei reine Landeslistenmandate; fehlende verknüpfte Kandidaturen
werden nicht als fehlende Wahlkreiszuordnung bezeichnet.

### Änderungen im Entwurf sichern

Bestehende Datensätze unveröffentlichter Perioden werden nach 900 ms Eingabepause
automatisch gespeichert, sobald das Formular gültig ist. Globale Personenstammdaten,
neue Datensätze und die Freigabe benötigen weiterhin explizites Speichern. Eine
automatische Speicherung bestätigt die Datenbankantwort und übernimmt die tatsächlich
gespeicherten Werte (einschließlich geerbter Mandatsdaten) zurück ins Formular.

Jede Änderung wird außerdem sofort als benutzerspezifischer Browserentwurf
zwischengespeichert. Beim Bereichs-/Periodenwechsel oder Neuladen bleibt dieser
erhalten und lässt sich über den Entwurfshinweis wiederherstellen. Das gilt auch
für noch unvollständige Formulare und fehlgeschlagene Datenbankanfragen. Die
Anzeige unterscheidet lokale Zwischenspeicherung von erfolgreicher DB-Speicherung.
Bei blockiertem Browser-Speicher erscheint ein entsprechender Hinweis. Nach
erfolgreichem Speichern oder explizitem Verwerfen wird nur der passende lokale
Entwurf entfernt; neuere Eingaben werden nicht durch verspätete Antworten gelöscht.

### Wahlkreis-Detailkarten bei Bedarf

In der historischen Wahlkreisansicht und der Administrationsvorschau lädt
„Wahlkreiskarte öffnen“ erst beim Aufklappen die Leaflet-Komponente, das kleine
Manifest des bestätigten Grenzstands und eine einzelne TopoJSON-Form. Anschließend
werden direkte Nachbarformen im Hintergrund geladen. Der Schalter
„Angrenzende Wahlkreise anzeigen“ blendet diese als eigene Ebene ein.
Die Kartenkacheln werden ebenfalls erst mit der geöffneten Karte angefordert.
Individuelle historische Umrisse haben Vorrang; für sie werden keine Nachbarn aus
einem anderen Grenzstand ergänzt. Fehlende oder unbestätigte Grenzen bleiben sichtbar
als Datenlücke. Für 1952 werden ausschließlich die bestätigten regionalen
Quellenkennungen verwendet; technische Nummern ersetzen keine Mandatszuordnung.
Die Gesamtkarte verwendet weiterhin ihre für die Übersicht gepackten Jahresdaten.

`node scripts/geometry/pack-district-details.mjs` erzeugt aus den vorhandenen
Jahresmanifesten und TopoJSON-Paketen die Detailassets. Die bereits kanonisierten
Form-Hashes vergleichen vollständige Koordinaten ohne Rundung oder Vereinfachung;
identische Formen werden über alle Grenzstände nur einmal gespeichert. Die 844
Zuordnungen der zwölf Grenzstände benötigen 261 unterschiedliche Formen.
1952 enthält 74 regionale Wahlkreise, die übrigen Grenzstände jeweils 70. Die
Jahres-Aliase bleiben unverändert. Koordinatengleichheit bestätigt keine historische
Identität und hebt die periodenspezifische Freigabe nicht auf.

Nachbarschaften werden pro Grenzstand anhand exakt gemeinsamer Liniensegmente
ermittelt; ein gemeinsamer Punkt allein zählt nicht. Abweichend digitalisierte
Grenzlinien werden nicht durch Toleranzen als gemeinsame Grenze ausgegeben.
`public/data/geometry/district-comparison.json` dokumentiert die Wiederverwendung
zwischen aufeinanderfolgenden Grenzständen, unabhängig von Wahlkreisnummern.
Nach Änderungen an den Quellpaketen zunächst den bisherigen Packer und danach
den Detailpacker ausführen. Die Detailmanifeste haben Inhalts-Hashes; die
Einzelformen nutzen ihre exakten Form-Hashes und den bestehenden Browser-Cache.

Unter **Daten → Wahlkreis-Steckbrief** steht derselbe aufklappbare Kartenbereich
unter dem Wahlkreisnamen. Er verwendet ausschließlich den für das ausgewählte
Wahljahr und den Wahlkreis bereits bestätigten `bundled_geometry_year` aus der
Wahlanalyse. Ohne bestätigte Zuordnung zeigt er eine Datenlücke. Beim Wechsel von
Wahljahr oder Wahlkreis schließt der Bereich; erst erneutes Öffnen lädt die Karte.
Das Öffnen lädt weder Mandatshistorien noch andere Wahljahre.

Detailkarten laden nach dem Öffnen zunächst den ausgewählten Wahlkreis und danach
seine direkten Nachbarn im Hintergrund. Der Nachbarschalter blendet ausschließlich
eine eigene Leaflet-Ebene ein oder aus; Karte, Kacheln und gewählter Ausschnitt
bleiben erhalten. Fehler beim Hintergrundabruf ersetzen nicht die gewählte Fläche.
Stuttgart I benötigt 2021 etwa 19 KiB, mit den drei erkannten Nachbarn insgesamt
77 KiB komprimierte TopoJSON-Daten. Die ausgewählte Kontur liegt über den Nachbarn,
wird ohne Linienvereinfachung/Clipping gezeichnet und nach Größenänderungen des
Kartencontainers vollständig mit Rand eingepasst.

### Umliegende Flächen ohne Eingriff in die Quelldaten

Die Detailkarte verwendet für „Umliegende Wahlkreise anzeigen“ einen räumlichen
Kontext statt einer vermeintlich vollständigen, aus exakten Segmentgleichheiten
abgeleiteten Nachbarliste. Auswahlfenster sind die Original-Grenzkoordinaten des
gewählten Wahlkreises, erweitert um jeweils eine halbe Breite/Höhe. Geladen werden
die Originalflächen, deren Begrenzungsrechtecke dieses Fenster schneiden. Dies
behauptet keine gemeinsame Grenze; dadurch bleiben auch umliegende Wahlkreise bei
unterschiedlicher Segmentierung oder minimal abweichenden Quellkoordinaten sichtbar.
Insbesondere werden für Stuttgart I 2006 auch Leonberg und Vaihingen berücksichtigt.
Keine Koordinate wird gerundet, verschoben, ergänzt, geglättet oder durch eine
berechnete Verbindung ersetzt. Die zuvor genannten 77 KiB betrafen ausschließlich
die frühere, unvollständige Auswahl von drei Nachbarn.
