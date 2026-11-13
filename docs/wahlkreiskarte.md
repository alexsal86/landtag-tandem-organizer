# Wahlkreise BW

- Die Suche findet Wahlkreise nach Namen (ohne Beachtung der Großschreibung) oder exakter Nummer. Enter wählt den ersten Treffer; Escape schließt die Trefferliste. Die Auswahl zoomt auf die Grenze oder, wenn sie fehlt, auf den Mittelpunkt.
- Ein Klick auf eine Zahl oder Gebietsfläche zeigt Informationen und bearbeitbare Arbeitsnotizen in der Seitenleiste, ohne Klick-Popup. Die Statistik zeigt das ausgewählte Gebiet; „Gesamtübersicht anzeigen“ hebt die Auswahl auf.
- CDU wird schwarz, FDP/DVP gelb mit schwarzer Schrift dargestellt. Karte, Parteibadges und Legende verwenden dieselben Farben; die Legende enthält CDU, SPD, GRÜNE, FDP/DVP und AfD.
- Unter „Ebenen“ lassen sich farbige Wahlkreisflächen und Nummernkreise getrennt schalten. Verwaltungsgrenzen und Kreisverbände bleiben eigene Ebenen.
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
