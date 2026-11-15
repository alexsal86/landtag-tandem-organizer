# Baden-Württemberg: Wahlkreise zur Landtagswahl vom 15. Mai 1960

## Dateien

- `LTWahlkreise1960-BW_konsistent.topojson`: TopoJSON mit den historischen 70 Wahlkreisen, ohne Quantisierung oder Simplifizierung.
- `LTWahlkreise1960-BW_konsistent.geojson`: entsprechende GeoJSON zum Vergleich.
- `LTWahlkreise1960-BW_Historische_Wahlkreisnamen.csv`: historische Nummern 1–70 und Wahlkreisnamen.
- `work_1960_geometrie_audit.json`, `work_1960_zuordnungen_audit.csv`: geometrische und räumliche Zuordnungsprüfung.
- `reconstruct_wahlkreise_1960.py`, `reconstruct_wahlkreise_1972.py`, `work_1972_zuordnungen.py`, `finalize_wahlkreise_1956_1960.py`, `geojson_to_lossless_topojson.py`: Reproduktionsskripte mit weiteren Geodaten als Eingabe.

## Historische Grundlage

- Wahltermin: **15. Mai 1960**; Rechtsgrundlage Landtagswahlgesetz Baden-Württemberg vom 9. Mai 1955, Artikel 6, Wahlkreise 1–70.
- Kreisgrenzen aus dem Bundesdatensatz **BKG VG-Hist zum Wahltag 15.05.1960**. Das Gesetz 1955 enthielt noch nicht die spätere Sechsmonats-Sperrfrist für Grenzänderungen des Jahres 1963.
- Die Gebietszuordnung ist nach damaligen Kreisen und ihren in Art. 6 genannten Ortsteilen ausgelegt; heutige ALKIS-Gemarkungen werden als Näherung für ehemalige Gemeinden verwendet.
- Sonderfall **Wilflingen** aus dem ehemaligen Landkreis Hechingen ist gemäß Gesetz Wahlkreis 62 Tuttlingen; Wahlkreis 37 ist **Bruchsal**.

## Vergleich und Prüfung

- 70 Features mit eindeutigen Nummern 1–70, geometrisch gültig.
- Die aus den VG-Hist-Kreisgrenzen von 1960 rekonstruierte Polygonzuordnung ist bei unserer feinräumigen Erfassungsmethode **für alle 70 Wahlkreise gleich der von 1964**.
- Darum wurden die absoluten Koordinaten der 1964er TopoJSON übernommen; TopoJSON-Arcs und Polygonbögen sind bytegleich, nur die Eigenschaften/Wahljahre unterscheiden sich.
- Keine Quantisierung, Rundung oder Vereinfachung bei der TopoJSON-Erzeugung; 2.777 wiederverwendbare Arcs.

**Achtung:** Die Karte ist eine historisch recherchierte **Rekonstruktion**, keine originale amtliche digitale Vermessung von 1960. Die exakte Gleichheit der erzeugten Koordinaten beweist nicht, dass es in der Wirklichkeit keine lokalen Grenzänderungen gab. Besonders die kleinräumigen innerstädtischen Grenzen sind aus späteren Daten angenähert.

## Quellen und Lizenz

- Statistisches Landesamt Baden-Württemberg: *Die Wahl zum Landtag von Baden-Württemberg am 15. Mai 1960*, Band 71, 1960: https://d-nb.info/1278245642/34
- Gesetz über die Landtagswahlen vom 9. Mai 1955, GBl. Baden-Württemberg S. 71.
- Historische Kreisgrenzen: BKG **VG-Hist**, © BKG 2026, CC BY 4.0, Daten verändert: https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-historisch-vg-hist.html
- ALKIS-Gemarkungen 2026: LGL Baden-Württemberg, Datenlizenz Deutschland – Namensnennung 2.0, Daten verändert.
