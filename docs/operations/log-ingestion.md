# Log ingestion reduction

The status runtime is mounted once below auth/tenant/query providers. Activity remains
local, with a persisted heartbeat at most once per five minutes per mounted runtime.
Automatic away remains ten minutes. Multiple browser tabs each have their own runtime.
Profile metadata is cached for five minutes; presence sync uses the status already
contained in presence payloads instead of fetching statuses again. All clients in a
tenant share one presence channel. Heartbeat-only updates do not retrack presence.

Routine success/idle logs were removed from scheduled emails, meeting reminders,
external calendar sync, RSS fetching, daily appointment feedback and morning greetings.
Warnings and errors remain available.

## Zweite Stufe: kein Aufruf ohne Arbeit

Die verbleibenden geplanten HTTP-Aufrufe prüfen ihre Fälligkeit jetzt in SQL,
bevor sie eine Edge Function starten (`20261125240000_log_ingestion_cron_gates.sql`).
Jeder vermiedene Aufruf spart einen kompletten Log-Satz aus Boot, Request und
Execution – die Function wäre bei diesen Läufen ohnehin ohne Ergebnis
zurückgekehrt.

Der Cron-Befehl enthält dafür nur noch zwei Angaben: die Function und die
Fälligkeitsfrage. Vault-Zugang und HTTP-POST liegen einmal in
`automation_private.dispatch_edge_function()`; `dispatch_edge_function_if_due()`
überspringt den Aufruf, wenn nichts fällig ist. Zusätzliche Header wie
`x-automation-secret` nennen nur den Vault-Namen des Secrets – der Wert steht
weder im Cron-Befehl noch in einer Migration.

Die Fälligkeitsprüfungen sind private SQL-Funktionen, die die bestehenden Regeln
mitbenutzen, statt sie zu kopieren:

| Prüfung | Nutzt |
| --- | --- |
| `get_due_appointment_reminders()` | dasselbe Prädikat, aus dem `dispatch_due_appointment_reminders()` seine Kandidaten liest |
| `has_due_poll_followups()` | `get_due_poll_followups()` |
| `is_calendar_sync_slot_due()` | `calendar_sync_slot()`; auch `claim_calendar_sync()` prüft damit |
| `has_case_escalation_candidate()` | Schwellen aus `suggest-case-escalations` |
| `has_pending_morning_greeting()` | `matrix_morning_settings` / `matrix_bot_logs` |

Erinnerungsfenster, Slot-Vergleich, Übernahme-Frist und Abstände existieren damit
je einmal in SQL. `automation_private` ist für Clients gesperrt: keine neuen
public-Funktionen, keine neuen Katalogeinträge und keine Änderung am fachlichen
Funktionsumfang.

| Cron-Job | Takt | Aufrufe/Tag vorher | Aufruf nur noch, wenn … |
| --- | --- | ---: | --- |
| `dispatch-appointment-reminders` | 5 min | 288 | eine Terminerinnerung fällig und noch nicht verbucht ist |
| `poll-answer-followups` | 30 min | 48 | `get_due_poll_followups()` eine Abstimmung liefert |
| `auto-sync-external-calendars` | stündlich | 24 | ein Slot fällig ist **und** ein aktiver Kalender existiert |
| `suggest-case-escalations-hourly` | stündlich | 24 | ein offener Vorgang ohne Akte einen Eskalationsgrund hat |
| `matrix-morning-greetings` | stündlich | 24 | ein aktiver Gruß in dieser Berliner Stunde noch aussteht |
| `matrix-morning-greeting-hourly` | 6–12 Uhr | 7 | entfällt – war ein Duplikat des stündlichen Jobs |

Das sind rund 415 Function-Aufrufe pro Tag, die auf die tatsächlich anfallende
Arbeit zusammenschrumpfen. Keine Prüfung ist enger als die Function selbst: Sie
sind Über-Approximationen und lassen höchstens einen Lauf aus, wenn nichts
fällig ist. Kurze Vorlaufzeiten (5/10 Minuten) brauchen weiterhin den
5-Minuten-Takt; deshalb wurde der Takt nicht gestreckt, sondern die Bedingung
vorgezogen.

Zusätzlich entfallen Routine-Erfolgslogs in `auto-sync-calendars` (Start,
Mandanten-/Kalenderzahlen, jeder synchronisierte Kalender, Gesamtergebnis) und
der Abschluss-Statistiklog in `send-matrix-morning-greeting`. Fehler und
Warnungen bleiben unverändert erhalten.

## Rollout

1. Deploy the frontend from main.
2. Ensure Supabase Vault contains `supabase_url` (or `project_url`) and
   `service_role_key` (or `SUPABASE_SERVICE_ROLE_KEY`). Never use an anon key for
   the service-role-protected email endpoint.
3. Apply `20261115120000_reduce_log_ingestion.sql` through the usual migration process.
   It removes email endpoint jobs by name/command, creates one five-minute dispatcher,
   and skips HTTP invocations when no email is due. Missing Vault credentials cause
   an explicit error when emails are due. The dispatcher is not callable by clients.
4. Deploy the six modified Edge Functions.
5. Apply `20261125240000_log_ingestion_cron_gates.sql` as `postgres`. It creates
   the shared helpers in `automation_private`, replaces the command of the five
   scheduled HTTP jobs with a due check, removes the duplicate morning-greeting
   job and is repeatable. It also rebuilds `dispatch_due_appointment_reminders()`
   and `claim_calendar_sync()` with the same behaviour, now reading the shared
   due checks. Missing Vault credentials raise an explicit error once work is
   actually due, instead of an invalid URL being posted to every tick.
6. Deploy the two log-trimmed Edge Functions (`auto-sync-calendars`,
   `send-matrix-morning-greeting`).

The migration changes knowledge-review and employee-preparation scans from 15 to
30 minutes only when their existing schedule matches. Email delivery, meeting
reminders and dependent routine execution keep their cadence.

No live Supabase logs, cron catalog or Vault configuration were accessible during
implementation. No tests were run at the user's request. The historical sample is
request-count data, not ingested bytes; percentage savings remain unverified.
After rollout, compare ingested bytes and endpoint counts over comparable usage
windows. The second stage should show a sharp drop in invocations of the six
scheduled endpoints; the counts above are tick arithmetic, not measured bytes.
Check for remaining 403 responses and inspect their actual callers before
changing any authentication policy. Existing email processing has no new atomic
claiming; separate concurrent manual calls are outside this cron cleanup.

## Permission denied for table job

Run the migration in the SQL editor with the `postgres` database role. Cron's
functions can require write privileges on `cron.job`, even if listing jobs works.
The migration explicitly grants SELECT/INSERT/UPDATE/DELETE to `postgres` before
changing jobs; it does not grant cron access to application roles.

If that GRANT itself fails, a table owner or administrator with grant option must
execute it. Do not bypass the error by swallowing it or creating another email
job: that would leave the duplicate schedules active. Once privileges are restored,
rerun the complete migration. A failed DO block rolls back all of its cron changes.
