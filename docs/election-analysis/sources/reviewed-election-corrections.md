# Gezielte Korrekturen nach dem Nutzer-Auszug zu Version 6

Der Nutzer hat am 17.11.2026 einen Auszug der Korrekturen aus dem anderen Chat
bereitgestellt. Die dort verlinkte Version 6 (`libfile_3473589412a081919542bb1483670ff4`)
ist hier nicht herunterladbar: Der Bibliothekslink liefert die Anmeldeseite, keinen
Dateianhang. Es liegt weiterhin ausschließlich die ursprünglich hochgeladene
Arbeitsmappe vor. Die vollständigen 127 Zelländerungen für 17 Wahlkreise 2006
werden deshalb **nicht** als bereits übernommen oder unabhängig geprüft behauptet.

## Tatsächlich verfügbare Korrekturen

Die fünf konkreten 2006-Beispiele sind im bisherigen Repository-Ergebnisbestand
bereits richtig. Der alte Excel-Importgenerator berichtigt diese fünf benannten
Zellen nun anhand der Nutzerbestätigung, bevor er die Importdaten erzeugt:

| Wahlkreis | Feld | Alte Excel-Datei | Richtig / bereits im Seed |
| --- | --- | ---: | ---: |
| Lahr | Beteiligung | 58,5 | 46,8 |
| Heidenheim | SPD | 39,4 | 33,7 |
| Heidenheim | Beteiligung | 62,6 | 53,8 |
| Konstanz | SPD | 32,4 | 21,3 |
| Konstanz | GRÜNE | 16,0 | 18,9 |

Das ursprüngliche Zellarchiv und sein SHA-256 bleiben unverändert. Die
Berichtigung steht explizit am erzeugten Importdatensatz und wird nicht als Inhalt
der unveränderten Originaldatei ausgegeben. Bei einem unerwarteten dritten Wert
bricht der Generator ab. Bereits richtige Zellen werden nicht verändert. Für die
übrigen 2006-Korrekturen wird weiterhin Version 6 benötigt. Auch der berichtete
Abgleich der 70 Wahlkreise auf 3.960.615 gültige Stimmen wurde hier nicht wiederholt.

## Zusätzlich direkt gelesene Originalquellen

Für die tatsächlichen Repository-Korrekturen wurden die folgenden Quellen über
den Webzugriff gelesen, unabhängig vom Chat-Auszug:

- [Statistischer Bericht 2016, Tabelle 1, gedruckte Seite 20](https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistische_Berichte/423216001.pdf): Tübingen und Balingen; ausschließlich die Originalspalten 2016, nicht die benachbarten Vergleichsspalten 2011.
- [Endgültige Ergebnispräsentation Sigmaringen 2026](https://wahlen.statistik-bw.de/ltw26/ergebnispraesentation_wahlkreis_70.html): Erst- und Zweitstimmen sowie Beteiligungsbezugszahlen.

Die extrahierten Zahlen und erwarteten Repository-Altstände stehen vollständig in
`reviewed-election-corrections.json`. Der dortige SHA-256 identifiziert die
normalisierten extrahierten Zahlen, **nicht** die PDF-/HTML-Originalbytes. Es wurde
kein vollständiger Originaldownload archiviert oder vorgetäuscht.

| Wahl | Wahlkreis | Wahlberechtigte | Wählende | Gültige Stimmen |
| --- | --- | ---: | ---: | ---: |
| 2016 | Tübingen | 134.421 | 100.803 | 100.156 |
| 2016 | Balingen | 114.805 | 77.834 | 77.131 |
| 2026 | Sigmaringen, Erststimme | 97.910 | 68.543 | 67.784 |
| 2026 | Sigmaringen, Zweitstimme | 97.910 | 68.543 | 67.976 |

Die absoluten Parteistimmen werden gemeinsam mit den Anteilen korrigiert, damit
keine Mischung aus alten Stimmenzahlen und neuen Prozentwerten entsteht. Beispiele:
Tübingen GRÜNE 37.712 / 100.156 = 37,65326 %; Balingen AfD 13.961 / 77.131 =
18,10037 %. Sigmaringen Beteiligung: 68.543 / 97.910 = 70,00613 %, angezeigt auf
eine Nachkommastelle 70,0 %. Der gerundete Auszug ist kein Grund, die präzise Quote
auf exakt 70,00000 % zu kürzen. Beide Stimmenarten behalten getrennte gültige Stimmen.

## Migration und Schutz bestehender Daten

`20261117130000_reviewed_district_corrections.sql` enthält 26 gezielte
Zeilenkorrekturen: 2016 jeweils sechs Parteien einschließlich REP und einen
Beteiligungsdatensatz für Tübingen/Balingen, 2026 jeweils fünf Fokusparteien und
einen Beteiligungsdatensatz pro Stimmenart für Sigmaringen. Sie aktualisiert
bestehende Zeilen ausdrücklich; es handelt sich nicht um einen additiven Import.

Vor jedem Update müssen die bisherigen Zahlen, Namen, Vorläufigkeit, Hinweise und
Datenstände dem versionierten erwarteten Altstand entsprechen. Abweichende manuelle
Werte werden geschützt und als Konflikt protokolliert. Bei einem fehlenden oder
abweichenden Altstand wird die gesamte Korrekturgruppe dieses Wahlkreises
zurückgestellt, damit Stimmen und Nenner nicht teilweise umgestellt werden. Fehlende Zeilen werden als
fehlend protokolliert und nicht aus einer unklaren Grundlage ergänzt. Bereits
aktualisierte Datensätze werden beim Wiederholen erkannt. Das neue
`election_analysis_correction_audit` erfasst alten und neuen Stand je Schlüssel;
nur Superadmins dürfen es lesen oder ändern. Die vorhandene automatische
Historienzusammenführung aktualisiert danach nur unverändert automatisch
übernommene persönliche Ergebnisse; manuelle Angaben bleiben geschützt.

Die geometrischen/historischen Zuordnungen bleiben unverändert. Es wird weder
2021 pauschal neu importiert noch die vollständige 2026-Wahl als geprüft markiert.
Die fehlende vollständige Zuordnung der 1952er Originalwahlkreise zu Analyseschlüsseln
bleibt unabhängig von der zuvor ergänzten, ausdrücklich auf Originalmandats-UUIDs
begrenzten persönlichen Ergebniszuordnung.

Reproduzierbar: `python scripts/import-reviewed-election-corrections.py` erzeugt
den Quellenbericht und die neue Korrekturmigration. Anschließend kann der
historische Excel-Generator wie bisher mit der Originaldatei laufen; er berücksichtigt
die fünf bestätigten 2006-Berichtigungen. Keine Tests ausgeführt. Die Migration
wurde in dieser Sitzung nicht auf einer Live-Datenbank eingespielt.
