# Gebietsergebnisse der Landtagswahl Baden-Württemberg 2026

Quelle sind die bereitgestellten Dateien `ltw26-ergebnisse (2).csv` und
`Hinweise-Datensatzbeschreibung.pdf`. Jede JSON-Datei enthält die Gebiete
des entsprechenden Wahlkreises. Die Arrays `first` und `second` enthalten
jeweils die gültigen Stimmen insgesamt, gefolgt von GRÜNE, CDU, SPD, FDP und
AfD (D1–D5 beziehungsweise F1–F5). Anteile verwenden die gültigen Stimmen
aller Wahlvorschläge. `null` kennzeichnet ein Gebiet ohne eigenes Ergebnis.

Gemeindeergebnisse sind direkt aus den Zeilen der Gebietsart GEMEINDE
übernommen. Die Verknüpfung erfolgt über Wahlkreisnummer und Gebietsnummer
beziehungsweise den achtstelligen AGS der Geometrie. Freiburgs zwei
Gemeindeanteile behalten ihre zehnstelligen Schlüssel. Gemeinden ohne
eigene Briefwahlzeile mit gültigen Stimmen werden gekennzeichnet.
Gemeindeübergreifende Briefwahlstimmen wurden nicht auf Gemeinden verteilt.

Für Stuttgart, Karlsruhe und Mannheim wurden die Urnen- und
Briefwahlbezirke innerhalb ihres jeweiligen Wahlkreises zusammengefasst.
Stuttgart verwendet die dreistellige Bezirkskennung aus den [amtlichen
Wahlraumverzeichnissen](https://www.stuttgart.de/service/wahlen/wahldaten/wahldaten).
Karlsruhe verwendet bei der Urnenwahl den Stadtteilschlüssel am Anfang der
Bezirksnummer und bei der Briefwahl den ausdrücklich genannten Stadtteil,
entsprechend dem [Ergebnisbericht der Stadt Karlsruhe](https://www.karlsruhe.de/fileadmin/user_upload/01_Stadt_Rathaus/013_Verwaltung_und_Stadtpolitik/Wahlen/LTW_2026_Ergebnisbericht_26-0232.pdf).
Mannheim verwendet die ersten beiden Ziffern der Bezirksnummer; beide
Stimmenarten wurden für alle 17 Stadtbezirke mit der [Gemeindestatistik
nach Stadtbezirk](https://www.mannheim.de/sites/default/files/2026-05/LTW%202026%20-Stadtbezirke.pdf)
abgeglichen. Die Wahlkreiszuordnung folgt der Landes-CSV und der
[amtlichen Wahlkreiseinteilung der Stadt Mannheim](https://www.mannheim.de/de/stadt-gestalten/politik/wahlen-und-abstimmungen/landtagswahl/wahlsystem-sitzverteilung).

Die Summen der Stadtgebiete wurden je Wahlkreis und Stimmenart mit den
Wahlkreiszeilen der Landes-CSV abgeglichen. Die Stuttgarter Stadtbezirke Ost
und Mühlhausen haben je einen Datensatz pro zugehörigem Wahlkreis.
Gebiete ohne hinterlegte Kartenfläche sind in der Seitenleiste auswählbar.

`winners` enthält je Stimmenart den eindeutigen Spitzenreiter, sofern er
zu den fünf angezeigten Parteien gehört. Der Rang wurde vor dem Filtern
der Landes-CSV bestimmt. Bei Gleichstand oder einer anderen stärksten
Partei bleibt die Kartenfläche grau.

`areas-v2` enthält die verlustfrei komprimierten TopoJSON-Flächen je Wahlkreis. Die
Flächen aus den Gemeinde-, Stuttgarter und Karlsruher TopoJSON wurden an
der hinterlegten Wahlkreisgeometrie 2021/2026 zugeschnitten und über
denselben Gebietsschlüssel den Ergebnissen zugeordnet. Jede Fläche enthält
einen Beschriftungspunkt im größten zusammenhängenden Teil.

Die Binärdateien enthalten den TopoJSON-Kopf einschließlich aller
Eigenschaften sowie die Koordinaten in getrennten Zahlenspalten. Werte,
die bereits exakt auf dem Raster der ursprünglichen Gemeindedatei liegen,
werden als Rasterdifferenzen gespeichert. Alle anderen Werte bleiben
Float64. Beim Packen wird der vollständige rekonstruierte Datensatz mit
dem ungerundeten Eingang verglichen. Das Format ändert weder Koordinaten
noch Punktzahl, Topologie, Gebietsschlüssel oder Beschriftungspunkte.

Zum Umwandeln der absoluten TopoJSON-Dateien (`<Wahlkreis>.topojson.gz`)
steht `scripts/geometry/pack-local-result-areas.mjs` zur Verfügung.
Der Kartenclient lädt je Auswahl nur die zugehörige Ergebnis- und
Flächendatei. Die separate Grenzlinien-Datei dient als Rückfall bei
einem Ladefehler.
