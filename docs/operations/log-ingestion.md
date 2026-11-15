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

The migration changes knowledge-review and employee-preparation scans from 15 to
30 minutes only when their existing schedule matches. Email delivery, meeting
reminders and dependent routine execution keep their cadence.

No live Supabase logs, cron catalog or Vault configuration were accessible during
implementation. No tests were run at the user's request. The historical sample is
request-count data, not ingested bytes; percentage savings remain unverified.
After rollout, compare ingested bytes and endpoint counts over comparable usage
windows. Check for remaining 403 responses and inspect their actual callers before
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
