# Gemeindegrenzen zur Landtagswahl Baden-Württemberg 2026

Die Dateien `<Wahlkreisnummer>.topojson` stammen aus dem bereitgestellten
Archiv `landtagswahl_bw_2026_wahlkreise_topojson.zip`. Sie enthalten die
Wahlkreisform, Gemeindegeometrien und amtliche Gemeindeschlüssel mit
Wahlkreiszuordnung. Die amtliche Wahlkreiseinteilung hat den Stand 30. April
2025. Gemeindequelle laut Archiv ist der Datensatz `v_al_gemeinde.shp`.

Die Dateien `<Wahlkreisnummer>-boundaries.json` enthalten die auf der Karte
angezeigten Linien. Dafür wurden die von mindestens zwei Gemeindegeometrien
gemeinsam referenzierten TopoJSON-Arcs in WGS84 dekodiert und mit der
hinterlegten Wahlkreisform aus dem gemeinsamen Grenzstand 2021/2026
geschnitten. Heidelberg (34) hat nur eine Gemeinde und daher keine
Innengrenzen. Für Mannheim (35–36) und Freiburg (46–47) sind keine
Innengrenzen hinterlegt.

Für Stuttgart (1–4) und Karlsruhe (27–28) stammen die Linien aus
[`stadtbezirke.topojson`](../stuttgart/stadtbezirke.topojson) beziehungsweise
[`stadtteile.topojson`](../karlsruhe/stadtteile.topojson). Pro Wahlkreis
wurden nur Grenzlinien berücksichtigt, die zwei ihm ganz oder teilweise
zugeordnete Bezirke beziehungsweise Stadtteile gemeinsam haben. Die Linien
wurden ebenfalls an der hinterlegten Wahlkreisform zugeschnitten.
Geometriequellen sind Landeshauptstadt Stuttgart – Stadtmessungsamt
(CC BY 4.0) und Stadt Karlsruhe (CC0 1.0).

© Statistisches Landesamt Baden-Württemberg, Fellbach 2025. Wahlkreiskarte
für die Landtagswahl 2026 in Baden-Württemberg. Kartengrundlage: LGL
(www.lgl-bw.de), Stadt Freiburg, Stadt Karlsruhe, Stadt Mannheim,
Landeshauptstadt Stuttgart.

[Quelle der amtlichen Wahlkreiseinteilung](https://www.statistik-bw.de/service/karten-und-atlanten/wahlkreiskarten/)
