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
- [ ] Gesamtchecks grün: Gesamt-Vitest nach Einbeziehen von `main` (`5eaf988b9`): 656 bestandene und 33 fehlgeschlagene Tests in denselben 21 fehlerhaften Dateien; Ausgangscommit `8333462be` reproduziert dieselben 21 fehlerhaften Dateien (32 fehlgeschlagene Tests, Parser-Suite bereits beim Import defekt). Breite Selftest-/Komponenten-/Features-Typechecks sind schon im Ausgangsstand rot; keine zusätzlichen Fehler pro Datei/TS-Code.
- [ ] Echte Supabase-Session: Live-Migration, bestehende Produktions-Trigger/RLS im Zusammenspiel, Anmeldung und persistente Selbsttest-Läufe noch nicht geprüft. PGlite verwendet ein isoliertes Minimalschema mit den benötigten bestehenden Helfer-/Tabellenschnittstellen.
- [x] Draft-PR veröffentlicht: https://github.com/alexsal86/landtag-tandem-organizer/pull/1422 (über verbundenen GitHub-Dienst; CLI-API ist gesperrt).
- [ ] Phase 1 vollständig abnehmen (Bestandsfehler und echte Sitzung offen). Phase 2 entfällt laut aktualisiertem Auftrag; Phase 3 ist ausdrücklich zur Umsetzung freigegeben.

# Büro-Team-Features — Phase 3: HR-Onboarding & Offboarding
- [x] Eigener Branch `feat/employee-lifecycle-phase-3`; Phase 1 inzwischen zusammengeführt, separater PR gegen `main`; keine Phase 2.
- [x] Beschäftigungsdaten und Mentor:in; tenant- und rollenbeschränkte RPCs, RLS und aktualisierte Supabase-Typen.
- [x] Bestehende Routine-Pakete um personenbezogenen Start, Eintritt/Austritt, Phasen, Pflicht und Nachweis ergänzt; keine zweite Engine, vorhandener 15-Minuten-Dispatcher bleibt zuständig.
- [x] Drei editierbare Rollenvorlagen und allgemeines Offboarding im bestehenden Routinen-Editor unter Administration; laufende Pakete behalten ihre Snapshots.
- [x] HR-Tab unter `/employee`: Pflicht-/Optionalfortschritt, eigene Punkte, Nachweisbestätigung durch Leitung und Dokumentverweise. Kein Vermischen mit Produkt-Onboarding und keine Ausweis-/Schlüsselnummern.
- [x] Team-Erinnerungen für Pflichtpunkte und Austritte; manuelle sowie täglich deduplizierte Benachrichtigungen durch den vorhandenen Dispatcher.
- [x] DSGVO-Nachweise mit Datum und bestätigender Person; normale Aufgaben-Haken können die Nachweissperre nicht umgehen.
- [x] Minimale Offboarding-Abhängigkeit `handover_tasks_to_deputy`: Tenant/Rolle/Empfänger prüfen, Ball-Typ erhalten, HR-Aufgaben ausnehmen, wiederholbar ohne doppelte Übergaben.
- [x] Sieben gezielte Vitest-Tests, HR-/Mitarbeiter-Typecheck, Feature-Lint und fokussierter PGlite-Test; Migration wiederholt, Rollen/Tenants, echter Start und Wiederholung, Nachweis, Übergabe und tägliche Erinnerungen geprüft. Neue Selftest-Schritte registriert.
- [ ] Live-Migration, echte Supabase-Sitzung, HR-Selbsttest auf der externen Instanz und Zustellung durch den echten Cron-Job prüfen. PGlite nutzt isolierte Fixtures.
- [ ] Gesamtsuite/Browser-Testserie bewusst nicht erneut ausgeführt: aktueller Auftrag verlangt weniger Tests. Bekannte Bestandsfehler aus Phase 1 bleiben separat dokumentiert.

# Team-Rituale – Phase 1
- [x] Freiwilliges Widget `weekly_question`, standardmäßig nicht in bestehenden Layouts; Mandant standardmäßig ausgeschaltet.
- [x] Fragenbank mit 20 neutralen Fragen, Verwaltung für tenant-lokale Büroleitung/Abgeordnete, archivieren statt historische Fragen löschen.
- [x] Berliner Wochenfrage beim ersten Abruf ab Montag, Unique-Index und Tenant-Sperre für idempotente Vergabe; keine Wiederholung vor vollständigem Durchlauf.
- [x] Eigene Antworten bis 280 Zeichen nur per RPC; Abmelden löscht eigene Antworten.
- [x] Freiwillige Datumsfelder pro Person/Mandant in `team_ritual_profiles` mit separater Sichtbarkeitsfreigabe. Dashboard-Wochenvorschau und Konfetti auf Wunsch; 29.02. in Gemeinjahren am 28.02.
- [x] RLS und Tenant-/Rollenprüfungen; alle Schreibaktionen per RPC, keine direkten Client-Schreibrechte.
- [x] GDPR-Kontolöschung über bestehendes `manage-tenant-user/deleteUser` entfernt Profilfelder und Antworten per `auth.users`-FK-Cascade; Entfernen/Deaktivieren der Mitgliedschaft löscht tenant-lokale Rituale. Bestehende Kontakt-GDPR-Löschung bleibt getrennt, da diese Daten ausschließlich Benutzerkonten gehören.
- [x] Ein Unit-Test-File für reine Regeln und Logic-Selbsttest-Schritte; keine neuen Abhängigkeiten.
- [ ] Migration in Supabase anwenden und mit echter Anmeldung prüfen: Mandantenisolation, Büroleitungsrechte, Opt-in/Opt-out, eigene Antwort ändern/löschen, paralleles `ensure_weekly_question`, Widerruf und GDPR-Kontolöschung — keine angemeldete Supabase-Testsitzung verfügbar.
- Optionale Benachrichtigung „Neue Frage der Woche“ nicht aktiviert; keine automatische Nachricht ohne Einwilligung.
- Phasen 2–4 bleiben außerhalb dieses Commit-Satzes.
- [x] Gezielte lokale Checks: `npx vitest run src/features/team-rituals/logic.test.ts` (4 Tests bestanden); ESLint aller geänderten TS/TSX-Dateien (0 Fehler, 20 bestehende Warnungen); `npx tsc -p tsconfig.app.json --noEmit --types node,react,react-dom,vite/client` erfolgreich. Die explizite Typenliste umgeht den bestehenden defekten `@types/react-grid-layout@2.1.0`-Stub; der unveränderte Standardaufruf bleibt dadurch blockiert.
- Lokale Paketinstallation ohne Manifest-/Lockfile-Änderung: bestehende Peer-/Lockfile-Inkonsistenz verhindert `npm ci`; deshalb `npm install --legacy-peer-deps --ignore-scripts --no-package-lock --no-save`.
- [x] Integration auf aktuellem `main`: additive Konflikte in Roadmap, Selbsttest-Registry und RPC-Typen zusammengeführt; fehlende `regionIds`/`committeeIds` beim Aufgabenformular-Reset aus parallel integrierter Zuständigkeitsmatrix ergänzt.
