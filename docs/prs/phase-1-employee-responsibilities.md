# Phase 1: Zuständigkeiten und Themen-Matrix

Mitarbeitende haben bisher kein gemeinsames Zuständigkeitsprofil. `/employee?tab=responsibilities` zeigt jetzt Personen × Themen/Ausschüsse/Regionen, Primär/Sekundär und unbesetzte Bereiche. Leitung und Abgeordnete bearbeiten Profile und führen Katalogeinträge zusammen; Tenant-Mitglieder lesen die Matrix.

Vorschläge in neuen Fallakten, Vorgängen und Aufgaben verwenden dieselbe reine Bewertungslogik. Kontakt-Aufgaben übernehmen die tenantgeprüften Kontaktthemen. Vorschläge werden ausdrücklich bestätigt. Aufgaben/Fallakten werden über `assign_from_responsibility_matrix` übergeben, bestehende Vorgänge über `handover_case_items`; `ball_owner` bleibt erhalten. Regionale Vorschlagsparameter sind bei Fallakten/Aufgaben Eingaben für den aktuellen Vorschlag; Vorgänge speichern sie im vorhandenen Intake-Payload. Fallaktenthemen verwenden die vorhandene Verknüpfungstabelle.

Die wiederholbare Migration ergänzt Kataloge, Referenzprüfungen, tenantgebundenes Lesen und ausschließlich RPC-basierte Matrixänderungen. Regionen können auf vorhandene `election_districts` verweisen. Beim Zusammenführen bleibt die stärkere Zuständigkeitsstufe erhalten, auch beim vorhandenen Themen-Merge.

## Validierung

- 14 neue Vitest-Tests: Prioritäten, Abwesenheit, Gleichstand, Lücken, Tenant-Wechsel, Kontaktgrenzen und Bestätigung per Klick.
- Isoliertes PostgreSQL/PGlite: Migration zweimal, zwei bevölkerte Tenants, RLS, Rollen/anon, Direktzugriffssperren, referentielle Integrität, Katalog-/Themen-Merge und wiederholte Übergabe ohne doppelte Timeline; Ball-Kategorie unverändert.
- Neuer Strict-Typecheck einschließlich Selbsttest-Szenario, Mitarbeiter-Typecheck und Knowledge-Strict-Typecheck grün. Neuer Code: ESLint mit `--max-warnings 0`; betroffene Altdateien: keine ESLint-Fehler, bestehende Warnungen.
- Produktionsbuild erfolgreich. Chromium prüft die echte Matrixkomponente mit gemocktem Service: Lücken, Sekundäränderung über RPC und reine Leseansicht. Ohne Sitzung leitet `/employee` zur Anmeldung weiter.
- Gesamt-Vitest nach konfliktfreier Integration von `main` (`5eaf988b9`) nicht grün: 656 bestandene und 33 fehlgeschlagene Tests in 21 Dateien; Ausgangscommit `8333462be`: dieselben 21 fehlgeschlagenen Dateien, dort 32 fehlgeschlagene Tests (eine Parser-Suite scheitert dort bereits beim Import). Breite Selftest-/Komponenten-/Features-Typechecks reproduzieren die vorhandenen Fehler; keine zusätzlichen Fehler pro Datei/TS-Code.
- Keine echte Supabase-Session, keine Live-Migration, keine serverseitigen Selbsttests gegen die externe Instanz ausgeführt. Die DB-Fixtures ersetzen keinen Test der gesamten bestehenden Produktionsschema-/Triggerkombination.

## Annahmen und Abgrenzung

Thema + Region schlägt Thema, danach Region, danach einen reinen Ausschusstreffer. Innerhalb derselben Kategorie zählt Primär vor Sekundär; Gleichstände werden nach User-ID aufgelöst. Abwesende folgen verfügbaren Kandidaten unabhängig von der Zuständigkeitsstufe. Rollenfokus dient dem Profil und wird ohne entsprechendes Eingangssignal nicht für Vorschläge gewertet.

Die private Routinen-Vertretungsauflösung wurde geprüft: Sie löst aktive Vertretungsketten auf und behandelt Konflikte/Zyklen. Phase 1 verwendet bewusst den angeforderten Abwesenheitsparameter und Sekundärzuständigkeiten; eine öffentliche Vertretungs-RPC ist Teil der noch fehlenden Phase-2-Spezifikation.

Phase 2/3, HR-Daten und eine weitere Workflow-Engine sind nicht enthalten. Die alte Aufgabenansicht bleibt erhalten. Vollständige Abnahme ist wegen der vorhandenen roten Gesamtchecks und des fehlenden angemeldeten Gesamttests offen. Draft-PR: https://github.com/alexsal86/landtag-tandem-organizer/pull/1422 (über verbundenen GitHub-Dienst erstellt; CLI-API-Zugriff ist gesperrt).
