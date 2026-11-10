# Saisonale Büropakete, 10. November 2026

## Ergebnis

Fünf editierbare Vorlagen stehen in Administration → Regeln & Workflows → Jahresroutinen unter „Vorlagen fürs Bürojahr“ bereit. Übernehmen öffnet den vorhandenen Regel-Assistenten; erst Speichern richtet die Regel für das aktuelle Büro ein. Zuständigkeit, Start, Abschluss und Arbeitsschritte sind änderbar. Bereits mit derselben Vorlagen-ID eingerichtete Regeln werden zum Bearbeiten geöffnet. Bestehende individuelle Regeln oder ältere Varianten ohne Vorlagen-ID werden nicht automatisch überschrieben oder aktiviert.

| Vorlage | Vorgeschlagener Planungsbeginn | Vorgeschlagener Abschluss | Arbeitsschritte |
|---|---|---|---|
| Haushaltsberatungen | 1. September | 15. Oktober | Bedarfe sammeln, Prioritäten, Fraktionsabstimmung, Änderungsanträge, Freigabe |
| Weihnachtskarten | 15. September | 10. Dezember | Empfänger, Gestaltung, Druck, persönliche Texte, Unterschriften, Versand |
| Sommertour | 1. Februar | 31. Mai | Schwerpunkt, Besuchsorte, Termine, Kommunikation, Briefings, Programm |
| Jahresplanung fürs Folgejahr | 1. Oktober | 30. November | Ziele, Budget/Personal, Jahreskalender, Beschluss |
| Jahres-/Mandatsbericht | 1. November | 31. Januar im Folgejahr | Ergebnisse, Material, Entwurf, Freigabe, Veröffentlichung |

Dies sind editierbare Vorschläge, keine behaupteten parlamentarischen Termine. Für Haushaltsberatungen ist die jährliche Bestätigung standardmäßig erforderlich. Das Büro gleicht Start und Abschluss mit dem tatsächlichen Haushaltsfahrplan ab; ohne Bestätigung wartet die Ausführung. Änderungen an Start oder Abschluss heben die Bestätigung im Editor auf. Im nächsten Berliner Kalenderjahr ist sie erneut nötig. Weitere Vorlagen können ebenfalls auf jährliche Bestätigung umgestellt werden.

## Verarbeitung

- Die Vorlagen verwenden `run_annual_routine`, die bestehende Jahresverknüpfung und den bestehenden Stafetten-Prozessor. Es gibt keinen zweiten Executor.
- Start und Abschluss sind getrennt. Die Jahresübersicht gruppiert nach Planungsbeginn und bewertet „überfällig“ anhand des Abschlusses. Abschlüsse im Folgejahr werden mit Jahr angezeigt.
- Eine Ausführung erzeugt eine zugewiesene Hauptaufgabe und echte Teilaufgaben. Ohne explizite Person greift die bestehende Auswahl der Büroleitung beziehungsweise des Verantwortlichen.
- Schritte werden als „Tage vor Abschluss | Arbeitsschritt“ bearbeitet und chronologisch angelegt. Schrittfristen liegen frühestens am Planungsbeginn. Maximal 20 Schritte, jeweils höchstens 365 Tage Vorlauf und 500 Zeichen.
- Hauptaufgabe, Fristen, Teilaufgaben und Jahresverknüpfung entstehen in einer DB-Transaktion. Die vorhandene Jahresabschlusssperre verhindert doppelte Pakete. Bei Schreibfehlern wird das gesamte neue Paket zurückgerollt.
- Der Scheduler überspringt unbestätigte Jahrespläne vor dem Start eines Regellaufs. Die Datenbank prüft die Bestätigung zusätzlich auch bei manueller Ausführung.
- Neue Paket-Regeln werden nur gespeichert, wenn das Backend die Paketmigration kennt. Eine alte Datenbank soll nicht stillschweigend lediglich eine Hauptaufgabe ohne Arbeitsschritte erzeugen.
- Änderungen an einer Vorlage verändern bereits gestartete Aufgabenpakete nicht rückwirkend. Bestehende Personal-/Systemroutinen werden nicht umgebaut.
- Es werden Arbeitsaufträge für Freigabe, Versand und Veröffentlichung erzeugt; die Vorlage versendet oder veröffentlicht nichts selbst und erzwingt keine neue Freigabekette.
- Kalenderstarts werden wie bisher nicht rückwirkend nachgeholt. Ist der Beginn bereits vorbei, lässt sich das aktuelle Jahrespaket gezielt mit „Ausführen“ starten.

## Prüfung

- 90 gezielte Vorlagen-, Kalender-, Darstellungs-, Komponenten- und Selbsttests bestanden, einschließlich der Backend-Verfügbarkeitsprüfung.
- Vollständige lokale Datenbank-Testsuite bestanden. Neue Tests verwenden die tatsächlichen SQL-Funktionen und prüfen Jahreswechsel, zugewiesene Teilaufgaben, Reihenfolge, Fristbegrenzung, fehlende/veraltete Bestätigung, Wiederholungsschutz, Eingabevalidierung, Berechtigungen und vollständigen Rollback bei einem fehlgeschlagenen Teilaufgaben-Insert.
- Der tatsächliche Scheduler-Handler wurde mit Testdaten geprüft: Er startet nur das bestätigte Paket. Keine echten System- oder Personalaktionen.
- Browserprüfung bestanden: Vorlagenauswahl, vorhandener Regel-Assistent, Terminänderung mit aufgehobener Bestätigung, Speicherung sämtlicher Paketfelder sowie bisherige Desktop-/Mobil- und Hell-/Dunkelansicht. Keine JavaScript-Fehler; Backend-Aufrufe sind abgefangen.
- Produktionsbuild mit dem vorhandenen lokalen Tooling bestanden (Vite 5.4.21; der Paketstand fordert Vite 8). Lint ohne Fehler, vorhandene Warnungen in älteren Regel-Manager-Dateien. Selbsttest-Coverage und Sicherheitsmatrix aktuell.
- Der übergreifende Typecheck enthält bestehende Befunde; die neuen Paketdateien verursachen dort keine Diagnosen.

## Noch auszurollen

1. Migration `20261110140000_office_routine_packages.sql` auf der bereits vorhandenen Jahresroutinen-Anbindung anwenden.
2. `run-scheduled-automation-rules` samt gemeinsamer Hilfsdatei deployen.
3. Frontend ausrollen. Vorlagen im jeweiligen Büro übernehmen, Zuständigkeiten/Termine festlegen und bei der Haushaltsroutine die tatsächlichen Termine bestätigen.

In dieser Umgebung fehlen Supabase-Deployment-Zugangsdaten. Die Migration und Function wurden vorbereitet und lokal geprüft, aber nicht gegen die Produktivdatenbank ausgeführt. Es wurden keine produktiven Routinen angelegt oder automatisch gestartet.
