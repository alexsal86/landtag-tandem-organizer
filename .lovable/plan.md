

# Fixes: Stadtteile laden + Toggles + Layer-Strategie

## Problem 1 + 2: Stadtteile werden nicht geladen / Toggles wirken nicht

**Ursache:** `KarlsruheDistrictsMap.tsx` Zeile 121 pruft `isFeatureCollection(district.boundaries)`, aber die Datenbank speichert `boundaries` als rohe Geometrie (`{ type: 'Polygon', coordinates: [...] }`), nicht als FeatureCollection. Deshalb ist `districtLayerConfigs` immer leer — keine Polygone, nichts zum Togglen.

**Fix in `KarlsruheDistrictsMap.tsx`:**
- Im `districtLayerConfigs` Memo: statt `isFeatureCollection`-Check die rohe Geometrie direkt in ein Feature/FeatureCollection wrappen
- Logik: Wenn `boundaries.type === 'Polygon'` oder `'MultiPolygon'`, ein Feature daraus bauen; wenn es schon eine FeatureCollection ist, wie bisher verwenden
- Damit rendern die Polygone wieder und die Toggles (showDistricts/showStakeholders) greifen wieder

**Geanderte Datei:** `src/components/karlsruhe/KarlsruheDistrictsMap.tsx` (nur der `districtLayerConfigs` useMemo-Block, ca. 15 Zeilen)

## Problem 3: Egress bei zusatzlichen Layern minimieren

**Empfehlung: Statische GeoJSON-Dateien aus `public/data/`**

Fur zusatzliche Karten-Layer (z.B. Infrastruktur, Schulbezirke, Grunflachen) ist die Datenbank der falsche Ort. GeoJSON-Dateien in `public/data/` verursachen:
- **Null DB-Egress** — die Dateien werden direkt vom CDN/Webserver ausgeliefert
- **Browser-Caching** — nach dem ersten Laden kein erneuter Download
- **Keine Supabase-Kosten** — kein Row-Level-Security-Overhead, keine Query-Kosten

Die Datenbank sollte nur fur Daten verwendet werden, die sich andern (Flaggen, Notizen, Stakeholder-Koordinaten). Statische Geodaten (Stadtteilgrenzen, Wahlkreise, Points of Interest) gehoren als `.geojson`-Dateien ins Projekt.

**Konkret fur die bestehenden Stadtteile:** Die Stadtteilgrenzen konnten langfristig auch aus `public/data/karlsruhe-stadtteile.geojson` geladen werden statt aus der DB. Das wurde den grossten Egress-Posten eliminieren (27 Stadtteile mit komplexen Polygon-Koordinaten bei jedem Seitenaufruf).

**Fur neue Layer:** Einfach weitere `.geojson`-Dateien in `public/data/` ablegen und per `fetch('/data/layer-name.geojson')` laden. Ein generischer Layer-Loader kann das mit minimalem Code erledigen. Das wird aber als separater Schritt umgesetzt, wenn konkrete Layer gewunscht sind.

## Zusammenfassung der Anderungen

| Datei | Anderung |
|---|---|
| `src/components/karlsruhe/KarlsruheDistrictsMap.tsx` | `districtLayerConfigs` Memo fixen: rohe Geometrie zu Feature wrappen |

Keine Migration, keine neuen Dateien. Ein fokussierter Fix.

