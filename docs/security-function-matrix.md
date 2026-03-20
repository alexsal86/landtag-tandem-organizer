# Security Function Matrix

Stand: 2026-03-20

Diese Matrix klassifiziert alle Supabase Edge Functions nach Sicherheitsmodell.

## Kategorien

- **authenticated**: `verify_jwt = true` (Standard für user-getriggerte Aufrufe).
- **internal-scheduled**: `verify_jwt = false`, Aufruf ausschließlich durch Scheduler/Cron oder internen Worker.
- **public-webhook**: `verify_jwt = false`, aber zusätzlicher Secret-/Signatur-Check erforderlich.
- **public-readonly**: `verify_jwt = false`, bewusst öffentlich und ohne privilegierte Schreiboperationen.

## Matrix

| Function | verify_jwt | Kategorie | Zusätzlicher Schutz / Hinweis |
|---|---:|---|---|
| fetch-karlsruhe-districts | false | public-readonly | Externe Datenabfrage, keine Benutzerkontext-Abhängigkeit |
| auto-archive-decisions | false | internal-scheduled | Nur als interner Job betreiben |
| send-poll-invitation | true | authenticated | JWT erforderlich |
| resend-poll-invitation | true | authenticated | JWT erforderlich |
| send-poll-notifications | true | authenticated | JWT erforderlich |
| send-push-notification | false | internal-scheduled | Push-Worker/Service-Flow; nicht direkt aus Browser exponieren |
| create-demo-users | true | authenticated | JWT erforderlich |
| create-admin-user | true | authenticated | JWT erforderlich |
| sync-external-calendar | true | authenticated | JWT erforderlich |
| auto-sync-calendars | true | authenticated | JWT erforderlich |
| send-decision-email | true | authenticated | JWT erforderlich |
| process-decision-response | false | public-webhook | Öffentliche Gastantworten |
| archive-letter | true | authenticated | JWT erforderlich |
| generate-calendar-invite | true | authenticated | JWT erforderlich |
| send-appointment-invitation | true | authenticated | JWT erforderlich |
| yjs-collaboration | false | public-webhook | Eigener Kollaborationskanal, zusätzlicher serverseitiger Guard empfohlen |
| knowledge-collaboration | false | public-webhook | Eigener Kollaborationskanal, zusätzlicher serverseitiger Guard empfohlen |
| import-election-districts | true | authenticated | JWT erforderlich |
| import-representatives | true | authenticated | JWT erforderlich |
| fetch-rss-feeds | true | authenticated | JWT erforderlich |
| matrix-bot-handler | true | authenticated | JWT erforderlich |
| matrix-decision-handler | false | public-webhook | Matrix-Integration, Endpoint absichern über Signatur/Shared Secret |
| check-meeting-reminders | false | internal-scheduled | Scheduler-Job |
| send-matrix-morning-greeting | false | internal-scheduled | Scheduler-Job |
| reset-user-mfa | true | authenticated | JWT + Rollenprüfung im Code |
| send-document-email | true | authenticated | JWT erforderlich |
| process-scheduled-emails | false | internal-scheduled | Scheduler-Job |
| geocode-contact-address | true | authenticated | JWT erforderlich |
| batch-geocode-contacts | true | authenticated | JWT erforderlich |
| create-daily-appointment-feedback | false | internal-scheduled | Geplanter Cron-Job (`schedule`) |
| log-audit-event | true | authenticated | Auth wird im Code erzwungen (`requireAuth`) |
| execute-annual-tasks | false | internal-scheduled | Geplanter Cron-Job (`schedule`) |
| sync-holidays | false | internal-scheduled | Hintergrund-/Sync-Job |
| manage-tenant-user | true | authenticated | JWT erforderlich |
| publish-to-ghost | true | authenticated | JWT erforderlich |
| send-event-invitation | true | authenticated | JWT erforderlich |
| get-public-event-invitation | false | public-readonly | Lädt RSVP-Gastdaten ausschließlich per `public_code`, validiert Widerruf/Ablauf und begrenzt Zugriffe per einfachem IP-Rate-Limit |
| force-resync-calendar | true | authenticated | JWT + Rollen-/Tenant-Checks im Code |
| global-logout | true | authenticated | JWT erforderlich |
| run-automation-rule | true | authenticated | JWT erforderlich |
| run-scheduled-automation-rules | false | internal-scheduled | Geplanter Cron-Job (`schedule`) |
| automation-webhook | false | public-webhook | Secret-Check pro Regel (`x-webhook-secret`) |

## Policy (verbindlich)

1. **Default ist `verify_jwt = true`.**
2. Jede Ausnahme (`verify_jwt = false`) muss einer Kategorie zugeordnet und dokumentiert sein.
3. `public-webhook` Endpunkte benötigen verpflichtend einen weiteren Schutz (Secret/Signatur/Allowlist).
4. `internal-scheduled` Endpunkte dürfen nicht als allgemeine Browser-API genutzt werden.
