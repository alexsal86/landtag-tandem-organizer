# CI Quality Gates

Diese Regeln definieren die verpflichtenden und optionalen Qualitäts- und Security-Prüfungen in GitHub Actions.

## PR-Arbeitsmodus (verbindlich)

- Kleine PRs statt Big-Bang-Änderungen: Richtwert **max. 10–20 Dateien** pro PR.
- Pro PR genau **ein Themencluster** (z. B. ausschließlich Letter **oder** Matrix/Context).
- Reviewer starten mit der Pflichtfrage: **„Wurden neue `any` eingeführt?“**.
- Nach jedem **3. Merge** wird ein kurzer Stabilisierungs-PR für Typduplikate eingeplant.

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
2. **`dependency-scan`**
   - `npm audit --audit-level=high`
   - **Blockierend:** PR/Push schlägt fehl bei Vulnerabilities mit Severity `high` oder `critical`.
3. **`secret-scan`** *(nur Pull Requests)*
   - `gitleaks detect --verbose --redact --config .gitleaks.toml --source .`
   - **Blockierend:** Jeder bestätigte Secret-Fund stoppt den Merge.
4. **`static-security-analysis`**
   - `semgrep scan --config p/security-audit --error --severity ERROR --exclude-from .semgrepignore src/ supabase/functions/`
   - Scope: `src/` und `supabase/functions/`
   - **Blockierend:** Findings ab Severity `ERROR`.
5. **`node-quality-gates`**
   - `npm run check:security-hygiene`
   - `npm run check:edge-function-security` (verpflichtend, inkl. Drift-Check + Whitelist-Ausnahmen)
   - `npm run check:diagram-drift`
   - Typecheck / Lint / Build

### Any-Metrik (`any`-Delta)

Im Job **`node-quality-gates`** wird für Pull Requests ein Delta zwischen Basis-Branch und PR-Head berechnet:

- Basis: `npm run --silent report:any-usage:total -- --ref="origin/<base-branch>"`
- Head: `npm run --silent report:any-usage:total`
- Delta: `Head - Basis`

Zusätzlich landen im Job Summary:

- Delta-Block mit Base/Head/Differenz
- Cluster-Tabelle (`npm run --silent report:any-usage:clusters`)
- Top-Dateien-Tabelle (`npm run --silent report:any-usage:files`)

**Merge-Regel:**

- `Delta <= 0`: Gate erfüllt.
- `Delta > 0`: Gate blockiert den PR (keine Ausnahme über PR-Body-Marker).

### Type-Safety Delta Gate (maschinenlesbare Ausnahmen)

Zusätzlich wird in PRs `npm run check:type-safety-delta -- --base="origin/<base-branch>"` ausgeführt.

**Blockierende Regeln auf neu hinzugefügten Diff-Zeilen:**

- Neue `any`-Typisierung (`: any`, `as any`, `any[]`, `<any>`, `Map<string, any>`) ist nur erlaubt, wenn im gleichen lokalen Diff-Kontext ein maschinenlesbarer Ausnahme-Kommentar mit **Keyword + Ticket-ID** steht.
- Format für `any`-Ausnahmen: Kommentar mit `any-exception` (oder `eslint-disable-next-line @typescript-eslint/no-explicit-any`) **und** Ticket-ID wie `ABC-123`.
- Neue `@ts-ignore`/`@ts-expect-error` sind nur erlaubt mit **Ticket-ID und Begründung** im selben Kommentar.

**Beispiel (zulässig):**

```ts
// any-exception ABC-123: Drittanbieter-Payload ohne stabilen Typ, Follow-up im Ticket
const payload: any = legacyInput;

// @ts-expect-error ABC-456: Upstream-Typdefekt in lib v1.2.3, remove after update
legacyApi.call();
```

6. **`fast-unit-integration`**
   - `npm run test:unit-integration:ci` (schneller Vitest-Run)
7. **`coverage-thresholds`**
   - `npm run test:coverage:ci`
   - PRs: `npm run coverage:thresholds:warn` (warnend)
   - `main`/`master`: `npm run coverage:thresholds:block` (blockierend)

## Versionierte Baselines / Allowlists

Um bekannte False Positives kontrolliert zu behandeln, sind folgende Dateien versioniert:

- **`.gitleaks.toml`**
  - Enthält die Gitleaks-Allowlist (Pfad- und Regex-Ausnahmen) für dokumentierte, nicht-sensitive Test-/Doku-Muster.
  - Änderungen nur mit Begründung im PR.
- **`.semgrepignore`**
  - Definiert die Semgrep-Baseline/Ignore-Liste für nicht relevante Pfade (z. B. `docs/`, Build-Artefakte, Fixtures).
  - Änderungen nur mit Begründung im PR.

## Optionaler E2E-Smoke-Job

- Job: **`e2e-smoke-nonblocking`**
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


## TypeScript Strict Migration

Details zur Batch-Strategie, Migrationsregel und Fortschrittsmetrik: `docs/typescript-strict-migration.md`. Die Strict-Migration wird dort zusätzlich flow-basiert entlang der fünf priorisierten Kernflows organisiert; dieselben Flows sollten deshalb auch für Coverage-Interpretation, PR-Zuschnitt und Batch-Freigaben verwendet werden.

Für PRs, die Strict-Batches erweitern, sind außerdem die dokumentierten **Review-Checkfragen für Type-Sicherheits-Schulden** aus `docs/typescript-strict-migration.md` verbindlich zu beantworten. Dazu gehören insbesondere das Verbot neuer `@ts-ignore`-Kommentare, die fachliche Prüfung von Non-Null-Assertions und Typ-Casts sowie ein expliziter Abbauplan für verbleibende Typ-Schulden.

## Python-Test-Gate (Parser)

- `pytest -q` ist ein verpflichtender Gate-Check im Job `parser-and-tests`.
- Im Repository muss mindestens ein echter Pytest vorhanden sein (kein Dummy), damit der Gate-Status aussagekräftig bleibt.
- Referenz: `tests/test_parser_core.py` prüft Kernfunktionen der Parser-Normalisierung und Metadaten-Extraktion.
