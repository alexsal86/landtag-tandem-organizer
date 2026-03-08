

# Nächste Verbesserungen für den No-Code Automations-Hub

## Was bereits gebaut ist (Bestandsaufnahme)

- 4-Step Wizard (Grundlagen → Trigger → Bedingungen → Aktionen)
- 10 Templates, Template-Galerie mit Suche/Filter
- Kill-Switch, Dry-Run, Run-Now, Run-Historie mit Step-Logs
- Error-Dashboard mit Retry, Regel-Versionierung, Import/Export
- Rate Limiting, Idempotency, Audit-Trail
- 5 Action-Typen, 5 Condition-Operators, 3 Trigger-Typen
- Rollenbasierte Zugriffskontrolle

## Was noch fehlt (priorisiert nach Nutzen)

### 1. Regel duplizieren / klonen (Quick Win)
Ein "Duplizieren"-Button pro Regel, der die bestehende Konfiguration in den Wizard lädt (ohne `editingRuleId`), sodass eine Kopie erstellt wird. Spart Zeit beim Erstellen ähnlicher Regeln.

**Änderung:** `AutomationRulesManager.tsx` — neuer Button neben "Bearbeiten", ruft `startEdit`-ähnliche Logik auf, setzt aber `editingRuleId = null`.

### 2. Nächste geplante Ausführung anzeigen
Für `schedule`-Regeln die **nächste Ausführungszeit** berechnen und in der Regel-Karte anzeigen. Basierend auf `trigger_config.minutes_interval` und letztem Run.

**Änderung:** `AutomationRulesManager.tsx` — kleine Hilfsfunktion `getNextRunTime(rule, runs)`, Anzeige als Badge/Text in der Regel-Karte.

### 3. Regel-Statistiken (Erfolgsrate, Durchschnittslaufzeit)
Pro Regel eine kompakte Statistik-Zeile: Erfolgsrate (%), letzte 10 Runs, Durchschnittsdauer.

**Änderung:** `AutomationRulesManager.tsx` — `useMemo` über `runs` gruppiert nach `rule_id`, Anzeige als kleine Badges unter dem Regelnamen.

### 4. Webhook-Trigger-Typ
Neuer Trigger `webhook` — generiert eine eindeutige URL pro Regel, die extern aufgerufen werden kann. Passt zum bestehenden `trigger_type`-System.

**Änderungen:**
- `AutomationRuleWizard.tsx` — `TRIGGER_TYPES` um `webhook` erweitern, UI zeigt generierte URL
- `run-automation-rule/index.ts` — Webhook-Authentifizierung (shared secret per rule)
- Neue Edge Function `automation-webhook` als Eingangstor

### 5. "Warum wurde das ausgelöst?" — Deep-Link in Notifications
Bereits teilweise vorhanden (NotificationsPage hat Link auf `?tab=automation`). Fehlt: **In der Notification selbst** einen erklärenden Text ("Ausgelöst durch Regel X weil Y"), der beim Erstellen der Notification aus dem Run-Kontext befüllt wird.

**Änderung:** `run-automation-rule/index.ts` — beim `create_notification`-Action den `data`-Payload um `rule_name`, `trigger_reason`, `run_id` erweitern.

---

## Empfohlene Reihenfolge

| Nr | Feature | Aufwand | Dateien |
|----|---------|---------|---------|
| 1 | Regel duplizieren | Klein | 1 |
| 2 | Nächste Ausführung | Klein | 1 |
| 3 | Regel-Statistiken | Klein | 1 |
| 5 | Notification-Kontext | Mittel | 1 Edge Fn |
| 4 | Webhook-Trigger | Groß | 3+ Dateien + neue Edge Fn |

Empfehlung: **1–3 zusammen** als Quick-Win-Batch, dann 5, dann 4.

