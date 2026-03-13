# CI Quality Gates

Diese Regeln definieren die verpflichtenden und optionalen Qualitäts- und Security-Prüfungen in GitHub Actions.

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
   - `npm run check:diagram-drift`
   - Typecheck / Lint / Build
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

Diese Grenzwerte sind bewusst konservativ gestartet und können schrittweise erhöht werden.
