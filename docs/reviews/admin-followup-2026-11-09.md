# Admin-Fortsetzung, 9. November 2026

Ergänzt [die erste Umsetzung](admin-implementation-2026-11-09.md). Entwurfsschutz und allgemeine Versions-/Bearbeitungskonflikte bleiben auf Wunsch ausgenommen. Bei Feldrechten werden beide gewünschten Varianten angeboten.

## Umgesetzt

- **Feldrechte:** Pro Büro, Rolle und unterstütztem Feld entweder nur den Wert maskieren oder den gesamten Datensatz sperren. Unterstützt werden Kontakt-E-Mail-Adressen, Telefonnummern und Notizen sowie Briefinhalt/HTML. Nicht vorhandene Beispielspalten wurden aus dem Editor entfernt. Schreibverbot wird in Datenbanktriggern durchgesetzt; ohne Leserecht ist auch Schreiben gesperrt. Plattformrechte bleiben ausgenommen.
- **Datenzugriffe:** Restriktive SELECT-Policies schließen unmaskierte Browser-/REST-Abfragen. Typisierte Invoker-Lesefunktionen erhalten die bestehenden RLS-Regeln und maskieren vor äußeren Filtern. Der zentrale Supabase-Transport verwendet diese Funktionen auch für eingebettete Beziehungen. Die Schreibfunktion erhält ausgeblendete Werte, statt Maskierungs-Platzhalter zurückzuschreiben. Direkte ID-/Bürofilter werden in den Reader übernommen. Keine unsichere Rückfalllösung auf alte APIs bei fehlender Migration.
- **Aktionsrechte:** Kontakt-/Brief-Löschen, Briefversand, Entscheidungsarchiv und Fallaktenabschluss erhalten zusätzliche DB-Prüfungen. Benutzeranlage und manuelle Automatisierung prüfen Aktionsrechte vor Ausführung. Diagnose des Workflow-Dispatchers ist nur als autorisierter Dry-Run möglich. Der Cron-Worker verlangt Service-Role vor Datenzugriff. Briefarchivierung verwendet die verifizierte Identität und prüft Leserechte vor PDF-Erzeugung; Dokument-Mails lesen Kontakte im Benutzerkontext und aktuellen Büro.
- **Module:** Zentrale Routensperre für ausgeblendete Arbeitsbereiche; Briefregister und neuer Brief in Dokumenten berücksichtigen den Schalter ebenfalls. Module sind ausdrücklich UI-Sichtbarkeit, keine zusätzliche serverseitige Datenberechtigung. Änderungen an Regeln invalidieren über Realtime den Clientcache.
- **Audit-Export:** Gesamter gefilterter Bestand in 500er-Schritten mit Stichtag und Schlüsselcursor, Fortschritt und Abbruch; Download erst bei vollständigem Erfolg. CSV-Formeln werden escaped. Index für Büro/Zeit/ID ergänzt. Dies ist ein Stichtag auf `created_at`, kein über mehrere HTTP-Aufrufe gehaltener MVCC-Snapshot.
- **Kontakt-Sammelaktionen:** Tags/Kategorie in einer Transaktion, höchstens 500 Kontakte; Rücknahmedaten entstehen aus den tatsächlichen DB-Vorher-/Nachherwerten. Admin-Rücknahme bis 30 Tage; keine Wiederholung und kein Überschreiben späterer Änderungen. Löschungen einschließlich ihrer Folgeobjekte sind nicht rücknehmbar. Audit-Snapshots sind nur für Akteur/Admin sichtbar.
- **RSS-Test:** Serverfunktion statt Browser-CORS-Test, RSS-/Atom-Parser, Admin-/Büroprüfung, URL-/DNS-/Redirect-Prüfung auf öffentliche Ziele, Zeitlimit und maximal 512 KiB Antwort. Keine Zugangsdaten/Sonderports. DNS wird vor jedem Ziel geprüft, aber nicht an die anschließend aufgebaute Verbindung gepinnt; DNS-Rebinding ist damit nicht vollständig ausgeschlossen.
- **Prüfbarkeit:** Admin-Szenario im Selbsttest-Center; PostgreSQL-Integrationstests, Transport-/Export-/Feedtests und Edge-Guard-Tests. Sicherheitsprüfung erkennt den authentifizierenden Tenant-Guard; Matrixprüfung ignoriert Markdown-Trennzeilen korrekt. Keine zusätzlichen Whitelist-Ausnahmen.

## Validierung und Grenzen

Bestanden: 86 gezielte Vitest-/Selbsttests, die komplette lokale Datenbank-Testsuite einschließlich der neuen Migrationen und Edge-Guards sowie Produktionsbuild und Admin-Browsertest (Desktop/Mobil, beide Feldmodi, keine JavaScript-Fehler). Lint der geänderten Quelldateien ohne Fehler; bestehende Warnungen bleiben sichtbar. Sicherheitsmatrix und Selbsttest-Coverage sind aktuell. Der Admin-Chunk liegt weiter bei rund 47 kB unkomprimiert. Browserprüfung verwendet synthetische Anmeldung und abgefangene Backend-Aufrufe. Sie ersetzt keine echte Supabase-/PostgREST-Abnahme.

Offen bleiben:

1. **Live-Rollout und Rollenabnahme:** Keine Supabase-Deployment-Zugangsdaten in der Umgebung. Git-Push ist kein Nachweis eines DB-/Function-/Frontend-Rollouts. Beide Feldmodi mit zwei Büros und verschiedenen Konten über das echte PostgREST einschließlich Embeds, Count/Range und vorhandener Integrationen prüfen.
2. **Performance unter echten Datenmengen:** Invoker-Lesefunktionen maskieren vor äußeren Such-/Seitenfiltern. Große Kontaktbestände können deshalb vor der Pagination verarbeitet werden. Einzelabfragen sind durch ID-/Büroparameter eingegrenzt; Lastmessung und gegebenenfalls weitere serverseitige Filter/Pagination bleiben erforderlich. Auch der CSV-Download wird im Browserspeicher zusammengesetzt.
3. **Weitere Systeme:** Einheitliches Automatisierungsmodell, begrenztes Iconregister, tatsächliche Frontend-/RPC-Latenzmetriken und umfassende Live-Abnahme aller Admin-Unterpunkte.
4. **Globale Bestandsfehler:** Projektweiter Typecheck und Edge-Sicherheitscheck enthalten weitere vorhandene Befunde. Nicht als vollständig grün ausgegeben. Kopierte/exportierte/archivierte Daten und zusätzliche Drittsysteme sind keine automatische rückwirkende Feldredaktion; neue Integrationen müssen den gesicherten Reader benutzen. Mehrdeutige Fremdschlüsselbeziehungen werden nicht stillschweigend einem falschen Kontakt zugeordnet und brauchen gegebenenfalls explizite Reader.
5. **Wie beauftragt ausgenommen:** Allgemeiner Entwurfsschutz und gleichzeitige Bearbeitung/Versionskonflikte.

## Rollout

Zuerst die vier Migrationen aus dem ersten Bericht, danach:

1. `20261109140000_audit_export.sql`
2. `20261109141000_contact_bulk_undo.sql`
3. `20261109142000_enforce_admin_actions.sql`
4. `20261109143000_secured_field_reads.sql`

Anschließend aktualisierte Functions `archive-letter`, `manage-tenant-user`, `run-automation-rule`, `run-workflow-cron`, `send-document-email`, `workflow-dispatcher` und neue Function `test-rss-feed` mit der Konfiguration ausrollen. Die zuvor geänderten Functions `ics-validation` und `auto-sync-calendars` ebenfalls berücksichtigen. Danach Frontend deployen, Selbsttests und echte Rollen-/Büroabnahme ausführen.

Lokal reproduzierbar: `npm --prefix tests/database test`, gezielte Vitest-Tests unter `src/components/administration/utils`, `src/integrations/supabase/securedFetch.test.ts` und `src/features/selftest`, sowie Playwright-Projekt `admin-mocked`.
