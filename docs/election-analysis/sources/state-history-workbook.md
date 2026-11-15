# Landesgeschichte und Wanderungsmatrix aus Arbeitsmappe

Umgesetzt am 15.11.2026 auf `main`. Eingangsdatei:
`Baden_Wuerttemberg_Landtagswahlen_1952_2026_mit_Primaerquellen.xlsx`.
SHA-256: `f5afc9d95e0b291d3656ff8f3327d71f0e5839be1380a168a6c3e8d1601933c9`.
Diese Prüfsumme bezeichnet ausschließlich die Excel-Datei. Die verlinkten
Originalquellen wurden für diese Ergänzung nicht unabhängig abgerufen/verifiziert.

## Umfang

- 18 Wahlen 1952–2026: Wahltag, Wahlberechtigte, Wählende, gültige und ungültige
  Stimmen. Nichtwählende, Beteiligung und Ungültigenquote werden aus den
  Grundzahlen berechnet. Die Ungültigenquote bezieht sich auf Wählende.
- 68 Landesergebnisse der bisherigen Fokusparteien CDU, SPD, FDP, GRÜNE und AfD:
  45 zusätzliche Ergebnisse aus den 13 Wahlen 1952–2001; 23 bereits vorhandene
  absolute Stimmenzahlen und Nenner stimmen mit dem ursprünglichen Seed überein.
  Anteile werden bei neuen Einträgen aus absoluten Stimmen berechnet.
- 102 Wanderungsbeziehungen für Fokus-Zielparteien aus den Blättern
  „Wanderung Brutto“ und „Wanderung 2026 Salden“: gegenüber dem ursprünglichen
  Seed 25 Ergänzungen, 76 Übereinstimmungen und ein Konflikt. Die 25 Ergänzungen
  betreffen 24 Beziehungen 2006 und eine Beziehung 2021.
- Vollständige gerichtete Matrix 2001 → 2006 mit 64 Zellen: einschließlich
  Parteibindung, Nichtwahl, Erstwählenden, Zu-/Fortgezogenen und Gestorbenen.
  Die ursprüngliche Sammelkategorie „Andere“ bleibt als Matrixkategorie erhalten.
- 252 Abgleichdatensätze mit Jahr, Bereich, Eingangszeile, Original-Quellenlink,
  Excel-Prüfsumme, Vergleichszeitpunkt sowie vorgeschlagenem und bisherigem Wert.

Nicht importiert: weitere historische Parteiergebnisse, „Linke“ als zusätzliche
Ergebnispartei, Restgruppen aus „Parteistimmen“, das Blatt „Weitere Parteien“,
synthetische Nullwerte, Sitze, Mandate, Personen, Grenzen und Wahlkreisergebnisse.
Bestehende zusätzliche Parteien etwa im verifizierten Landesergebnis 2026
bleiben erhalten. Historische Bezeichnungen werden nicht als bestätigte
organisatorische Parteiidentität oder Personenidentität interpretiert.

1952 war die Wahl zur Verfassunggebenden Landesversammlung. Bis 2021 gilt
Einzelstimme, ab 2026 wird in der Landes-Zeitreihe die Zweitstimme verwendet.
Gültige/ungültige Zweitstimmen dürfen nicht für Erststimmen verwendet werden.

## Offener Quellenkonflikt 2021

GRÜNE / Erstwählende-Verstorbene, Vorwahl 2016, Blatt „Wanderung Brutto“, Zeile 32:

| Kennzahl | Bisheriger Seed | Neue Arbeitsmappe |
| --- | ---: | ---: |
| Zustrom | 95.000 | 90.000 |
| Abstrom | 105.000 | 105.000 |
| Saldo | −10.000 | −15.000 |

Der bestehende Wert bleibt erhalten. Die Fundstelle in der Böll-Veröffentlichung
zum Infratest-dimap-Modell ist noch zu prüfen. Die Oberfläche zeigt die
Abweichung mit beiden Zahlensätzen; sie behauptet keine bereits erfolgte
inhaltliche Entscheidung. Quellenlinks aus der Arbeitsmappe werden unverändert
aufbewahrt, einschließlich einer gegebenenfalls zu korrigierenden URL-Kodierung.

Bei der Matrix 2006 steht CDU aus GRÜNEN mit **11.000** Personen in der
Arbeitsmappe, nicht 111.000 (Quellenangabe: Infratest dimap, Wahlreport 2006, S. 33).
Das ist ein dokumentierter Arbeitsmappenwert, keine unabhängige Originalprüfung.

## Import und Schutz bestehender Werte

Migration: `supabase/migrations/20261115140000_election_state_history.sql`.
Generator (benötigt Python/openpyxl):

```sh
python scripts/import-election-state-history.py workbook.xlsx output.sql
```

Die Migration erstellt `election_analysis_state_totals`,
`election_analysis_flow_matrix` und `election_analysis_workbook_audit`.
Schreibzugriff erhalten nur Superadmins; angemeldete Nutzer lesen Daten
veröffentlichter Analysejahre. Historische Jahre werden ausschließlich in der
Wahlanalyse ergänzt; `election_history_*` und bestehende Periodenverknüpfungen
bleiben unverändert.

Vor dem Einfügen werden tatsächliche Bestandszeilen unter Transaktionssperren
verglichen und dokumentiert. `ON CONFLICT DO NOTHING` erhält bestehende Werte,
auch manuelle Abweichungen, NULL-Werte und Quellenfreigaben. Der Vergleich von
Anteilen toleriert bis zu 0,051 Prozentpunkte für amtlich gerundete Angaben;
absolute Stimmen, Nenner und Wanderungswerte werden exakt verglichen.
„Übereinstimmung“ bedeutet Bestandsabgleich, nicht Originalquellenverifikation.
Der Bericht ist ein zeitgestempelter Import-Snapshot, kein dauerhaft aktueller
Monitor für spätere Änderungen.

`state-history-workbook-review.json` dokumentiert den vorab erstellten Vergleich
mit dem Repository-Seed. Der tatsächliche Live-Abgleich entsteht erst beim
Einspielen der Migration. Hier stand kein administrativer Datenbankzugang zur
Verfügung; die Migration wurde daher nicht auf der Live-Datenbank ausgeführt.

## Oberfläche und Prüfstand

Unter Daten → Wahlanalyse:

- **Landesgeschichte**: expliziter Wahljahresbereich, vier Diagrammansichten,
  genaue Bezugsgrößen und Parteiwerte, getrennte CSV-Exporte. Nur dieser
  ausgewählte Bereich wird geladen, maximal 40 Bezugsgrößen/200 Parteizeilen;
  keine zusätzlichen Wahlkreisdaten oder anderen Periodenregister.
- **Wahlbeteiligung**: Landesbezugsgrößen zusätzlich zu den bisherigen
  Wahlkreiswerten, je gewählter Stimmenart.
- **Wanderungsmatrix**: Originalrichtung und getrennte Herkunfts-/Zielgruppen,
  CSV, Modell- und Quellenhinweise. Die Jahresauswahl ist auf 2006 begrenzt.
- **Quellenabgleich**: ein ausgewähltes Jahr, Konfliktfilter, Quellenlinks und
  aufklappbare Eingangsdaten/Bestandswerte. Bestehende Landes- und
  Wanderungsansichten zeigen zusätzlich Quellenhinweise.

Die Wahlkreis- und Forschungsansichten bieten weiterhin nur die bisherigen
Analysejahre ab 2006 an. Fehlende Parteieinträge werden nicht mit Null ergänzt.

Auf Nutzerwunsch wurden **keine Tests ausgeführt**. Der neue Logikschritt im
Selbsttest-Center ist lediglich hinterlegt, nicht gestartet. Die
TypeScript-Kompilierungsprüfung `tsconfig.election-analysis.json` meldet dieselben
11 Fehler wie der unveränderte Ausgangsstand `106e94c9a` (im separaten Checkout
abgeglichen), keine neuen Fehler in den ergänzten Dateien. Die Fehler betreffen
vorhandene Typgrenzen in Mandats-, Szenario-, Qualitäts- und History-Funktionen.
