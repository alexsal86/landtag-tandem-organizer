# Gültigkeit und erneute Freigabe von Wissensantworten

Antworten erhalten spätestens zwölf Kalendermonate nach ihrer ersten Speicherung beziehungsweise nach einer Freigabe einen neuen Prüftermin. Ein früherer Termin ist möglich. Berechnet wird mit Berliner Kalenderdaten, einschließlich Schaltjahren und Zeitumstellungen. Bearbeiten der Antwort, Quellen oder Anhänge verlängert eine bestehende Gültigkeitsfrist nicht. Beim Freigeben prüft die Datenbank die Obergrenze; nur die aktuell zugeordnete, aktive Person darf freigeben. Ihre Mitgliedschaft genügt dafür; die allgemeine Prüfberechtigung allein erlaubt keine Freigabe fremder Zuständigkeiten mehr. Personen mit Prüfberechtigung können weiterhin eine Überprüfung anfordern.

Zum Fristablauf zeigt die Oberfläche über die bestehenden serverzeitbasierten Statusberechnungen unmittelbar „Überprüfung erforderlich“. Der vorhandene pg_cron-Job verarbeitet alle 15 Minuten bis zu 500 fällige Antworten, setzt den gespeicherten Prüfstatus und erzeugt eine zugeordnete Büroaufgabe mit Link zur Wissensantwort. Pro Frage gibt es höchstens eine aktive Prüfaufgabe. Nach einer erneuten Freigabe wird diese automatisch erledigt; im nächsten Prüfzyklus wird dieselbe Aufgabe wieder geöffnet. Beim Wechsel der Zuständigkeit wird die Aufgabe übertragen. Erledigen der Aufgabe allein verlängert die Antwort nicht; bei weiterhin abgelaufener Antwort öffnet der Scheduler die Aufgabe erneut. Archivieren der Frage erledigt die offene Aufgabe ebenfalls.

Neue Antworten ohne Zuständigkeit werden der antwortenden Person zugeordnet. Bestehende unzugeordnete Antworten erhalten nach Möglichkeit die aktive antwortende Person, ersatzweise den aktiven Fragesteller als Zuständigen. Fehlt eine aktive Person, bleibt die Prüfaufgabe als nicht zugeordnete Büroaufgabe erhalten; zur Freigabe muss zuerst eine aktive Zuständigkeit ausgewählt werden.

## Migration

`20261112090000_knowledge_validity_and_review_tasks.sql` vollständig nach den vorherigen Wissensmigrationen ausführen. Sie begrenzt vorhandene Fristen, setzt fehlende Fristen anhand der letzten Freigabe oder der ersten Antwort und verarbeitet bereits abgelaufene Antworten. Auch wiederhergestellte Antworten erhalten eine begrenzte Frist. Voraussetzung ist das bereits für Aufgaben-Erinnerungen verwendete pg_cron. Die bestehenden Frage-, Aufgaben- und Benachrichtigungstabellen werden verwendet; es entstehen keine neuen Tabellen.

Die Migration ändert keine alten Migrationsdateien. Bestehende Audit-Snapshots bleiben erhalten. Automatische Fristabläufe erhalten den Ereignistyp `review_expired`, im Verlauf als Systemereignis angezeigt. Ein Datenbanklauf ohne Nutzer-JWT kann durch einen Fallback auf den letzten Aktualisierungsakteur weiterhin gültige Auditzeilen schreiben.

Auf ausdrücklichen Nutzerwunsch keine Tests angelegt oder ausgeführt. TypeScript und Diff wurden statisch geprüft; die Migration wurde nicht auf einer Datenbank ausgeführt.
