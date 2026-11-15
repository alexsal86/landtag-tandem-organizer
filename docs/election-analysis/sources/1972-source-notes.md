# Baden-Württemberg: Landtagswahlkreise für die Wahl 1972

## Dateien

- `LTWahlkreise1972-BW_konsistent.topojson` – die rekonstruierte Wahlkreiskarte,
  70 Wahlkreise, ohne Quantisierung oder Vereinfachung.
- `LTWahlkreise1972-BW_konsistent.geojson` – geometrisch dieselben Wahlkreise
  zur unabhängigen Kontrolle in GIS-Programmen.
- `LTWahlkreise1972-BW_Historische_Wahlkreisnamen.csv` – amtliche Nummern
  1 bis 70 mit historischen Wahlkreisnamen.
- `work_1972_geometrie_audit.json` – Kennzahlen und dokumentierte Näherungen.
- `work_1972_zuordnungen_audit.csv` – Zuordnung der heutigen Gemarkungen zu
  historischen Kreisen und Wahlkreisen.
- `reconstruct_wahlkreise_1972.py`, `work_1972_zuordnungen.py`,
  `geojson_to_lossless_topojson.py` – Reproduktionscode (abhängig von den
  zugrunde liegenden, im Chat bereitgestellten Geodaten).

## Historische Zuordnung

Für die Landtagswahl vom **23. April 1972** galten **70 Wahlkreise** und
ausdrücklich der **Gebietsstand vom 1. Oktober 1971**. Maßgeblich ist Artikel
50a des damaligen Landtagswahlgesetzes. Das amtliche Statistische Landesamt
nennt diesen Stichtag für die Wahlkreisstatistik ausdrücklich.

**Nicht mit den Karten 1976–1988 verwechseln:**

- 1972 **Nr. 37: Bruchsal** (damaliger Landkreis Bruchsal).
- 1972 **Nr. 31–33: Mannheim-Stadt I/II/III**.
- 1976–1988 **Nr. 35–37: Mannheim I/II/III**.
- 1992 ff. Nr. 37: Wiesloch.
- 1972 gab es noch **fünf Stuttgarter Wahlkreise** (Nr. 1–5).

## Quellen und geometrische Methode

1. **Rechtsquelle:** Statistisches Landesamt Baden-Württemberg,
   *Die Wahl zum Landtag von Baden-Württemberg am 23. April 1972*,
   Statistik von Baden-Württemberg, Band 185, Heft 4, Anhang S. 139–142,
   Wahlkreisgebiete nach Art. 6 des Landtagswahlgesetzes.
   https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWHeft_derivate_00023809/185_04_2882_72001.pdf
2. **Historische Kreisgeometrien:** Bundesamt für Kartographie und Geodäsie,
   *Verwaltungsgebiete Historisch (VG-Hist)*, **Stichtag 01.10.1971**,
   aus dem vom Benutzer bereitgestellten GeoPackage; 72 damalige Stadt- und
   Landkreise in Baden-Württemberg.
   https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-historisch-vg-hist.html
3. **Feinräumige Aufteilung:** LGL-BW ALKIS-Verwaltungsgrenzen Januar 2026,
   insbesondere 3.380 Gemarkungspolygone. Gemarkungen dienen als Näherung an
   ehemalige selbstständige Gemeinden.
4. **Geteilte Stadtkreise:** aktuelle Stuttgarter Stadtbezirke und Mannheimer
   Stadtteile; für Karlsruhes Stadtkreis ein Abgleich mit der 1988er
   Wahlkreis-Zweiteilung. Diese Einteilungen sind keine Originale von 1972.
5. **Geometrie:** Zwischenstücke von Gemarkungen, die nach den BKG-Flächen
   wesentlich zwei alte Kreise schneiden, wurden getrennt zugeordnet;
   ansonsten erfolgte eine Gemarkungszuordnung nach größter Schnittfläche.
   Zusammenfassung durch topologische Polygonvereinigung, danach Übertragung
   nach EPSG:4326 und Korrektur winziger ungültiger Ringkreuzungen, die beim
   Koordinatenwechsel entstanden.

## Technische Prüfergebnisse

- **70** Features mit allen eindeutigen Wahlkreisnummern 1–70.
- **70/70** geometrisch gültige Wahlkreisfeatures.
- **70/70** TopoJSON→GeoJSON-Rückkonvertierungen sind topologisch **exakt
  identisch** zur ausgegebenen GeoJSON; keine geometrische Vereinfachung,
  keine quantisierte `transform`-Koordinate.
- **2.740** TopoJSON-Bögen, an exakt gleichen Kanten geteilt.
- **35.721,668 km²** vereinigte Gebietskulisse im rekonstruierenden UTM-GIS.
- Kleine bereits in der Geodatenverschneidung vorhandene rechnerische
  Polygonschnitt-Überlappung **374 m²** über das Gesamtland (rund 0,000001 %
  der Kartenfläche); für großräumige Karten visuell vernachlässigbar.

## Wichtige fachliche Einschränkungen

**Diese Datei ist eine recherchierte historische Rekonstruktion, keine amtlich
vermessene Originalkarte von 1972.** Besonders die innerstädtischen Grenzen,
der Übergang von modernen zu ehemaligen Gemeinden und ältere Flurstücks- bzw.
Kreisgrenzänderungen können von den echten damaligen Wahlkreisgrenzen
abweichen. Bei Karlsruhe betrifft das beispielsweise die heute zusammengefasste
Gemarkung Durlach/Grötzingen und die Innenstadt-Zweiteilung; bei Mannheim und
Stuttgart beruhen die Stadtteilgrenzen auf aktueller Geometrie.

Ein besonderer historischer Fall ist **Wilflingen**: Der Ort wurde 1969 vom
Landkreis Hechingen in den Landkreis Rottweil eingegliedert, blieb für die
Wahlkreiseinteilung laut Art. 6 beim Wahlkreis 62 (Tuttlingen). Diese
abweichende Zuordnung wurde berücksichtigt.

Die geometrischen Ausmaße sind nicht exakt an den 1988er Außenumring
geschnappt. Die 1972er Polygone stammen vorwiegend aus den modernen
ALKIS-Gemarkungen, die 1988er Karte aus einer anderen bereits vorhandenen
Gebietskulisse. Kleine geometrische Außenrandabweichungen bei Kartenüberlagerung
beweisen daher **keine** Wahlkreisänderung.

## Lizenz- und Quellenvermerk

Historische Kreisgrenzen: © **BKG (2026)**, **CC BY 4.0**,
Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg-hist.pdf
(Daten verändert und mit weiteren Daten kombiniert).

Gemarkungen: © **Landesamt für Geoinformation und Landentwicklung
Baden-Württemberg (2026)**, Datenlizenz Deutschland – Namensnennung 2.0
(Daten verändert und mit weiteren Daten kombiniert).
