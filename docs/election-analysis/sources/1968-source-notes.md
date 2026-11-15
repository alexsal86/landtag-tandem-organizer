# Historische Landtagswahlkreise Baden-Württemberg – Wahl 1968

## Dateien

- `LTWahlkreise1968-BW_konsistent.topojson`: rekonstruierte Geometrien aller 70 Wahlkreise (keine Quantisierung oder Vereinfachung).
- `LTWahlkreise1968-BW_konsistent.geojson`: direkt zu prüfende, gleichwertige GeoJSON.
- `LTWahlkreise1968-BW_Historische_Wahlkreisnamen.csv`: historische Wahlkreisnummern und Namen.
- `LTWahlkreise1968-BW_Aenderungen_gegenueber_1972.csv`: betroffene Wahlkreise und geometrische Differenzflächen.
- `work_1968_geometrie_audit.json`: Gebietskulisse, Änderungen und technische Rekonstruktionszahlen.
- `work_1968_zuordnungen_audit.csv`: Zuordnung nach modernen Gemarkungen zu historischen Kreisen und Wahlkreisen.
- `reconstruct_wahlkreise_1968.py`, `reconstruct_wahlkreise_1972.py`, `work_1972_zuordnungen.py`, `finalize_wahlkreise_1968.py`, `geojson_to_lossless_topojson.py`: Reproduktionscode, abhängig von den in diesem Chat bereitgestellten Geodaten.

## Rechtsgrundlage und historischer Stichtag

- **Wahltag:** 28. April 1968.
- **Wahlkreisstand:** 28. Oktober 1967. Das Landtagswahlgesetz in der Fassung 20. September 1963 (Art. 6 Abs. 2) ließ spätere Änderungen der Gemeinde- und Landkreisgrenzen ab sechs Monaten vor der Wahl außer Betracht.
- **Wahlkreise 1–70:** Wahlkreisnummerierung des Landeswahlgesetzes 1963, im amtlichen Wahlbericht 1968 wiedergegeben. **Nr. 37 ist Bruchsal**; Stuttgart besitzt fünf Wahlkreise, Mannheim-Stadt die Nummern 31–33.
- **Sonderfall Wilflingen:** 1967 zum Landkreis Hechingen gehörend, war Wilflingen gesetzlich ausdrücklich Wahlkreis 62 Tuttlingen zugeordnet.

## Geometrische Erstellung

1. BKG `VG-Hist`, aus dem vom Benutzer bereitgestellten GeoPackage: **72 Stadt- und Landkreise in Baden-Württemberg am 28.10.1967**.
2. Feinere ehemalige Gemeinde- und Gemarkungszuordnung approximiert mit 3.380 modernen ALKIS-Gemarkungen, lokale Durchschneidung der historisch unterschiedlichen Kreisgrenzen.
3. Innerstädtische Wahlkreisgrenzen approximiert mit heutigen Stuttgarter Stadtbezirken, Mannheimer Stadtteilen und der früheren Zweiteilung von Karlsruhe.
4. Für **41 geometrisch unveränderte Wahlkreise** wurden die absoluten Koordinaten exakt aus der 1972er GeoJSON übernommen. Die anderen **29 Wahlkreise** wurden mit dem geänderten historischen Kreisstand neu gerechnet. Diese 29 sind nach den benutzten historischen Quellen **geometrisch** von 1972 verschieden; sie sind nicht notwendigerweise 29 explizit per Gesetz umbenannte bzw. neu abgegrenzte Wahlkreise.
5. Koordinaten nach EPSG:4326, TopoJSON ohne Vereinfachung oder Quantisierung.

## Prüfung

- 70 Geometrien mit den Wahlkreisnummern 1 bis 70 vorhanden.
- Alle 70 Geometrien gültig und bei TopoJSON→GeoJSON-Rückkonvertierung topologisch exakt identisch.
- 2.777 geteilte TopoJSON-Arcs.
- 41/70 Gebiete im Vergleich zu 1972 unverändert, 29/70 geometrisch verändert; die einzelnen WK stehen in der Änderungstabelle.
- Änderungsumfang als Summe der paarweisen symmetrischen Differenzen aller WK ca. 329,104 km² (hinzugefügte und entfernte Gebiete jeweils gezählt; nicht die Fläche einmalig geänderter Orte).
- Gebietsfläche der rekonstruierten 1968er Wahlkreise ca. 35.721,668 km² (moderne ALKIS-Kulisse).

## Grenzen der historischen Genauigkeit

**Es handelt sich um eine nachvollziehbare Rekonstruktion, nicht um amtliche digitale Original-Geometrien von 1968.** Moderne Gemarkungen wurden auf die damaligen Kreisgrenzen bezogen. Alte innerstädtische Grenzverläufe sind nur genähert. Die exakte geometrische Gleichheit mit 1972 ist bewusst nur dort hergestellt, wo die eigene historische Flächenzuordnung keine Änderung ergeben hat. Auch die heute verwendete Außenlandesgrenze ist nicht aus einem historisch vermessenen 1968er Gesamtdatensatz abgeleitet.

## Quellen und Lizenzen

- Statistisches Landesamt Baden-Württemberg: *Die Wahl zum Landtag von Baden-Württemberg am 28. April 1968*, Band 149 (1969), besonders S. 7 sowie 193 ff.: https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023903/149_2612_68001.pdf
- Gesetz über die Landtagswahlen, Fassung vom 20. September 1963, Art. 6 mit Anlage; veröffentlicht im Gesetzblatt Baden-Württemberg.
- Bundesamt für Kartographie und Geodäsie, `VG-Hist` (Verwaltungsgebiete Historisch): https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-historisch-vg-hist.html – © BKG (2026), CC BY 4.0, Daten verändert.
- Landesamt für Geoinformation und Landentwicklung Baden-Württemberg, ALKIS-Gemarkungen 2026, Datenlizenz Deutschland – Namensnennung 2.0, Daten verändert.
