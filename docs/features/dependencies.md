# Modulübergreifende Abhängigkeiten

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

## Funktionsabhängigkeiten

| Funktion | hängt ab von |
|---|---|
| `mywork.tabs` | `mywork.dashboard` |
| `quicknotes.checklists` | `quicknotes.manage` |
| `quicknotes.drag-sort` | `quicknotes.manage` |
| `profile.edit` | `platform.auth` |
| `tasks.edit` | `tasks.create` |
| `tasks.link-case` | `cases.steps` |
| `annotations.tasks` | `tasks.create` |
| `annotations.export` | `annotations.create` |
| `letters.archive` | `letters.workflow` |
| `letters.archive` | `tasks.create` |
| `contacts.briefing-memory` | `appointments.briefing` |
| `employees.action-tasks` | `tasks.create` |
| `employees.action-tasks` | `employees.protocol` |
| `appointments.preparation` | `appointments.briefing` |
| `admin.workspace` | `admin.roles` |
| `cases.steps` | `tasks.link-case` |
| `cases.link-letter` | `letters.create` |

## Bereichsübergänge

### aufgaben → vorgaenge

- tasks.link-case → cases.steps

### dokumente → aufgaben

- annotations.tasks → tasks.create
- letters.archive → tasks.create

### kontakte → termine

- contacts.briefing-memory → appointments.briefing

### mitarbeit → aufgaben

- employees.action-tasks → tasks.create

### vorgaenge → aufgaben

- cases.steps → tasks.link-case

### vorgaenge → dokumente

- cases.link-letter → letters.create

## Gemeinsam genutzte Tabellen

| Tabelle | Bereiche |
|---|---|
| `tasks` | aufgaben, automation, dokumente, entscheidungen, mitarbeit, organisation, schnittstellen, termine, vorgaenge, wissen |
| `case_items` | automation, mitarbeit, organisation, termine, verwaltung, vorgaenge |
| `email_logs` | dokumente, entscheidungen, kommunikation, schnittstellen, termine, veranstaltungen |
| `notifications` | arbeitsbereich, aufgaben, schnittstellen, termine, verwaltung, wissen |
| `contacts` | dokumente, kontakte, schnittstellen, verwaltung |
| `profiles` | arbeitsbereich, aufgaben, verwaltung, wissen |
| `topics` | kontakte, mitarbeit, organisation, wissen |
| `annual_task_completions` | aufgaben, automation, mitarbeit |
| `annual_tasks` | aufgaben, automation, mitarbeit |
| `appointments` | schnittstellen, termine, vorgaenge |
| `audit_log_entries` | kontakte, verwaltung, vorgaenge |
| `bulk_action_audit` | aufgaben, kontakte, verwaltung |
| `documents` | aufgaben, dokumente, organisation |
| `letters` | dokumente, schnittstellen, vorgaenge |
| `press_releases` | kommunikation, schnittstellen, verwaltung |
| `regions` | kontakte, mitarbeit, organisation |
| `routine_package_runs` | aufgaben, automation, mitarbeit |
| `routine_package_steps` | aufgaben, automation, mitarbeit |
| `task_decisions` | aufgaben, entscheidungen, vorgaenge |
| `appointment_categories` | termine, verwaltung |
| `appointment_polls` | termine, veranstaltungen |
| `appointment_preparations` | schnittstellen, termine |
| `appointment_requests` | termine, verwaltung |
| `calendar_sync_settings` | automation, schnittstellen |
| `case_file_tasks` | aufgaben, vorgaenge |
| `case_item_timeline` | aufgaben, vorgaenge |
| `committees` | mitarbeit, organisation |
| `dashboard_decision_nudges` | aufgaben, entscheidungen |
| `document_categories` | dokumente, verwaltung |
| `document_contacts` | dokumente, kontakte |
| `election_districts` | schnittstellen, wahl |
| `email_templates` | schnittstellen, verwaltung |
| `employee_responsibilities` | mitarbeit, organisation |
| `external_events` | schnittstellen, termine |
| `field_permissions` | kontakte, verwaltung |
| `map_layers` | kontakte, wahl |
| `meeting_agenda_items` | organisation, termine |
| `meetings` | organisation, termine |
| `message_confirmations` | arbeitsbereich, kommunikation |
| `news_articles` | kommunikation, verwaltung |
| `party_associations` | kontakte, wahl |
| `poll_participants` | termine, veranstaltungen |
| `poll_time_slots` | termine, veranstaltungen |
| `protocol_sessions` | organisation, wahl |
| `protocol_speeches` | organisation, wahl |
| `push_subscriptions` | schnittstellen, verwaltung |
| `quick_notes` | arbeitsbereich, schnittstellen |
| `scheduled_emails` | automation, schnittstellen |
| `sender_information` | dokumente, verwaltung |
| `social_assets` | kommunikation, schnittstellen |
| `system_health` | schnittstellen, verwaltung |
| `task_categories` | aufgaben, verwaltung |
| `task_decision_participants` | aufgaben, entscheidungen |
| `task_snoozes` | arbeitsbereich, aufgaben |
| `task_statuses` | aufgaben, verwaltung |
| `user_sessions` | arbeitsbereich, verwaltung |
| `user_tenant_memberships` | arbeitsbereich, verwaltung |
| `workflow_runs` | automation, verwaltung |

## Edge Functions nach Bereich

| Edge Function | Bereiche |
|---|---|
| `analyze-parliament-protocol` | wahl |
| `archive-letter` | dokumente |
| `auto-archive-decisions` | entscheidungen |
| `auto-sync-calendars` | schnittstellen |
| `automation-webhook` | automation |
| `batch-geocode-contacts` | schnittstellen |
| `check-egress-anomaly` | schnittstellen |
| `check-meeting-reminders` | organisation |
| `collect-egress-metrics` | schnittstellen |
| `create-admin-user` | verwaltung |
| `create-daily-appointment-feedback` | termine |
| `create-demo-users` | verwaltung |
| `detect-appointment-district` | termine |
| `dispatch-mobile-push` | schnittstellen |
| `execute-annual-tasks` | automation |
| `extract-photo-data` | wahl |
| `fetch-karlsruhe-districts` | wahl |
| `fetch-rss-feeds` | automation |
| `force-resync-calendar` | schnittstellen |
| `gdpr-process` | verwaltung |
| `generate-calendar-invite` | schnittstellen, termine |
| `generate-preparation-suggestions` | schnittstellen, termine |
| `geocode-contact-address` | schnittstellen |
| `get-poll-by-token` | veranstaltungen |
| `get-public-event-invitation` | veranstaltungen |
| `global-logout` | verwaltung |
| `ics-validation` | schnittstellen |
| `import-administrative-boundaries` | wahl |
| `import-election-districts` | wahl |
| `import-karlsruhe-districts` | wahl |
| `import-party-associations` | wahl |
| `import-representatives` | wahl |
| `knowledge-collaboration` | wissen |
| `log-audit-event` | verwaltung |
| `manage-tenant-user` | verwaltung |
| `matrix-bot-handler` | kommunikation |
| `matrix-decision-handler` | entscheidungen |
| `process-decision-response` | entscheidungen |
| `process-scheduled-emails` | automation, schnittstellen |
| `propose-task-from-intake` | schnittstellen |
| `publish-to-ghost` | kommunikation |
| `push-notification-worker` | schnittstellen |
| `register-mobile-push-token` | schnittstellen |
| `resend-poll-invitation` | veranstaltungen |
| `reset-user-mfa` | verwaltung |
| `respond-public-event-invitation` | veranstaltungen |
| `run-automation-rule` | automation |
| `run-scheduled-automation-rules` | automation |
| `run-workflow-cron` | automation |
| `save-deputy-portrait` | wahl |
| `search-unsplash` | schnittstellen |
| `selftest-backup-pointer` | verwaltung |
| `send-appointment-invitation` | termine |
| `send-appointment-reminders` | termine |
| `send-checklist-email` | schnittstellen |
| `send-decision-email` | entscheidungen |
| `send-document-email` | dokumente |
| `send-event-invitation` | veranstaltungen |
| `send-matrix-morning-greeting` | kommunikation |
| `send-news-email` | kommunikation |
| `send-news-matrix` | kommunikation |
| `send-poll-followups` | veranstaltungen |
| `send-poll-invitation` | veranstaltungen |
| `send-poll-notifications` | veranstaltungen |
| `send-push-notification` | schnittstellen |
| `social-planner-reminders` | kommunikation |
| `submit-poll-response-by-token` | veranstaltungen |
| `suggest-case-escalations` | vorgaenge |
| `sync-dossier-external-sources` | organisation |
| `sync-external-calendar` | schnittstellen |
| `sync-holidays` | termine |
| `test-rss-feed` | automation |
| `transcribe-voice-note` | schnittstellen |
| `workflow-dispatcher` | automation |

## Bereiche

- `verwaltung` — Administration, Sicherheit & Qualität
- `aufgaben` — Aufgaben & Stafette
- `automation` — Automatisierung & Workflows
- `dokumente` — Dokumente, Briefe & Annotationen
- `entscheidungen` — Entscheidungen
- `schnittstellen` — Externe Schnittstellen
- `organisation` — Jour fixe, Dossiers & Themen
- `kontakte` — Kontakte & Netzwerk
- `arbeitsbereich` — Meine Arbeit & Benachrichtigungen
- `mitarbeit` — Mitarbeit, Personal & Zeit
- `kommunikation` — Redaktion, News & Chat
- `termine` — Termine, Anfragen & Briefings
- `veranstaltungen` — Veranstaltungen & Umfragen
- `vorgaenge` — Vorgänge & Fallakten
- `wahl` — Wahlanalyse & Wahlhistorie
- `wissen` — Wissensbereich
