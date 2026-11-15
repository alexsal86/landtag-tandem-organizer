# Landtagswahlkreise Baden-Württemberg – geometrisch konsistente TopoJSON

## Überarbeitete Dateien

- `LTWahlkreise2006-BW_konsistent.topojson`
- `LTWahlkreise2001-BW_konsistent.topojson`
- `LTWahlkreise1996-BW_konsistent.topojson`
- `LTWahlkreise1992-BW_konsistent.topojson`

Alle vier Dateien behalten 70 Wahlkreisnummern, die bisherigen Wahlkreisnamen und die rechtlichen Wahlkreisgrenzen des jeweiligen Wahljahrs. Sie enthalten WGS84-Koordinaten und sind **ohne Vereinfachung und ohne Quantisierung** gespeichert (TopoJSON ohne `transform`).

## Was wurde korrigiert?

Bei zuvor unveränderten Wahlkreisen differierten die Koordinaten nach separater Geometrieaufbereitung und wiederholter Koordinatentransformation geringfügig. Das störte exakte Vergleiche: identische Grenzen wirkten teilweise wie Änderungen.

| Neuer Datensatz | Referenz | Geometrien exakt übernommen | Historische Geometrien beibehalten |
|---|---|---:|---:|
| 2006 | 2011 | 33 | 37 |
| 2001 | korrigiert 2006 | 59 | 11 |
| 1996 | korrigiert 2001 | 70 | 0 |
| 1992 | korrigiert 2001 | 70 | 0 |

Die 2006→2011-Reform betraf **37** Wahlkreise: `1–11, 13, 14, 16–20, 25, 26, 42, 44, 46–48, 54, 55, 58–63, 66–69`.

Die 2001→2006-Reform betraf **11** Wahlkreise: `5, 6, 8, 10, 11, 13, 14, 18, 20, 66, 68`.

Zwischen den Wahlen 1992, 1996 und 2001 gab es keine weitere Wahlkreisneueinteilung. Daher sind die Geometrien in diesen drei überarbeiteten TopoJSON identisch (die Objektbezeichnung trägt weiterhin das jeweilige Jahr).

## Methodik und Prüfungen

1. Aus den bereits vorhandenen originalen TopoJSON wurden GeoJSON-Geometrien **ohne Reprojektion** exportiert.
2. Für unveränderte Wahlkreisnummern wurden die vollständigen Koordinatenstrukturen aus dem jeweils jüngeren Jahr übernommen. Echte Wahlkreisänderungen blieben ausschließlich im historischen Jahr erhalten.
3. Die vier Ergebnisse wurden als nicht quantisierte, nicht vereinfachte TopoJSON ausgegeben.
4. Der Rückimport aller vier erzeugten TopoJSON bestätigt für **jede** Referenzbeziehung eine mathematisch **identische Geometrie** (`Shapely.equals = True`; symmetrische Flächendifferenz null): 33, 59, 70 und 70 der erwarteten Gebiete.
5. Alle vier Dateien enthalten genau 70 gültige Flächengeometrien und die korrekten Nummern von 1 bis 70.
6. Das Gesamtabdeckungsgebiet und die bereits vorhandene minimale interne Überlappung der Ausgangsdaten blieben unverändert (keine Fläche hinzugefügt oder entfernt).
7. Beim Vergleich jeder korrigierten Wahl mit ihrer vorherigen Fassung entstanden **keine** tatsächlichen Flächenänderungen über 1 m².

Die im Vergleich zu den ursprünglichen, separat erstellten TopoJSON **etwas größeren Dateigrößen** entstehen durch die streng unverändert übernommenen Koordinaten und die dadurch teils nicht zusammengefassten Grenzabschnitte. Das ist **kein** Hinweis auf höhere geografische Genauigkeit und **keine** Vereinfachung.

Das Rekonstruktionsscript heißt `align_unchanged_wahlkreise_1992_2006.py`. Die originale TopoJSON für 2011 wurde nicht verändert. Die hier neu erzeugten Dateien haben `_konsistent` im Namen, damit die bisherigen Dateien als Vergleichsversionen erhalten bleiben.

**Hinweis zum Wahljahr 1988:** Diese vier Dateien werden mit den Wahlen ab 2001 bzw. 2011 koordiniert. Eine entsprechende exakte Koordinatengleichheit zur separat rekonstruierten 1988er TopoJSON ist noch nicht nachträglich hergestellt worden. Der Wahlkreis 37 heißt 1988 Mannheim III und ab 1992 Wiesloch; das darf beim Zeitvergleich nicht nur nach Nummer gekoppelt werden.
