

# Fehler-Alerts für Admins bei fehlgeschlagenen Automations-Runs

## Ist-Zustand
- Fehlgeschlagene Runs werden in `automation_rule_runs` mit `status = 'failed'` und `error_message` gespeichert
- Admins sehen Fehler nur, wenn sie aktiv die Run-Historie im Admin-Bereich öffnen
- Keine proaktive Benachrichtigung

## Lösung: Zwei Teile

### 1. Backend: Notification an Tenant-Admins bei Fehler (Edge Function)
Im `catch`-Block von `run-automation-rule/index.ts` (Zeile 424-450) nach dem Schreiben des Fehler-Logs zusätzlich:
- Alle aktiven Tenant-Admins aus `user_tenant_memberships` laden (role = 'abgeordneter')
- Für jeden Admin `create_notification` RPC aufrufen mit:
  - `type_name: 'automation_run_failed'`
  - `data`: `{ rule_name, rule_id, run_id, error_message }`
  - `navigation_context: 'admin/automation'`

Dafür muss ein neuer Notification-Typ `automation_run_failed` in der DB angelegt werden.

### 2. Frontend: Fehler-Banner in der Regelliste
In `AutomationRulesManager.tsx` oberhalb der Regelliste ein kompaktes Alert-Banner einbauen, wenn es kürzlich fehlgeschlagene Runs gibt (aus den bereits geladenen `runs`-Daten). Zeigt Anzahl + Link zum Filtern der Run-Historie auf "Failed".

### 3. Deep-Link aus Notification
In `notificationDeepLinks.ts` einen neuen Case `automation_run_failed` hinzufügen, der auf `/admin?tab=automation&filter=failed` verweist (oder den passenden Admin-Pfad).

## Dateien

| Datei | Änderung |
|-------|----------|
| Migration SQL | Neuer Notification-Typ `automation_run_failed` |
| `supabase/functions/run-automation-rule/index.ts` | Admin-Notifications im catch-Block |
| `src/components/administration/AutomationRulesManager.tsx` | Fehler-Banner |
| `src/utils/notificationDeepLinks.ts` | Deep-Link Case |

