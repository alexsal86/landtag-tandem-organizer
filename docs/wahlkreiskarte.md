# Wahlkreise BW

- Die Suche findet Wahlkreise nach Namen (ohne Beachtung der Großschreibung) oder exakter Nummer. Enter wählt den ersten Treffer; Escape schließt die Trefferliste. Die Auswahl zoomt auf die Grenze oder, wenn sie fehlt, auf den Mittelpunkt.
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
