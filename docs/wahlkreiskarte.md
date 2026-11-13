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
(`/administration?adminSection=superadmin&adminSubSection=election-history`) pflegt
plattformweite Legislaturperioden, Personen, historische Wahlkreise, Kandidaturen
und tatsächliche Mandatsabschnitte. Die Datenbankmigration
`20261114090000_central_election_history.sql` muss vor Verwendung eingespielt werden.
Die neuen Tabellen sind unabhängig von den vorhandenen `election_representatives`;
Bestandsdaten und tenantbezogene Notizen bleiben erhalten. Es gibt keinen
unsicheren automatischen Personenabgleich anhand von Namen und keine Testdaten.

1. Periode als Entwurf mit Wahltag und Legislaturzeitraum anlegen.
2. Personen und die Wahlkreise dieser Periode anlegen; Namensgleichheit ist
   erlaubt, die Kurzbiografie kann der Unterscheidung dienen. Wahlkreisnummern
   sind nur innerhalb einer Periode eindeutig.
3. Kandidaturen erfassen: damalige Partei, persönliche Kandidaten-/Erststimmen,
   Anteil, Rang, Listenplatz und Wahlausgang. Auch Listengewählte und erfolglose
   Kandidierende können persönliche Wahlkreisergebnisse erhalten. Parteizweitstimmen
   werden hier ausdrücklich nicht als persönliche Ergebnisse gespeichert.
4. Mandate erfassen: Person, Periode, Wahlkreis (optional für reine Listenmandate),
   Direkt/Liste, gewählt/nachgerückt, tatsächlicher Beginn/Ende und Quelle. Die
   zugehörige Kandidatur ist optional verknüpfbar. Bei verknüpften gewählten
   Mandaten müssen Wahlausgang und Wahlkreis passen; Nachrücken kann auf eine
   ursprünglich erfolglose Kandidatur folgen. Verknüpfungen zwischen Perioden und
   überlappende Mandatsabschnitte einer Person in derselben Periode sind gesperrt.
5. Periode über **Periode prüfen** ansehen und anschließend freigeben.
   **Als aktuell festlegen** schaltet die Standardperiode atomar um. Zum
   Zurückziehen der aktuellen Periode zuerst eine andere als aktuell festlegen.

Alle angemeldeten Tenants lesen freigegebene Perioden; nur Super-Admins bearbeiten
zentrale Datensätze oder sehen Entwürfe und das Änderungsprotokoll. Personenstammdaten
sind angemeldeten Nutzern lesbar. Änderungen werden durch Datenbanktrigger
append-only protokolliert. Löschungen referenzierter Datensätze sind gesperrt;
Löschen im Editor verlangt eine Bestätigung.

Die Karte bietet die freigegebenen Perioden zur Auswahl und verwendet deren Namen
und Mandate. Ohne freigegebene Perioden wird die bisherige Datenquelle verwendet.
Historische Grenzgeometrien werden nicht erfunden: Die Karte nutzt die vorhandenen
Grenzdaten und kennzeichnet diesen Umstand. Grenzänderungen lassen sich pro
historischem Wahlkreis dokumentieren. Nicht vorhandene Perioden/Daten werden
nicht als belegte historische Lücken oder Nullergebnisse ausgegeben.

Wiederwahlen zählen verschiedene gewählte Legislaturperioden minus die erste Wahl;
Nachrücken und mehrere Mandatsabschnitte derselben Periode erhöhen den Zähler nicht.
Die Anzeige bezieht sich auf die ausgewählte Periode und frühere Perioden. Solange
bei einer Person die Vollständigkeit nicht ausdrücklich bestätigt wurde, zeigt die
Ansicht nur die Zahl erfasster gewählter Perioden. Die Bestätigung setzt eine
vollständige, freigegebene Historie voraus. Kandidaturen und Mandate ohne Wahlkreis
bleiben zentral pflegbar und in der Periodenvorschau sichtbar, sind aber keinem
Kartenpolygon zugeordnet.
