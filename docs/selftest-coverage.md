# Selbsttest-Coverage

_Auto-generiert von `scripts/check-selftest-coverage.mjs`. Nicht von Hand bearbeiten._

## Szenarien

| ID | Titel | Features | Tabellen |
|---|---|---|---|
| `case-item-lifecycle` | Vorgangs-Lifecycle (neu → in Klärung → Antwort ausstehend → erledigt) | case-items, decisions | case_items, case_item_interactions, task_decisions |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | decisions | task_decisions, task_decision_participants |
| `letter-lifecycle` | Brief-Lifecycle (Entwurf → Prüfung → Genehmigt → Versendet) | letters, decisions | letters, letter_attachments, task_decisions |
| `meeting-lifecycle` | Meeting-Lifecycle (vollständig + Field-Verifikation) | meetings, appointments, tasks | meetings, meeting_agenda_items, meeting_agenda_documents, meeting_participants, appointments, tasks |
| `task-lifecycle` | Aufgaben-Lifecycle | tasks | tasks |

## Tabellen-Coverage

| Tabelle | Status | Szenario(en) |
|---|---|---|
| `admin_status_options` | ⚪ ignoriert | — |
| `annual_task_completions` | ⚪ ignoriert | — |
| `annual_tasks` | ⚪ ignoriert | — |
| `app_settings` | ⚪ ignoriert | — |
| `appointment_categories` | ⚪ ignoriert | — |
| `appointment_contacts` | ⚪ ignoriert | — |
| `appointment_documents` | ⚪ ignoriert | — |
| `appointment_feedback` | ⚪ ignoriert | — |
| `appointment_feedback_settings` | ⚪ ignoriert | — |
| `appointment_guests` | ⚪ ignoriert | — |
| `appointment_locations` | ⚪ ignoriert | — |
| `appointment_polls` | ⚪ ignoriert | — |
| `appointment_preparation_documents` | ⚪ ignoriert | — |
| `appointment_preparation_templates` | ⚪ ignoriert | — |
| `appointment_preparations` | ⚪ ignoriert | — |
| `appointment_statuses` | ⚪ ignoriert | — |
| `appointment_topics` | ⚪ ignoriert | — |
| `appointments` | ✅ getestet | meeting-lifecycle |
| `archived_tasks` | ⚪ ignoriert | — |
| `audit_log_entries` | ⚪ ignoriert | — |
| `automation_rate_limits` | ⚪ ignoriert | — |
| `automation_rule_run_steps` | ⚪ ignoriert | — |
| `automation_rule_runs` | ⚪ ignoriert | — |
| `automation_rule_versions` | ⚪ ignoriert | — |
| `automation_rules` | ⚪ ignoriert | — |
| `calendar_sync_settings` | ⚪ ignoriert | — |
| `call_logs` | ⚪ ignoriert | — |
| `carryover_items` | ⚪ ignoriert | — |
| `case_file_appointments` | ⚪ ignoriert | — |
| `case_file_contacts` | ⚪ ignoriert | — |
| `case_file_documents` | ⚪ ignoriert | — |
| `case_file_letters` | ⚪ ignoriert | — |
| `case_file_notes` | ⚪ ignoriert | — |
| `case_file_participants` | ⚪ ignoriert | — |
| `case_file_processing_statuses` | ⚪ ignoriert | — |
| `case_file_status_history` | ⚪ ignoriert | — |
| `case_file_tasks` | ⚪ ignoriert | — |
| `case_file_timeline` | ⚪ ignoriert | — |
| `case_file_topics` | ⚪ ignoriert | — |
| `case_file_types` | ⚪ ignoriert | — |
| `case_files` | ⚪ ignoriert | — |
| `case_item_attachments` | ⚪ ignoriert | — |
| `case_item_categories` | ⚪ ignoriert | — |
| `case_item_escalation_suggestions` | ⚪ ignoriert | — |
| `case_item_interactions` | ✅ getestet | case-item-lifecycle |
| `case_item_participants` | ⚪ ignoriert | — |
| `case_item_timeline` | ⚪ ignoriert | — |
| `case_items` | ✅ getestet | case-item-lifecycle |
| `celebration_animations` | ⚪ ignoriert | — |
| `celebration_settings` | ⚪ ignoriert | — |
| `contact_activities` | ⚪ ignoriert | — |
| `contact_topics` | ⚪ ignoriert | — |
| `contact_usage_stats` | ⚪ ignoriert | — |
| `contacts` | ⚪ ignoriert | — |
| `daily_briefing_reads` | ⚪ ignoriert | — |
| `daily_briefings` | ⚪ ignoriert | — |
| `dashboard_layouts` | ⚪ ignoriert | — |
| `day_slips` | ⚪ ignoriert | — |
| `decision_archive_settings` | ⚪ ignoriert | — |
| `decision_email_templates` | ⚪ ignoriert | — |
| `decision_matrix_messages` | ⚪ ignoriert | — |
| `default_appointment_guests` | ⚪ ignoriert | — |
| `distribution_list_members` | ⚪ ignoriert | — |
| `distribution_lists` | ⚪ ignoriert | — |
| `district_notes` | ⚪ ignoriert | — |
| `district_support_assignments` | ⚪ ignoriert | — |
| `document_categories` | ⚪ ignoriert | — |
| `document_contacts` | ⚪ ignoriert | — |
| `document_folders` | ⚪ ignoriert | — |
| `document_topics` | ⚪ ignoriert | — |
| `documents` | ⚪ ignoriert | — |
| `dossier_entries` | ⚪ ignoriert | — |
| `dossier_links` | ⚪ ignoriert | — |
| `dossier_position_versions` | ⚪ ignoriert | — |
| `dossier_source_watchers` | ⚪ ignoriert | — |
| `dossier_stakeholders` | ⚪ ignoriert | — |
| `dossier_talking_points` | ⚪ ignoriert | — |
| `dossiers` | ⚪ ignoriert | — |
| `election_district_municipalities` | ⚪ ignoriert | — |
| `election_district_notes` | ⚪ ignoriert | — |
| `election_districts` | ⚪ ignoriert | — |
| `election_representatives` | ⚪ ignoriert | — |
| `email_logs` | ⚪ ignoriert | — |
| `email_templates` | ⚪ ignoriert | — |
| `employee_meeting_action_items` | ⚪ ignoriert | — |
| `employee_meeting_requests` | ⚪ ignoriert | — |
| `employee_meetings` | ⚪ ignoriert | — |
| `employee_settings` | ⚪ ignoriert | — |
| `employee_settings_history` | ⚪ ignoriert | — |
| `employee_yearly_stats` | ⚪ ignoriert | — |
| `event_email_templates` | ⚪ ignoriert | — |
| `event_planning_action_logs` | ⚪ ignoriert | — |
| `event_planning_checklist_items` | ⚪ ignoriert | — |
| `event_planning_collaborators` | ⚪ ignoriert | — |
| `event_planning_contacts` | ⚪ ignoriert | — |
| `event_planning_dates` | ⚪ ignoriert | — |
| `event_planning_documents` | ⚪ ignoriert | — |
| `event_planning_item_actions` | ⚪ ignoriert | — |
| `event_planning_speakers` | ⚪ ignoriert | — |
| `event_planning_timeline_assignments` | ⚪ ignoriert | — |
| `event_plannings` | ⚪ ignoriert | — |
| `event_rsvp_public_links` | ⚪ ignoriert | — |
| `event_rsvps` | ⚪ ignoriert | — |
| `expense_budgets` | ⚪ ignoriert | — |
| `expense_categories` | ⚪ ignoriert | — |
| `expenses` | ⚪ ignoriert | — |
| `external_calendars` | ⚪ ignoriert | — |
| `external_events` | ⚪ ignoriert | — |
| `funding_participants` | ⚪ ignoriert | — |
| `fundings` | ⚪ ignoriert | — |
| `habit_completions` | ⚪ ignoriert | — |
| `habits` | ⚪ ignoriert | — |
| `information_blocks` | ⚪ ignoriert | — |
| `karlsruhe_districts` | ⚪ ignoriert | — |
| `knowledge_document_collaborators` | ⚪ ignoriert | — |
| `knowledge_document_permissions` | ⚪ ignoriert | — |
| `knowledge_document_snapshots` | ⚪ ignoriert | — |
| `knowledge_document_topics` | ⚪ ignoriert | — |
| `knowledge_document_versions` | ⚪ ignoriert | — |
| `knowledge_documents` | ⚪ ignoriert | — |
| `leave_requests` | ⚪ ignoriert | — |
| `letter_archive_settings` | ⚪ ignoriert | — |
| `letter_attachments` | ✅ getestet | letter-lifecycle |
| `letter_collaborators` | ⚪ ignoriert | — |
| `letter_comments` | ⚪ ignoriert | — |
| `letter_occasions` | ⚪ ignoriert | — |
| `letter_template_assets` | ⚪ ignoriert | — |
| `letter_template_settings` | ⚪ ignoriert | — |
| `letter_templates` | ⚪ ignoriert | — |
| `letter_workflow_history` | ⚪ ignoriert | — |
| `letters` | ✅ getestet | letter-lifecycle |
| `login_customization` | ⚪ ignoriert | — |
| `map_flag_topics` | ⚪ ignoriert | — |
| `map_flag_types` | ⚪ ignoriert | — |
| `map_flags` | ⚪ ignoriert | — |
| `map_layers` | ⚪ ignoriert | — |
| `map_routes` | ⚪ ignoriert | — |
| `matrix_bot_logs` | ⚪ ignoriert | — |
| `matrix_morning_settings` | ⚪ ignoriert | — |
| `matrix_subscriptions` | ⚪ ignoriert | — |
| `matrix_widget_callback_requests` | ⚪ ignoriert | — |
| `matrix_widget_improvement_triggers` | ⚪ ignoriert | — |
| `matrix_widget_message_feedback` | ⚪ ignoriert | — |
| `meeting_agenda_documents` | ✅ getestet | meeting-lifecycle |
| `meeting_agenda_items` | ✅ getestet | meeting-lifecycle |
| `meeting_participants` | ✅ getestet | meeting-lifecycle |
| `meeting_templates` | ⚪ ignoriert | — |
| `meetings` | ✅ getestet | meeting-lifecycle |
| `message_confirmations` | ⚪ ignoriert | — |
| `message_recipients` | ⚪ ignoriert | — |
| `messages` | ⚪ ignoriert | — |
| `news_email_templates` | ⚪ ignoriert | — |
| `notification_navigation_mapping` | ⚪ ignoriert | — |
| `notification_types` | ⚪ ignoriert | — |
| `notifications` | ⚪ ignoriert | — |
| `parliament_protocols` | ⚪ ignoriert | — |
| `party_associations` | ⚪ ignoriert | — |
| `planning_item_comments` | ⚪ ignoriert | — |
| `planning_item_documents` | ⚪ ignoriert | — |
| `planning_item_subtasks` | ⚪ ignoriert | — |
| `planning_templates` | ⚪ ignoriert | — |
| `poll_notifications` | ⚪ ignoriert | — |
| `poll_participants` | ⚪ ignoriert | — |
| `poll_responses` | ⚪ ignoriert | — |
| `poll_time_slots` | ⚪ ignoriert | — |
| `poll_versions` | ⚪ ignoriert | — |
| `pomodoro_sessions` | ⚪ ignoriert | — |
| `press_releases` | ⚪ ignoriert | — |
| `profiles` | ⚪ ignoriert | — |
| `protocol_agenda_items` | ⚪ ignoriert | — |
| `protocol_sessions` | ⚪ ignoriert | — |
| `protocol_speeches` | ⚪ ignoriert | — |
| `public_holidays` | ⚪ ignoriert | — |
| `push_subscriptions` | ⚪ ignoriert | — |
| `quick_note_global_shares` | ⚪ ignoriert | — |
| `quick_note_shares` | ⚪ ignoriert | — |
| `quick_note_versions` | ⚪ ignoriert | — |
| `quick_notes` | ⚪ ignoriert | — |
| `rss_cache` | ⚪ ignoriert | — |
| `rss_settings` | ⚪ ignoriert | — |
| `rss_sources` | ⚪ ignoriert | — |
| `scheduled_emails` | ⚪ ignoriert | — |
| `search_analytics` | ⚪ ignoriert | — |
| `sender_information` | ⚪ ignoriert | — |
| `sick_days` | ⚪ ignoriert | — |
| `social_approval_comments` | ⚪ ignoriert | — |
| `social_assets` | ⚪ ignoriert | — |
| `social_campaigns` | ⚪ ignoriert | — |
| `social_content_channels` | ⚪ ignoriert | — |
| `social_content_item_channels` | ⚪ ignoriert | — |
| `social_content_items` | ⚪ ignoriert | — |
| `social_content_variants` | ⚪ ignoriert | — |
| `social_hashtag_sets` | ⚪ ignoriert | — |
| `social_planner_notes` | ⚪ ignoriert | — |
| `starred_appointments` | ⚪ ignoriert | — |
| `subtasks` | ⚪ ignoriert | — |
| `tags` | ⚪ ignoriert | — |
| `task_archive_settings` | ⚪ ignoriert | — |
| `task_assignees` | ⚪ ignoriert | — |
| `task_categories` | ⚪ ignoriert | — |
| `task_comments` | ⚪ ignoriert | — |
| `task_decision_attachments` | ⚪ ignoriert | — |
| `task_decision_comment_reactions` | ⚪ ignoriert | — |
| `task_decision_comments` | ⚪ ignoriert | — |
| `task_decision_participants` | ✅ getestet | decision-lifecycle |
| `task_decision_response_history` | ⚪ ignoriert | — |
| `task_decision_responses` | ⚪ ignoriert | — |
| `task_decision_topics` | ⚪ ignoriert | — |
| `task_decisions` | ✅ getestet | case-item-lifecycle, decision-lifecycle, letter-lifecycle |
| `task_documents` | ⚪ ignoriert | — |
| `task_snoozes` | ⚪ ignoriert | — |
| `task_statuses` | ⚪ ignoriert | — |
| `task_topics` | ⚪ ignoriert | — |
| `tasks` | ✅ getestet | meeting-lifecycle, task-lifecycle |
| `team_announcement_dismissals` | ⚪ ignoriert | — |
| `team_announcements` | ⚪ ignoriert | — |
| `team_dashboard_members` | ⚪ ignoriert | — |
| `team_dashboards` | ⚪ ignoriert | — |
| `tenant_collaborations` | ⚪ ignoriert | — |
| `tenants` | ⚪ ignoriert | — |
| `time_entries` | ⚪ ignoriert | — |
| `time_entry_corrections` | ⚪ ignoriert | — |
| `time_entry_history` | ⚪ ignoriert | — |
| `todo_categories` | ⚪ ignoriert | — |
| `todos` | ⚪ ignoriert | — |
| `topic_backlog` | ⚪ ignoriert | — |
| `topics` | ⚪ ignoriert | — |
| `user_mywork_settings` | ⚪ ignoriert | — |
| `user_navigation_visits` | ⚪ ignoriert | — |
| `user_notification_settings` | ⚪ ignoriert | — |
| `user_planning_preferences` | ⚪ ignoriert | — |
| `user_preferences` | ⚪ ignoriert | — |
| `user_roles` | ⚪ ignoriert | — |
| `user_sessions` | ⚪ ignoriert | — |
| `user_status` | ⚪ ignoriert | — |
| `user_tenant_memberships` | ⚪ ignoriert | — |
| `vacation_checklist_responses` | ⚪ ignoriert | — |
| `vacation_checklist_templates` | ⚪ ignoriert | — |
| `vacation_history` | ⚪ ignoriert | — |
| `widget_configurations` | ⚪ ignoriert | — |
| `widget_rate_limits` | ⚪ ignoriert | — |

## Lücken

_Keine — alle relevanten Tabellen sind abgedeckt._

## Spalten-Coverage (writes)

| Tabelle | Getestete Spalten |
|---|---|
| `appointments` | `category`, `description`, `end_time`, `meeting_id`, `start_time`, `status`, `tenant_id`, `title`, `user_id` |
| `letter_attachments` | `file_name`, `file_path`, `file_size`, `file_type`, `letter_id`, `uploaded_by` |
| `letters` | `approved_at`, `approved_by`, `content`, `content_html`, `created_by`, `letter_date`, `recipient_address`, `recipient_name`, `sent_at`, `sent_by`, `sent_date`, `sent_method`, `status`, `subject`, `submitted_for_review_at`, `submitted_for_review_by`, `submitted_to_user`, `tenant_id`, `title` |
| `meeting_agenda_documents` | `file_name`, `file_path`, `file_size`, `file_type`, `meeting_agenda_item_id`, `user_id` |
| `meeting_agenda_items` | `carried_over_from`, `carry_over_to_next`, `carryover_notes`, `description`, `is_completed`, `is_optional`, `is_recurring`, `is_visible`, `meeting_id`, `notes`, `order_index`, `original_meeting_date`, `original_meeting_title`, `parent_id`, `result_text`, `system_type`, `task_id`, `title` |
| `meeting_participants` | `meeting_id`, `role`, `status`, `user_id` |
| `meetings` | `description`, `is_public`, `is_recurring_instance`, `meeting_date`, `meeting_time`, `parent_meeting_id`, `status`, `tenant_id`, `title`, `user_id` |
| `task_decision_participants` | `decision_id`, `user_id` |
| `task_decisions` | `archived_at`, `archived_by`, `created_by`, `description`, `priority`, `response_deadline`, `status`, `tenant_id`, `title`, `visible_to_all` |
| `tasks` | `description`, `priority`, `status`, `tenant_id`, `title`, `user_id` |
