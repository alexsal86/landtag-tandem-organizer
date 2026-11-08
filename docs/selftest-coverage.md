# Selbsttest-Abdeckung

_Auto-generiert mit `npm run update:selftest-coverage`._

Quelle: `src/integrations/supabase/types.ts`. Die Angaben beschreiben deklarierte Prüfumfänge, keine erfolgreichen Testläufe und keine Code-Coverage.

Von 267 Tabellen haben 29 ein registriertes Szenario. 82 sind als Ausbau offen, 156 ausgenommen und 0 noch nicht eingeordnet. Ausnahmen zählen nicht als bestanden.

## Szenarien

| ID | Titel | Tabellen |
|---|---|---|
| `access-boundaries` | Zugriffsschutz (Bürogrenzen und Entscheiderrolle) | appointment_requests |
| `appointment-briefing-lifecycle` | Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben) | appointments, tasks |
| `appointment-lifecycle` | Termin-Lifecycle (Kalender + Briefing + Feedback) | appointments, appointment_preparations, appointment_feedback |
| `appointment-request-lifecycle` | Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin) | appointment_requests, appointments |
| `case-item-lifecycle` | Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss) | case_items, case_item_interactions, case_item_handover_log, task_decisions, task_decision_participants, task_decision_responses, appointment_requests, day_slips, tasks |
| `contact-lifecycle` | Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche) | contacts, contact_activities |
| `daily-briefing-lifecycle` | Tages-Briefings (Vortag-Regel) | daily_briefings |
| `day-slip-lifecycle` | Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag) | day_slips |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | task_decisions, task_decision_participants |
| `event-planning-lifecycle` | Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline) | event_plannings, event_planning_dates, event_planning_speakers, event_planning_contacts, event_planning_checklist_items, event_planning_timeline_assignments |
| `jour-fixe-platform-integration` | Jour Fixe: Plattformquellen & Stafetten-Abschluss | meetings, meeting_agenda_items, tasks, task_decisions |
| `letter-lifecycle` | Brief-Lifecycle (Entwurf → Prüfung → Freigabe → Archiv und Folgeaufgabe) | letters, letter_attachments, documents, tasks |
| `meeting-lifecycle` | Meeting-Lifecycle (vollständig + Field-Verifikation) | meetings, meeting_agenda_items, meeting_agenda_documents, meeting_participants, appointments, tasks |
| `quick-note-lifecycle` | Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv) | quick_notes, tasks, task_decisions, task_decision_participants |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | tasks, task_decisions |
| `task-stafette-lifecycle` | Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe) | Keine (reine Regeln) |
| `workflow-rules` | Geschäftsregeln (Freigabe, Rollen, Fristen) | Keine (reine Regeln) |

## Tabellen

| Tabelle | Einordnung | Szenarien |
|---|---|---|
| `action_permissions` | Ausstehend | — |
| `admin_status_options` | Ausgenommen (nicht geprüft) | — |
| `annual_task_completions` | Ausstehend | — |
| `annual_tasks` | Ausstehend | — |
| `app_settings` | Ausgenommen (nicht geprüft) | — |
| `appointment_categories` | Ausgenommen (nicht geprüft) | — |
| `appointment_contacts` | Ausgenommen (nicht geprüft) | — |
| `appointment_documents` | Ausgenommen (nicht geprüft) | — |
| `appointment_feedback` | Szenario vorhanden | appointment-lifecycle |
| `appointment_feedback_settings` | Ausgenommen (nicht geprüft) | — |
| `appointment_guests` | Ausgenommen (nicht geprüft) | — |
| `appointment_locations` | Ausgenommen (nicht geprüft) | — |
| `appointment_polls` | Ausgenommen (nicht geprüft) | — |
| `appointment_preparation_documents` | Ausgenommen (nicht geprüft) | — |
| `appointment_preparation_templates` | Ausgenommen (nicht geprüft) | — |
| `appointment_preparations` | Szenario vorhanden | appointment-lifecycle |
| `appointment_requests` | Szenario vorhanden | access-boundaries, appointment-request-lifecycle, case-item-lifecycle |
| `appointment_statuses` | Ausgenommen (nicht geprüft) | — |
| `appointment_topics` | Ausgenommen (nicht geprüft) | — |
| `appointments` | Szenario vorhanden | appointment-briefing-lifecycle, appointment-lifecycle, appointment-request-lifecycle, meeting-lifecycle |
| `archived_tasks` | Ausstehend | — |
| `audit_log_entries` | Ausgenommen (nicht geprüft) | — |
| `automation_rate_limits` | Ausgenommen (nicht geprüft) | — |
| `automation_rule_run_steps` | Ausgenommen (nicht geprüft) | — |
| `automation_rule_runs` | Ausgenommen (nicht geprüft) | — |
| `automation_rule_versions` | Ausgenommen (nicht geprüft) | — |
| `automation_rules` | Ausstehend | — |
| `bulk_action_audit` | Ausgenommen (nicht geprüft) | — |
| `calendar_sync_settings` | Ausgenommen (nicht geprüft) | — |
| `call_logs` | Ausstehend | — |
| `carryover_items` | Ausstehend | — |
| `case_file_appointments` | Ausgenommen (nicht geprüft) | — |
| `case_file_contacts` | Ausgenommen (nicht geprüft) | — |
| `case_file_documents` | Ausgenommen (nicht geprüft) | — |
| `case_file_letters` | Ausgenommen (nicht geprüft) | — |
| `case_file_notes` | Ausgenommen (nicht geprüft) | — |
| `case_file_participants` | Ausgenommen (nicht geprüft) | — |
| `case_file_processing_statuses` | Ausgenommen (nicht geprüft) | — |
| `case_file_status_history` | Ausgenommen (nicht geprüft) | — |
| `case_file_tasks` | Ausgenommen (nicht geprüft) | — |
| `case_file_timeline` | Ausgenommen (nicht geprüft) | — |
| `case_file_topics` | Ausgenommen (nicht geprüft) | — |
| `case_file_types` | Ausgenommen (nicht geprüft) | — |
| `case_files` | Ausstehend | — |
| `case_item_attachments` | Ausstehend | — |
| `case_item_categories` | Ausgenommen (nicht geprüft) | — |
| `case_item_escalation_suggestions` | Ausgenommen (nicht geprüft) | — |
| `case_item_handover_log` | Szenario vorhanden | case-item-lifecycle |
| `case_item_interactions` | Szenario vorhanden | case-item-lifecycle |
| `case_item_participants` | Ausgenommen (nicht geprüft) | — |
| `case_item_timeline` | Ausgenommen (nicht geprüft) | — |
| `case_items` | Szenario vorhanden | case-item-lifecycle |
| `celebration_animations` | Ausgenommen (nicht geprüft) | — |
| `celebration_settings` | Ausgenommen (nicht geprüft) | — |
| `contact_activities` | Szenario vorhanden | contact-lifecycle |
| `contact_briefing_memory` | Ausstehend | — |
| `contact_topics` | Ausgenommen (nicht geprüft) | — |
| `contact_usage_stats` | Ausgenommen (nicht geprüft) | — |
| `contacts` | Szenario vorhanden | contact-lifecycle |
| `daily_briefing_reads` | Ausstehend | — |
| `daily_briefings` | Szenario vorhanden | daily-briefing-lifecycle |
| `dashboard_layouts` | Ausgenommen (nicht geprüft) | — |
| `data_lint_findings` | Ausgenommen (nicht geprüft) | — |
| `day_slips` | Szenario vorhanden | case-item-lifecycle, day-slip-lifecycle |
| `decision_archive_settings` | Ausgenommen (nicht geprüft) | — |
| `decision_email_templates` | Ausgenommen (nicht geprüft) | — |
| `decision_matrix_messages` | Ausgenommen (nicht geprüft) | — |
| `default_appointment_guests` | Ausgenommen (nicht geprüft) | — |
| `distribution_list_members` | Ausgenommen (nicht geprüft) | — |
| `distribution_lists` | Ausstehend | — |
| `district_notes` | Ausstehend | — |
| `district_support_assignments` | Ausstehend | — |
| `document_categories` | Ausgenommen (nicht geprüft) | — |
| `document_contacts` | Ausgenommen (nicht geprüft) | — |
| `document_folders` | Ausstehend | — |
| `document_topics` | Ausgenommen (nicht geprüft) | — |
| `documents` | Szenario vorhanden | letter-lifecycle |
| `dossier_entries` | Ausstehend | — |
| `dossier_links` | Ausgenommen (nicht geprüft) | — |
| `dossier_position_versions` | Ausgenommen (nicht geprüft) | — |
| `dossier_source_watchers` | Ausgenommen (nicht geprüft) | — |
| `dossier_stakeholders` | Ausgenommen (nicht geprüft) | — |
| `dossier_talking_points` | Ausgenommen (nicht geprüft) | — |
| `dossiers` | Ausstehend | — |
| `edge_function_cache` | Ausgenommen (nicht geprüft) | — |
| `egress_anomalies` | Ausgenommen (nicht geprüft) | — |
| `egress_metrics` | Ausgenommen (nicht geprüft) | — |
| `election_district_municipalities` | Ausgenommen (nicht geprüft) | — |
| `election_district_notes` | Ausgenommen (nicht geprüft) | — |
| `election_districts` | Ausstehend | — |
| `election_representatives` | Ausstehend | — |
| `email_logs` | Ausgenommen (nicht geprüft) | — |
| `email_templates` | Ausgenommen (nicht geprüft) | — |
| `employee_meeting_action_items` | Ausstehend | — |
| `employee_meeting_requests` | Ausstehend | — |
| `employee_meetings` | Ausstehend | — |
| `employee_settings` | Ausgenommen (nicht geprüft) | — |
| `employee_settings_history` | Ausgenommen (nicht geprüft) | — |
| `employee_yearly_stats` | Ausgenommen (nicht geprüft) | — |
| `event_email_templates` | Ausgenommen (nicht geprüft) | — |
| `event_planning_action_logs` | Ausgenommen (nicht geprüft) | — |
| `event_planning_checklist_items` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_collaborators` | Ausgenommen (nicht geprüft) | — |
| `event_planning_contacts` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_dates` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_documents` | Ausgenommen (nicht geprüft) | — |
| `event_planning_item_actions` | Ausgenommen (nicht geprüft) | — |
| `event_planning_speakers` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_timeline_assignments` | Szenario vorhanden | event-planning-lifecycle |
| `event_plannings` | Szenario vorhanden | event-planning-lifecycle |
| `event_rsvp_public_links` | Ausgenommen (nicht geprüft) | — |
| `event_rsvps` | Ausgenommen (nicht geprüft) | — |
| `expense_budgets` | Ausgenommen (nicht geprüft) | — |
| `expense_categories` | Ausgenommen (nicht geprüft) | — |
| `expenses` | Ausstehend | — |
| `external_calendars` | Ausstehend | — |
| `external_events` | Ausstehend | — |
| `facts` | Ausstehend | — |
| `field_permissions` | Ausstehend | — |
| `funding_participants` | Ausgenommen (nicht geprüft) | — |
| `fundings` | Ausstehend | — |
| `gdpr_requests` | Ausstehend | — |
| `habit_completions` | Ausstehend | — |
| `habits` | Ausstehend | — |
| `information_blocks` | Ausstehend | — |
| `karlsruhe_districts` | Ausstehend | — |
| `knowledge_document_collaborators` | Ausgenommen (nicht geprüft) | — |
| `knowledge_document_permissions` | Ausgenommen (nicht geprüft) | — |
| `knowledge_document_snapshots` | Ausgenommen (nicht geprüft) | — |
| `knowledge_document_topics` | Ausgenommen (nicht geprüft) | — |
| `knowledge_document_versions` | Ausgenommen (nicht geprüft) | — |
| `knowledge_documents` | Ausstehend | — |
| `leave_requests` | Ausstehend | — |
| `letter_archive_settings` | Ausgenommen (nicht geprüft) | — |
| `letter_attachments` | Szenario vorhanden | letter-lifecycle |
| `letter_collaborators` | Ausgenommen (nicht geprüft) | — |
| `letter_comments` | Ausgenommen (nicht geprüft) | — |
| `letter_occasions` | Ausgenommen (nicht geprüft) | — |
| `letter_template_assets` | Ausgenommen (nicht geprüft) | — |
| `letter_template_settings` | Ausgenommen (nicht geprüft) | — |
| `letter_templates` | Ausgenommen (nicht geprüft) | — |
| `letter_workflow_history` | Ausgenommen (nicht geprüft) | — |
| `letters` | Szenario vorhanden | letter-lifecycle |
| `login_customization` | Ausgenommen (nicht geprüft) | — |
| `map_flag_topics` | Ausgenommen (nicht geprüft) | — |
| `map_flag_types` | Ausgenommen (nicht geprüft) | — |
| `map_flags` | Ausstehend | — |
| `map_layers` | Ausgenommen (nicht geprüft) | — |
| `map_routes` | Ausstehend | — |
| `matrix_bot_logs` | Ausgenommen (nicht geprüft) | — |
| `matrix_morning_settings` | Ausgenommen (nicht geprüft) | — |
| `matrix_subscriptions` | Ausgenommen (nicht geprüft) | — |
| `matrix_widget_callback_requests` | Ausgenommen (nicht geprüft) | — |
| `matrix_widget_improvement_triggers` | Ausgenommen (nicht geprüft) | — |
| `matrix_widget_message_feedback` | Ausgenommen (nicht geprüft) | — |
| `meeting_agenda_documents` | Szenario vorhanden | meeting-lifecycle |
| `meeting_agenda_items` | Szenario vorhanden | jour-fixe-platform-integration, meeting-lifecycle |
| `meeting_participants` | Szenario vorhanden | meeting-lifecycle |
| `meeting_templates` | Ausgenommen (nicht geprüft) | — |
| `meetings` | Szenario vorhanden | jour-fixe-platform-integration, meeting-lifecycle |
| `message_confirmations` | Ausgenommen (nicht geprüft) | — |
| `message_recipients` | Ausgenommen (nicht geprüft) | — |
| `messages` | Ausstehend | — |
| `mobile_push_tokens` | Ausgenommen (nicht geprüft) | — |
| `news_email_templates` | Ausgenommen (nicht geprüft) | — |
| `notification_navigation_mapping` | Ausgenommen (nicht geprüft) | — |
| `notification_types` | Ausgenommen (nicht geprüft) | — |
| `notifications` | Ausstehend | — |
| `parliament_protocols` | Ausstehend | — |
| `party_associations` | Ausstehend | — |
| `planning_item_comments` | Ausgenommen (nicht geprüft) | — |
| `planning_item_documents` | Ausgenommen (nicht geprüft) | — |
| `planning_item_subtasks` | Ausgenommen (nicht geprüft) | — |
| `planning_templates` | Ausgenommen (nicht geprüft) | — |
| `poll_notifications` | Ausstehend | — |
| `poll_participants` | Ausstehend | — |
| `poll_responses` | Ausstehend | — |
| `poll_time_slots` | Ausstehend | — |
| `poll_versions` | Ausgenommen (nicht geprüft) | — |
| `pomodoro_sessions` | Ausstehend | — |
| `preparation_templates` | Ausgenommen (nicht geprüft) | — |
| `press_releases` | Ausstehend | — |
| `profiles` | Ausstehend | — |
| `protocol_agenda_items` | Ausstehend | — |
| `protocol_sessions` | Ausstehend | — |
| `protocol_speeches` | Ausstehend | — |
| `public_holidays` | Ausstehend | — |
| `push_subscriptions` | Ausgenommen (nicht geprüft) | — |
| `quick_note_global_shares` | Ausstehend | — |
| `quick_note_shares` | Ausstehend | — |
| `quick_note_versions` | Ausgenommen (nicht geprüft) | — |
| `quick_note_write_receipts` | Ausgenommen (nicht geprüft) | — |
| `quick_notes` | Szenario vorhanden | quick-note-lifecycle |
| `rss_cache` | Ausgenommen (nicht geprüft) | — |
| `rss_settings` | Ausgenommen (nicht geprüft) | — |
| `rss_sources` | Ausgenommen (nicht geprüft) | — |
| `scheduled_emails` | Ausstehend | — |
| `search_analytics` | Ausgenommen (nicht geprüft) | — |
| `security_audit_snapshots` | Ausgenommen (nicht geprüft) | — |
| `selftest_runs` | Ausgenommen (nicht geprüft) | — |
| `sender_information` | Ausstehend | — |
| `sick_days` | Ausstehend | — |
| `social_approval_comments` | Ausstehend | — |
| `social_assets` | Ausstehend | — |
| `social_campaigns` | Ausstehend | — |
| `social_content_channels` | Ausstehend | — |
| `social_content_item_channels` | Ausstehend | — |
| `social_content_items` | Ausstehend | — |
| `social_content_variants` | Ausstehend | — |
| `social_hashtag_sets` | Ausstehend | — |
| `social_planner_notes` | Ausstehend | — |
| `starred_appointments` | Ausgenommen (nicht geprüft) | — |
| `subtasks` | Ausstehend | — |
| `superadmin_users` | Ausstehend | — |
| `system_health` | Ausgenommen (nicht geprüft) | — |
| `tags` | Ausgenommen (nicht geprüft) | — |
| `task_archive_settings` | Ausgenommen (nicht geprüft) | — |
| `task_assignees` | Ausgenommen (nicht geprüft) | — |
| `task_categories` | Ausgenommen (nicht geprüft) | — |
| `task_comments` | Ausgenommen (nicht geprüft) | — |
| `task_decision_attachments` | Ausgenommen (nicht geprüft) | — |
| `task_decision_comment_reactions` | Ausgenommen (nicht geprüft) | — |
| `task_decision_comments` | Ausgenommen (nicht geprüft) | — |
| `task_decision_participants` | Szenario vorhanden | case-item-lifecycle, decision-lifecycle, quick-note-lifecycle |
| `task_decision_response_history` | Ausgenommen (nicht geprüft) | — |
| `task_decision_responses` | Szenario vorhanden | case-item-lifecycle |
| `task_decision_topics` | Ausgenommen (nicht geprüft) | — |
| `task_decisions` | Szenario vorhanden | case-item-lifecycle, decision-lifecycle, jour-fixe-platform-integration, quick-note-lifecycle, task-lifecycle |
| `task_documents` | Ausgenommen (nicht geprüft) | — |
| `task_snoozes` | Ausgenommen (nicht geprüft) | — |
| `task_statuses` | Ausgenommen (nicht geprüft) | — |
| `task_topics` | Ausgenommen (nicht geprüft) | — |
| `tasks` | Szenario vorhanden | appointment-briefing-lifecycle, case-item-lifecycle, jour-fixe-platform-integration, letter-lifecycle, meeting-lifecycle, quick-note-lifecycle, task-lifecycle |
| `team_announcement_dismissals` | Ausgenommen (nicht geprüft) | — |
| `team_announcements` | Ausstehend | — |
| `team_dashboard_members` | Ausgenommen (nicht geprüft) | — |
| `team_dashboards` | Ausstehend | — |
| `tenant_collaborations` | Ausstehend | — |
| `tenant_feature_flags` | Ausgenommen (nicht geprüft) | — |
| `tenant_onboarding_checklist_items` | Ausstehend | — |
| `tenant_onboarding_slides` | Ausstehend | — |
| `tenants` | Ausgenommen (nicht geprüft) | — |
| `time_entries` | Ausstehend | — |
| `time_entry_corrections` | Ausgenommen (nicht geprüft) | — |
| `time_entry_history` | Ausgenommen (nicht geprüft) | — |
| `todo_categories` | Ausgenommen (nicht geprüft) | — |
| `todos` | Ausstehend | — |
| `topic_backlog` | Ausstehend | — |
| `topics` | Ausstehend | — |
| `user_mywork_settings` | Ausgenommen (nicht geprüft) | — |
| `user_navigation_visits` | Ausgenommen (nicht geprüft) | — |
| `user_notification_settings` | Ausgenommen (nicht geprüft) | — |
| `user_onboarding_state` | Ausstehend | — |
| `user_planning_preferences` | Ausgenommen (nicht geprüft) | — |
| `user_preferences` | Ausgenommen (nicht geprüft) | — |
| `user_roles` | Ausgenommen (nicht geprüft) | — |
| `user_sessions` | Ausgenommen (nicht geprüft) | — |
| `user_status` | Ausgenommen (nicht geprüft) | — |
| `user_tenant_memberships` | Ausgenommen (nicht geprüft) | — |
| `vacation_checklist_responses` | Ausstehend | — |
| `vacation_checklist_templates` | Ausgenommen (nicht geprüft) | — |
| `vacation_history` | Ausgenommen (nicht geprüft) | — |
| `widget_configurations` | Ausgenommen (nicht geprüft) | — |
| `widget_rate_limits` | Ausgenommen (nicht geprüft) | — |
| `workflow_action_log` | Ausstehend | — |
| `workflow_definitions` | Ausstehend | — |
| `workflow_runs` | Ausstehend | — |

## Deklarierte Schreibfelder

Diese Manifeste sind keine Messung ausgeführter Assertions.

- appointment-briefing-lifecycle: `appointments`: title, tenant_id, user_id, start_time, end_time
- appointment-lifecycle: `appointments`: title, description, start_time, end_time, location, category, priority, status, is_all_day, user_id, tenant_id, reminder_minutes
- appointment-lifecycle: `appointment_preparations`: appointment_id, tenant_id, created_by, title, status, preparation_data, checklist_items, notes
- appointment-lifecycle: `appointment_feedback`: appointment_id, user_id, tenant_id, feedback_status, notes, event_type, completed_at
- appointment-request-lifecycle: `appointment_requests`: title, tenant_id, requested_date, requested_time, duration_minutes, channel, requester, location, notes
- case-item-lifecycle: `case_items`: subject, summary, user_id, tenant_id, status, ball_owner, next_action_label, next_action_due_at, next_action_assignee_id, intake_payload, pending_for_jour_fixe, completion_note, completed_at, resolution_summary
- case-item-lifecycle: `case_item_interactions`: case_item_id, tenant_id, interaction_type, direction, interaction_at, summary, visibility, created_by
- case-item-lifecycle: `case_item_handover_log`: case_item_id, tenant_id, from_user_id, to_user_id, handed_over_by
- case-item-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, case_item_id
- case-item-lifecycle: `appointment_requests`: title, tenant_id, requested_date, channel, notes
- case-item-lifecycle: `day_slips`: user_id, tenant_id, day_key, data
- contact-lifecycle: `contacts`: name, user_id, tenant_id, email, phone, organization, title, category, tags, notes
- contact-lifecycle: `contact_activities`: contact_id, tenant_id, created_by, activity_type, title, description
- daily-briefing-lifecycle: `daily_briefings`: tenant_id, author_id, briefing_date, title, content
- day-slip-lifecycle: `day_slips`: user_id, tenant_id, day_key, data
- decision-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, visible_to_all, priority, response_deadline, archived_at, archived_by
- decision-lifecycle: `task_decision_participants`: decision_id, user_id
- event-planning-lifecycle: `event_plannings`: title, description, location, background_info, is_private, is_digital, user_id, tenant_id
- event-planning-lifecycle: `event_planning_dates`: event_planning_id, date_time, is_confirmed
- event-planning-lifecycle: `event_planning_speakers`: event_planning_id, name, bio, topic, order_index
- event-planning-lifecycle: `event_planning_contacts`: event_planning_id, name, email, phone, role
- event-planning-lifecycle: `event_planning_checklist_items`: event_planning_id, title, is_completed, order_index, type
- event-planning-lifecycle: `event_planning_timeline_assignments`: event_planning_id, checklist_item_id, due_date
- jour-fixe-platform-integration: `meetings`: title, description, meeting_date, status, user_id, tenant_id
- jour-fixe-platform-integration: `meeting_agenda_items`: meeting_id, title, assigned_to, result_text, order_index, system_type, is_completed, is_recurring
- jour-fixe-platform-integration: `task_decisions`: title, description, created_by, tenant_id, status, meeting_id, meeting_result
- jour-fixe-platform-integration: `tasks`: meeting_id, source_type, source_id, ball_owner, ball_assignee_id, next_action, next_action_due, timeline
- letter-lifecycle: `letters`: title, subject, content, content_html, status, created_by, tenant_id, recipient_name, recipient_address, letter_date, submitted_for_review_at, submitted_for_review_by, approved_at, approved_by, sent_at, sent_by, sent_date, workflow_locked, archived_document_id
- letter-lifecycle: `letter_attachments`: letter_id, file_name, file_path, file_type, file_size, uploaded_by
- meeting-lifecycle: `meetings`: title, description, meeting_date, meeting_time, status, user_id, tenant_id, is_public, parent_meeting_id, is_recurring_instance
- meeting-lifecycle: `meeting_agenda_items`: meeting_id, title, description, order_index, is_completed, is_recurring, system_type, is_visible, is_optional, parent_id, task_id, notes, result_text, carry_over_to_next, carryover_notes, carried_over_from, original_meeting_date, original_meeting_title
- meeting-lifecycle: `meeting_agenda_documents`: meeting_agenda_item_id, user_id, file_name, file_path, file_type, file_size
- meeting-lifecycle: `meeting_participants`: meeting_id, user_id, role, status
- meeting-lifecycle: `appointments`: title, description, start_time, end_time, category, status, user_id, tenant_id, meeting_id
- meeting-lifecycle: `tasks`: title, description, status, priority, user_id, tenant_id
- quick-note-lifecycle: `quick_notes`: title, content, user_id, tenant_id, priority_level, color, category, tags, is_pinned, task_id, is_archived, archived_at
- quick-note-lifecycle: `tasks`: title, description, user_id, tenant_id, status, priority
- task-lifecycle: `tasks`: title, description, status, priority, user_id, tenant_id, assigned_to, due_date, progress, pending_for_jour_fixe
- task-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, task_id
