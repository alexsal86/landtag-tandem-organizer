# Umsetzung der Admin-Prüfung – 9. November 2026

Die Korrekturen aus der ersten Runde und dieser Umsetzung bauen auf dem aktuellen `origin/main` auf. Der neue Unterpunkt für Standard-Mitwirkende aus zwischenzeitlichen Main-Änderungen bleibt erhalten. Der ursprüngliche Prüfbericht ist eine historische Bestandsaufnahme, keine Beschreibung des jetzt vollständig korrigierten Stands.

## Umgesetzt

- **Erste Runde:** Büro-/Plattformrechte getrennt, asynchrone Rollenprüfung abgesichert, Direktlinks erhalten, Rollenwechsel atomar per RPC, Speicherfehler korrekt angezeigt und Mutationen während der Speicherung gesperrt.
- **A01:** Kalenderdiagnose prüft aktive Büro-Adminrolle oder Plattformrechte, bevor Feed und Termine gelesen werden. Feed-URLs werden nicht mehr geloggt. Originabhängiges CORS, explizite Function-Konfiguration und Sicherheitsdokumentation ergänzt; alte ICS-Whitelist-Ausnahmen entfernt.
- **A02:** Standard-Meetingvorlagen auf das jeweilige Büro begrenzt; Transaktionssperre und partieller Unique-Index sichern die Eindeutigkeit.
- **A03:** Konfigurations-Policies verwenden aktive Mitgliedschaften statt der falschen Profil-ID. Alte Hilfsfunktionen verweigern mehrdeutige Bürozuordnungen und verwenden Mitgliedschaftsrollen.
- **A04, teilweise:** Die Oberfläche kennzeichnet die Regelkonfiguration ausdrücklich als Vorschau ohne verlässliche Zugriffsschutzwirkung. Berechtigungshooks geben bei fehlenden/fehlerhaften Daten keine Freigabe mehr. Vollständige fachliche Durchsetzung ist noch offen, siehe unten.
- **A05/A08:** News-, Entscheidungs-, Veranstaltungs-, Meeting-/Planungsvorlagen und Statusauswahl richten sich nach dem aktuellen Büro. Meetingvorlagen erhalten beim Anlegen ihre Büro-ID. Fehlende Veranstaltungs-Mailvorlagen starten mit Defaults statt den Werten eines anderen Büros. Meeting-Teilnehmer werden im vorgesehenen UUID-Format gespeichert; Speicherfehler werden ausgewertet.
- **A06:** Kalenderplan berücksichtigt Minuten und die ausgewiesene Zeitzone `Europe/Berlin`. DB-Claims verhindern parallele/doppelte Ausführungen; abgeschlossene Zeitfenster werden gespeichert, Fehler können erneut versucht und verpasste Zeitfenster nachgeholt werden. Der Debugbereich bietet eine Kalenderauswahl für das aktuelle Büro und bestätigt einen vollständigen Neuaufbau.
- **A07:** Kategorien-/Status- und RSS-Sortierungen verwenden eine atomare, tabellenbeschränkte RPC statt unvollständiger Upserts beziehungsweise ungeprüfter Einzelupdates. Die beiden plattformweiten Lookup-Tabellen sind für Büro-Administratoren lesbar, aber nur für Plattformadministratoren änderbar; die Oberfläche weist darauf hin.
- **A09:** Audit-Suche läuft serverseitig vor Pagination über den autorisierten Bestand. Eingaben werden verzögert, Filterwechsel setzen die Seite zurück. Export ist korrekt als aktuelle Seite beschriftet; CSV-Formelauswertung wird verhindert.
- **A10:** Fehler in Security-Cockpit, Performance- und DSGVO-Anzeige werden ausdrücklich dargestellt und nicht als unauffällige/leere Ergebnisse ausgegeben.
- **A11:** Benutzerfarben werden atomar gespeichert. Budgetfortschreibung prüft Teilerfolge und meldet sie; der fachliche Konfliktschlüssel enthält jetzt das Büro. Wiederholtes Budgetsetzen verwendet diesen Schlüssel, sodass Büros dieselbe Person unabhängig budgetieren können.
- **A12, teilweise:** Adminmasken werden beim Büro-/Unterpunktwechsel neu aufgebaut. Das verhindert die Übernahme alter Formularzustände zwischen Büros. Allgemeine Einstellungen aktualisieren den Anwendungskontext ohne kompletten Seitenreload. Ein genereller Schutz ungespeicherter Entwürfe ist noch offen.
- **A13:** Eine gemeinsame, gecachte RPC lädt den Mandantenstatus statt einzelner Edge-Aufrufe pro Tabellenzeile. Die Benutzerverwaltung liest sämtliche Auth-, Profil- und Mitgliedschaftsseiten und verknüpft sie mit Maps.
- **A14:** Der Duplikatscan startet erst nach Loslassen des Sliders; veraltete Antworten werden ignoriert und das Ergebnislimit wird angezeigt.
- **A15, teilweise:** Sammelaktionen-Audit filtert tatsächlich die letzten 30 Tage, nennt das Limit und erklärt das fehlende Undo. RSS-Test weist auf CORS-Beschränkungen hin. Badge und Liste jährlicher Aufgaben verwenden Büroaufgaben; das Badge zählt nur wirkliche Abschlüsse. Die wirkungslose Passwort-Reset-Option ist deaktiviert und als Vorschau kenntlich.
- **Menü/Performance:** Suche für Unterpunkte, persönliche Einstellungen getrennt, eigener Bereich Kosten & Budget, Büroname/Geltungsbereich und aktuelle Position sichtbar. Alte Direktlinks werden weiter aufgelöst. Alle Admin-Unterseiten werden bedarfsgerecht nachgeladen; schwere Editor-, Matrix-, Karten- und Diagnosemodule gehören nicht mehr zum direkten Einstieg.

## Messung und Prüfungen

- Produktionsbuild erfolgreich mit 4 GiB Node-Heap.
- Admin-Chunk: vorher ca. **618 KiB**, jetzt **46 KiB** unkomprimiert.
- Zusätzlicher statischer Admin-Importgraph gegenüber dem Haupt-Entry: vorher **177 Dateien / 4.669 KiB gzip**, jetzt **42 Dateien / 555 KiB gzip**. Das ist ein Vergleich des Build-Artefakts; tatsächliche Ladezeit hängt unter anderem vom Cache und dem zuerst geöffneten Unterpunkt ab.
- **62 gezielte Komponenten-/Logik- und Selbsttest-Tests bestanden.** Der zuvor fehlerhafte Zeiterfassungs-Zugriffstest besitzt jetzt den benötigten Router-Kontext.
- Lokale PostgreSQL-Tests prüfen die tatsächlichen Migrationen: Bürogrenzen, Standardvorlagen, Profil-/Auth-ID-Unterschiede, Rollen, atomare Sortierung/Farben, Audit-Suche sowie Kalenderzeiten, Sommerzeit, Claim, Retry und Duplikatvermeidung.
- Der tatsächliche ICS-Handler wurde mit Auth-/Service-/Feed-Doubles getestet: ohne Berechtigung wird vor einem Feedzugriff abgebrochen.
- Reproduzierbarer Playwright-Test `e2e/admin-mocked.spec.ts`: Desktop und Mobil, Direktlink, Menüsuchen, Audit-RPC und Queryfehler; simulierte Anmeldung, sämtliche Serviceaufrufe abgefangen, keine echten Kundendaten. Keine Browser-JavaScript-Fehler.
- Lint der geänderten Quelldateien ohne Fehler; verbleibende Warnungen betreffen unter anderem ältere Effekt-Abhängigkeiten/Typkonventionen.
- Selbsttest-Coverage-Prüfung ohne fehlende Einordnung. Die bereits zuvor offene Vorbereitungshistorie ist ausdrücklich **deferred**, nicht fälschlich als getestet markiert.
- Der übergreifende Typecheck und der globale Edge-Sicherheitscheck bleiben wegen bereits bestehender Fehler anderer Dateien/Funktionen rot. Die geänderten Quellmodule verursachen im geprüften Typecheck keine Diagnosen. Die globale Sicherheitsprüfung wird nicht durch zusätzliche Ausnahmen für diese Änderungen umgangen.

## Noch offen

1. **Durchgängiger fachlicher Zugriffsschutz für alle konfigurierbaren Modul-, Aktions- und Feldrechte.** Dafür müssen alle Lese-/Schreibpfade und Edge-/Geschäfts-RPCs entsprechend integriert werden. Insbesondere sensible Felder brauchen serverseitigen Schutz; UI-Verbergen reicht nicht. Die Vorschau ist kein Ersatz dafür.
2. **Allgemeiner Entwurfsschutz, Versionskonflikte und weitere Sammelabläufe.** Das Neuaufbauen beim Bürowechsel schützt vor falscher Zuordnung, kann aber ungespeicherte Eingaben verwerfen. Gleichzeitige Bearbeitung von JSON-Sammlungen, Onboarding-Sortierung und automatisches Vorlagen-Seeding sind noch gesondert abzusichern.
3. **Weitere Ausbaupunkte:** vollständiger Audit-Gesamtexport, funktionierendes Undo, serverseitiger Feed-Test mit URL-/Timeout-Schutz, einheitliches Automatisierungsmodell, begrenztes Iconregister, echte Frontend-/RPC-Latenzmetriken und eine breitere Live-Abnahme aller Unterpunkte.
4. **Bestehende globale Typecheck-/Edge-Sicherheitsbefunde** und noch ungetestete Vorbereitungshistorie bleiben als eigenständige Aufgaben bestehen.
5. **Produktiv-Rollout und Live-Abnahme:** Ein Push auf Main spielt nicht automatisch nachweisbar Migrationen und Edge Functions ein. Es wurden keine Produktivdaten verändert und keine produktiven Kalender-/DSGVO-/Push-Aktionen getestet.

## Rollout-Reihenfolge

Die folgenden Schritte sind für das Zielprojekt getrennt vom Git-Push erforderlich:

1. Alle vier neuen Migrationen in Dateireihenfolge anwenden:
   - `20261109120000_atomic_admin_role_replacement.sql`
   - `20261109130000_admin_integrity_and_queries.sql`
   - `20261109131000_calendar_sync_schedule.sql`
   - `20261109132000_admin_bulk_operations.sql`
2. Die aktualisierten Edge Functions `ics-validation`, `auto-sync-calendars` und `manage-tenant-user` mit der zugehörigen Konfiguration deployen.
3. Anschließend das Frontend ausrollen und die Selbsttests mit einem Büro- und einem Plattformadministrator ausführen. Zwei-Büro-Abnahme mit getrennten Konten ergänzen.

Vor dem Anwenden fachliche Sicherung/Deploymentprozess des Zielprojekts beachten. Keine RPCs auf eine alte Datenbank rückfallend durch unsichere Client-Mehrfachschreibzugriffe ersetzen: bei fehlender Migration zeigen die betreffenden Ansichten einen Fehler und verhindern riskante Änderungen.

Reproduzierbar lokal: `npm --prefix tests/database ci && npm --prefix tests/database test`; Komponenten-/Selbsttests mit Vitest; Browserprüfung mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm --prefix e2e test -- --project=admin-mocked` (oder mit installiertem Playwright-Chromium ohne diese Variable).
