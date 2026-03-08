

## Empfohlene nächste Schritte (nach Priorität)

### 1. Kill-Switch für Tenant-Automations (Quick Win)

Ein Toggle im Admin-Header des Automatisierungs-Bereichs, der alle Regeln eines Tenants pausiert/reaktiviert.

- Neues Feld `automations_paused` in `tenants`-Tabelle (boolean, default false)
- Toggle-Button im `AutomationRulesManager`-Header
- `run-automation-rule` und `run-scheduled-automation-rules` prüfen dieses Flag vor Ausführung
- ~30 Zeilen Code + 1 Migration

### 2. Fehler-Alerts für Admins (Quick Win)

Wenn ein Run fehlschlägt, automatisch eine In-App-Notification an Tenant-Admins senden.

- Bereits im `run-automation-rule` Backend bei Fehler implementiert (Zeile 518ff erstellt Notification)
- Prüfen ob das korrekt funktioniert, ggf. erweitern um Push-Notification
- Im Admin-UI: Fehlerhafte Runs rot hervorheben, Filter "Nur Fehler" prominenter machen

### 3. DB-Trigger für `record_changed` (Komplex)

Postgres-Trigger + `pg_net` Extension, der bei Änderungen an tasks/decisions/meetings die Edge Function aufruft.

- `pg_net` Extension aktivieren
- Postgres-Trigger-Funktionen für relevante Tabellen erstellen
- HTTP-Call an `run-automation-rule` mit geändertem Record als Payload
- Condition-Matching im Backend erweitern um Feld-Vergleiche gegen tatsächliche Daten
- Aufwand: ~2 Sprints, höchstes Risiko

### 4. Rule-Versionierung & Import/Export (Phase 4)

- Versionstabelle `automation_rule_versions` mit Snapshots bei jeder Änderung
- JSON-Export/Import Button im Admin-UI

---

### Empfehlung

**Kill-Switch** und **Fehler-Alerts** sind schnelle Wins mit hohem Betriebsnutzen. Der DB-Trigger ist das Feature mit dem größten Impact, aber auch dem höchsten Aufwand.

Soll ich mit dem **Kill-Switch** starten?

