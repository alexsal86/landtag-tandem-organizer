# Wahlkreise zur Wahl der Verfassunggebenden Landesversammlung am 9. März 1952

## Enthaltene Dateien

- `LTWahlkreise1952-BW_konsistent.topojson`: **74 Wahlkreise**, ohne Quantisierung, Koordinatenrundung oder Vereinfachung der gelieferten GeoJSON.
- `LTWahlkreise1952-BW_konsistent.geojson`: gleiche Geometrien, geographische Koordinaten in WGS84.
- `LTWahlkreise1952-BW_Historische_Wahlkreisnamen.csv`: alle 74 Namen, die ursprünglichen *regionalen* Nummern und die Zahl der Wahlberechtigten von 1952.
- `work_1952_geometrie_audit.json`: dokumentierte Umgruppierungen sowie verbliebene Zuordnungsunsicherheiten.
- `reconstruct_wahlkreise_1952.py`, `finalize_wahlkreise_1952.py`, `validate_wahlkreise_1952.py`, `geojson_to_lossless_topojson.py`: Rekonstruktion und Kontrollen.

## Historische Nummerierung – besonders wichtig

Im Jahr 1952 fand **noch keine reguläre Landtagswahl auf der Grundlage des Wahlgesetzes von 1955** statt. Die Wahl zur Verfassunggebenden Landesversammlung fand in den drei Vorgängerländern statt. Die amtliche Ergebnistabelle nummeriert:

- `NW`: Nordwürttemberg **1–28**;
- `NB`: Nordbaden **29–45**;
- `SB`: Südbaden **1–16**;
- `SWH`: Südwürttemberg-Hohenzollern **1–13**.

Deshalb sind die in `Nummer`/`Nummer_technisch_1952` enthaltenen Zahlen **1–74 nur eindeutige technische Schlüssel** für die landesweite Karte. Die amtliche regionale Nummer steht in `Nummer_historisch`, der historische Landesteil in `Region`. **1952 technisch 37 = Heidelberg-Land**, anders als **1956 Nummer 37 = Bruchsal**. Bei der Dateneinbindung niemals Wahlkreisnummern zwischen diesen Jahren ohne diese Übersetzung als gleich behandeln.

## Geometrie und Stand

1. Die 1952er Wahlkreise und die historisch zugeordneten Gemeinden sind den zeitgenössischen Bekanntmachungen entnommen. Die 1952er Landkreise wurden aus **BKG VG-Hist am 9. März 1952** extrahiert; für die vier Vorgängerstaat-Regionen wurden die BKG-Codes `QWN`, `QBD` und `QWH` benutzt.
2. Als gemeinsame aufgelöste Landschafts-/Außengrenze dient die bereits bestehende **1956er Rekonstruktion**. Gesetzliche Gemeinde-Umbuchungen wurden mit Gemarkungsgrenzen des LGL Baden-Württemberg (Stand 2026) nachvollzogen. Damit sind die **49 geometrisch unberührten Wahlkreise zu 1956 koordinatengleich**, auch hinsichtlich der Reihenfolge der Polygonkoordinaten und des Polygon- bzw. Multipolygon-Typs.
3. Für Südbaden betreffen die Änderungen u.a. Meßkirch/Stockach, Engen/Konstanz, Wolfach/Lahr, Säckingen/Lörrach, Müllheim/Lörrach und Achern/Bühl. In Südwürttemberg wurden Urach, Schwenningen, Bad Schussenried, Aulendorf/Wilhelmsdorf und Teile Tettnangs historisch neu zugeordnet.
4. Alle **74 Geometrien gültig**, in der gemeinsamen UTM-Basis 35.721,67 km² Gesamtfläche und ungefähr 11 m² Überlappung (numerische Kantenartefakte). Die WGS84-Enddatei unterscheidet sich in ihrer gemeinsamen Außenkontur von der 1956er Enddatei um ungefähr 186 m² – weit unterhalb der Genauigkeit der historischen Rekonstruktion.
5. Die TopoJSON wurde gegen die WGS84-GeoJSON geprüft: Jede Bogen-Kante hat **exakt dieselben Koordinatenwerte** wie die Quell-GeoJSON (keine Quantisierung, keine Vereinfachung). `validate_wahlkreise_1952.py` führte diesen Test erfolgreich für alle 74 Objekte durch.

## Unvermeidliche Grenzen der Rekonstruktion

**Diese Version ist keine amtlich vermessene Wahlkreiskarte von 1952.** Moderne Gemarkungen können ältere Kleingemeinde- und Ortsteilgrenzen nicht immer genau reproduzieren. Konkret sind noch folgende Details zu beachten:

- Der **Freiburger Stadtteil-Zuschnitt** zwischen den 1952er SB-Wahlkreisen 7 und 8 basiert auf einer offen dokumentierten westlichen Näherungsmaske. Die Originalbekanntmachung nennt *Freiburg-West, Alt-Betzenhausen, Freiburg-West-Siedlung, Haslach, St. Georgen*; für diese damaligen Stadtteile standen hier keine exakten 1952er Polygone zur Verfügung.
- Die damalige Gemeinde **Hartheim** aus dem 1952er Landkreis Stockach konnte nicht zuverlässig mit der heutigen Gemarkung *Hartheim* (bei Meßstetten, laut BKG im Landkreis Sigmaringen) gleichgesetzt werden.
- Die damals genannte Gemeinde **Duchtlingen** lässt sich in den verfügbaren aktuellen Gemarkungspolygonen nicht eigenständig abgrenzen.
- Bei weiteren ehemals selbständigen Gemeinden können heutige Gemarkungslinien geringfügig von 1952 abweichen; eine exakte amtliche 1952er Grenze ist damit nicht bewiesen.

Für eine rechtlich genaue Grenzprüfung oder kleinräumige Flächenanalyse müssen die betroffenen Gemeinden/Stadtteile anhand historischer 1952er Vermessungskarten oder Gemarkungsgrenzen nachgezogen werden.

## Quellen und Lizenzen

- Statistisches Landesamt Baden-Württemberg, *Die Wahl zur Verfassunggebenden Landesversammlung am 9. März 1952*, Statistik von Baden-Württemberg, Band 8, Wahlkreisergebnisse: https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023462/008_2612_52001.pdf
- Landesministerielle Wahlkreisbekanntmachungen 1952, transkribiert unter "Durch Bekanntmachungen der Innenministerien der Länder" im historischen Wahlgesetzvergleich: https://www.verfassungen.de/bw/landtagswahlgesetze-vergleiche.htm
- Verordnung des gemeinsamen Ministerrats vom 7. Januar 1952: https://www.verfassungen.de/bw/wahlverordnung-landesversammlung52.htm
- BKG: VG-Hist, 1952er Kreisgeometrien; © BKG 2026, **CC BY 4.0**, Daten bearbeitet: https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-historisch-vg-hist.html
- LGL Baden-Württemberg: ALKIS-Gemarkungen (2026), **Datenlizenz Deutschland – Namensnennung 2.0**, Daten bearbeitet.
