# Roadmap Aufgaben

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
