# Roadmap Aufgaben

# Kalender-Reparatur
- [x] Administrationsparameter auf die Administrationsseite begrenzen.
- [x] Kalender-Abwesenheiten ohne nicht vorhandenen Fremdschlüssel laden — 6 Kalender-Tests bestanden.
- [x] Kalender-Navigation unabhängig von Besuchsmarkierungen öffnen; Kalender-Gruppenklick öffnet Hauptkalender.
- [ ] Angemeldeten Kalender prüfen — externe Supabase-Testsitzung nicht verfügbar.

# Dependency security
- [x] Update affected direct dependencies and refresh transitive resolutions in both lockfiles.
- [x] Verify advisory version floors, run relevant tests, and check the preview build.
- [x] Report dependencies blocked by licensing or unavailable compatible patched releases.
- [ ] Resolve expo/expo-router security constraints — coordinated mobile SDK upgrade required.
- [ ] Resolve xlsx advisories — existing licensing restriction requires an approved replacement or licensing decision.
- [ ] Resolve additional low-severity deepmerge/elliptic advisories — incompatible upstream constraints or no patched release.

- [x] Anstupsen (Rules, RPCs, UI, Tests, Selftest)
- [x] Erinnerung mit freier Uhrzeit
- [x] Erinnerung ohne geöffnete App (stündliche Benachrichtigung)
- [x] Checkliste innerhalb einer Aufgabe
- [x] Mehrfachauswahl: gebündelt übergeben / Frist verschieben / anstupsen
- [x] Schnelles Abstimmen direkt in der Aufgabe
- Alte Aufgabenansicht bleibt erhalten (nicht löschen)

# Jour Fixe – Plattformintegration
- [x] Redaktion, Abwesenheiten, Veranstaltungen, Briefe und Fristenradar als Systempunkte
- [x] Terminanfragen und Briefings in Agenda und Fokusmodus
- [x] Entscheidungsrückschrieb über echte IDs und sichere Folgeaufgaben mit Stafette
- [x] Regeln, Archivierungstests und Selbsttest ergänzen
- [ ] Angemeldeten Gesamtablauf und Datenbank-Selbsttest prüfen — keine verwaltete Testsitzung für externes Supabase verfügbar
- Beide Jour-Fixe-Ansichten bleiben getrennt.

# Automatisierungs-Hub
- [x] Jahresroutinen tief in Regel-Assistent, Zeitsteuerung und Verlauf integriert; bestehende Abschlüsse erhalten, Funktionen ausgerollt.
- [x] Jahresübersicht, sichere Systemaktionen, 40 Regressionstests und zurückgerollter Datenbank-Gesamttest erfolgreich.
- [ ] Neue Jahresroutine angemeldet im Assistenten speichern und Aufgabe öffnen — externe Supabase-Testsitzung nicht verfügbar.
- [x] Phase 1: Jahresaufgaben atomar ins Stafetten-System übergeben und Abschluss synchronisieren
- [x] Phase 1: Regeln, Datenbank-Verknüpfung und Selbsttests absichern
- [x] Phase 2: Regeln/Workflows und RSS-Navigation zusammenführen
- [x] Phase 2: Alte Links und Selbsttest absichern — 22 gezielte Tests bestanden
- [ ] Phase 2: Gemeinsame Reiter angemeldet durchklicken — externe Supabase-Testsitzung nicht verfügbar
- [x] Phase 3: Jährliche, monatliche und quartalsweise Stichtage samt Monatsende im Regel-Builder ergänzen
- [x] Phase 3: Terminberechnung, doppelte Ausführung, Vorlagen und Selbsttest absichern — 10 gezielte Tests und 2 Edge-Tests bestanden
- [x] Phase 3: Sichere stündliche Zeitsteuerung ausrollen und prüfen — signiert 200, ohne Signatur 403
- [ ] Phase 3: Regel mit Anmeldung speichern und erzeugte Aufgabe in der App prüfen — externe Supabase-Testsitzung fehlt
- [ ] Älteren Dispatcher-Test prüfen — gültige Testvorlage wird durch vorhandene zyklische Aktionsreferenzen abgelehnt
- [ ] Angemeldeten Jahresaufgaben-Gesamtablauf prüfen — externe Supabase-Testsitzung fehlt

# Plattformweite Themen (Option B)
- [x] Themen beim Tippen anlegen, Zusammenführen für Büroleitung, alte Tags übernommen
- [x] Fallakten nur noch mit Themen-Box; Wissens-Tags spiegeln Themen
- [x] Kontakt-/Dokument-Tags laufen automatisch in Themen (DB-Abgleich)
- [x] Querschnittsansicht pro Thema (/themen)
- [ ] Angemeldet prüfen — externe Supabase-Testsitzung nicht verfügbar

# Büro-Team-Features — Phase 1: Zuständigkeiten & Matrix (13.11.2026)
- [x] Eigener Branch `feat/employee-responsibilities-phase-1`; PR-Text in `docs/prs/phase-1-employee-responsibilities.md` vorbereitet.
- [x] Wiederholbare Migration: Ausschüsse, Regionen mit optionalem Wahlkreisverweis und Zuständigkeiten; genau passende Referenzen, Tenant-FKs, Unique-Indizes, RLS-Lesen und rollengeprüfte Schreib-RPCs.
- [x] Zusammenführen von Ausschüssen/Regionen und Erweiterung des Themen-Merge; Primärzuständigkeit bei Doppelungen erhalten.
- [x] Reine Vorschlags-/Lückenlogik, 14 neue Vitest-Tests und registrierte Selbsttest-Schritte für Logik, Übergabe und Tenant-/Rollengrenzen.
- [x] Matrix und Zuständigkeitsprofile unter `/employee`; Themen-Box wiederverwendet, Bearbeitung auf Leitung/Abgeordnete begrenzt.
- [x] Bestätigte Vorschläge bei Fallakten/Vorgängen/Aufgaben und Kontakt-Aufgaben; Übergaben über RPCs mit unverändertem Ball-Typ. Region/Ausschuss sind bei Fallakten/Aufgaben Vorschlagseingaben, bei Vorgängen zusätzlich Intake-Daten.
- [x] Themen beim Tenant-Wechsel zurücksetzen und verspätete Antworten verwerfen; Kontakt-Themen erst nach Tenant-Prüfung laden. Abwesenheiten nur über aktive Tenant-User-IDs, ohne Gründe.
- [x] Isolierter PGlite-Test mit echter Migration zweimal, zwei bevölkerten Tenants, Rollen/anon, gesperrten Direktzugriffen, Referenzintegrität, Merge und wiederholter Übergabe erfolgreich.
- [x] Feature-Strict-Typecheck (inkl. neuem Selbsttest-Szenario), Mitarbeiter-/Knowledge-Typecheck und Build erfolgreich; neuer Code ohne Lint-Warnungen. Betroffene Altdateien haben weiterhin vorhandene Warnungen, aber keine Lint-Fehler.
- [x] Matrix mit Chromium und gemocktem Service geprüft (Lücken, Sekundärzuständigkeit speichern, reine Leseansicht); Route ohne Sitzung führt zur Anmeldung.
- [ ] Gesamtchecks grün: Gesamt-Vitest aktuell 33 fehlgeschlagene Tests in 21 Dateien; Ausgangscommit `8333462be` reproduziert dieselben 21 fehlerhaften Dateien (32 fehlgeschlagene Tests, Parser-Suite bereits beim Import defekt). Breite Selftest-/Komponenten-/Features-Typechecks sind schon im Ausgangsstand rot; keine zusätzlichen Fehler pro Datei/TS-Code.
- [ ] Echte Supabase-Session: Live-Migration, bestehende Produktions-Trigger/RLS im Zusammenspiel, Anmeldung und persistente Selbsttest-Läufe noch nicht geprüft. PGlite verwendet ein isoliertes Minimalschema mit den benötigten bestehenden Helfer-/Tabellenschnittstellen.
- [ ] Draft-PR veröffentlichen — bereitgestellte GitHub-Authentifizierung ungültig.
- [ ] Phase 1 vollständig abnehmen; Phase 2 erst danach. Phase-2-Spezifikation fehlt im Auftrag und wurde angefragt; Phase 3 bleibt nachgelagert, insbesondere `handover_tasks_to_deputy` aus Phase 2 fehlt noch.
