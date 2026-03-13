# CI Quality Gates

Diese Regeln definieren die verpflichtenden und optionalen Qualitätsprüfungen in GitHub Actions.

## Priorisierte Kernflows (Top 5)

1. **Auth / Tenant-Wechsel**
   - Anmeldung, Session-Wiederherstellung, tenant-spezifische Isolation per `currentTenantId_<userId>`.
2. **Kalender-Sync-Trigger**
   - Manueller Trigger in der UI plus Edge-Function-Aufruf für externe Kalender-Synchronisation.
3. **Briefstatus-Workflow**
   - Archivierung erzeugt PDF, speichert Dokument-Metadaten und setzt Briefstatus auf `sent`.
4. **Benachrichtigungen (Read/Unread)**
   - Laden, Optimistic Updates, `markAllAsRead`, Cross-Tab-Signale über LocalStorage.
5. **Edge-Auth/Role/Tenant-Grenzen**
   - Edge Functions mit Auth-, Rollen- und Tenant-Grenzfallprüfungen inkl. Trigger-Wiederholungen.

## Verpflichtende Jobs

Workflow: `.github/workflows/github_workflows_ci_Version3.yml`

1. **`parser-and-tests`**
   - Python-Parser-Validierung
   - Pytests
2. **`node-quality-gates`**
   - `npm run check:security-hygiene`
   - `npm run check:diagram-drift`
   - Typecheck / Lint / Build
3. **`fast-unit-integration`**
   - `npm run test:unit-integration:ci` (schneller Vitest-Run)
4. **`coverage-thresholds`**
   - `npm run test:coverage:ci`
   - PRs: `npm run coverage:thresholds:warn` (warnend)
   - `main`/`master`: `npm run coverage:thresholds:block` (blockierend)

## Optionaler E2E-Smoke-Job

- Job: **`e2e-smoke`**
- Start: nur über `workflow_dispatch` mit Input `run_e2e_smoke=true`
- Command: `npm run test:e2e-smoke`
- Verhalten: `continue-on-error: true` (liefert Signal, blockiert aber nicht den Merge)

## Stufenweise Coverage-Schwellenwerte

Script: `scripts/check-coverage-thresholds.mjs`

### Globale Mindestwerte

- **Warnstufe (PR):**
  - Lines / Statements / Functions: **45%**
  - Branches: **30%**
- **Blockierstufe (main/master):**
  - Lines / Statements / Functions: **55%**
  - Branches: **40%**

### Kritische Module (höhere Mindestwerte)

- `src/utils/errorHandler.ts`
- `src/utils/htmlSanitizer.ts`
- `src/lib/timeUtils.ts`

Mindestwerte pro kritischem Modul (Lines):

- **Warnstufe (PR):** **70%**
- **Blockierstufe (main/master):** **80%**

### Kritische Flows (zusätzlich zu globalen Thresholds)

Die folgenden Flows haben explizite Mindestwerte auf **Functions** und **Branches**:

- `src/hooks/useAuth.tsx` → Functions: 70/80, Branches: 55/65
- `src/hooks/useTenant.tsx` → Functions: 70/80, Branches: 55/65
- `src/components/ExternalCalendarSettings.tsx` → Functions: 60/70, Branches: 45/55
- `src/hooks/useLetterArchiving.tsx` → Functions: 70/80, Branches: 55/65
- `src/hooks/useNotifications.tsx` → Functions: 55/65, Branches: 40/50

Format: **Warn/Block**.

## Dokumentierte Testfälle inkl. Negativpfade

### 1) Auth / Tenant-Wechsel
- Positiv: Session wird geladen, Tenant-Kontext initialisiert, Tenant-Wechsel wird pro User gespeichert.
- Negativ: Kein User in Session ⇒ keine Tenant-Zuordnung, kein persistierter Wechsel.

### 2) Kalender-Sync-Trigger
- Positiv: UI-Button löst `sync-external-calendar` mit `calendar_id` aus.
- Negativ: Fehlende Berechtigung/fehlerhafte Payload in Contract-Tests (`missing-jwt`, `invalid-payload-schema`, `role-tenant-violation`).

### 3) Briefstatus-Workflow
- Positiv: Archivierung schreibt Dokumenteintrag und setzt Brief auf `sent`.
- Negativ: Fehlender User/Tenant verhindert Archivierung und erzeugt destruktive Fehlermeldung.

### 4) Benachrichtigungen
- Positiv: `markAllAsRead` reduziert ungelesene Nachrichten auf 0 und persistiert per DB-Update.
- Negativ: Fehlerpfade bleiben abgedeckt (Rollback/Reload-Verhalten in Hook-Tests und Kontraktfällen).

### 5) Edge-Functions Auth/Role/Tenant
- Positiv: Happy-Path für alle priorisierten Funktionen mit validen Rollen/Berechtigungen.
- Negativ: Für jede Funktion mind. `missing-jwt`, `invalid-payload-schema`, `role-tenant-violation`; für Trigger-Funktionen zusätzlich `idempotency-repeat`.

Diese Grenzwerte sind bewusst konservativ gestartet und können schrittweise erhöht werden.
