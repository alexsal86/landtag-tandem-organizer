# Quellenprüfung und offene Abgleiche, 14.11.2026

## Endgültige Ergebnisse 2026

Primärquelle: https://wahlen.statistik-bw.de/ltw26/

Wahlkreisseiten folgen dem amtlichen Muster
`https://wahlen.statistik-bw.de/ltw26/ergebnispraesentation_wahlkreis_1.html`
(1 bis 70). Die Präsentation bezeichnet den Stand als endgültig.
Gelesene Landesbezugsgrößen: 7.764.858 Wahlberechtigte, 5.406.737 Wählende,
5.359.187 gültige Erststimmen und 5.375.109 gültige Zweitstimmen.
Diese Angaben allein ersetzen keinen vollständigen Originaldateiabgleich.

Die Wahlübersicht der Bundeswahlleiterin nennt an einer Stelle 5.357.109 gültige
Zweitstimmen, abweichend von der Landespräsentation (5.375.109). Für den
Ergebnisimport ist die widerspruchsfrei mit allen Wahlkreisen abgeglichene
Landespräsentation maßgeblich. Die Bundeswahlleiterin wird hier nur als Quelle
für Wahltage verwendet, nicht als Ersatz für einen ungeprüften Ergebnisnenner.

**Noch kein Differenzbericht über alle 70 Wahlkreise:** Originalabrufe aus der
Ausführungsumgebung liefern weiterhin HTTP 403. Der vorbereitete Prozess erzeugt
`review.json` erst nach vollständigem Download und Zahlenabgleich. Vorläufigkeits-
kennzeichen und gespeicherte Werte wurden deshalb nicht pauschal geändert.

## Geometrien 2021 / 2026

Amtlicher Index:
https://www.statistik-bw.de/service/karten-und-atlanten/wahlkreiskarten/

Originale:
- https://www.statistik-bw.de/fileadmin/user_upload/medien/bilder/Karten_und_Geometrien_der_Wahlkreise/LTWahlkreise2021-BW_GEOJSON.zip
- https://www.statistik-bw.de/fileadmin/user_upload/medien/bilder/Karten_und_Geometrien_der_Wahlkreise/LTWahlkreise2026-BW_GEOJSON.zip

Amtlicher Hinweis auf unveränderte Grenzen:
https://www.statistik-bw.de/staat-und-gesellschaft/wahlen/detail/landtagswahl-am-8-maerz-2026-informationsangebot-des-statistischen-landesamtes-baden-wuerttemberg/

Dieser Textbeleg ersetzt nicht den verlangten Vergleich beider Originalgeometrien.
Gemeinsame Identitäten werden deshalb erst nach erfolgreichem GIS-Abgleich gesetzt.
Frühere Änderungen, insbesondere vor 2021, sind offen. Waldshut 2006 ist weiterhin
als rekonstruierter Wert auf dem Zuschnitt 2011 gekennzeichnet.

## Legislaturperioden

Amtliche Wahltagschronologie:
https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html

Die 18 regulären Wahltage sind als überprüfte Vorschläge hinterlegt. Die
Wiederholungswahl am 12.03.1961 begründet keine zusätzliche Legislaturperiode.
Keine konstituierende Sitzung wird ohne rechtliche Prüfung mit dem Beginn der
Wahlperiode oder einer individuellen Amtszeit gleichgesetzt.

Historisches Abgeordnetenangebot:
https://www.landtag-bw.de/de/der-landtag/abgeordnete/abgeordnete-1946-bis-heute

Die im Workbook als Periodenquelle genannte Datei
https://www.landtag-bw.de/resource/blob/618426/0fbd0f925d6293b2ad676a2761069f3f/17_0139_28012026.pdf
ist ein Plenarprotokoll vom 28.01.2026, keine vollständige Chronologie der
Periodenanfänge und -enden seit 1952. Diese Felder bleiben ohne separaten Beleg
unbestätigt. Bestehende manuelle Angaben werden nicht überschrieben.

## Ergänzung: vollständige Landes-Zweitstimmen und Sitzreferenz 2026

Amtliche Endfeststellung, Landeswahlausschuss 27.03.2026, gelesen 14.11.2026:
https://im.baden-wuerttemberg.de/de/land-kommunen/lebendige-demokratie/wahlen/landtagswahl-2026

Die Seite enthält alle 21 Landeslisten mit 5.375.109 gültigen Zweitstimmen und
die Sitzreferenz: GRÜNE 56 (13 direkt/43 Liste), CDU 56 (56/0), AfD 35 (1/34),
SPD 10 (0/10); zusammen 157 Sitze, 70 direkt und 87 über Listen.
Migration `20261114145000_verified_2026_state_parties.sql` ergänzt diese Werte
in der bestehenden Landestabelle. Sie füllt fehlende Werte und verifiziert nur
bereits numerisch übereinstimmende Einträge; abweichende manuelle Werte werden
nicht ersetzt. Die bisherigen fünf Fokusparteien bleiben in den bisherigen
Analyseansichten erhalten. Wahlkreis- und historische Mandatsdaten bleiben
unverändert. Die Vollständigkeit betrifft ausschließlich Landes-Zweitstimmen.

Die Webseite war über Recherche lesbar, nicht als Originaldatei aus dem Container
abrufbar. `sha256` ist deshalb ausdrücklich NULL, die Zeitangabe hat Tagespräzision.
Es wird kein Originaldatei-Hash erfunden und kein Wahlkreis-Endabgleich behauptet.

## Wahlrecht für den Simulator

Primärnorm §2 LWG, seit 30.04.2022 geltende Zweistimmenfassung:
https://www.landesrecht-bw.de/bsbw/document/jlr-NNLBW00008DB0NN00000000010/format/xsl

Amtliche Erläuterung des Landtags:
https://www.landtag-bw.de/de/der-landtag/parlament/das-baden-wuerttembergische-wahlsystem

Ergänzend amtliche Erläuterung des Innenministeriums (Stand 02.03.2026), auf der
kommunalen Service-BW-Seite:
https://www.ludwigsburg.de/-/lebenslagen/wahlergebnisse-sitzverteilung/leb5000630

Lesbare konsolidierte Normwiedergabe zum Abgleich der Sonderregeln:
https://www.anwalt24.de/gesetze/lwg-1/2

Relevant sind nicht nur Sainte-Laguë, sondern auch §2 Abs.2 Satz3
(Zweitstimmenbereinigung für Sonderdirektgewinner), Abs.3 (weniger zu verteilende
Grundsitze / Los), Abs.6 (Ausgleich, letzter Gleichstand: alle gleichen Höchstzahlen),
Abs.7 (Mehrheitsklausel) und Abs.8/9 (erschöpfte/nicht verteilbare Sitze).
Das Modell ist versioniert und ausschließlich für 2026 verwendbar. Tests und
amtlicher Referenzfall sind hinterlegt, aber Tests wurden auf ausdrücklichen
Nutzerwunsch nicht ausgeführt. Die im UI angebotene Referenzrechnung ist keine
Behauptung einer bestandenen Test- oder wissenschaftlichen Freigabe.
