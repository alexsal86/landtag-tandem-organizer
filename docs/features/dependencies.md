# Modulübergreifende Abhängigkeiten

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

## Funktionsabhängigkeiten

| Funktion | hängt ab von |
|---|---|
| `mywork.dashboard.today-priorities` | `mywork.dashboard` |
| `mywork.dashboard.today-priorities` | `appointments.briefing` |
| `mywork.dashboard.today-priorities` | `appointments.debrief` |
| `mywork.tabs` | `mywork.dashboard` |
| `quicknotes.checklists` | `quicknotes.manage` |
| `quicknotes.drag-sort` | `quicknotes.manage` |
| `quicknotes.page` | `quicknotes.manage` |
| `profile.edit` | `platform.auth` |
| `tasks.edit` | `tasks.create` |
| `tasks.complete` | `tasks.create` |
| `tasks.assign` | `tasks.create` |
| `tasks.assign` | `tasks.ball-owner` |
| `tasks.handover-stafette` | `tasks.ball-owner` |
| `tasks.handover-stafette` | `tasks.create` |
| `tasks.ball-owner` | `tasks.create` |
| `tasks.deadline` | `tasks.create` |
| `tasks.snooze` | `tasks.create` |
| `tasks.subtasks` | `tasks.create` |
| `tasks.link-decision` | `tasks.create` |
| `tasks.link-decision` | `decisions.create` |
| `tasks.link-case` | `cases.steps` |
| `tasks.link-case` | `tasks.create` |
| `tasks.link-document` | `tasks.create` |
| `tasks.link-document` | `documents.upload-version` |
| `tasks.recurring` | `tasks.create` |
| `tasks.templates` | `tasks.create` |
| `tasks.archive` | `tasks.create` |
| `tasks.archive` | `tasks.complete` |
| `tasks.search-filter` | `tasks.create` |
| `tasks.nudge` | `tasks.create` |
| `tasks.nudge` | `tasks.ball-owner` |
| `tasks.annual` | `tasks.create` |
| `automation.conditions` | `automation.rules` |
| `automation.rule-validation` | `automation.rules` |
| `automation.rule-validation` | `automation.conditions` |
| `automation.rule-versions` | `automation.rules` |
| `automation.runs` | `automation.rules` |
| `automation.annual-routines` | `tasks.annual` |
| `automation.office-packages` | `automation.annual-routines` |
| `automation.office-packages` | `automation.routine-packages` |
| `automation.office-packages` | `tasks.annual` |
| `automation.routine-packages` | `tasks.create` |
| `automation.task-packages` | `tasks.create` |
| `automation.scheduler` | `automation.rules` |
| `automation.scheduler` | `integration.email` |
| `automation.webhooks` | `automation.rules` |
| `automation.templates` | `automation.rules` |
| `documents.details` | `documents.list` |
| `documents.contacts` | `contacts.create` |
| `documents.email` | `documents.upload-version` |
| `documents.email` | `integration.email` |
| `annotations.create` | `documents.upload-version` |
| `annotations.history` | `annotations.create` |
| `annotations.tasks` | `tasks.create` |
| `annotations.tasks` | `annotations.create` |
| `annotations.ocr` | `documents.upload-version` |
| `annotations.export` | `annotations.create` |
| `annotations.relocate` | `annotations.create` |
| `annotations.relocate` | `documents.upload-version` |
| `letters.workflow` | `letters.create` |
| `letters.archive` | `letters.workflow` |
| `letters.archive` | `tasks.create` |
| `letters.export` | `letters.create` |
| `letters.collaboration` | `letters.create` |
| `letters.attachments` | `letters.create` |
| `decisions.participants` | `decisions.create` |
| `decisions.vote` | `decisions.participants` |
| `decisions.withdraw-vote` | `decisions.vote` |
| `decisions.change-vote` | `decisions.vote` |
| `decisions.comments` | `decisions.create` |
| `decisions.notification-digest` | `decisions.comments` |
| `decisions.daily-digest` | `decisions.notification-digest` |
| `decisions.inbox-hygiene` | `decisions.notification-digest` |
| `decisions.notification-email` | `decisions.notification-digest` |
| `decisions.deadline-reminders` | `decisions.notification-digest` |
| `decisions.creator-deadline-warnings` | `decisions.deadline-reminders` |
| `decisions.digest-items` | `decisions.notification-digest` |
| `decisions.result-summary` | `decisions.notification-digest` |
| `decisions.notification-actions` | `decisions.vote` |
| `decisions.attachments` | `decisions.create` |
| `decisions.remind` | `decisions.create` |
| `decisions.archive` | `decisions.vote` |
| `decisions.email` | `decisions.create` |
| `decisions.email` | `integration.email` |
| `decisions.matrix` | `decisions.vote` |
| `redaktion.planner` | `redaktion.themenspeicher` |
| `redaktion.approval` | `redaktion.planner` |
| `redaktion.assets-campaigns` | `redaktion.planner` |
| `redaktion.calendar-reminders` | `redaktion.planner` |
| `press.ghost` | `press.releases` |
| `news.email` | `news.articles` |
| `news.email` | `integration.email` |
| `news.matrix` | `news.articles` |
| `chat.matrix-bot` | `chat.messages` |
| `chat.team-announcements` | `chat.messages` |
| `contacts.edit` | `contacts.create` |
| `contacts.detail` | `contacts.create` |
| `contacts.archive` | `contacts.detail` |
| `contacts.list-search` | `contacts.create` |
| `contacts.import` | `contacts.create` |
| `contacts.duplicates` | `contacts.create` |
| `contacts.merge` | `contacts.create` |
| `contacts.merge` | `contacts.edit` |
| `contacts.distribution-lists` | `contacts.create` |
| `contacts.stakeholders` | `contacts.create` |
| `contacts.tags-topics` | `contacts.create` |
| `contacts.tags-topics` | `topics.manage` |
| `contacts.privacy` | `contacts.create` |
| `contacts.bulk` | `contacts.create` |
| `contacts.activities` | `contacts.create` |
| `contacts.briefing-memory` | `appointments.briefing` |
| `contacts.fundings` | `contacts.create` |
| `employees.protocol` | `employees.meetings` |
| `employees.action-tasks` | `tasks.create` |
| `employees.action-tasks` | `employees.protocol` |
| `employees.action-tasks` | `employees.meetings` |
| `employees.preparation` | `employees.meetings` |
| `employees.review` | `employees.meetings` |
| `employees.wellbeing` | `employees.meetings` |
| `employees.requests` | `employees.meetings` |
| `employees.export-stats` | `employees.protocol` |
| `employees.export-stats` | `employees.meetings` |
| `hr.onboarding` | `hr.templates` |
| `hr.onboarding` | `tasks.create` |
| `hr.onboarding` | `automation.routine-packages` |
| `hr.offboarding` | `tasks.create` |
| `hr.offboarding` | `automation.routine-packages` |
| `responsibilities.suggest` | `responsibilities.matrix` |
| `responsibilities.coverage` | `responsibilities.matrix` |
| `timetracking.admin` | `timetracking.entries` |
| `timetracking.annual-tasks` | `tasks.annual` |
| `timetracking.annual-tasks` | `automation.annual-routines` |
| `meetings.agenda` | `meetings.jour-fixe` |
| `meetings.protocol` | `meetings.agenda` |
| `meetings.protocol` | `tasks.create` |
| `meetings.decisions` | `meetings.agenda` |
| `meetings.decisions` | `decisions.create` |
| `meetings.archive` | `meetings.protocol` |
| `meetings.archive` | `tasks.create` |
| `meetings.templates` | `meetings.agenda` |
| `meetings.zombie-points` | `meetings.agenda` |
| `dossiers.entries` | `dossiers.manage` |
| `dossiers.links-stakeholders` | `dossiers.manage` |
| `dossiers.links-stakeholders` | `contacts.create` |
| `dossiers.talking-points` | `dossiers.manage` |
| `dossiers.capture-radar` | `dossiers.manage` |
| `dossiers.sources` | `dossiers.manage` |
| `dossiers.search` | `dossiers.manage` |
| `topics.convert-catalog` | `topics.manage` |
| `topics.convert-catalog` | `responsibilities.matrix` |
| `topics.ministry-cloud` | `topics.manage` |
| `integration.calendar-sync` | `calendar.create-appointment` |
| `integration.ics` | `calendar.create-appointment` |
| `integration.email` | `admin.templates-senders` |
| `integration.push` | `platform.notification-dispatch` |
| `integration.geocoding` | `contacts.create` |
| `calendar.create-appointment` | `calendar.categories-locations` |
| `calendar.edit-move` | `calendar.create-appointment` |
| `calendar.guests` | `calendar.create-appointment` |
| `calendar.reminders` | `calendar.create-appointment` |
| `calendar.invitations` | `calendar.guests` |
| `calendar.invitations` | `integration.email` |
| `appointments.requests` | `calendar.create-appointment` |
| `appointments.briefing` | `tasks.create` |
| `appointments.briefing` | `integration.ai-suggestions` |
| `appointments.briefing-live` | `appointments.briefing` |
| `appointments.briefing-live` | `integration.transcription` |
| `appointments.debrief` | `appointments.briefing` |
| `appointments.feedback` | `calendar.create-appointment` |
| `appointments.preparation` | `appointments.briefing` |
| `appointments.preparation` | `integration.ai-suggestions` |
| `appointments.jour-fixe` | `meetings.agenda` |
| `calendar.polls` | `polls.manage` |
| `events.checklist` | `events.plan` |
| `events.checklist` | `tasks.create` |
| `events.speakers-documents` | `events.plan` |
| `events.speakers-documents` | `documents.upload-version` |
| `events.invitations` | `events.plan` |
| `events.invitations` | `integration.email` |
| `events.rsvp-public` | `events.plan` |
| `events.legacy-rsvp` | `events.plan` |
| `polls.respond` | `polls.manage` |
| `polls.availability` | `polls.manage` |
| `admin.workspace` | `admin.roles` |
| `admin.system-pulse` | `admin.security-cockpit` |
| `admin.system-pulse` | `admin.selftest-center` |
| `cases.triage` | `cases.create` |
| `cases.handover` | `cases.triage` |
| `cases.handover` | `responsibilities.suggest` |
| `cases.steps` | `tasks.link-case` |
| `cases.steps` | `cases.create` |
| `cases.steps` | `tasks.create` |
| `cases.interactions` | `cases.create` |
| `cases.interactions` | `contacts.create` |
| `cases.timeline` | `cases.create` |
| `cases.link-appointment` | `cases.create` |
| `cases.link-appointment` | `calendar.create-appointment` |
| `cases.link-letter` | `letters.create` |
| `cases.link-letter` | `cases.create` |
| `cases.link-decision` | `cases.create` |
| `cases.link-decision` | `decisions.create` |
| `cases.escalation` | `cases.triage` |
| `cases.close-archive` | `cases.steps` |
| `cases.close-archive` | `cases.interactions` |
| `casefiles.status-workflow` | `casefiles.manage` |
| `casefiles.links` | `casefiles.manage` |
| `casefiles.links` | `documents.upload-version` |
| `casefiles.links` | `contacts.create` |
| `casefiles.document-upload` | `casefiles.links` |
| `casefiles.document-upload` | `documents.list` |
| `casefiles.document-upload` | `documents.details` |
| `casefiles.notes` | `casefiles.manage` |
| `election.analysis-navigation` | `election.analysis` |
| `election.analysis-map` | `election.analysis` |
| `election.analysis-map` | `election.history.districts-geometry` |
| `election.turnout` | `election.analysis` |
| `election.seat-distribution` | `election.analysis` |
| `election.deputy-results` | `election.analysis` |
| `election.state-history` | `election.analysis` |
| `election.research-workbench` | `election.analysis` |
| `election.map` | `election.districts-import` |
| `election.history.mandates` | `election.history.periods` |
| `election.history.mandates` | `election.history.people` |
| `election.history.mandates` | `election.history.districts-geometry` |
| `election.history.mandates` | `election.history.factions` |
| `election.history.candidacies` | `election.history.periods` |
| `election.history.candidacies` | `election.history.people` |
| `election.history.people` | `election.history.periods` |
| `election.history.state-lists` | `election.history.periods` |
| `election.history.state-lists` | `election.history.people` |
| `election.history.state-lists` | `election.history.factions` |
| `election.history.quality` | `election.history.periods` |
| `election.history.audit` | `election.history.quality` |
| `election.history.assembly` | `election.history.candidacies` |
| `election.history.assembly` | `election.history.mandates` |
| `election.history.districts-geometry` | `election.history.periods` |
| `election.history.portraits` | `election.history.people` |
| `knowledge.answer` | `knowledge.ask` |
| `knowledge.short-answer` | `knowledge.answer` |
| `knowledge.review` | `knowledge.answer` |
| `knowledge.review` | `tasks.create` |
| `knowledge.validity` | `knowledge.answer` |
| `knowledge.tags` | `knowledge.answer` |
| `knowledge.tags` | `topics.manage` |
| `knowledge.sources` | `knowledge.answer` |
| `knowledge.attachments` | `knowledge.ask` |
| `knowledge.comments-follow` | `knowledge.ask` |
| `knowledge.search` | `knowledge.ask` |
| `knowledge.versions` | `knowledge.answer` |
| `knowledge.collaboration` | `knowledge.answer` |
| `knowledge.global-question` | `knowledge.ask` |

## Bereichsübergänge

### arbeitsbereich → termine

- mywork.dashboard.today-priorities → appointments.briefing
- mywork.dashboard.today-priorities → appointments.debrief

### aufgaben → entscheidungen

- tasks.link-decision → decisions.create

### aufgaben → vorgaenge

- tasks.link-case → cases.steps

### aufgaben → dokumente

- tasks.link-document → documents.upload-version

### automation → aufgaben

- automation.annual-routines → tasks.annual
- automation.office-packages → tasks.annual
- automation.routine-packages → tasks.create
- automation.task-packages → tasks.create

### automation → schnittstellen

- automation.scheduler → integration.email

### dokumente → kontakte

- documents.contacts → contacts.create

### dokumente → schnittstellen

- documents.email → integration.email

### dokumente → aufgaben

- annotations.tasks → tasks.create
- letters.archive → tasks.create

### entscheidungen → schnittstellen

- decisions.email → integration.email

### kommunikation → schnittstellen

- news.email → integration.email

### kontakte → organisation

- contacts.tags-topics → topics.manage

### kontakte → termine

- contacts.briefing-memory → appointments.briefing

### mitarbeit → aufgaben

- employees.action-tasks → tasks.create
- hr.onboarding → tasks.create
- hr.offboarding → tasks.create
- timetracking.annual-tasks → tasks.annual

### mitarbeit → automation

- hr.onboarding → automation.routine-packages
- hr.offboarding → automation.routine-packages
- timetracking.annual-tasks → automation.annual-routines

### organisation → aufgaben

- meetings.protocol → tasks.create
- meetings.archive → tasks.create

### organisation → entscheidungen

- meetings.decisions → decisions.create

### organisation → kontakte

- dossiers.links-stakeholders → contacts.create

### organisation → mitarbeit

- topics.convert-catalog → responsibilities.matrix

### schnittstellen → termine

- integration.calendar-sync → calendar.create-appointment
- integration.ics → calendar.create-appointment

### schnittstellen → verwaltung

- integration.email → admin.templates-senders
- integration.push → platform.notification-dispatch

### schnittstellen → kontakte

- integration.geocoding → contacts.create

### termine → schnittstellen

- calendar.invitations → integration.email
- appointments.briefing → integration.ai-suggestions
- appointments.briefing-live → integration.transcription
- appointments.preparation → integration.ai-suggestions

### termine → aufgaben

- appointments.briefing → tasks.create

### termine → organisation

- appointments.jour-fixe → meetings.agenda

### termine → veranstaltungen

- calendar.polls → polls.manage

### veranstaltungen → aufgaben

- events.checklist → tasks.create

### veranstaltungen → dokumente

- events.speakers-documents → documents.upload-version

### veranstaltungen → schnittstellen

- events.invitations → integration.email

### vorgaenge → mitarbeit

- cases.handover → responsibilities.suggest

### vorgaenge → aufgaben

- cases.steps → tasks.link-case
- cases.steps → tasks.create

### vorgaenge → kontakte

- cases.interactions → contacts.create
- casefiles.links → contacts.create

### vorgaenge → termine

- cases.link-appointment → calendar.create-appointment

### vorgaenge → dokumente

- cases.link-letter → letters.create
- casefiles.links → documents.upload-version
- casefiles.document-upload → documents.list
- casefiles.document-upload → documents.details

### vorgaenge → entscheidungen

- cases.link-decision → decisions.create

### wissen → aufgaben

- knowledge.review → tasks.create

### wissen → organisation

- knowledge.tags → topics.manage

## Gemeinsam genutzte Tabellen

| Tabelle | Bereiche |
|---|---|
| `tasks` | arbeitsbereich, aufgaben, automation, dokumente, entscheidungen, mitarbeit, organisation, schnittstellen, termine, vorgaenge, wissen |
| `notifications` | arbeitsbereich, aufgaben, entscheidungen, schnittstellen, termine, verwaltung, vorgaenge, wissen |
| `case_items` | arbeitsbereich, automation, mitarbeit, organisation, termine, verwaltung, vorgaenge |
| `email_logs` | dokumente, entscheidungen, kommunikation, schnittstellen, termine, veranstaltungen |
| `topics` | dokumente, kontakte, mitarbeit, organisation, vorgaenge, wissen |
| `contacts` | arbeitsbereich, dokumente, kontakte, schnittstellen, verwaltung |
| `profiles` | arbeitsbereich, aufgaben, entscheidungen, verwaltung, wissen |
| `appointments` | arbeitsbereich, schnittstellen, termine, vorgaenge |
| `documents` | aufgaben, dokumente, organisation, vorgaenge |
| `annual_task_completions` | aufgaben, automation, mitarbeit |
| `annual_tasks` | aufgaben, automation, mitarbeit |
| `appointment_preparations` | arbeitsbereich, schnittstellen, termine |
| `audit_log_entries` | kontakte, verwaltung, vorgaenge |
| `bulk_action_audit` | aufgaben, kontakte, verwaltung |
| `external_events` | arbeitsbereich, schnittstellen, termine |
| `letters` | dokumente, schnittstellen, vorgaenge |
| `notification_types` | arbeitsbereich, entscheidungen, vorgaenge |
| `press_releases` | kommunikation, schnittstellen, verwaltung |
| `regions` | kontakte, mitarbeit, organisation |
| `routine_package_runs` | aufgaben, automation, mitarbeit |
| `routine_package_steps` | aufgaben, automation, mitarbeit |
| `task_decisions` | aufgaben, entscheidungen, vorgaenge |
| `topic_module_settings` | organisation, vorgaenge, wissen |
| `appointment_categories` | termine, verwaltung |
| `appointment_contacts` | arbeitsbereich, termine |
| `appointment_polls` | termine, veranstaltungen |
| `appointment_requests` | termine, verwaltung |
| `calendar_sync_settings` | automation, schnittstellen |
| `case_file_contacts` | arbeitsbereich, vorgaenge |
| `case_file_documents` | dokumente, vorgaenge |
| `case_file_tasks` | aufgaben, vorgaenge |
| `case_files` | arbeitsbereich, vorgaenge |
| `case_item_timeline` | aufgaben, vorgaenge |
| `case_item_topics` | organisation, vorgaenge |
| `committees` | mitarbeit, organisation |
| `dashboard_decision_nudges` | aufgaben, entscheidungen |
| `document_categories` | dokumente, verwaltung |
| `document_contacts` | dokumente, kontakte |
| `election_districts` | schnittstellen, wahl |
| `election_history_mandates` | vorgaenge, wahl |
| `email_templates` | schnittstellen, verwaltung |
| `employee_responsibilities` | mitarbeit, organisation |
| `field_permissions` | kontakte, verwaltung |
| `gdpr_requests` | kontakte, verwaltung |
| `knowledge_question_topics` | organisation, wissen |
| `map_layers` | kontakte, wahl |
| `meeting_agenda_items` | organisation, termine |
| `meetings` | organisation, termine |
| `message_confirmations` | arbeitsbereich, kommunikation |
| `news_articles` | kommunikation, verwaltung |
| `parlis_ministry_lines` | organisation, vorgaenge |
| `parlis_ministry_topics` | organisation, vorgaenge |
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
| `task_assignees` | arbeitsbereich, aufgaben |
| `task_categories` | aufgaben, verwaltung |
| `task_decision_participants` | aufgaben, entscheidungen |
| `task_snoozes` | arbeitsbereich, aufgaben |
| `task_statuses` | aufgaben, verwaltung |
| `tenants` | organisation, verwaltung |
| `user_notification_settings` | arbeitsbereich, entscheidungen |
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
| `dispatch-decision-invitations` | entscheidungen |
| `dispatch-decision-notification-emails` | entscheidungen |
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
| `log-auth-failure` | verwaltung |
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
