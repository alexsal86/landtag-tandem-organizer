# Durchgängige Arbeitsübergänge

Die Migration `20261107150000_workflow_consistency.sql` muss vor dem neuen Client angewendet werden.

- Büroschritte und Aufgaben teilen Titel, Termin und einzelne Zuständigkeit. Das Abschließen einer Aufgabe (auch über direktes Archivieren) entfernt den offenen Schritt. Die Übergabe nach außen behält den Schritt als Wiedervorlage.
- Die Fristenübersicht zeigt einen Schritt mit aktiver Aufgabe einmal.
- Aus einer Entscheidung erzeugte Aufgaben speichern `source_type=decision` und die Entscheidungs-ID. Aktenentscheidungen speichern `case_file_id`; Folgeaufgaben werden auch mit der Akte verbunden.
- Notizübernahmen und Akten-Schnellaufgaben werden samt Verknüpfung atomar angelegt. Gesperrte Quellzeilen bzw. stabile Erstellungs-IDs verhindern doppelte Ergebnisse bei Wiederholung.
- Entscheidungsanfragen, Teilnehmer und die optionale Notizbeziehung werden gemeinsam gespeichert. Anhänge und Versand erfolgen anschließend über die vorhandenen Abläufe; Versandfehler können die bereits gespeicherte Anfrage nicht duplizieren.
- „Verknüpfung entfernen“ erhält das Zielobjekt. Die eigenständigen Aktionen zum Archivieren und Löschen bleiben verfügbar.
- Die Erstellungs-RPCs laufen mit den Zeilenrechten des angemeldeten Benutzers; die Synchronisierungstrigger prüfen den Zugriff auf den Vorgang. Herkunftsverknüpfungen übertragen keine Leserechte auf private Quellen.

## Prüfungen

`PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node scripts/test-workflow-consistency.mjs` prüft die Migration in einer isolierten Datenbank mit Rückkopplung, Wiederholung, Entknüpfen, Herkunft und Fehler-Rollbacks.

Die Notiz- und Vorgangs-Lifecycle-Szenarien im Selbsttest-Center prüfen die produktiven RPCs und die Rückkopplung. Die Integrationstests benötigen keine Produktionsverbindung.
