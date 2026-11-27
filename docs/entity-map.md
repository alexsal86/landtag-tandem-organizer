# Entitätskarte

_Auto-generiert mit `npm run update:feature-catalog` aus den Fremdschlüsseln in `src/integrations/supabase/types.ts`. Nicht von Hand bearbeiten._

362 Tabellen, 497 Fremdschlüsselverweise. Die Karte zeigt, welche Tabelle auf welche zeigt; fachliche Bedeutung steht im [Funktionskatalog](./features/README.md).

## Zentrale Tabellen

Tabellen mit mindestens drei eingehenden Verweisen.

### `tenants` — 144 eingehende Verweise

| Von | Spalte |
|---|---|
| `action_permissions` | `tenant_id` |
| `admin_status_options` | `tenant_id` |
| `annual_tasks` | `tenant_id` |
| `app_settings` | `tenant_id` |
| `appointment_categories` | `tenant_id` |
| `appointment_feedback` | `tenant_id` |
| `appointment_feedback_settings` | `tenant_id` |
| `appointment_locations` | `tenant_id` |
| `appointment_polls` | `tenant_id` |
| `appointment_preparation_templates` | `tenant_id` |
| `appointment_preparations` | `tenant_id` |
| `appointment_requests` | `tenant_id` |
| `appointment_statuses` | `tenant_id` |
| `appointments` | `tenant_id` |
| `audit_log_entries` | `tenant_id` |
| `automation_rate_limits` | `tenant_id` |
| `automation_rule_run_steps` | `tenant_id` |
| `automation_rule_runs` | `tenant_id` |
| `automation_rule_versions` | `tenant_id` |
| `automation_rules` | `tenant_id` |
| `calendar_sync_settings` | `tenant_id` |
| `call_logs` | `tenant_id` |
| `case_file_processing_statuses` | `tenant_id` |
| `case_file_types` | `tenant_id` |
| `case_files` | `tenant_id` |
| `case_item_categories` | `tenant_id` |
| `case_item_escalation_suggestions` | `tenant_id` |
| `case_item_interactions` | `tenant_id` |
| `case_item_timeline` | `tenant_id` |
| `case_item_topics` | `tenant_id` |
| `case_items` | `tenant_id` |
| `committees` | `tenant_id` |
| `contacts` | `tenant_id` |
| `dashboard_decision_nudges` | `tenant_id` |
| `day_slips` | `tenant_id` |
| `decision_archive_settings` | `tenant_id` |
| `distribution_lists` | `tenant_id` |
| `district_notes` | `tenant_id` |
| `document_categories` | `tenant_id` |
| `documents` | `tenant_id` |
| `dossier_entries` | `tenant_id` |
| `dossier_source_watchers` | `tenant_id` |
| `dossiers` | `tenant_id` |
| `election_analysis_scenarios` | `tenant_id` |
| `email_logs` | `tenant_id` |
| `email_templates` | `tenant_id` |
| `employee_hr_evidence` | `tenant_id` |
| `employee_hr_gdpr_declarations` | `tenant_id` |
| `employee_hr_reminder_log` | `tenant_id` |
| `employee_hr_templates` | `tenant_id` |
| `employee_lifecycle` | `tenant_id` |
| `employee_meeting_requests` | `tenant_id` |
| `employee_meetings` | `tenant_id` |
| `employee_responsibilities` | `tenant_id` |
| `event_email_templates` | `tenant_id` |
| `event_planning_documents` | `tenant_id` |
| `event_plannings` | `tenant_id` |
| `event_rsvps` | `tenant_id` |
| `expense_budgets` | `tenant_id` |
| `expense_categories` | `tenant_id` |
| `expenses` | `tenant_id` |
| `field_permissions` | `tenant_id` |
| `fundings` | `tenant_id` |
| `habits` | `tenant_id` |
| `knowledge_document_versions` | `tenant_id` |
| `knowledge_documents` | `tenant_id` |
| `knowledge_question_topics` | `tenant_id` |
| `knowledge_questions` | `tenant_id` |
| `knowledge_tags` | `tenant_id` |
| `letter_occasions` | `tenant_id` |
| `letter_template_settings` | `tenant_id` |
| `login_customization` | `tenant_id` |
| `map_flag_types` | `tenant_id` |
| `map_flags` | `tenant_id` |
| `map_layers` | `tenant_id` |
| `map_routes` | `tenant_id` |
| `matrix_subscriptions` | `tenant_id` |
| `matrix_widget_improvement_triggers` | `tenant_id` |
| `matrix_widget_message_feedback` | `tenant_id` |
| `meeting_templates` | `tenant_id` |
| `meetings` | `tenant_id` |
| `messages` | `tenant_id` |
| `news_article_states` | `tenant_id` |
| `news_articles` | `tenant_id` |
| `news_email_templates` | `tenant_id` |
| `notification_types` | `tenant_id` |
| `notifications` | `tenant_id` |
| `parlis_ministry_assignments` | `tenant_id` |
| `parlis_ministry_topics` | `tenant_id` |
| `planning_item_documents` | `tenant_id` |
| `planning_templates` | `tenant_id` |
| `press_releases` | `tenant_id` |
| `profiles` | `tenant_id` |
| `public_holidays` | `tenant_id` |
| `quick_note_global_shares` | `tenant_id` |
| `quick_note_shares` | `tenant_id` |
| `quick_note_topic_mention_deliveries` | `tenant_id` |
| `quick_note_versions` | `tenant_id` |
| `quick_note_write_receipts` | `tenant_id` |
| `quick_notes` | `tenant_id` |
| `regions` | `tenant_id` |
| `routine_package_runs` | `tenant_id` |
| `rss_settings` | `tenant_id` |
| `rss_sources` | `tenant_id` |
| `scheduled_emails` | `tenant_id` |
| `search_analytics` | `tenant_id` |
| `social_campaigns` | `tenant_id` |
| `social_content_approval_events` | `tenant_id` |
| `social_content_channels` | `tenant_id` |
| `social_content_item_channels` | `tenant_id` |
| `social_content_items` | `tenant_id` |
| `social_content_variants` | `tenant_id` |
| `social_planner_notes` | `tenant_id` |
| `starred_appointments` | `tenant_id` |
| `tags` | `tenant_id` |
| `task_batch_actions` | `tenant_id` |
| `task_categories` | `tenant_id` |
| `task_decisions` | `tenant_id` |
| `tasks` | `tenant_id` |
| `team_announcements` | `tenant_id` |
| `team_bingo_settings` | `tenant_id` |
| `team_dashboards` | `tenant_id` |
| `team_question_weeks` | `tenant_id` |
| `team_questions` | `tenant_id` |
| `team_ritual_profiles` | `tenant_id` |
| `team_ritual_settings` | `tenant_id` |
| `team_two_truths_months` | `tenant_id` |
| `tenant_collaborations` | `tenant_a_id` |
| `tenant_collaborations` | `tenant_b_id` |
| `tenant_feature_flags` | `tenant_id` |
| `tenant_onboarding_checklist_items` | `tenant_id` |
| `tenant_onboarding_slides` | `tenant_id` |
| `time_entries` | `tenant_id` |
| `todos` | `tenant_id` |
| `topic_backlog` | `tenant_id` |
| `topic_catalog_links` | `tenant_id` |
| `topic_module_settings` | `tenant_id` |
| `topics` | `tenant_id` |
| `user_onboarding_state` | `tenant_id` |
| `user_planning_preferences` | `tenant_id` |
| `user_preferences` | `tenant_id` |
| `user_status` | `tenant_id` |
| `user_tenant_memberships` | `tenant_id` |
| `vacation_checklist_templates` | `tenant_id` |

### `topics` — 24 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointment_topics` | `tenant_id`, `topic_id` |
| `appointment_topics` | `topic_id` |
| `case_file_topics` | `tenant_id`, `topic_id` |
| `case_file_topics` | `topic_id` |
| `case_item_topics` | `tenant_id`, `topic_id` |
| `contact_topics` | `tenant_id`, `topic_id` |
| `contact_topics` | `topic_id` |
| `document_topics` | `tenant_id`, `topic_id` |
| `document_topics` | `topic_id` |
| `dossiers` | `topic_id` |
| `employee_responsibilities` | `tenant_id`, `topic_id` |
| `knowledge_document_topics` | `tenant_id`, `topic_id` |
| `knowledge_document_topics` | `topic_id` |
| `knowledge_question_topics` | `tenant_id`, `topic_id` |
| `map_flag_topics` | `tenant_id`, `topic_id` |
| `map_flag_topics` | `topic_id` |
| `parlis_ministry_topics` | `tenant_id`, `topic_id` |
| `quick_note_topic_mention_deliveries` | `topic_id` |
| `task_decision_topics` | `tenant_id`, `topic_id` |
| `task_decision_topics` | `topic_id` |
| `task_topics` | `tenant_id`, `topic_id` |
| `task_topics` | `topic_id` |
| `topic_catalog_links` | `tenant_id`, `topic_id` |
| `topics` | `merged_into` |

### `profiles` — 17 eingehende Verweise

| Von | Spalte |
|---|---|
| `dossier_entries` | `created_by` |
| `dossier_source_watchers` | `created_by` |
| `dossiers` | `created_by` |
| `dossiers` | `owner_id` |
| `meeting_participants` | `user_id` |
| `social_campaigns` | `created_by` |
| `social_campaigns` | `owner_id` |
| `social_content_approval_events` | `actor_id` |
| `social_content_item_channels` | `created_by` |
| `social_content_items` | `approved_by` |
| `social_content_items` | `created_by` |
| `social_content_items` | `responsible_user_id` |
| `social_content_variants` | `created_by` |
| `task_assignees` | `assigned_by` |
| `task_assignees` | `user_id` |
| `topic_backlog` | `created_by` |
| `topic_backlog` | `owner_id` |

### `case_files` — 16 eingehende Verweise

| Von | Spalte |
|---|---|
| `case_file_appointments` | `case_file_id` |
| `case_file_contacts` | `case_file_id` |
| `case_file_documents` | `case_file_id` |
| `case_file_letters` | `case_file_id` |
| `case_file_notes` | `case_file_id` |
| `case_file_participants` | `case_file_id` |
| `case_file_status_history` | `case_file_id` |
| `case_file_tasks` | `case_file_id` |
| `case_file_timeline` | `case_file_id` |
| `case_file_topics` | `case_file_id` |
| `case_item_escalation_suggestions` | `accepted_case_file_id` |
| `case_item_escalation_suggestions` | `suggested_case_file_id` |
| `case_item_interactions` | `case_file_id` |
| `case_items` | `case_file_id` |
| `knowledge_question_sources` | `case_id` |
| `task_decisions` | `case_file_id` |

### `tasks` — 13 eingehende Verweise

| Von | Spalte |
|---|---|
| `annual_task_completions` | `linked_task_id` |
| `case_file_tasks` | `task_id` |
| `document_annotation_tasks` | `task_id` |
| `employee_meeting_action_items` | `task_id` |
| `matrix_widget_callback_requests` | `task_id` |
| `quick_notes` | `task_id` |
| `routine_package_runs` | `task_id` |
| `subtasks` | `task_id` |
| `task_assignees` | `task_id` |
| `task_comments` | `task_id` |
| `task_decisions` | `task_id` |
| `task_topics` | `task_id` |
| `tasks` | `parent_task_id` |

### `appointments` — 12 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointment_contacts` | `appointment_id` |
| `appointment_documents` | `appointment_id` |
| `appointment_feedback` | `appointment_id` |
| `appointment_guests` | `appointment_id` |
| `appointment_polls` | `confirmed_appointment_id` |
| `appointment_preparations` | `appointment_id` |
| `appointment_reminder_dispatches` | `appointment_id` |
| `appointment_requests` | `appointment_id` |
| `appointment_topics` | `appointment_id` |
| `case_file_appointments` | `appointment_id` |
| `event_planning_dates` | `appointment_id` |
| `starred_appointments` | `appointment_id` |

### `contacts` — 12 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointment_contacts` | `contact_id` |
| `appointments` | `contact_id` |
| `case_file_contacts` | `contact_id` |
| `case_items` | `contact_id` |
| `contact_activities` | `contact_id` |
| `contact_briefing_memory` | `contact_id` |
| `contact_topics` | `contact_id` |
| `contacts` | `organization_id` |
| `distribution_list_members` | `contact_id` |
| `document_contacts` | `contact_id` |
| `facts` | `contact_id` |
| `funding_participants` | `contact_id` |

### `election_analysis_years` — 12 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_analysis_candidates` | `year` |
| `election_analysis_correction_audit` | `year` |
| `election_analysis_demographics` | `year` |
| `election_analysis_district_workbook_audit` | `year` |
| `election_analysis_districts` | `year` |
| `election_analysis_flow_matrix` | `year` |
| `election_analysis_flows` | `year` |
| `election_analysis_local_results` | `year` |
| `election_analysis_state` | `year` |
| `election_analysis_state_totals` | `year` |
| `election_analysis_turnout` | `year` |
| `election_analysis_workbook_audit` | `year` |

### `meetings` — 12 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointments` | `meeting_id` |
| `archived_tasks` | `meeting_id` |
| `case_items` | `meeting_id` |
| `meeting_agenda_items` | `meeting_id` |
| `meeting_participants` | `meeting_id` |
| `meeting_protocol_addenda` | `meeting_id` |
| `meeting_protocol_details` | `meeting_id` |
| `meetings` | `parent_meeting_id` |
| `quick_notes` | `meeting_id` |
| `starred_appointments` | `meeting_id` |
| `task_decisions` | `meeting_id` |
| `tasks` | `meeting_id` |

### `task_decisions` — 10 eingehende Verweise

| Von | Spalte |
|---|---|
| `dashboard_decision_nudges` | `decision_id` |
| `decision_matrix_messages` | `decision_id` |
| `quick_notes` | `decision_id` |
| `routine_package_steps` | `approval_id` |
| `task_decision_attachments` | `decision_id` |
| `task_decision_comments` | `decision_id` |
| `task_decision_participants` | `decision_id` |
| `task_decision_response_history` | `decision_id` |
| `task_decision_responses` | `decision_id` |
| `task_decision_topics` | `decision_id` |

### `case_items` — 9 eingehende Verweise

| Von | Spalte |
|---|---|
| `case_item_attachments` | `case_item_id` |
| `case_item_escalation_suggestions` | `case_item_id` |
| `case_item_handover_log` | `case_item_id` |
| `case_item_interactions` | `case_item_id` |
| `case_item_participants` | `case_item_id` |
| `case_item_timeline` | `case_item_id` |
| `case_item_topics` | `case_item_id` |
| `quick_notes` | `case_item_id` |
| `task_decisions` | `case_item_id` |

### `documents` — 9 eingehende Verweise

| Von | Spalte |
|---|---|
| `case_file_documents` | `document_id` |
| `case_item_attachments` | `document_id` |
| `document_annotation_events` | `document_id` |
| `document_annotation_tasks` | `document_id` |
| `document_annotations` | `document_id` |
| `document_contacts` | `document_id` |
| `document_topics` | `document_id` |
| `employee_hr_evidence` | `document_id` |
| `knowledge_question_sources` | `document_id` |

### `knowledge_question_cards` — 9 eingehende Verweise

| Von | Spalte |
|---|---|
| `knowledge_question_attachments` | `tenant_id`, `question_id` |
| `knowledge_question_comments` | `tenant_id`, `question_id` |
| `knowledge_question_events` | `tenant_id`, `question_id` |
| `knowledge_question_followers` | `tenant_id`, `question_id` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` |
| `knowledge_question_sources` | `tenant_id`, `question_id` |
| `knowledge_question_tags` | `tenant_id`, `question_id` |
| `knowledge_question_topics` | `tenant_id`, `question_id` |
| `knowledge_questions` | `tenant_id`, `merged_into` |

### `knowledge_question_summaries` — 9 eingehende Verweise

| Von | Spalte |
|---|---|
| `knowledge_question_attachments` | `tenant_id`, `question_id` |
| `knowledge_question_comments` | `tenant_id`, `question_id` |
| `knowledge_question_events` | `tenant_id`, `question_id` |
| `knowledge_question_followers` | `tenant_id`, `question_id` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` |
| `knowledge_question_sources` | `tenant_id`, `question_id` |
| `knowledge_question_tags` | `tenant_id`, `question_id` |
| `knowledge_question_topics` | `tenant_id`, `question_id` |
| `knowledge_questions` | `tenant_id`, `merged_into` |

### `knowledge_questions` — 9 eingehende Verweise

| Von | Spalte |
|---|---|
| `knowledge_question_attachments` | `tenant_id`, `question_id` |
| `knowledge_question_comments` | `tenant_id`, `question_id` |
| `knowledge_question_events` | `tenant_id`, `question_id` |
| `knowledge_question_followers` | `tenant_id`, `question_id` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` |
| `knowledge_question_sources` | `tenant_id`, `question_id` |
| `knowledge_question_tags` | `tenant_id`, `question_id` |
| `knowledge_question_topics` | `tenant_id`, `question_id` |
| `knowledge_questions` | `tenant_id`, `merged_into` |

### `dossiers` — 8 eingehende Verweise

| Von | Spalte |
|---|---|
| `dossier_entries` | `dossier_id` |
| `dossier_links` | `dossier_id` |
| `dossier_position_versions` | `dossier_id` |
| `dossier_source_watchers` | `dossier_id` |
| `dossier_stakeholders` | `dossier_id` |
| `dossier_talking_points` | `dossier_id` |
| `dossiers` | `parent_id` |
| `facts` | `dossier_id` |

### `event_plannings` — 8 eingehende Verweise

| Von | Spalte |
|---|---|
| `event_planning_checklist_items` | `event_planning_id` |
| `event_planning_collaborators` | `event_planning_id` |
| `event_planning_contacts` | `event_planning_id` |
| `event_planning_dates` | `event_planning_id` |
| `event_planning_documents` | `event_planning_id` |
| `event_planning_speakers` | `event_planning_id` |
| `event_planning_timeline_assignments` | `event_planning_id` |
| `event_rsvps` | `event_planning_id` |

### `election_history_periods` — 7 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_analysis_candidate_coverage` | `period_id` |
| `election_analysis_years` | `period_id` |
| `election_history_assembly_issues` | `period_id` |
| `election_history_candidacies` | `period_id` |
| `election_history_districts` | `period_id` |
| `election_history_mandates` | `period_id` |
| `election_history_state_lists` | `period_id` |

### `appointment_polls` — 6 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointments` | `poll_id` |
| `poll_notifications` | `poll_id` |
| `poll_participants` | `poll_id` |
| `poll_responses` | `poll_id` |
| `poll_time_slots` | `poll_id` |
| `poll_versions` | `poll_id` |

### `election_districts` — 6 eingehende Verweise

| Von | Spalte |
|---|---|
| `appointments` | `district_id` |
| `district_support_assignments` | `district_id` |
| `election_district_municipalities` | `district_id` |
| `election_district_notes` | `district_id` |
| `election_representatives` | `district_id` |
| `regions` | `election_district_id` |

### `election_history_factions` — 5 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_history_candidacies` | `party` |
| `election_history_mandates` | `party` |
| `election_history_mandates` | `party_label` |
| `election_history_mandates` | `subsequent_faction` |
| `election_history_state_lists` | `party` |

### `automation_rules` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `annual_tasks` | `automation_rule_id` |
| `automation_rule_runs` | `rule_id` |
| `automation_rule_versions` | `rule_id` |
| `routine_package_runs` | `rule_id` |

### `election_history_districts` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_analysis_versions` | `historical_district_id` |
| `election_history_1952_result_sources` | `district_id` |
| `election_history_candidacies` | `district_id`, `period_id` |
| `election_history_mandates` | `district_id`, `period_id` |

### `election_history_people` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_analysis_candidates` | `person_id` |
| `election_history_candidacies` | `person_id` |
| `election_history_connection_people` | `person_id` |
| `election_history_mandates` | `person_id` |

### `employee_meetings` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `employee_meeting_action_items` | `meeting_id` |
| `employee_meeting_audit` | `meeting_id` |
| `employee_meeting_private_notes` | `meeting_id` |
| `employee_meeting_requests` | `scheduled_meeting_id` |

### `knowledge_documents` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `knowledge_document_collaborators` | `document_id` |
| `knowledge_document_permissions` | `document_id` |
| `knowledge_document_topics` | `document_id` |
| `knowledge_document_versions` | `document_id` |

### `quick_notes` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `quick_note_shares` | `note_id` |
| `quick_note_topic_mention_deliveries` | `note_id` |
| `quick_note_versions` | `note_id` |
| `quick_note_write_receipts` | `note_id` |

### `social_content_items` — 4 eingehende Verweise

| Von | Spalte |
|---|---|
| `social_approval_comments` | `content_item_id` |
| `social_content_approval_events` | `content_item_id` |
| `social_content_item_channels` | `content_item_id` |
| `social_content_variants` | `content_item_id` |

### `election_history_mandates` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `election_history_1952_result_sources` | `source_mandate_id` |
| `election_history_mandate_birthdays` | `mandate_id` |
| `parlis_deputy_mandates` | `mandate_id` |

### `event_planning_checklist_items` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `event_planning_action_logs` | `checklist_item_id` |
| `event_planning_item_actions` | `checklist_item_id` |
| `event_planning_timeline_assignments` | `checklist_item_id` |

### `letter_templates` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `letter_occasions` | `default_template_id` |
| `letter_template_assets` | `template_id` |
| `letters` | `template_id` |

### `letters` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `case_file_letters` | `letter_id` |
| `letter_collaborators` | `letter_id` |
| `letter_comments` | `letter_id` |

### `ministry_history_lines` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `ministry_history_entries` | `line_id` |
| `ministry_history_links` | `predecessor_id` |
| `ministry_history_links` | `successor_id` |

### `parliament_protocols` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `protocol_agenda_items` | `protocol_id` |
| `protocol_sessions` | `protocol_id` |
| `protocol_speeches` | `protocol_id` |

### `parlis_ministry_lines` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `parlis_ministry_assignments` | `line_id` |
| `parlis_ministry_suggestions` | `line_id` |
| `parlis_ministry_topics` | `line_id` |

### `sender_information` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `letter_templates` | `default_sender_id` |
| `letters` | `sender_information_id` |
| `scheduled_emails` | `sender_id` |

### `task_decision_participants` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `decision_matrix_messages` | `participant_id` |
| `task_decision_response_history` | `participant_id` |
| `task_decision_responses` | `participant_id` |

### `team_ritual_profiles` — 3 eingehende Verweise

| Von | Spalte |
|---|---|
| `team_fun_facts` | `tenant_id`, `user_id` |
| `team_question_answers` | `tenant_id`, `user_id` |
| `team_two_truths_answers` | `tenant_id`, `user_id` |

## Alle Verweise

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `action_permissions` | `tenant_id` | `tenants` |
| `admin_status_options` | `tenant_id` | `tenants` |
| `annual_task_completions` | `annual_task_id` | `annual_tasks` |
| `annual_task_completions` | `linked_task_id` | `tasks` |
| `annual_tasks` | `automation_rule_id` | `automation_rules` |
| `annual_tasks` | `tenant_id` | `tenants` |
| `app_settings` | `tenant_id` | `tenants` |
| `appointment_categories` | `tenant_id` | `tenants` |
| `appointment_contacts` | `appointment_id` | `appointments` |
| `appointment_contacts` | `contact_id` | `contacts` |
| `appointment_documents` | `appointment_id` | `appointments` |
| `appointment_feedback` | `appointment_id` | `appointments` |
| `appointment_feedback` | `external_event_id` | `external_events` |
| `appointment_feedback` | `tenant_id` | `tenants` |
| `appointment_feedback_settings` | `tenant_id` | `tenants` |
| `appointment_guests` | `appointment_id` | `appointments` |
| `appointment_locations` | `tenant_id` | `tenants` |
| `appointment_polls` | `confirmed_appointment_id` | `appointments` |
| `appointment_polls` | `confirmed_slot_id` | `poll_time_slots` |
| `appointment_polls` | `tenant_id` | `tenants` |
| `appointment_preparation_documents` | `preparation_id` | `appointment_preparations` |
| `appointment_preparation_templates` | `tenant_id` | `tenants` |
| `appointment_preparations` | `template_id` | `appointment_preparation_templates` |
| `appointment_preparations` | `appointment_id` | `appointments` |
| `appointment_preparations` | `tenant_id` | `tenants` |
| `appointment_reminder_dispatches` | `appointment_id` | `appointments` |
| `appointment_reminder_dispatches` | `notification_id` | `notifications` |
| `appointment_requests` | `appointment_id` | `appointments` |
| `appointment_requests` | `tenant_id` | `tenants` |
| `appointment_statuses` | `tenant_id` | `tenants` |
| `appointment_topics` | `appointment_id` | `appointments` |
| `appointment_topics` | `tenant_id`, `topic_id` | `topics` |
| `appointment_topics` | `topic_id` | `topics` |
| `appointments` | `poll_id` | `appointment_polls` |
| `appointments` | `call_log_id` | `call_logs` |
| `appointments` | `contact_id` | `contacts` |
| `appointments` | `district_id` | `election_districts` |
| `appointments` | `meeting_id` | `meetings` |
| `appointments` | `party_association_id` | `party_associations` |
| `appointments` | `tenant_id` | `tenants` |
| `archived_tasks` | `meeting_id` | `meetings` |
| `audit_log_entries` | `tenant_id` | `tenants` |
| `automation_rate_limits` | `tenant_id` | `tenants` |
| `automation_rule_run_steps` | `run_id` | `automation_rule_runs` |
| `automation_rule_run_steps` | `tenant_id` | `tenants` |
| `automation_rule_runs` | `rule_id` | `automation_rules` |
| `automation_rule_runs` | `tenant_id` | `tenants` |
| `automation_rule_versions` | `rule_id` | `automation_rules` |
| `automation_rule_versions` | `tenant_id` | `tenants` |
| `automation_rules` | `tenant_id` | `tenants` |
| `calendar_sync_settings` | `tenant_id` | `tenants` |
| `call_logs` | `tenant_id` | `tenants` |
| `case_file_appointments` | `appointment_id` | `appointments` |
| `case_file_appointments` | `case_file_id` | `case_files` |
| `case_file_contacts` | `case_file_id` | `case_files` |
| `case_file_contacts` | `contact_id` | `contacts` |
| `case_file_documents` | `case_file_id` | `case_files` |
| `case_file_documents` | `document_id` | `documents` |
| `case_file_letters` | `case_file_id` | `case_files` |
| `case_file_letters` | `letter_id` | `letters` |
| `case_file_notes` | `case_file_id` | `case_files` |
| `case_file_participants` | `case_file_id` | `case_files` |
| `case_file_processing_statuses` | `tenant_id` | `tenants` |
| `case_file_status_history` | `case_file_id` | `case_files` |
| `case_file_tasks` | `case_file_id` | `case_files` |
| `case_file_tasks` | `task_id` | `tasks` |
| `case_file_timeline` | `case_file_id` | `case_files` |
| `case_file_topics` | `case_file_id` | `case_files` |
| `case_file_topics` | `tenant_id`, `topic_id` | `topics` |
| `case_file_topics` | `topic_id` | `topics` |
| `case_file_types` | `tenant_id` | `tenants` |
| `case_files` | `tenant_id` | `tenants` |
| `case_item_attachments` | `case_item_id` | `case_items` |
| `case_item_attachments` | `document_id` | `documents` |
| `case_item_categories` | `tenant_id` | `tenants` |
| `case_item_escalation_suggestions` | `accepted_case_file_id` | `case_files` |
| `case_item_escalation_suggestions` | `suggested_case_file_id` | `case_files` |
| `case_item_escalation_suggestions` | `case_item_id` | `case_items` |
| `case_item_escalation_suggestions` | `tenant_id` | `tenants` |
| `case_item_handover_log` | `case_item_id` | `case_items` |
| `case_item_interactions` | `case_file_id` | `case_files` |
| `case_item_interactions` | `case_item_id` | `case_items` |
| `case_item_interactions` | `tenant_id` | `tenants` |
| `case_item_participants` | `case_item_id` | `case_items` |
| `case_item_timeline` | `case_item_id` | `case_items` |
| `case_item_timeline` | `tenant_id` | `tenants` |
| `case_item_topics` | `case_item_id` | `case_items` |
| `case_item_topics` | `tenant_id` | `tenants` |
| `case_item_topics` | `tenant_id`, `topic_id` | `topics` |
| `case_items` | `case_file_id` | `case_files` |
| `case_items` | `contact_id` | `contacts` |
| `case_items` | `meeting_id` | `meetings` |
| `case_items` | `tenant_id` | `tenants` |
| `committees` | `tenant_id` | `tenants` |
| `contact_activities` | `contact_id` | `contacts` |
| `contact_briefing_memory` | `contact_id` | `contacts` |
| `contact_topics` | `contact_id` | `contacts` |
| `contact_topics` | `tenant_id`, `topic_id` | `topics` |
| `contact_topics` | `topic_id` | `topics` |
| `contacts` | `organization_id` | `contacts` |
| `contacts` | `tenant_id` | `tenants` |
| `daily_briefing_reads` | `briefing_id` | `daily_briefings` |
| `dashboard_decision_nudges` | `decision_id` | `task_decisions` |
| `dashboard_decision_nudges` | `tenant_id` | `tenants` |
| `day_slips` | `tenant_id` | `tenants` |
| `decision_archive_settings` | `tenant_id` | `tenants` |
| `decision_matrix_messages` | `participant_id` | `task_decision_participants` |
| `decision_matrix_messages` | `decision_id` | `task_decisions` |
| `distribution_list_members` | `contact_id` | `contacts` |
| `distribution_list_members` | `distribution_list_id` | `distribution_lists` |
| `distribution_lists` | `tenant_id` | `tenants` |
| `district_notes` | `district_id` | `karlsruhe_districts` |
| `district_notes` | `tenant_id` | `tenants` |
| `district_support_assignments` | `district_id` | `election_districts` |
| `district_support_assignments` | `supporting_representative_id` | `election_representatives` |
| `document_annotation_events` | `document_id` | `documents` |
| `document_annotation_tasks` | `annotation_id` | `document_annotations` |
| `document_annotation_tasks` | `document_id` | `documents` |
| `document_annotation_tasks` | `task_id` | `tasks` |
| `document_annotations` | `parent_id` | `document_annotations` |
| `document_annotations` | `document_id` | `documents` |
| `document_categories` | `tenant_id` | `tenants` |
| `document_contacts` | `contact_id` | `contacts` |
| `document_contacts` | `document_id` | `documents` |
| `document_folders` | `parent_folder_id` | `document_folders` |
| `document_topics` | `document_id` | `documents` |
| `document_topics` | `tenant_id`, `topic_id` | `topics` |
| `document_topics` | `topic_id` | `topics` |
| `documents` | `folder_id` | `document_folders` |
| `documents` | `tenant_id` | `tenants` |
| `dossier_entries` | `dossier_id` | `dossiers` |
| `dossier_entries` | `created_by` | `profiles` |
| `dossier_entries` | `tenant_id` | `tenants` |
| `dossier_links` | `dossier_id` | `dossiers` |
| `dossier_position_versions` | `dossier_id` | `dossiers` |
| `dossier_source_watchers` | `dossier_id` | `dossiers` |
| `dossier_source_watchers` | `created_by` | `profiles` |
| `dossier_source_watchers` | `tenant_id` | `tenants` |
| `dossier_stakeholders` | `dossier_id` | `dossiers` |
| `dossier_talking_points` | `dossier_id` | `dossiers` |
| `dossiers` | `parent_id` | `dossiers` |
| `dossiers` | `created_by` | `profiles` |
| `dossiers` | `owner_id` | `profiles` |
| `dossiers` | `tenant_id` | `tenants` |
| `dossiers` | `topic_id` | `topics` |
| `election_analysis_candidate_coverage` | `period_id` | `election_history_periods` |
| `election_analysis_candidates` | `year`, `district_number` | `election_analysis_versions` |
| `election_analysis_candidates` | `year` | `election_analysis_years` |
| `election_analysis_candidates` | `person_id` | `election_history_people` |
| `election_analysis_correction_audit` | `year` | `election_analysis_years` |
| `election_analysis_demographics` | `year` | `election_analysis_years` |
| `election_analysis_district_workbook_audit` | `year` | `election_analysis_years` |
| `election_analysis_districts` | `year` | `election_analysis_years` |
| `election_analysis_flow_matrix` | `year` | `election_analysis_years` |
| `election_analysis_flows` | `year` | `election_analysis_years` |
| `election_analysis_local_results` | `year` | `election_analysis_years` |
| `election_analysis_scenarios` | `tenant_id` | `tenants` |
| `election_analysis_state` | `year` | `election_analysis_years` |
| `election_analysis_state_totals` | `year` | `election_analysis_years` |
| `election_analysis_turnout` | `year` | `election_analysis_years` |
| `election_analysis_versions` | `geography_id` | `election_analysis_geographies` |
| `election_analysis_versions` | `historical_district_id` | `election_history_districts` |
| `election_analysis_workbook_audit` | `year` | `election_analysis_years` |
| `election_analysis_years` | `period_id` | `election_history_periods` |
| `election_district_municipalities` | `district_id` | `election_districts` |
| `election_district_notes` | `district_id` | `election_districts` |
| `election_history_1952_result_sources` | `district_id` | `election_history_districts` |
| `election_history_1952_result_sources` | `source_mandate_id` | `election_history_mandates` |
| `election_history_assembly_issues` | `period_id` | `election_history_periods` |
| `election_history_candidacies` | `district_id`, `period_id` | `election_history_districts` |
| `election_history_candidacies` | `party` | `election_history_factions` |
| `election_history_candidacies` | `person_id` | `election_history_people` |
| `election_history_candidacies` | `period_id` | `election_history_periods` |
| `election_history_candidate_workbook_audit` | `candidacy_id` | `election_history_candidacies` |
| `election_history_connection_people` | `person_id` | `election_history_people` |
| `election_history_districts` | `period_id` | `election_history_periods` |
| `election_history_mandate_birthdays` | `mandate_id` | `election_history_mandates` |
| `election_history_mandates` | `candidacy_id`, `person_id`, `period_id` | `election_history_candidacies` |
| `election_history_mandates` | `district_id`, `period_id` | `election_history_districts` |
| `election_history_mandates` | `party` | `election_history_factions` |
| `election_history_mandates` | `party_label` | `election_history_factions` |
| `election_history_mandates` | `subsequent_faction` | `election_history_factions` |
| `election_history_mandates` | `person_id` | `election_history_people` |
| `election_history_mandates` | `period_id` | `election_history_periods` |
| `election_history_state_list_entries` | `list_id` | `election_history_state_lists` |
| `election_history_state_lists` | `party` | `election_history_factions` |
| `election_history_state_lists` | `period_id` | `election_history_periods` |
| `election_representatives` | `district_id` | `election_districts` |
| `email_logs` | `tenant_id` | `tenants` |
| `email_templates` | `tenant_id` | `tenants` |
| `employee_hr_evidence` | `document_id` | `documents` |
| `employee_hr_evidence` | `step_id` | `routine_package_steps` |
| `employee_hr_evidence` | `tenant_id` | `tenants` |
| `employee_hr_gdpr_declarations` | `tenant_id` | `tenants` |
| `employee_hr_reminder_log` | `lifecycle_id` | `employee_lifecycle` |
| `employee_hr_reminder_log` | `tenant_id` | `tenants` |
| `employee_hr_templates` | `tenant_id` | `tenants` |
| `employee_lifecycle` | `tenant_id` | `tenants` |
| `employee_meeting_action_items` | `meeting_id` | `employee_meetings` |
| `employee_meeting_action_items` | `task_id` | `tasks` |
| `employee_meeting_audit` | `meeting_id` | `employee_meetings` |
| `employee_meeting_private_notes` | `meeting_id` | `employee_meetings` |
| `employee_meeting_requests` | `scheduled_meeting_id` | `employee_meetings` |
| `employee_meeting_requests` | `tenant_id` | `tenants` |
| `employee_meetings` | `tenant_id` | `tenants` |
| `employee_responsibilities` | `tenant_id`, `committee_id` | `committees` |
| `employee_responsibilities` | `tenant_id`, `region_id` | `regions` |
| `employee_responsibilities` | `tenant_id` | `tenants` |
| `employee_responsibilities` | `tenant_id`, `topic_id` | `topics` |
| `event_email_templates` | `tenant_id` | `tenants` |
| `event_planning_action_logs` | `checklist_item_id` | `event_planning_checklist_items` |
| `event_planning_action_logs` | `action_id` | `event_planning_item_actions` |
| `event_planning_checklist_items` | `event_planning_id` | `event_plannings` |
| `event_planning_collaborators` | `event_planning_id` | `event_plannings` |
| `event_planning_contacts` | `event_planning_id` | `event_plannings` |
| `event_planning_dates` | `appointment_id` | `appointments` |
| `event_planning_dates` | `event_planning_id` | `event_plannings` |
| `event_planning_documents` | `event_planning_id` | `event_plannings` |
| `event_planning_documents` | `tenant_id` | `tenants` |
| `event_planning_item_actions` | `checklist_item_id` | `event_planning_checklist_items` |
| `event_planning_speakers` | `event_planning_id` | `event_plannings` |
| `event_planning_timeline_assignments` | `checklist_item_id` | `event_planning_checklist_items` |
| `event_planning_timeline_assignments` | `event_planning_id` | `event_plannings` |
| `event_plannings` | `template_id` | `planning_templates` |
| `event_plannings` | `tenant_id` | `tenants` |
| `event_rsvp_public_links` | `event_rsvp_id` | `event_rsvps` |
| `event_rsvps` | `event_planning_id` | `event_plannings` |
| `event_rsvps` | `tenant_id` | `tenants` |
| `expense_budgets` | `tenant_id` | `tenants` |
| `expense_categories` | `tenant_id` | `tenants` |
| `expenses` | `category_id` | `expense_categories` |
| `expenses` | `created_from_recurring` | `expenses` |
| `expenses` | `tenant_id` | `tenants` |
| `external_events` | `external_calendar_id` | `external_calendars` |
| `facts` | `contact_id` | `contacts` |
| `facts` | `dossier_id` | `dossiers` |
| `field_permissions` | `tenant_id` | `tenants` |
| `funding_participants` | `contact_id` | `contacts` |
| `funding_participants` | `funding_id` | `fundings` |
| `fundings` | `tenant_id` | `tenants` |
| `habits` | `tenant_id` | `tenants` |
| `knowledge_document_collaborators` | `document_id` | `knowledge_documents` |
| `knowledge_document_permissions` | `document_id` | `knowledge_documents` |
| `knowledge_document_topics` | `document_id` | `knowledge_documents` |
| `knowledge_document_topics` | `tenant_id`, `topic_id` | `topics` |
| `knowledge_document_topics` | `topic_id` | `topics` |
| `knowledge_document_versions` | `document_id` | `knowledge_documents` |
| `knowledge_document_versions` | `tenant_id` | `tenants` |
| `knowledge_documents` | `tenant_id` | `tenants` |
| `knowledge_question_attachments` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_attachments` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_attachments` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_comments` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_comments` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_comments` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_followers` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_followers` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_followers` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_outdated_reports` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_sources` | `case_id` | `case_files` |
| `knowledge_question_sources` | `document_id` | `documents` |
| `knowledge_question_sources` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_sources` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_sources` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_tags` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_tags` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_tags` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_tags` | `tenant_id`, `tag_id` | `knowledge_tags` |
| `knowledge_question_topics` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_topics` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_topics` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_question_topics` | `tenant_id` | `tenants` |
| `knowledge_question_topics` | `tenant_id`, `topic_id` | `topics` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_question_cards` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_question_summaries` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_questions` |
| `knowledge_questions` | `tenant_id` | `tenants` |
| `knowledge_tags` | `tenant_id` | `tenants` |
| `letter_collaborators` | `letter_id` | `letters` |
| `letter_comments` | `parent_comment_id` | `letter_comments` |
| `letter_comments` | `letter_id` | `letters` |
| `letter_occasions` | `default_template_id` | `letter_templates` |
| `letter_occasions` | `tenant_id` | `tenants` |
| `letter_template_assets` | `template_id` | `letter_templates` |
| `letter_template_settings` | `tenant_id` | `tenants` |
| `letter_templates` | `default_sender_id` | `sender_information` |
| `letters` | `information_block_id` | `information_blocks` |
| `letters` | `template_id` | `letter_templates` |
| `letters` | `sender_information_id` | `sender_information` |
| `login_customization` | `tenant_id` | `tenants` |
| `map_flag_topics` | `flag_id` | `map_flags` |
| `map_flag_topics` | `tenant_id`, `topic_id` | `topics` |
| `map_flag_topics` | `topic_id` | `topics` |
| `map_flag_types` | `tenant_id` | `tenants` |
| `map_flags` | `flag_type_id` | `map_flag_types` |
| `map_flags` | `tenant_id` | `tenants` |
| `map_layers` | `tenant_id` | `tenants` |
| `map_routes` | `tenant_id` | `tenants` |
| `matrix_subscriptions` | `tenant_id` | `tenants` |
| `matrix_widget_callback_requests` | `task_id` | `tasks` |
| `matrix_widget_improvement_triggers` | `feedback_id` | `matrix_widget_message_feedback` |
| `matrix_widget_improvement_triggers` | `tenant_id` | `tenants` |
| `matrix_widget_message_feedback` | `tenant_id` | `tenants` |
| `meeting_agenda_items` | `parent_id` | `meeting_agenda_items` |
| `meeting_agenda_items` | `meeting_id` | `meetings` |
| `meeting_participants` | `meeting_id` | `meetings` |
| `meeting_participants` | `user_id` | `profiles` |
| `meeting_protocol_addenda` | `meeting_id` | `meetings` |
| `meeting_protocol_details` | `meeting_id` | `meetings` |
| `meeting_templates` | `tenant_id` | `tenants` |
| `meetings` | `parent_meeting_id` | `meetings` |
| `meetings` | `tenant_id` | `tenants` |
| `message_confirmations` | `message_id` | `messages` |
| `message_recipients` | `message_id` | `messages` |
| `messages` | `tenant_id` | `tenants` |
| `ministry_history_changes` | `entry_id` | `ministry_history_entries` |
| `ministry_history_entries` | `line_id` | `ministry_history_lines` |
| `ministry_history_links` | `predecessor_id` | `ministry_history_lines` |
| `ministry_history_links` | `successor_id` | `ministry_history_lines` |
| `news_article_states` | `tenant_id`, `article_id` | `news_articles` |
| `news_article_states` | `tenant_id` | `tenants` |
| `news_articles` | `tenant_id` | `tenants` |
| `news_email_templates` | `tenant_id` | `tenants` |
| `notification_types` | `tenant_id` | `tenants` |
| `notifications` | `notification_type_id` | `notification_types` |
| `notifications` | `tenant_id` | `tenants` |
| `office_debrief_state` | `feedback_id` | `appointment_feedback` |
| `parlis_deputy_mandates` | `mandate_id` | `election_history_mandates` |
| `parlis_deputy_mandates` | `legislature`, `vorgangs_id` | `parlis_proceedings` |
| `parlis_ministry_assignments` | `line_id` | `parlis_ministry_lines` |
| `parlis_ministry_assignments` | `tenant_id` | `tenants` |
| `parlis_ministry_suggestions` | `line_id` | `parlis_ministry_lines` |
| `parlis_ministry_topics` | `line_id` | `parlis_ministry_lines` |
| `parlis_ministry_topics` | `tenant_id` | `tenants` |
| `parlis_ministry_topics` | `tenant_id`, `topic_id` | `topics` |
| `planning_item_documents` | `tenant_id` | `tenants` |
| `planning_templates` | `tenant_id` | `tenants` |
| `poll_notifications` | `poll_id` | `appointment_polls` |
| `poll_notifications` | `participant_id` | `poll_participants` |
| `poll_participants` | `poll_id` | `appointment_polls` |
| `poll_responses` | `poll_id` | `appointment_polls` |
| `poll_responses` | `participant_id` | `poll_participants` |
| `poll_responses` | `time_slot_id` | `poll_time_slots` |
| `poll_time_slots` | `poll_id` | `appointment_polls` |
| `poll_versions` | `poll_id` | `appointment_polls` |
| `press_releases` | `tenant_id` | `tenants` |
| `profiles` | `tenant_id` | `tenants` |
| `protocol_agenda_items` | `protocol_id` | `parliament_protocols` |
| `protocol_sessions` | `protocol_id` | `parliament_protocols` |
| `protocol_speeches` | `protocol_id` | `parliament_protocols` |
| `protocol_speeches` | `agenda_item_id` | `protocol_agenda_items` |
| `public_holidays` | `tenant_id` | `tenants` |
| `quick_note_global_shares` | `tenant_id` | `tenants` |
| `quick_note_shares` | `note_id` | `quick_notes` |
| `quick_note_shares` | `tenant_id` | `tenants` |
| `quick_note_topic_mention_deliveries` | `note_id` | `quick_notes` |
| `quick_note_topic_mention_deliveries` | `tenant_id` | `tenants` |
| `quick_note_topic_mention_deliveries` | `topic_id` | `topics` |
| `quick_note_versions` | `note_id` | `quick_notes` |
| `quick_note_versions` | `tenant_id` | `tenants` |
| `quick_note_write_receipts` | `note_id` | `quick_notes` |
| `quick_note_write_receipts` | `tenant_id` | `tenants` |
| `quick_notes` | `case_item_id` | `case_items` |
| `quick_notes` | `meeting_id` | `meetings` |
| `quick_notes` | `decision_id` | `task_decisions` |
| `quick_notes` | `task_id` | `tasks` |
| `quick_notes` | `tenant_id` | `tenants` |
| `quick_notes` | `topic_backlog_id` | `topic_backlog` |
| `regions` | `election_district_id` | `election_districts` |
| `regions` | `tenant_id` | `tenants` |
| `routine_package_runs` | `annual_task_id` | `annual_tasks` |
| `routine_package_runs` | `rule_id` | `automation_rules` |
| `routine_package_runs` | `hr_template_id` | `employee_hr_templates` |
| `routine_package_runs` | `tenant_id`, `employee_lifecycle_id` | `employee_lifecycle` |
| `routine_package_runs` | `task_id` | `tasks` |
| `routine_package_runs` | `tenant_id` | `tenants` |
| `routine_package_steps` | `run_id` | `routine_package_runs` |
| `routine_package_steps` | `approval_id` | `task_decisions` |
| `rss_settings` | `tenant_id` | `tenants` |
| `rss_sources` | `tenant_id` | `tenants` |
| `scheduled_emails` | `sender_id` | `sender_information` |
| `scheduled_emails` | `tenant_id` | `tenants` |
| `search_analytics` | `tenant_id` | `tenants` |
| `social_approval_comments` | `content_item_id` | `social_content_items` |
| `social_campaigns` | `created_by` | `profiles` |
| `social_campaigns` | `owner_id` | `profiles` |
| `social_campaigns` | `tenant_id` | `tenants` |
| `social_content_approval_events` | `actor_id` | `profiles` |
| `social_content_approval_events` | `content_item_id` | `social_content_items` |
| `social_content_approval_events` | `tenant_id` | `tenants` |
| `social_content_channels` | `tenant_id` | `tenants` |
| `social_content_item_channels` | `created_by` | `profiles` |
| `social_content_item_channels` | `channel_id` | `social_content_channels` |
| `social_content_item_channels` | `content_item_id` | `social_content_items` |
| `social_content_item_channels` | `tenant_id` | `tenants` |
| `social_content_items` | `approved_by` | `profiles` |
| `social_content_items` | `created_by` | `profiles` |
| `social_content_items` | `responsible_user_id` | `profiles` |
| `social_content_items` | `campaign_id` | `social_campaigns` |
| `social_content_items` | `tenant_id` | `tenants` |
| `social_content_items` | `topic_backlog_id` | `topic_backlog` |
| `social_content_variants` | `created_by` | `profiles` |
| `social_content_variants` | `channel_id` | `social_content_channels` |
| `social_content_variants` | `content_item_id` | `social_content_items` |
| `social_content_variants` | `tenant_id` | `tenants` |
| `social_planner_notes` | `tenant_id` | `tenants` |
| `starred_appointments` | `appointment_id` | `appointments` |
| `starred_appointments` | `external_event_id` | `external_events` |
| `starred_appointments` | `meeting_id` | `meetings` |
| `starred_appointments` | `tenant_id` | `tenants` |
| `subtasks` | `task_id` | `tasks` |
| `tags` | `tenant_id` | `tenants` |
| `task_assignees` | `assigned_by` | `profiles` |
| `task_assignees` | `user_id` | `profiles` |
| `task_assignees` | `task_id` | `tasks` |
| `task_batch_actions` | `tenant_id` | `tenants` |
| `task_categories` | `tenant_id` | `tenants` |
| `task_comments` | `parent_id` | `task_comments` |
| `task_comments` | `task_id` | `tasks` |
| `task_decision_attachments` | `decision_id` | `task_decisions` |
| `task_decision_comment_reactions` | `comment_id` | `task_decision_comments` |
| `task_decision_comments` | `parent_id` | `task_decision_comments` |
| `task_decision_comments` | `decision_id` | `task_decisions` |
| `task_decision_participants` | `decision_id` | `task_decisions` |
| `task_decision_response_history` | `participant_id` | `task_decision_participants` |
| `task_decision_response_history` | `response_id` | `task_decision_responses` |
| `task_decision_response_history` | `decision_id` | `task_decisions` |
| `task_decision_responses` | `participant_id` | `task_decision_participants` |
| `task_decision_responses` | `parent_response_id` | `task_decision_responses` |
| `task_decision_responses` | `decision_id` | `task_decisions` |
| `task_decision_topics` | `decision_id` | `task_decisions` |
| `task_decision_topics` | `tenant_id`, `topic_id` | `topics` |
| `task_decision_topics` | `topic_id` | `topics` |
| `task_decisions` | `case_file_id` | `case_files` |
| `task_decisions` | `case_item_id` | `case_items` |
| `task_decisions` | `meeting_id` | `meetings` |
| `task_decisions` | `task_id` | `tasks` |
| `task_decisions` | `tenant_id` | `tenants` |
| `task_topics` | `task_id` | `tasks` |
| `task_topics` | `tenant_id`, `topic_id` | `topics` |
| `task_topics` | `topic_id` | `topics` |
| `tasks` | `call_log_id` | `call_logs` |
| `tasks` | `meeting_id` | `meetings` |
| `tasks` | `parent_task_id` | `tasks` |
| `tasks` | `tenant_id` | `tenants` |
| `team_announcement_dismissals` | `announcement_id` | `team_announcements` |
| `team_announcements` | `tenant_id` | `tenants` |
| `team_bingo_settings` | `tenant_id` | `tenants` |
| `team_dashboards` | `tenant_id` | `tenants` |
| `team_fun_facts` | `tenant_id`, `user_id` | `team_ritual_profiles` |
| `team_question_answers` | `tenant_id`, `week_id` | `team_question_weeks` |
| `team_question_answers` | `tenant_id`, `user_id` | `team_ritual_profiles` |
| `team_question_weeks` | `tenant_id`, `question_id` | `team_questions` |
| `team_question_weeks` | `tenant_id` | `tenants` |
| `team_questions` | `tenant_id` | `tenants` |
| `team_ritual_profiles` | `tenant_id` | `tenants` |
| `team_ritual_settings` | `tenant_id` | `tenants` |
| `team_two_truths_answers` | `tenant_id`, `user_id` | `team_ritual_profiles` |
| `team_two_truths_answers` | `tenant_id`, `quiz_id` | `team_two_truths_months` |
| `team_two_truths_months` | `tenant_id`, `subject_user_id` | `team_fun_facts` |
| `team_two_truths_months` | `tenant_id` | `tenants` |
| `tenant_collaborations` | `tenant_a_id` | `tenants` |
| `tenant_collaborations` | `tenant_b_id` | `tenants` |
| `tenant_feature_flags` | `tenant_id` | `tenants` |
| `tenant_onboarding_checklist_items` | `tenant_id` | `tenants` |
| `tenant_onboarding_slides` | `tenant_id` | `tenants` |
| `time_entries` | `tenant_id` | `tenants` |
| `todos` | `tenant_id` | `tenants` |
| `todos` | `category_id` | `todo_categories` |
| `topic_backlog` | `created_by` | `profiles` |
| `topic_backlog` | `owner_id` | `profiles` |
| `topic_backlog` | `campaign_id` | `social_campaigns` |
| `topic_backlog` | `tenant_id` | `tenants` |
| `topic_catalog_links` | `tenant_id`, `committee_id` | `committees` |
| `topic_catalog_links` | `tenant_id`, `region_id` | `regions` |
| `topic_catalog_links` | `tenant_id` | `tenants` |
| `topic_catalog_links` | `tenant_id`, `topic_id` | `topics` |
| `topic_module_settings` | `tenant_id` | `tenants` |
| `topics` | `tenant_id` | `tenants` |
| `topics` | `merged_into` | `topics` |
| `user_notification_settings` | `notification_type_id` | `notification_types` |
| `user_onboarding_state` | `tenant_id` | `tenants` |
| `user_planning_preferences` | `tenant_id` | `tenants` |
| `user_preferences` | `tenant_id` | `tenants` |
| `user_status` | `tenant_id` | `tenants` |
| `user_tenant_memberships` | `tenant_id` | `tenants` |
| `vacation_checklist_responses` | `leave_request_id` | `leave_requests` |
| `vacation_checklist_responses` | `checklist_item_id` | `vacation_checklist_templates` |
| `vacation_checklist_templates` | `tenant_id` | `tenants` |
| `workflow_action_log` | `run_id` | `workflow_runs` |
| `workflow_runs` | `workflow_id` | `workflow_definitions` |
| `workflow_runs` | `parent_run_id` | `workflow_runs` |
