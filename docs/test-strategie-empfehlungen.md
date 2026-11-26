# Test-Strategie: Sinnvolle nächste Ausbaustufen

Dieses Dokument priorisiert zusätzliche Tests für die Büro-Plattform auf Basis der aktuellen Architektur (React SPA + Supabase Edge Functions + Multi-Tenant/Rollenmodell).

## 1) Höchste Priorität (kritische Risiken)

### 1.1 Multi-Tenant- und Rollen-Guardrails (Integration)
**Ziel:** Sicherstellen, dass Nutzer:innen nie Daten eines fremden Tenants sehen oder verändern können.

**Empfohlene Tests:**
- Tenant-Wechsel (`useTenant`) mit mehreren verfügbaren Tenants inkl. Persistenz in `localStorage`.
- Rollen-basierte UI-Gates in zentralen Views (z. B. Admin-Bereiche, sensible Aktionen).
- Verifikation, dass Query/Mutation-Hooks immer tenant-gebunden filtern.

**Nutzen:** Verhindert die teuersten Fehlerklassen (Datenabfluss, Compliance-Verstöße).

### 1.2 Edge-Function Contract-Tests (Auth + Input + Fehlerfälle)
**Ziel:** Jede kritische Funktion validiert erwartbares Verhalten für positive und negative Pfade.

**Empfohlene Tests:**
- HTTP-Status und Fehlermeldungen für fehlendes/ungültiges JWT.
- Zod/Schema-Validierungen mit Grenzwerten und Pflichtfeldern.
- Tenant-Zugehörigkeit und Rollenprüfung für mutierende Funktionen.
- Idempotenz bei wiederholten Requests (z. B. Mail-/Benachrichtigungs-Trigger).

**Nutzen:** Stabilisiert Schnittstellen und reduziert produktive Incident-Fälle.

### 1.3 Sicherheitsnahe Utilities (Unit)
**Ziel:** XSS-/Fehlerbehandlung weiter absichern.

**Empfohlene Tests:**
- Zusätzliche Payload-Suiten für HTML-Sanitizer (SVG, Event-Handler, URL-Protokolle).
- Error-Handling-Verhalten bei unbekannten `unknown`-Fehlertypen.
- Regressionstests für `dangerouslySetInnerHTML`-relevante Datenflüsse.

**Nutzen:** Frühzeitige Absicherung gegen typische Frontend-Sicherheitslücken.

## 2) Mittlere Priorität (Business-Prozesse)

### 2.1 Workflow-Tests „Termine/Sitzungen/Aufgaben“ (Integration)
**Ziel:** Reale Kernabläufe Ende-zu-Ende auf Komponenten-/Hook-Ebene prüfen.

**Empfohlene Tests:**
- Termin anlegen → Beteiligte zuweisen → Reminder-Logik auslösen.
- Sitzung/Meeting archivieren und anschließend gefilterte Darstellung validieren.
- Aufgabenoperationen inkl. Zustandswechsel und Fehler-UI.

### 2.2 Dokument- und Briefprozesse (Integration)
**Ziel:** Kritische Arbeitsabläufe rund um Dokumente robust machen.

**Empfohlene Tests:**
- Upload-/Verknüpfungslogik mit ungültigen Dateitypen und Größenlimits.
- Briefvorlagen-Typen plus Render-/Speicherpfade mit Fallbacks.
- Fehleranzeigen und Retry-Verhalten bei Supabase-Fehlern.

### 2.3 Kalender-/ICS-Funktionen (Contract)
**Ziel:** Terminexport/-sync zuverlässig halten.

**Empfohlene Tests:**
- ICS-Validierung für ungültige Datums- und TZ-Kombinationen.
- Deduplizierung/Update-Verhalten bei wiederholter Synchronisation.
- Fehlertoleranz gegenüber externen Kalenderquellen.

## 3) Ergänzende Qualitätssicherung

### 3.1 E2E-Smoketests (Playwright)
**Vorschlag für kleine, stabile Suite:**
- Login + Tenant-Auswahl + Dashboard lädt.
- Neuer Termin + Sichtbarkeit in Liste.
- Neuer Vorgang/Task + Statuswechsel.
- Rechtecheck: Nicht-Admin sieht keine Admin-Aktion.

### 3.2 Migrations-/Schema-Checks in CI
- Smoke-Checks gegen aktuelle Supabase-Migrationen.
- Kompatibilitätscheck für generierte Types (`src/integrations/supabase/types.ts`).

### 3.3 Performance-Budgets
- Bundle-Size-Regressionen pro Build tracken.
- Langsame Kernansichten mit Basis-Limits (Renderzeit) absichern.

## 4) Konkrete Test-Matrix (Startpaket)

1. **Tenant-Isolation Hook-Tests** (`useTenant`, auth-nahe Hooks).
2. **Edge-Function Negativtests** für 5–10 kritischste Funktionen (Auth, Rollen, Input).
3. **Workflow-Integration** für Meetings + Tasks + Documents (je 2–3 zentrale Flows).
4. **4 E2E-Smokes** für Login, Rechte, Termin, Aufgabe.

## 5) Vorschlag zur Umsetzung in 3 Sprints

### Sprint 1
- Tenant/Rollen-Testharness konsolidieren.
- Contract-Tests für sicherheitskritische Edge Functions.

### Sprint 2
- Integrations-Workflows für Meetings/Tasks/Documents.
- ICS/Kalender-Contract-Tests.

### Sprint 3
- Kleine Playwright-Suite in CI.
- Performance/Bundles als Quality Gate.

## 6) Definition of Done (für neue Features)

Ein Feature gilt erst als „testbar abgeschlossen“, wenn:
- Unit-Tests für neue Utility-Logik vorhanden sind,
- Integrations-Test für den Hauptnutzenfall vorliegt,
- mindestens ein Negativpfad getestet ist,
- bei Backend-Änderungen ein Contract-Test für die Edge Function existiert.
