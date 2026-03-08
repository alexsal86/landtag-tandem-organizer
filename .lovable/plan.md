
# Automations No-Code Rule Engine — Status & Nächste Schritte

## Aktuelle Situation: Phase 1 ist bereits größtenteils umgesetzt!

Die Analyse zeigt, dass das Fundament bereits besteht:

### ✅ Was bereits existiert

| Komponente | Status |
|------------|--------|
| **Tabellen** `automation_rules`, `automation_rule_runs`, `automation_rule_run_steps` | ✅ Mit RLS, Indizes, Update-Trigger |
| **Edge Function** `run-automation-rule` | ✅ Executor mit Idempotenz, Tenant-Isolation, Dry-Run |
| **Edge Function** `run-scheduled-automation-rules` | ✅ Scheduler für zeitgesteuerte Regeln |
| **UI: Regel-Builder** | ✅ `AutomationRulesManager.tsx` (856 Zeilen) mit Formular |
| **UI: Regel-Liste** | ✅ Mit Enable/Disable, Bearbeiten, Löschen |
| **UI: Run-Historie** | ✅ Mit Step-Details und Filter |
| **Actions**: `create_notification`, `create_task`, `update_record_status` | ✅ Implementiert |
| **Trigger-Typen**: `record_changed`, `schedule`, `manual` | ✅ Konfigurierbar |
| **Templates**: 2 vordefinierte | ✅ Überfällige Aufgaben, Wissensartikel-Review |

---

## ⚠️ Was fehlt / verbessert werden kann (Phase 1 → Phase 2 Übergang)

### 1. **Schnell-Toggle in der Regel-Liste**
Aktuell muss man zum Bearbeiten → Formular → Switch klicken. Ein direkter Toggle-Switch in der Listenzeile wäre nutzerfreundlicher.

### 2. **`automation_rule_run_steps` Tabelle fehlt im Schema**
Die Tabelle wird im Code verwendet (`loadRunSteps`), aber existiert möglicherweise nicht oder fehlt in der TypeScript-Typen-Generierung. Migration prüfen/erstellen.

### 3. **Scheduler-Cron-Job nicht aktiviert**
Die `run-scheduled-automation-rules` Function existiert, aber ohne Cron-Trigger in `supabase/config.toml` wird sie nicht automatisch ausgeführt.

### 4. **`send_push_notification` Action nicht implementiert**
Im UI auswählbar (`ACTION_TYPES`), aber nicht in der Edge Function implementiert.

### 5. **User-Picker statt UUID-Eingabe**
Aktuell: manuelle UUID-Eingabe für `target_user_id`. Besser: Dropdown mit Tenant-Nutzern.

---

## Empfohlener Umsetzungsplan

### Paket A: Quick-Toggle & UX (30 min)
- Direkter Enable/Disable Switch in Regel-Karte
- Optimistische UI-Aktualisierung

### Paket B: Schema-Vervollständigung (20 min)
- `automation_rule_run_steps` Tabelle prüfen/migrieren
- RLS-Policies ergänzen

### Paket C: Scheduler aktivieren (10 min)
- Cron-Job in `supabase/config.toml` konfigurieren (z.B. alle 5 Minuten)
- Secret `AUTOMATION_CRON_SECRET` dokumentieren

### Paket D: Fehlende Action implementieren (30 min)
- `send_push_notification` in `run-automation-rule` ergänzen
- Nutzt vorhandene Push-Infrastruktur

### Paket E: User-Picker (45 min)
- Tenant-Nutzer laden
- Combobox/Select statt UUID-Input

---

## Zusammenfassung

**Phase 1 ist zu ~90% fertig.** Die offenen Punkte sind primär UX-Verbesserungen und ein fehlendes Schema-Element. Soll ich mit Paket A (Quick-Toggle) oder Paket B (Schema-Vervollständigung) starten?
