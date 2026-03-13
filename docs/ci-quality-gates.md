# CI Quality Gates

Diese Regeln definieren die verpflichtenden und optionalen Qualitätsprüfungen in GitHub Actions.

## Verpflichtende Jobs

Workflow: `.github/workflows/github_workflows_ci_Version3.yml`

1. **`parser-and-tests`**
   - Python-Parser-Validierung
   - Pytests
2. **`node-quality-gates`**
   - `npm run check:security-hygiene`
   - `npm run check:edge-function-security` (verpflichtend, inkl. Drift-Check + Whitelist-Ausnahmen)
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

Diese Grenzwerte sind bewusst konservativ gestartet und können schrittweise erhöht werden.
