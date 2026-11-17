# Ergänzte Wahlkreisergebnisse 1952–2026

Quelle: `landtagswahlen_bw_1952_2026_alle_wahlkreise_ergaenzt.xlsx`.
Die vollständigen Zellwerte aller sieben Blätter sind mit Dateiname und SHA-256
in `district-history-workbook.json` archiviert. Verlinkte Originalquellen wurden
in diesem Auftrag nicht unabhängig geprüft. Quellenbehauptungen der Arbeitsmappe
sind keine Verifikation durch die Anwendung.

## Übernahme

`20261117100000_workbook_district_history.sql` übernimmt fehlende Parteianteile
(CDU, SPD, FDP/DVP → FDP, Grüne → GRÜNE, AfD und REP) und Beteiligungsquoten aus
**Wahlkreise gesamt 1952–2026** ab 1956. Die 70 Zeilen **2026 Erststimmen** liefern
getrennte Erststimmenanteile, Beteiligungsquoten und gültige Erststimmen.
Insgesamt enthält die Migration 6.561 potenzielle Ergebnis-/Beteiligungszeilen;
diese Zahl ist nicht die Zahl tatsächlich neu eingefügter Zeilen.

Bestehende Datensätze bleiben vollständig erhalten, einschließlich ihrer absoluten
Stimmen, Vorläufigkeit, Datenstände und Geometriehinweise. Auch präzisere oder als
endgültig bezeichnete neue Werte ersetzen sie nicht automatisch. Die Tabelle
`election_analysis_district_workbook_audit` protokolliert beim Einspielen je Zeile
`added`, `matched` oder `conflict` samt eingehenden und bestehenden Daten. Ein
Unterschied der Vorläufigkeit oder des Namens zählt ebenfalls als Konflikt.
Der Vergleich der gelieferten Prozentwerte verwendet nur 0,00001 Prozentpunkte
Toleranz. Rundungsabweichungen werden somit ebenfalls zur Prüfung sichtbar.
Das Audit ist für veröffentlichte Jahre lesbar und nur durch Superadmins schreibbar.

Fehlende Parteianteile bleiben fehlend. Absolute Parteistimmen werden nicht aus
Prozentwerten rekonstruiert. Beteiligungsquoten ohne Bezugszahlen erzeugen keine
erfundenen Wahlberechtigten/Wählenden. Vorläufige Zeilen (1956, Teile 1972/1992,
1980) behalten ihre Kennzeichnung. Unklare Ergebnisstände und Lücken stehen in
den Quellenhinweisen; `preliminary=false` ist keine Quellenverifikation.
Die Arbeitsmappe beansprucht nicht überall vollständige Parteiergebnisse.

Die 74 Originalwahlkreise von **1952** sind vollständig archiviert, werden aber
noch nicht mit Analyse- oder Geometrie-IDs verbunden: Im Blatt fehlen die regionalen
Originalnummern bzw. `geometry_source_key`. Namen allein erlauben diese Zuordnung
nicht. Die zurückgestellten Zeilen stehen in `district-history-workbook-review.json`.
Keine Personen, Kandidaturen, Mandate, Periodentermine oder bestätigten
jahrübergreifenden Geometrieidentitäten werden verändert.

## Was die übrigen Blätter bringen

| Blatt | Nutzen / Behandlung |
| --- | --- |
| Abgeordnete 1952–2026 | Quellen und Mandatsbeschreibungen zum Abgleich der vorhandenen Historie; keine erneute Namensverknüpfung oder Mandatsanlage. |
| Wahlkreisergebnisse | Zusätzliche absolute Wahlberechtigten-/Wählerzahlen für ältere Wahlen; vor Übernahme muss der jeweilige Zuschnitt geprüft werden. Insbesondere Stuttgart 1952–1972 ist auf spätere Grenzen umgerechnet. Alte Vergleichsreihen werden nicht als Originalwahlkreise importiert. |
| Landesergebnisse | Zusätzliche gerundete Vergleichswerte, REP und Sonstige; vorhandene Landesstimmen und Bezugsgrößen bleiben erhalten. Sonstige ist kein durchgehend überschneidungsfreier Parteischlüssel. |
| Abdeckung und Quellen | Jahrgangsweise Quellen, Abdeckung und Einschränkungen; vollständig archiviert, nützlich für weitere Quellenprüfung. |
| Wahlkreise 1964–1980 | Kontrollquelle mit Zuschnitt, Vorläufigkeit und NPD als Teilmenge von Sonstige; Haupttabelle liefert die zu übernehmenden Originalwahlkreise bereits. Kein Doppelimport. |
| Wahlkreise gesamt 1952–2026 | Maßgebliche Quelle für die additive historische Ergebnisübernahme; Mandatsspalten dienen nur als Quellenmaterial. |
| 2026 Erststimmen | Ergänzende getrennte Stimmenart; bestehende vorläufige Ergebnisse werden als Konflikte protokolliert, nicht still ersetzt. |

NPD ist ausdrücklich eine Teilmenge von Sonstige. Aggregierte Sonstige-Werte können
weitere einzeln ausgewiesene Parteien enthalten und werden nicht zusätzlich als
Partei übernommen. REP ist separat ausgewiesen und wird als eigene Partei ergänzt;
die bisherige Oberfläche kann weiterhin ihre Auswahl an Fokusparteien verwenden.

## Ausführung

Reproduzierbar im Repository-Stamm:

```sh
python scripts/import-election-district-history.py workbook.xlsx supabase/migrations/20261117100000_workbook_district_history.sql
```

Die Migration ist ein einzelner atomarer `DO`-Block und wiederholbar. Tabellenlocks
schützen den Abgleich gegen parallele Ergebnisänderungen. Bestehende historische
Verknüpfungstrigger bleiben aktiv; Geometrieidentitäten werden nicht abgeleitet.
Das Archiv und die Migrationsdatei sind versioniert. Es wurden auf ausdrücklichen
Wunsch keine Tests ausgeführt. Die Migration wurde hier nicht auf einer
Live-Datenbank ausgeführt; erst beim Einspielen steht der tatsächliche Umfang der
Ergänzungen und Konflikte fest.
