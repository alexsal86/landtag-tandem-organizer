

# Fix: 3 kritische Probleme im Automatisierungstool

Alle drei von Codex identifizierten Probleme sind real und im Code nachvollziehbar. Hier der konkrete Fix-Plan:

---

## 1. Inkonsistente Modul-/Tabellennamen

**Problem:** Templates nutzen `module: "casefiles"` aber `table: "case_files"` (Zeilen 134-199 in `AutomationRuleWizard.tsx`). Die `allowedTables`-Whitelist im Executor (Zeile 387) enthält sowohl `"casefiles"` als auch `"case_files"` — aber die DB-Tabelle heißt `case_files`.

**Fix:**
- In `RULE_TEMPLATES`: alle `table: "case_files"` vereinheitlichen auf den tatsächlichen DB-Tabellennamen `case_files`
- In `allowedTables` im Executor: `"casefiles"` entfernen, nur `"case_files"` behalten
- Eine `MODULE_TO_TABLE` Map einführen (sowohl Frontend als auch Executor), damit `module: "casefiles"` automatisch auf `table: "case_files"` gemappt wird

---

## 2. Dry-Run/Run-Now Payload aus Formular- statt Regel-Zustand

**Problem:** `triggerDryRun()` (Zeile 394-421) und `triggerRunNow()` (Zeile 423-449) in `AutomationRulesManager.tsx` nutzen `form.triggerField` und `form.triggerValue` — also den aktuellen Wizard-Formularstand. Wenn der User gerade eine andere Regel editiert, geht der falsche Payload raus.

**Fix:**
- Beide Funktionen so ändern, dass sie den Payload aus der **gespeicherten Regel** (`rule.trigger_config`, `rule.conditions`, `rule.actions`) aufbauen statt aus `form.*`
- Nur `handleWizardDryRun()` (für unsaved rules im Wizard) darf den Formularstand nutzen — aber erst nach Speicherung (was bereits enforced wird)

---

## 3. Scheduler ohne Concurrency-Guard

**Problem:** `run-scheduled-automation-rules` (Cron alle 5 Min) hat keinen Lock. Bei langsamer Ausführung oder doppeltem Trigger kann dieselbe Regel parallel gestartet werden. Die Idempotency basiert auf `crypto.randomUUID()` — also kein Schutz gegen Doppelausführung.

**Fix:**
- Deterministischen `idempotencyKey` generieren: `${rule.id}-${zeitfenster}` (z.B. auf 5-Min-Fenster gerundet)
- Damit greift der bestehende Idempotency-Check im Executor (Zeile 219-233) und verhindert Doppelausführung
- Optional: `pg_advisory_lock` im Scheduler für eine härtere Garantie (kann als Follow-up)

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `AutomationRuleWizard.tsx` | `MODULE_TO_TABLE` Map exportieren; Templates konsistent machen |
| `AutomationRulesManager.tsx` | `triggerDryRun`/`triggerRunNow` Payload aus Regel statt Formular |
| `run-automation-rule/index.ts` | `"casefiles"` aus allowedTables entfernen; `MODULE_TO_TABLE` nutzen |
| `run-scheduled-automation-rules/index.ts` | Deterministischen Idempotency-Key generieren |

