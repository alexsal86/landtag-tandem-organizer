# Wahlanalyse unter Daten

`/daten?dataTool=wahlanalyse` öffnet die zentrale Wahlanalyse. Unter
`dataTool=rechner` bleiben Sitzrechner, Kandidatenpflege und die bisherigen
Werkzeuge erreichbar. Die neue Analyse verändert weder Mandate, Personen noch
Legislaturperioden; sie verwendet einen eigenen Datenbestand.

## Einrichtung

1. `20261114130000_election_analysis.sql` erstellt sechs unabhängige Tabellen,
   Zugriffsschutz und Auswahlindizes.
2. `20261114131000_election_analysis_data.sql` übernimmt die zusätzlichen
   Analyseblätter der bereitgestellten Arbeitsmappe: 5 Wahlen, 30 Landesergebnisse,
   2.100 Parteiergebnisse auf Wahlkreisebene, 420 Beteiligungszeilen,
   133 Wanderungsbeziehungen und 399 demografische Anteile.

Der Generator `scripts/import-election-analysis.py workbook.xlsx output.sql`
benötigt openpyxl. Er liest ausschließlich die Ergebnis-, Beteiligungs-, Wanderungs-
und Demografieblätter. Er liest/importiert keine Abgeordneten oder Periodentermine.
Quellenlinks und Datei-/Zeilenherkunft werden nicht gespeichert; fachliche Hinweise,
Vorläufigkeit und Vergleichseinschränkungen bleiben erhalten. Stabile fachliche
Primärschlüssel und `ON CONFLICT DO NOTHING` verhindern, dass eine erneute Übernahme
Daten dupliziert oder bereits korrigierte Analysewerte überschreibt. Ungültige oder
doppelte Schlüssel brechen die Generierung ab.

Die Analysedaten sind zentral und für angemeldete Nutzer aller Tenants lesbar,
soweit das Wahljahr veröffentlicht ist. Nur `is_superadmin` erlaubt Schreibzugriffe.
Es gibt keinen anonymen Zugriff. Veröffentlicht sind die fünf importierten Wahlen;
Vorläufigkeit einzelner Ergebnisse ist ein fachlicher Datenstatus und wird dadurch
nicht zu einem endgültigen Ergebnis umgedeutet.

## Auswertungen

- Landesergebnisse: Parteianteile, absolute Stimmen und Sitze für fünf ausgewählte
  Parteien. Optional wird genau eine Vergleichswahl zusätzlich geladen. Änderungen
  sind Prozentpunkte; es erfolgt keine Sitzberechnung aus den importierten Anteilen.
  Sitze 2026 stehen nur in der maßgeblichen Zweitstimmenzeile.
- Wahlkreisvergleich: eine Partei, Wahl und Stimmenart, Rangliste und zehn stärkste
  Wahlkreise. Die beiden Tabellenblätter mit Prozenten und absoluten Stimmen werden
  je Jahr/Stimmenart/Wahlkreis verknüpft. Diese Resultate werden keinem Mandat oder
  keiner Person zugeschrieben.
- Beteiligung: 70 Wahlkreise, nach Wahl und genau einer Stimmenart. Landesweite
  Kennzahlen werden nur bei vollständigen 70 Wahlkreisen aus absoluten Zahlen
  berechnet, nie als ungewichteter Durchschnitt von Prozenten. Erst- und
  Zweitstimmenzeilen werden nicht zusammenaddiert.
- Wählerwanderung: eine Zielpartei und Wahl, Landesebene, mit Zustrom/Abstrom/Saldo.
  Positive Salden bedeuten Zugewinne dieser Zielpartei. Es sind Modellschätzungen,
  teilweise gerundet und teilweise nur als Saldo vorhanden. Fehlende Bruttoströme
  werden nicht aus dem Saldo erfunden. Beziehungen verschiedener Zielparteien
  werden nicht zu einer angeblichen Gesamtwanderung addiert.
- Alter/Geschlecht: repräsentative Statistik, drei Geschlechtsauswahlen, Altersgruppen,
  Parteienvergleich. 2026 ausschließlich Zweitstimmen und jüngste Gruppe 16–24;
  davor 18–24. „Insgesamt“ ist ein eigener vorhandener Wert, kein Mittelwert der
  Altersgruppen. Es werden keine absoluten Personenzahlen aus Anteilen abgeleitet.

2026 sind die Wahlkreiswerte vorläufig, die Landeswerte laut Arbeitsmappe endgültig.
Die Ansicht kennzeichnet dies und setzt deren Summen nicht automatisch gleich.
2006/Wahlkreis 59 enthält den Hinweis zur Berechnung auf dem Zuschnitt 2011.
Nur fünf Parteien sind enthalten; Summen werden nicht als vollständige Wahlresultate
oder vollständige Sitzverteilung ausgegeben. Leere Werte bleiben unbekannt. Die
Excel-Anteile (0–1) werden beim Import einmal auf Prozentwerte (0–100) umgerechnet.

## Datenmenge und Bedienung

Initial lädt nur der kleine Wahljahrindex. Erst der gewählte Reiter lädt seine Daten,
serverseitig gefiltert nach Jahr/Stimmenart und gegebenenfalls Partei oder Geschlecht.
Damit werden typischerweise 5, 70, 8–10 oder 35 Zeilen statt des gesamten Bestands
übertragen. Anfragen werden bei Wechsel abgebrochen, der Cache ist benutzer- und
filterbezogen (60 Sekunden Aktualität, 2 Minuten nach Verlassen). Die Importdaten
werden nicht in das Frontend-Bundle aufgenommen; Diagrammcode lädt erst im Tool.

Tabellen zeigen zuerst 25 Zeilen und lassen sich erweitern. Jede Auswertung bietet
CSV-Export der geladenen/gefilterten Daten mit fachlichen Statushinweisen. CSV nutzt
UTF-8-BOM, Semikolon und deutsche Dezimaltrennung; problematische Zeichen am Anfang
von Textzellen werden gegen Tabellenkalkulationsformeln abgesichert. URL-Parameter
für Wahl, Stimmenart, Reiter, Partei und Geschlecht bleiben beim Werkzeugwechsel
und Teilen des Links erhalten. Vergleichswahl und Tabellen-Altersgruppe sind lokale
Ansichtseinstellungen. Zahlen sind zusätzlich zu den Diagrammen als Tabelle zugänglich.

Typprüfung: `npm run typecheck:election-analysis`.

Wahlkreisvergleich und Wahlbeteiligung haben getrennte Spalten für Nummer und
Wahlkreisname. Die Spaltenköpfe mit Doppelpfeil sortieren per Klick auf-/absteigend;
der aktive Pfeil zeigt die Richtung. Zahlen werden nach ihrem Rohwert sortiert,
fehlende Angaben bleiben in beiden Richtungen unten. Die Sortierung umfasst alle
gefilterten Zeilen vor der Begrenzung auf zunächst 25 sichtbare Einträge und löst
keine zusätzlichen Datenbankabfragen aus.
