

## Fix: Wahlkreis-Polygone werden auf der Karte nicht angezeigt

### Befund

- DB-Check (`election_districts`): alle 70 Wahlkreise haben gültige `boundaries` als `MultiPolygon` (jsonb), `center_coordinates` als `{lat,lng}` im BW-Bereich (47.6–49.6 / 7.7–10.2). Daten sind also intakt.
- Im Screenshot werden die nummerierten **Marker** korrekt geladen (also kommen die Daten im Frontend an), aber **kein einziges Polygon** wird gezeichnet, und die Karte ist auf den Initial-Zoom (ganz Mitteleuropa) stehen geblieben — was beweist, dass `geoLayer.getBounds()` nie ausgeführt wurde, weil der Polygon-Layer leer geblieben ist.
- Ursache in `src/components/SimpleLeafletMap.tsx` (Zeilen 173–187): Es wird ein **nacktes Array von Features** an `L.geoJSON(geoJsonFeatures as any, …)` übergeben. Leaflets `L.geoJSON` erwartet entweder ein einzelnes `Feature`, ein `Geometry`-Objekt oder eine **`FeatureCollection`** — ein Array wird nicht zuverlässig verarbeitet (in unserer Konstellation gar nicht). Folge: Layer leer, kein `fitBounds`, kein Polygon sichtbar.

### Fix

Eine kleine, gezielte Änderung in `src/components/SimpleLeafletMap.tsx`:

1. Die zusammengebauten Features in eine **echte `FeatureCollection`** wrappen, bevor sie an `L.geoJSON` übergeben werden:
   ```ts
   const featureCollection = { type: 'FeatureCollection', features: geoJsonFeatures };
   const geoLayer = L.geoJSON(featureCollection as any, { style, onEachFeature });
   ```
2. Einen kurzen `debugConsole.log` davor („rendering N polygon features"), damit künftige Datenprobleme sofort sichtbar sind.
3. Fallback-`fitBounds`: Wenn (aus welchem Grund auch immer) keine Polygone, aber Marker mit `center_coordinates` vorhanden sind, soll die Karte beim ersten Render **trotzdem** auf die Marker-Bounds zoomen statt auf Stuttgart bei Zoom 8 stehen zu bleiben.

Keine Änderungen an DB, RLS, Hooks oder Datenstrukturen nötig — die Daten sind korrekt, nur die Übergabe an Leaflet ist es nicht.

### Verifikation nach Fix

- `/karten` zeigt 70 farbige Polygone für die Wahlkreise BW, automatisch auf Baden-Württemberg gezoomt.
- Toggle „Verwaltungsgrenzen" und „Grüne Kreisverbände" rendern weiterhin korrekt (gleicher Render-Pfad).
- Reiter „Stadtteile Karlsruhe" bleibt unberührt.

### Betroffene Dateien

- `src/components/SimpleLeafletMap.tsx` (eine Stelle, ca. 15 Zeilen)

