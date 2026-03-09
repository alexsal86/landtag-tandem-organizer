

## Edge Functions `verify_jwt`-Audit & Absicherung

Aktuell haben **18 Functions** `verify_jwt = false` gesetzt. Davon hat nur `log-audit-event` einen funktionierenden Auth-Guard. Die restlichen 17 sind ungeschützt und damit öffentlich aufrufbar.

### Klassifizierung

**Gruppe A — Cron/Interne Trigger** (dürfen nicht von Endnutzern aufgerufen werden):
- `auto-archive-decisions`, `check-meeting-reminders`, `send-matrix-morning-greeting`, `process-scheduled-emails`, `create-daily-appointment-feedback`, `execute-annual-tasks`, `sync-holidays`, `run-scheduled-automation-rules`
- **Maßnahme:** `requireServiceRole(req)` aus `_shared/security.ts` am Anfang prüfen. Supabase Cron sendet automatisch den Service-Role-Key.

**Gruppe B — Token-/Secret-basierte Endpoints** (eigene Auth-Logik):
- `process-decision-response` (Teilnehmer-Token), `automation-webhook` (Webhook-Secret), `matrix-decision-handler` (Matrix-Bot)
- **Maßnahme:** Bestehende Token-Validierung beibehalten, aber `withSafeHandler` wrappen für sichere Fehlerbehandlung. Input-Validierung verschärfen.

**Gruppe C — WebSocket/Collaboration** (benötigen verify_jwt=false wegen Upgrade):
- `yjs-collaboration`, `knowledge-collaboration`
- **Maßnahme:** Intern den JWT aus dem Query-Parameter oder Header manuell validieren via `requireAuth`.

**Gruppe D — Falsch konfiguriert** (sollten verify_jwt=true oder requireAuth haben):
- `send-push-notification`, `fetch-karlsruhe-districts`
- **Maßnahme:** Entweder `verify_jwt = true` setzen oder `requireAuth` Guard einbauen.

### Umsetzungsschritte

1. **Gruppe A (8 Functions):** `requireServiceRole`-Guard + `withSafeHandler` einbauen. Sofort 401 bei fehlendem/falschem Service-Role-Key.

2. **Gruppe B (3 Functions):** `withSafeHandler` wrappen, Stack-Trace-Leaks entfernen, bestehende Auth-Logik validieren.

3. **Gruppe C (2 Functions):** Manuellen `requireAuth`-Check einbauen bevor die WebSocket-Verbindung akzeptiert wird.

4. **Gruppe D (2 Functions):** `verify_jwt = true` in `config.toml` setzen ODER `requireAuth`-Guard einbauen.

5. **`plan.md` aktualisieren:** Punkt 4 ("Edge Functions verify_jwt-Audit") als erledigt markieren.

### Ergebnis

Alle 18 ungesicherten Functions erhalten einen passenden Guard. Keine Function ist mehr ohne Authentifizierung aufrufbar, und keine gibt Stack-Traces an Clients zurück.

