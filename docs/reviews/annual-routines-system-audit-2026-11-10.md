# Systemstatus der Jahresroutinen, 10. November 2026

Geprüft: aktueller Main-Stand `ef5c79612`, die sieben ursprünglichen Jahresroutinen, alle weiteren Kalender-/Jahresvorlagen sowie die Aufrufer der Personal-, Urlaubs- und Statistikfunktionen. Reine Bestandsprüfung; keine Änderung oder Ausführung der Routinen.

## Reichweite und Kernergebnis

Quellcode und Konfiguration sind geprüft. Die Umgebung hat keine Supabase-Deployment-/DB-Zugangsdaten und keinen angemeldeten Datenbank-Connector. Deshalb sind die bürospezifischen gespeicherten Regeln, aktivierten Scheduler und tatsächlichen Ausführungsprotokolle nicht ausgelesen worden. „Vorhanden“, „automatisch vorgesehen“ und „tatsächlich erfolgreich gelaufen“ dürfen nicht gleichgesetzt werden. Die Browser-Screenshots aus der Designprüfung verwenden synthetische Daten und sind ausdrücklich kein Nachweis echter Erledigungen.

Die Automatik ist heute überwiegend der Ausführungsmechanismus derselben Jahresroutine. Sie ist kein belegter zweiter, unabhängiger Jahresabschluss, der die Routine überflüssig machen würde. Technische Jahreswechsel-Aufträge gehören in einen Systemverlauf mit Erfolgs-/Fehlerüberwachung; sie sind keine zusätzlich zu erledigende Büroarbeit. Die zugrunde liegende Verarbeitung darf nicht mit dem Entfernen ihrer Darstellung abgeschaltet werden.

## Was das System bereits selbst berechnet

Die Urlaubsanzeige berechnet den Jahresanspruch für das ausgewählte Jahr und zieht die genehmigten Urlaubsanträge dieses Jahres ab. Für eine frische Jahresanzeige muss kein Zähler manuell auf null gesetzt werden. Ein abgelaufener Übertrag wird bereits in der Berechnung ausgeschlossen. Das schreibt aber weder den verbleibenden Vorjahresurlaub als neuen Übertrag in die Datenbank noch automatisch einen Archivdatensatz.

Historische Anträge bleiben gespeichert. Zusätzlich existieren `employee_yearly_stats` und `vacation_history` mit unterschiedlichen Schreibpfaden. Eine jahresbezogene Anzeige oder vorhandene Historientabelle beweist deshalb keinen erfolgreich ausgeführten Jahresabschluss.

## Ursprünglicher Bestand: vollständiger Abgleich

| Routine | Technischer Befund | Empfehlung |
|---|---|---|
| Urlaubstage zurücksetzen, 1. Januar | `execute_reset_vacation_days` schreibt die Vorjahresstatistik einschließlich Krankheitstagen und berechnet den Übertrag. Die neue Jahresanzeige benötigt kein Zurücksetzen. Funktion zählt beim Übertrag derzeit Kalendertage, während die Anzeige Wochenenden ausnimmt. | Als technische Jahreswechsel-Verarbeitung erhalten, fachliche Berechnung vereinheitlichen; nicht als zusätzliche Büroaufgabe. Nur bei Fehlern eine Kontrollaufgabe. |
| Krankentage-Statistik archivieren, 15. Januar | `execute_archive_sick_days` aktualisiert nur vorhandene Vorjahreszeilen in `employee_yearly_stats`. Der Jahreswechsel schreibt Krankheitstage bereits mit. Ohne vorhandene Zeilen kann die Funktion mit null betroffenen Mitarbeitern Erfolg melden. | Eigenständige Pflicht-Routine redundant. Falls Nachmeldungen gebraucht werden: als gezielte Aktualisierung des Jahresabschlusses ausweisen. |
| Resturlaub verfällt, 31. März | `execute_expire_carry_over` setzt positive Überträge im Büro pauschal auf null. Daneben schließen Anzeige/Berechnung abgelaufene Überträge schon aus. Eine weitere Funktion `expire_carry_over_vacation` berücksichtigt ein gespeichertes Ablaufdatum und schreibt Historie; ein automatischer Aufrufer dieser Funktion ist im Repository nicht nachgewiesen. | Keine pauschale zusätzliche Nullsetzungsroutine. Einen gemeinsamen Ablauf mit individuellem Ablaufdatum, Ausnahmen und nachvollziehbarer Historie festlegen. |
| Jahresrückblick erstellen, 31. Januar | Kein automatischer inhaltlicher Jahresbericht. Bei Ausführung entsteht eine verknüpfte Büroaufgabe. | Sinnvoll; mit „Mandatsbericht vorbereiten“ zusammenführen, falls derselbe Bericht gemeint ist. |
| Halbjahresbilanz, 1. Juli | Keine automatische Bewertung der Ziele oder politischen Arbeit; erzeugt Büroaufgabe. | Sinnvoll. Mit vorhandenem Quartalsrückblick abstimmen, um dieselbe Auswertung nicht doppelt zu verlangen. |
| Urlaubsplanung nächstes Jahr, 1. November | Keine automatische personelle Abstimmung oder Vertretungsplanung. | Behalten als echte Planungsaufgabe mit Verantwortlichem und Ergebnis. |
| Jahresende-Statistiken, 15. Dezember | Der Standarddatensatz hat keine `execute_function`. Der Name/Kategorie „system“ bedeutet hier keine automatische Statistikberechnung; er erzeugt eine Büroaufgabe. `generate_current_year_stats` ist separat als Systemaktion verfügbar. | Als „Jahresabschluss prüfen/vorbereiten“ konkretisieren; am 15. Dezember nur vorläufig. Reines Erzeugen von Zahlen gehört in den technischen Jahresabschluss. |

### Ausführungspfade und belegte Grenzen

- Die ursprünglichen Definitionen setzen `auto_execute` standardmäßig auf false. Die Regelmigration übernimmt dies als `trigger_type='manual'`; nur zuvor automatische Routinen werden als Zeitplan migriert. `enabled=true` allein bedeutet daher nicht automatische Ausführung.
- Der neue Pfad ist `run-scheduled-automation-rules` → `run-automation-rule` → `execute_annual_automation_routine`. Er berücksichtigt aktive Zeitregeln und die Büropause. Ein gesperrter Jahresabschlussdatensatz verhindert wiederholte Verarbeitung derselben Routine im selben Jahr.
- Der alte Worker `execute-annual-tasks` liest nur automatische Routinen ohne Regelverknüpfung. Verknüpfte Routinen sollen also nicht zusätzlich über diesen Worker laufen. Ein Unique-Index begrenzt gleiche Systemfunktionen auf eine pro Büro. Inhaltliche Überschneidungen verschiedener Funktionen bleiben trotzdem möglich.
- Für den alten Worker ist ein täglicher Zeitplan in `supabase/config.toml` deklariert. Dies ist kein Laufnachweis. Aktive externe Scheduler/DB-Cronjobs wurden mangels Live-Zugriff nicht überprüft.
- Der neue Kalenderplan holt versäumte Ausführungstage nicht automatisch nach. Eine im Januar manuelle/deaktivierte Routine läuft durch Aktivierung im November nicht rückwirkend für Januar.
- `archive_employee_year_stats` ist eine weitere Archivfunktion. Im geprüften Repository ist außer Definition und Typen kein produktiver Aufruf nachgewiesen. Existenz der Funktion reicht als Beleg für automatische Archivierung nicht aus.
- Systemfunktionen zählen Krankheitstage aus `sick_days`; die aktuelle Zeiterfassungsansicht liest Krankmeldungen aus `leave_requests` mit Typ `sick`. Die Datenquelle ist vor einem verbindlichen Jahresabschluss abzugleichen.

## Weitere vorhandene Vorlagen

| Vorlage | Bereits automatisch inhaltlich erledigt? | Bewertung |
|---|---|---|
| Mandatsbericht vorbereiten, 31. Januar | Nein; erzeugt Arbeitsauftrag. | Mit Jahresrückblick bündeln oder klar unterschiedliches Ergebnis definieren. |
| Haushaltsanmeldungen vorbereiten, 15. September | Nein; erzeugt Arbeitsauftrag. | Sinnvoll, Termin anhand des tatsächlichen Haushaltsverfahrens festlegen. |
| Datenschutz-Verzeichnis prüfen, 1. März | Nein; erzeugt Arbeitsauftrag. | Sinnvoll; zusätzlich Rollen, ausgeschiedene Personen und Aufbewahrungsfristen prüfen. |
| Weihnachtskartenliste vorbereiten, 1. November | Nein; erzeugt Arbeitsauftrag. | Sinnvoll, wenn dieser Ablauf tatsächlich stattfindet. |
| Sommertour vorbereiten, 1. April | Nein; normale Kalenderregel erzeugt eine Aufgabe. | Sinnvoll, wenn eine Sommertour geplant ist. |
| Monatsabschluss im Büro, Monatsende | Nein; normale Kalenderregel erzeugt eine Aufgabe. | Sinnvoll für offene Zusagen, Fristen und Aufgaben; in bestehende Besprechung integrieren. |
| Quartalsrückblick, Quartalsende | Nein; normale Kalenderregel erzeugt eine Aufgabe. | Alternative/Ergänzung zur Halbjahresbilanz mit klar anderer Tiefe; keine doppelte Pflichtauswertung. |

Vorlagen sind nicht automatisch angelegte oder aktivierte Büroroutinen. Ob sie verwendet werden, ist im Bürobestand zu prüfen.

## Empfohlener schlanker Bestand

1. Jahres-/Mandatsbericht und Jahresplanung als zusammenhängenden Ablauf statt doppeltem Rückblick.
2. Halbjahres- **oder** Quartalsreview der Ziele, abhängig vom tatsächlichen Besprechungsrhythmus.
3. Urlaubs- und Vertretungsplanung fürs Folgejahr.
4. Haushalts-/Budgetanmeldungen mit echtem externem Termin und ausreichendem Vorlauf.
5. Datenschutz-, Zugriffs- und Aufbewahrungsprüfung.
6. Saisonale Planung nur nach Bedarf: Sommertour und Weihnachtskarten.
7. Kurzer monatlicher Büroabschluss für offene Zusagen und Fristen, sofern die bestehende Sitzung dies noch nicht abdeckt.

Jede Büro-Routine braucht eine zuständige Person, einen Planungsbeginn, einen getrennten Erledigungstermin und ein erwartetes Ergebnis. Eine automatische Personal-/Statistikverarbeitung braucht dagegen nachweisbare Ausführung und eine Fehlermeldung, nicht eine zusätzliche manuelle Erledigungscheckbox.

## Offener tatsächlicher Ausführungsstatus

Die beigefügte [read-only Bestandsabfrage](annual-routines-system-audit-2026-11-10.sql) zeigt nach Einsetzen der Büro-ID: Art der Routine, konfigurierten Modus, Büropause, Jahres-Erledigungsmarkierung, verknüpfte Aufgabe und letzten echten Regellauf des aktuellen Berliner Kalenderjahres. Sie führt keine Geschäftsaktion aus. Sie wurde hier nicht gegen die Produktivdatenbank ausgeführt. Manuelle Erledigungsmarkierungen und erfolgreiche Regelläufe sind anschließend mit den tatsächlich betroffenen Jahresdaten abzugleichen; externe/ältere direkte Funktionsaufrufe können ohne passendes Protokoll unbewiesen bleiben.

21 bestehende Tests zu Urlaubsberechnung, Jahresregeln und Jahresstichtagen bestanden. Diese Tests bestätigen die geprüften Codepfade, keine tatsächlichen produktiven Ausführungen.
