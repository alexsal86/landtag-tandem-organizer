# Selbsttest-Abdeckung

_Auto-generiert mit `npm run update:selftest-coverage`._

Quelle: `src/integrations/supabase/types.ts`. Die Angaben beschreiben deklarierte Prüfumfänge, keine erfolgreichen Testläufe und keine Code-Coverage.

Von 363 Tabellen haben 111 ein registriertes Szenario; 4 sind noch nicht eingeordnet. 248 sind befristet ausgenommen, davon 112 als Ausbau offen und 136 als technisch oder fachlich ausgenommen. Ausnahmen zählen nicht als bestanden.

## Szenarien

| ID | Titel | Tabellen |
|---|---|---|
| `access-boundaries` | Zugriffsschutz (Bürogrenzen und Entscheiderrolle) | appointment_requests |
| `admin-controls` | Adminregeln: Feldschutz, Aktionen, Export, Rücknahme und Feeds | Keine (reine Regeln) |
| `annual-task-stafette` | Jahresaufgabe → Büroaufgabe → Jahresabschluss | annual_tasks, annual_task_completions, tasks |
| `appointment-briefing-lifecycle` | Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben) | appointments, tasks, appointment_change_alerts |
| `appointment-lifecycle` | Termin-Lifecycle (Kalender + Briefing + Feedback) | appointments, appointment_preparations, appointment_feedback |
| `appointment-request-lifecycle` | Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin) | appointment_requests, appointments |
| `case-file-lifecycle` | Fallakte mit Folgetabellen (Container) im Unterschied zum Vorgang | case_files, case_file_participants, case_file_status_history, case_file_notes, case_file_timeline, case_file_contacts, case_file_documents, documents, case_file_tasks, case_file_appointments, case_file_letters, document_contacts, case_items, contacts, tasks, appointments, letters |
| `case-item-lifecycle` | Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss) | case_items, case_item_interactions, case_item_handover_log, task_decisions, task_decision_participants, task_decision_responses, appointment_requests, day_slips, tasks |
| `contact-lifecycle` | Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche) | contacts, contact_activities, contact_usage_stats |
| `contact-relations` | Kontakt-Beziehungen (Datenschutz → Themen → Duplikate → Sammelaktion → Verteiler → Wissen → Förderungen) | contacts, contact_activities, contact_topics, topics, call_logs, distribution_lists, distribution_list_members, gdpr_requests, map_flags, map_flag_types, contact_briefing_memory, fundings, funding_participants |
| `daily-briefing-lifecycle` | Tages-Briefings (Vortag-Regel) | daily_briefings |
| `day-slip-lifecycle` | Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag) | day_slips, tasks, quick_notes |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | task_decisions, task_decision_participants, task_decision_responses, task_decision_response_history, task_decision_vote_effects, task_decision_attachments, task_decision_comments, task_decision_comment_reactions, dashboard_decision_nudges |
| `document-annotation` | Dokument-Annotation | documents, document_annotations, document_annotation_events, document_annotation_tasks, tasks, task_assignees |
| `document-list` | Dokumente: Suche, Kategorien, Sortierung und Auswahl | Keine (reine Regeln) |
| `election-analysis` | Wahlanalyse: Datenqualität und Vergleichbarkeit | Keine (reine Regeln) |
| `election-deputy-reader` | Wahlanalyse: Abgeordnetenübersicht | Keine (reine Regeln) |
| `election-history-workbench` | Wahldaten: Problemfälle und Landeslisten | Keine (reine Regeln) |
| `election-map` | Wahlkreiskarte: Suche und Grenzdaten | Keine (reine Regeln) |
| `employee-meetings` | Mitarbeitergespräche (Anfrage → Termin → Vorbereitung → Freigabe/Sperre) | employee_meeting_requests, employee_meetings, employee_meeting_private_notes, employee_meeting_action_items, employee_meeting_audit |
| `employee-protection` | Mitarbeiterschutz: Protokollsperre, Belastungsgrenzen und Vorbereitung | Keine (reine Regeln) |
| `event-planning-lifecycle` | Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline) | event_plannings, event_planning_dates, event_planning_speakers, event_planning_contacts, event_planning_checklist_items, event_planning_timeline_assignments |
| `jour-fixe-platform-integration` | Jour Fixe: Plattformquellen & Stafetten-Abschluss | meetings, meeting_agenda_items, tasks, task_decisions |
| `knowledge-lifecycle` | Wissen: Fragen, Antworten und manuelle Prüfung | knowledge_questions, knowledge_question_events, knowledge_qa_notification_deliveries |
| `letter-lifecycle` | Brief-Lifecycle (Entwurf → Prüfung → Freigabe → Archiv und Folgeaufgabe) | letters, letter_attachments, letter_collaborators, letter_comments, documents, tasks |
| `meeting-lifecycle` | Meeting-Lifecycle (vollständig + Field-Verifikation) | meetings, meeting_templates, meeting_protocol_details, meeting_protocol_addenda, meeting_agenda_items, meeting_agenda_documents, meeting_participants, appointments, tasks |
| `notification-inbox` | Benachrichtigungs-Inbox (Erzeugen, Gelesen-Markieren, Zurücksetzen und Zugriffsgrenze) | notifications |
| `onboarding-hr` | HR-Onboarding und Offboarding | employee_lifecycle, employee_hr_templates, routine_package_runs, routine_package_steps, employee_hr_evidence, employee_hr_gdpr_declarations, employee_hr_reminder_log, notification_types, notifications, tasks, subtasks |
| `parlis` | Parlamentarische Vorgänge | Keine (reine Regeln) |
| `poll-lifecycle` | Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen) | appointment_polls, poll_time_slots, poll_participants, appointments, appointment_guests |
| `quick-note-lifecycle` | Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv) | quick_notes, tasks, task_decisions, task_decision_participants |
| `responsibilities` | Zuständigkeiten & Matrix | tasks |
| `security-hardening` | Sicherheitsregeln: Porträtdateien und E-Mail-Inhalte | Keine (reine Regeln) |
| `social-content-lifecycle` | Social-Content-Lifecycle (Planung, Kanalvariante, Freigabe und Ereignisprotokoll) | topic_backlog, social_content_items, social_content_channels, social_content_item_channels, social_content_variants, social_content_approval_events, social_approval_comments, tasks, task_assignees, notifications |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | tasks, task_documents, task_decisions, task_decision_participants, task_decision_responses, task_statuses |
| `task-stafette-lifecycle` | Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe) | tasks, task_assignees, task_snoozes, archived_tasks, task_batch_actions |
| `team-rituals` | Freiwillige Team-Rituale | Keine (reine Regeln) |
| `topic-linking` | Themenverknüpfung und Modul-Steuerung | topics, case_item_topics, case_items, knowledge_question_topics, topic_module_settings, committees, regions, employee_responsibilities, topic_catalog_links |
| `workflow-rules` | Geschäftsregeln (Freigabe, Rollen, Fristen) | Keine (reine Regeln) |

## Tabellen

| Tabelle | Einordnung | Szenarien |
|---|---|---|
| `action_permissions` | Ausstehend bis 2027-06-30 | — |
| `admin_status_options` | Ausgenommen bis 2027-06-30 | — |
| `annual_task_completions` | Szenario vorhanden | annual-task-stafette |
| `annual_tasks` | Szenario vorhanden | annual-task-stafette |
| `app_settings` | Ausgenommen bis 2027-06-30 | — |
| `appointment_categories` | Ausgenommen bis 2027-06-30 | — |
| `appointment_change_alerts` | Szenario vorhanden | appointment-briefing-lifecycle |
| `appointment_contacts` | Ausgenommen bis 2027-06-30 | — |
| `appointment_documents` | Ausgenommen bis 2027-06-30 | — |
| `appointment_feedback` | Szenario vorhanden | appointment-lifecycle |
| `appointment_feedback_settings` | Ausgenommen bis 2027-06-30 | — |
| `appointment_guests` | Szenario vorhanden | poll-lifecycle |
| `appointment_locations` | Ausgenommen bis 2027-06-30 | — |
| `appointment_polls` | Szenario vorhanden | poll-lifecycle |
| `appointment_preparation_documents` | Ausgenommen bis 2027-06-30 | — |
| `appointment_preparation_templates` | Ausgenommen bis 2027-06-30 | — |
| `appointment_preparations` | Szenario vorhanden | appointment-lifecycle |
| `appointment_reminder_dispatches` | Ausgenommen bis 2027-06-30 | — |
| `appointment_requests` | Szenario vorhanden | access-boundaries, appointment-request-lifecycle, case-item-lifecycle |
| `appointment_statuses` | Ausgenommen bis 2027-06-30 | — |
| `appointment_topics` | Ausgenommen bis 2027-06-30 | — |
| `appointments` | Szenario vorhanden | appointment-briefing-lifecycle, appointment-lifecycle, appointment-request-lifecycle, case-file-lifecycle, meeting-lifecycle, poll-lifecycle |
| `archived_tasks` | Szenario vorhanden | task-stafette-lifecycle |
| `audit_log_entries` | Ausgenommen bis 2027-06-30 | — |
| `automation_rate_limits` | Ausgenommen bis 2027-06-30 | — |
| `automation_rule_run_steps` | Ausgenommen bis 2027-06-30 | — |
| `automation_rule_runs` | Ausgenommen bis 2027-06-30 | — |
| `automation_rule_versions` | Ausgenommen bis 2027-06-30 | — |
| `automation_rules` | Ausstehend bis 2027-03-31 | — |
| `bulk_action_audit` | Ausgenommen bis 2027-06-30 | — |
| `calendar_sync_settings` | Ausgenommen bis 2027-06-30 | — |
| `call_logs` | Szenario vorhanden | contact-relations |
| `carryover_items` | Ausstehend bis 2027-03-31 | — |
| `case_file_appointments` | Szenario vorhanden | case-file-lifecycle |
| `case_file_contacts` | Szenario vorhanden | case-file-lifecycle |
| `case_file_documents` | Szenario vorhanden | case-file-lifecycle |
| `case_file_letters` | Szenario vorhanden | case-file-lifecycle |
| `case_file_notes` | Szenario vorhanden | case-file-lifecycle |
| `case_file_participants` | Szenario vorhanden | case-file-lifecycle |
| `case_file_processing_statuses` | Ausgenommen bis 2027-06-30 | — |
| `case_file_status_history` | Szenario vorhanden | case-file-lifecycle |
| `case_file_tasks` | Szenario vorhanden | case-file-lifecycle |
| `case_file_timeline` | Szenario vorhanden | case-file-lifecycle |
| `case_file_topics` | Ausgenommen bis 2027-06-30 | — |
| `case_file_types` | Ausgenommen bis 2027-06-30 | — |
| `case_files` | Szenario vorhanden | case-file-lifecycle |
| `case_item_attachments` | Ausstehend bis 2027-03-31 | — |
| `case_item_categories` | Ausgenommen bis 2027-06-30 | — |
| `case_item_escalation_suggestions` | Ausgenommen bis 2027-06-30 | — |
| `case_item_handover_log` | Szenario vorhanden | case-item-lifecycle |
| `case_item_interactions` | Szenario vorhanden | case-item-lifecycle |
| `case_item_participants` | Ausgenommen bis 2027-06-30 | — |
| `case_item_timeline` | Ausgenommen bis 2027-06-30 | — |
| `case_item_topics` | Szenario vorhanden | topic-linking |
| `case_items` | Szenario vorhanden | case-file-lifecycle, case-item-lifecycle, topic-linking |
| `celebration_animations` | Ausgenommen bis 2027-06-30 | — |
| `celebration_settings` | Ausgenommen bis 2027-06-30 | — |
| `committees` | Szenario vorhanden | topic-linking |
| `contact_activities` | Szenario vorhanden | contact-lifecycle, contact-relations |
| `contact_briefing_memory` | Szenario vorhanden | contact-relations |
| `contact_topics` | Szenario vorhanden | contact-relations |
| `contact_usage_stats` | Szenario vorhanden | contact-lifecycle |
| `contacts` | Szenario vorhanden | case-file-lifecycle, contact-lifecycle, contact-relations |
| `daily_briefing_reads` | Ausstehend bis 2027-03-31 | — |
| `daily_briefings` | Szenario vorhanden | daily-briefing-lifecycle |
| `dashboard_decision_nudges` | Szenario vorhanden | decision-lifecycle |
| `dashboard_layouts` | Ausgenommen bis 2027-06-30 | — |
| `data_lint_findings` | Ausgenommen bis 2027-06-30 | — |
| `day_slips` | Szenario vorhanden | case-item-lifecycle, day-slip-lifecycle |
| `decision_archive_settings` | Ausgenommen bis 2027-06-30 | — |
| `decision_email_templates` | Ausgenommen bis 2027-06-30 | — |
| `decision_matrix_messages` | Ausgenommen bis 2027-06-30 | — |
| `default_appointment_guests` | Ausgenommen bis 2027-06-30 | — |
| `distribution_list_members` | Szenario vorhanden | contact-relations |
| `distribution_lists` | Szenario vorhanden | contact-relations |
| `district_notes` | Ausstehend bis 2027-03-31 | — |
| `district_support_assignments` | Ausstehend bis 2027-03-31 | — |
| `document_annotation_events` | Szenario vorhanden | document-annotation |
| `document_annotation_tasks` | Szenario vorhanden | document-annotation |
| `document_annotations` | Szenario vorhanden | document-annotation |
| `document_categories` | Ausgenommen bis 2027-06-30 | — |
| `document_contacts` | Szenario vorhanden | case-file-lifecycle |
| `document_folders` | Ausstehend bis 2027-03-31 | — |
| `document_topics` | Ausgenommen bis 2027-06-30 | — |
| `documents` | Szenario vorhanden | case-file-lifecycle, document-annotation, letter-lifecycle |
| `dossier_entries` | Ausstehend bis 2027-03-31 | — |
| `dossier_links` | Ausgenommen bis 2027-06-30 | — |
| `dossier_position_versions` | Ausgenommen bis 2027-06-30 | — |
| `dossier_source_watchers` | Ausgenommen bis 2027-06-30 | — |
| `dossier_stakeholders` | Ausgenommen bis 2027-06-30 | — |
| `dossier_talking_points` | Ausgenommen bis 2027-06-30 | — |
| `dossiers` | Ausstehend bis 2027-03-31 | — |
| `edge_function_cache` | Ausgenommen bis 2027-06-30 | — |
| `egress_anomalies` | Ausgenommen bis 2027-06-30 | — |
| `egress_metrics` | Ausgenommen bis 2027-06-30 | — |
| `election_analysis_bw_polls` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_candidate_coverage` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_candidates` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_correction_audit` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_demographics` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_district_workbook_audit` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_districts` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_flow_matrix` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_flows` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_geographies` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_local_results` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_period_proposals` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_scenarios` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_source_reviews` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_state` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_state_totals` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_turnout` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_versions` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_workbook_audit` | Ausstehend bis 2027-06-30 | — |
| `election_analysis_years` | Ausstehend bis 2027-06-30 | — |
| `election_district_municipalities` | Ausgenommen bis 2027-06-30 | — |
| `election_district_notes` | Ausgenommen bis 2027-06-30 | — |
| `election_districts` | Ausstehend bis 2027-06-30 | — |
| `election_history_1952_result_sources` | Ausstehend bis 2027-06-30 | — |
| `election_history_assembly_issues` | Ausstehend bis 2027-06-30 | — |
| `election_history_audit` | Ausstehend bis 2027-06-30 | — |
| `election_history_candidacies` | Ausstehend bis 2027-06-30 | — |
| `election_history_candidate_workbook_audit` | Ausstehend bis 2027-06-30 | — |
| `election_history_connection_people` | Ausstehend bis 2027-06-30 | — |
| `election_history_districts` | Ausstehend bis 2027-06-30 | — |
| `election_history_factions` | Ausstehend bis 2027-06-30 | — |
| `election_history_mandate_birthdays` | Ausstehend bis 2027-06-30 | — |
| `election_history_mandates` | Ausstehend bis 2027-06-30 | — |
| `election_history_people` | Ausstehend bis 2027-06-30 | — |
| `election_history_periods` | Ausstehend bis 2027-06-30 | — |
| `election_history_state_list_entries` | Ausstehend bis 2027-06-30 | — |
| `election_history_state_lists` | Ausstehend bis 2027-06-30 | — |
| `election_representatives` | Ausstehend bis 2027-06-30 | — |
| `email_logs` | Ausgenommen bis 2027-06-30 | — |
| `email_templates` | Ausgenommen bis 2027-06-30 | — |
| `employee_hr_evidence` | Szenario vorhanden | onboarding-hr |
| `employee_hr_gdpr_declarations` | Szenario vorhanden | onboarding-hr |
| `employee_hr_reminder_log` | Szenario vorhanden | onboarding-hr |
| `employee_hr_templates` | Szenario vorhanden | onboarding-hr |
| `employee_lifecycle` | Szenario vorhanden | onboarding-hr |
| `employee_meeting_action_items` | Szenario vorhanden | employee-meetings |
| `employee_meeting_audit` | Szenario vorhanden | employee-meetings |
| `employee_meeting_private_notes` | Szenario vorhanden | employee-meetings |
| `employee_meeting_requests` | Szenario vorhanden | employee-meetings |
| `employee_meetings` | Szenario vorhanden | employee-meetings |
| `employee_responsibilities` | Szenario vorhanden | topic-linking |
| `employee_settings` | Ausgenommen bis 2027-06-30 | — |
| `employee_settings_history` | Ausgenommen bis 2027-06-30 | — |
| `employee_yearly_stats` | Ausgenommen bis 2027-06-30 | — |
| `event_email_templates` | Ausgenommen bis 2027-06-30 | — |
| `event_planning_action_logs` | Ausgenommen bis 2027-06-30 | — |
| `event_planning_checklist_items` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_collaborators` | Ausgenommen bis 2027-06-30 | — |
| `event_planning_contacts` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_dates` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_documents` | Ausgenommen bis 2027-06-30 | — |
| `event_planning_item_actions` | Ausgenommen bis 2027-06-30 | — |
| `event_planning_speakers` | Szenario vorhanden | event-planning-lifecycle |
| `event_planning_timeline_assignments` | Szenario vorhanden | event-planning-lifecycle |
| `event_plannings` | Szenario vorhanden | event-planning-lifecycle |
| `event_rsvp_public_links` | Ausgenommen bis 2027-06-30 | — |
| `event_rsvps` | Ausgenommen bis 2027-06-30 | — |
| `expense_budgets` | Ausgenommen bis 2027-06-30 | — |
| `expense_categories` | Ausgenommen bis 2027-06-30 | — |
| `expenses` | Ausstehend bis 2027-03-31 | — |
| `external_calendars` | Ausstehend bis 2027-06-30 | — |
| `external_events` | Ausstehend bis 2027-06-30 | — |
| `facts` | Ausstehend bis 2027-06-30 | — |
| `field_permissions` | Ausstehend bis 2027-06-30 | — |
| `funding_participants` | Szenario vorhanden | contact-relations |
| `fundings` | Szenario vorhanden | contact-relations |
| `gdpr_requests` | Szenario vorhanden | contact-relations |
| `habit_completions` | Ausstehend bis 2027-03-31 | — |
| `habits` | Ausstehend bis 2027-03-31 | — |
| `information_blocks` | Ausstehend bis 2027-03-31 | — |
| `karlsruhe_districts` | Ausstehend bis 2027-03-31 | — |
| `knowledge_document_collaborators` | Ausgenommen bis 2027-06-30 | — |
| `knowledge_document_permissions` | Ausgenommen bis 2027-06-30 | — |
| `knowledge_document_snapshots` | Ausgenommen bis 2027-06-30 | — |
| `knowledge_document_topics` | Ausgenommen bis 2027-06-30 | — |
| `knowledge_document_versions` | Ausgenommen bis 2027-06-30 | — |
| `knowledge_documents` | Ausstehend bis 2027-06-30 | — |
| `knowledge_qa_notification_deliveries` | Szenario vorhanden | knowledge-lifecycle |
| `knowledge_question_attachments` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_comments` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_events` | Szenario vorhanden | knowledge-lifecycle |
| `knowledge_question_followers` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_outdated_reports` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_sources` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_tags` | Ausstehend bis 2027-06-30 | — |
| `knowledge_question_topics` | Szenario vorhanden | topic-linking |
| `knowledge_questions` | Szenario vorhanden | knowledge-lifecycle |
| `knowledge_tags` | Ausstehend bis 2027-06-30 | — |
| `leave_requests` | Ausstehend bis 2027-03-31 | — |
| `letter_archive_settings` | Ausgenommen bis 2027-06-30 | — |
| `letter_attachments` | Szenario vorhanden | letter-lifecycle |
| `letter_collaborators` | Szenario vorhanden | letter-lifecycle |
| `letter_comments` | Szenario vorhanden | letter-lifecycle |
| `letter_occasions` | Ausgenommen bis 2027-06-30 | — |
| `letter_status_transitions` | Ausgenommen bis 2027-06-30 | — |
| `letter_template_assets` | Ausgenommen bis 2027-06-30 | — |
| `letter_template_settings` | Ausgenommen bis 2027-06-30 | — |
| `letter_templates` | Ausgenommen bis 2027-06-30 | — |
| `letter_workflow_history` | Ausgenommen bis 2027-06-30 | — |
| `letters` | Szenario vorhanden | case-file-lifecycle, letter-lifecycle |
| `login_customization` | Ausgenommen bis 2027-06-30 | — |
| `map_flag_topics` | Ausgenommen bis 2027-06-30 | — |
| `map_flag_types` | Szenario vorhanden | contact-relations |
| `map_flags` | Szenario vorhanden | contact-relations |
| `map_layers` | Ausgenommen bis 2027-06-30 | — |
| `map_routes` | Ausstehend bis 2027-03-31 | — |
| `matrix_bot_logs` | Ausgenommen bis 2027-06-30 | — |
| `matrix_morning_settings` | Ausgenommen bis 2027-06-30 | — |
| `matrix_subscriptions` | Ausgenommen bis 2027-06-30 | — |
| `matrix_widget_callback_requests` | Ausgenommen bis 2027-06-30 | — |
| `matrix_widget_improvement_triggers` | Ausgenommen bis 2027-06-30 | — |
| `matrix_widget_message_feedback` | Ausgenommen bis 2027-06-30 | — |
| `meeting_agenda_documents` | Szenario vorhanden | meeting-lifecycle |
| `meeting_agenda_items` | Szenario vorhanden | jour-fixe-platform-integration, meeting-lifecycle |
| `meeting_participants` | Szenario vorhanden | meeting-lifecycle |
| `meeting_protocol_addenda` | Szenario vorhanden | meeting-lifecycle |
| `meeting_protocol_details` | Szenario vorhanden | meeting-lifecycle |
| `meeting_templates` | Szenario vorhanden | meeting-lifecycle |
| `meetings` | Szenario vorhanden | jour-fixe-platform-integration, meeting-lifecycle |
| `message_confirmations` | Ausgenommen bis 2027-06-30 | — |
| `message_recipients` | Ausgenommen bis 2027-06-30 | — |
| `messages` | Ausstehend bis 2027-03-31 | — |
| `ministry_history_changes` | Einordnung fehlt | — |
| `ministry_history_entries` | Einordnung fehlt | — |
| `ministry_history_lines` | Einordnung fehlt | — |
| `ministry_history_links` | Einordnung fehlt | — |
| `mobile_push_tokens` | Ausgenommen bis 2027-06-30 | — |
| `news_article_states` | Ausgenommen bis 2027-06-30 | — |
| `news_articles` | Ausgenommen bis 2027-06-30 | — |
| `news_email_templates` | Ausgenommen bis 2027-06-30 | — |
| `notification_navigation_mapping` | Ausgenommen bis 2027-06-30 | — |
| `notification_types` | Szenario vorhanden | onboarding-hr |
| `notifications` | Szenario vorhanden | notification-inbox, onboarding-hr, social-content-lifecycle |
| `office_debrief_state` | Ausstehend bis 2027-03-31 | — |
| `parliament_protocols` | Ausstehend bis 2027-03-31 | — |
| `parlis_deputy_mandates` | Ausstehend bis 2027-06-30 | — |
| `parlis_ministry_assignments` | Ausstehend bis 2027-06-30 | — |
| `parlis_ministry_lines` | Ausstehend bis 2027-06-30 | — |
| `parlis_ministry_suggestions` | Ausstehend bis 2027-06-30 | — |
| `parlis_ministry_topics` | Ausstehend bis 2027-06-30 | — |
| `parlis_proceedings` | Ausstehend bis 2027-06-30 | — |
| `party_associations` | Ausstehend bis 2027-03-31 | — |
| `planning_item_comments` | Ausgenommen bis 2027-06-30 | — |
| `planning_item_documents` | Ausgenommen bis 2027-06-30 | — |
| `planning_item_subtasks` | Ausgenommen bis 2027-06-30 | — |
| `planning_templates` | Ausgenommen bis 2027-06-30 | — |
| `poll_notifications` | Ausstehend bis 2027-03-31 | — |
| `poll_participants` | Szenario vorhanden | poll-lifecycle |
| `poll_responses` | Ausstehend bis 2027-03-31 | — |
| `poll_time_slots` | Szenario vorhanden | poll-lifecycle |
| `poll_versions` | Ausgenommen bis 2027-06-30 | — |
| `pomodoro_sessions` | Ausstehend bis 2027-03-31 | — |
| `preparation_templates` | Ausgenommen bis 2027-06-30 | — |
| `press_releases` | Ausstehend bis 2027-03-31 | — |
| `profiles` | Ausstehend bis 2027-03-31 | — |
| `protocol_agenda_items` | Ausstehend bis 2027-03-31 | — |
| `protocol_sessions` | Ausstehend bis 2027-03-31 | — |
| `protocol_speeches` | Ausstehend bis 2027-03-31 | — |
| `public_holidays` | Ausstehend bis 2027-03-31 | — |
| `push_subscriptions` | Ausgenommen bis 2027-06-30 | — |
| `quick_note_global_shares` | Ausstehend bis 2027-03-31 | — |
| `quick_note_shares` | Ausstehend bis 2027-03-31 | — |
| `quick_note_topic_mention_deliveries` | Ausgenommen bis 2027-06-30 | — |
| `quick_note_versions` | Ausgenommen bis 2027-06-30 | — |
| `quick_note_write_receipts` | Ausgenommen bis 2027-06-30 | — |
| `quick_notes` | Szenario vorhanden | day-slip-lifecycle, quick-note-lifecycle |
| `regions` | Szenario vorhanden | topic-linking |
| `rls_policy_snapshot_20261124` | Ausgenommen bis 2027-06-30 | — |
| `routine_package_runs` | Szenario vorhanden | onboarding-hr |
| `routine_package_steps` | Szenario vorhanden | onboarding-hr |
| `rss_cache` | Ausgenommen bis 2027-06-30 | — |
| `rss_settings` | Ausgenommen bis 2027-06-30 | — |
| `rss_sources` | Ausgenommen bis 2027-06-30 | — |
| `scheduled_emails` | Ausstehend bis 2027-03-31 | — |
| `search_analytics` | Ausgenommen bis 2027-06-30 | — |
| `security_audit_snapshots` | Ausgenommen bis 2027-06-30 | — |
| `selftest_runs` | Ausgenommen bis 2027-06-30 | — |
| `sender_information` | Ausstehend bis 2027-03-31 | — |
| `sick_days` | Ausstehend bis 2027-03-31 | — |
| `social_approval_comments` | Szenario vorhanden | social-content-lifecycle |
| `social_assets` | Ausstehend bis 2027-03-31 | — |
| `social_campaigns` | Ausstehend bis 2027-03-31 | — |
| `social_content_approval_events` | Szenario vorhanden | social-content-lifecycle |
| `social_content_channels` | Szenario vorhanden | social-content-lifecycle |
| `social_content_item_channels` | Szenario vorhanden | social-content-lifecycle |
| `social_content_items` | Szenario vorhanden | social-content-lifecycle |
| `social_content_variants` | Szenario vorhanden | social-content-lifecycle |
| `social_hashtag_sets` | Ausstehend bis 2027-03-31 | — |
| `social_planner_notes` | Ausstehend bis 2027-03-31 | — |
| `starred_appointments` | Ausgenommen bis 2027-06-30 | — |
| `subtasks` | Szenario vorhanden | onboarding-hr |
| `superadmin_users` | Ausstehend bis 2027-06-30 | — |
| `system_health` | Ausgenommen bis 2027-06-30 | — |
| `tags` | Ausgenommen bis 2027-06-30 | — |
| `task_archive_settings` | Ausgenommen bis 2027-06-30 | — |
| `task_assignees` | Szenario vorhanden | document-annotation, social-content-lifecycle, task-stafette-lifecycle |
| `task_batch_actions` | Szenario vorhanden | task-stafette-lifecycle |
| `task_categories` | Ausgenommen bis 2027-06-30 | — |
| `task_comments` | Ausgenommen bis 2027-06-30 | — |
| `task_decision_attachments` | Szenario vorhanden | decision-lifecycle |
| `task_decision_comment_reactions` | Szenario vorhanden | decision-lifecycle |
| `task_decision_comments` | Szenario vorhanden | decision-lifecycle |
| `task_decision_participants` | Szenario vorhanden | case-item-lifecycle, decision-lifecycle, quick-note-lifecycle, task-lifecycle |
| `task_decision_response_history` | Szenario vorhanden | decision-lifecycle |
| `task_decision_responses` | Szenario vorhanden | case-item-lifecycle, decision-lifecycle, task-lifecycle |
| `task_decision_topics` | Ausgenommen bis 2027-06-30 | — |
| `task_decision_vote_effects` | Szenario vorhanden | decision-lifecycle |
| `task_decisions` | Szenario vorhanden | case-item-lifecycle, decision-lifecycle, jour-fixe-platform-integration, quick-note-lifecycle, task-lifecycle |
| `task_documents` | Szenario vorhanden | task-lifecycle |
| `task_snoozes` | Szenario vorhanden | task-stafette-lifecycle |
| `task_statuses` | Szenario vorhanden | task-lifecycle |
| `task_topics` | Ausgenommen bis 2027-06-30 | — |
| `tasks` | Szenario vorhanden | annual-task-stafette, appointment-briefing-lifecycle, case-file-lifecycle, case-item-lifecycle, day-slip-lifecycle, document-annotation, jour-fixe-platform-integration, letter-lifecycle, meeting-lifecycle, onboarding-hr, quick-note-lifecycle, responsibilities, social-content-lifecycle, task-lifecycle, task-stafette-lifecycle |
| `team_announcement_dismissals` | Ausgenommen bis 2027-06-30 | — |
| `team_announcements` | Ausstehend bis 2027-03-31 | — |
| `team_bingo_settings` | Ausgenommen bis 2027-06-30 | — |
| `team_dashboard_members` | Ausgenommen bis 2027-06-30 | — |
| `team_dashboards` | Ausstehend bis 2027-03-31 | — |
| `team_fun_facts` | Ausstehend bis 2027-03-31 | — |
| `team_question_answers` | Ausstehend bis 2027-03-31 | — |
| `team_question_weeks` | Ausstehend bis 2027-03-31 | — |
| `team_questions` | Ausstehend bis 2027-03-31 | — |
| `team_ritual_profiles` | Ausgenommen bis 2027-06-30 | — |
| `team_ritual_settings` | Ausgenommen bis 2027-06-30 | — |
| `team_two_truths_answers` | Ausstehend bis 2027-03-31 | — |
| `team_two_truths_months` | Ausstehend bis 2027-03-31 | — |
| `tenant_collaborations` | Ausstehend bis 2027-03-31 | — |
| `tenant_feature_flags` | Ausgenommen bis 2027-06-30 | — |
| `tenant_onboarding_checklist_items` | Ausstehend bis 2027-06-30 | — |
| `tenant_onboarding_slides` | Ausstehend bis 2027-06-30 | — |
| `tenants` | Ausgenommen bis 2027-06-30 | — |
| `time_entries` | Ausstehend bis 2027-03-31 | — |
| `time_entry_corrections` | Ausgenommen bis 2027-06-30 | — |
| `time_entry_history` | Ausgenommen bis 2027-06-30 | — |
| `todo_categories` | Ausgenommen bis 2027-06-30 | — |
| `todos` | Ausstehend bis 2027-03-31 | — |
| `topic_backlog` | Szenario vorhanden | social-content-lifecycle |
| `topic_catalog_links` | Szenario vorhanden | topic-linking |
| `topic_module_settings` | Szenario vorhanden | topic-linking |
| `topics` | Szenario vorhanden | contact-relations, topic-linking |
| `user_mywork_settings` | Ausgenommen bis 2027-06-30 | — |
| `user_navigation_visits` | Ausgenommen bis 2027-06-30 | — |
| `user_notification_settings` | Ausgenommen bis 2027-06-30 | — |
| `user_onboarding_state` | Ausstehend bis 2027-06-30 | — |
| `user_planning_preferences` | Ausgenommen bis 2027-06-30 | — |
| `user_preferences` | Ausgenommen bis 2027-06-30 | — |
| `user_roles` | Ausgenommen bis 2027-06-30 | — |
| `user_sessions` | Ausgenommen bis 2027-06-30 | — |
| `user_status` | Ausgenommen bis 2027-06-30 | — |
| `user_tenant_memberships` | Ausgenommen bis 2027-06-30 | — |
| `vacation_checklist_responses` | Ausstehend bis 2027-03-31 | — |
| `vacation_checklist_templates` | Ausgenommen bis 2027-06-30 | — |
| `vacation_history` | Ausgenommen bis 2027-06-30 | — |
| `widget_configurations` | Ausgenommen bis 2027-06-30 | — |
| `widget_rate_limits` | Ausgenommen bis 2027-06-30 | — |
| `workflow_action_log` | Ausstehend bis 2027-06-30 | — |
| `workflow_definitions` | Ausstehend bis 2027-06-30 | — |
| `workflow_runs` | Ausstehend bis 2027-06-30 | — |

## Befristete Ausnahmen

Jede Ausnahme verlangt eine Begründung und ein Ablaufdatum. Abgelaufene, unbegründete oder bereits durch ein Szenario gedeckte Ausnahmen lassen `check:selftest-coverage` fehlschlagen.

| Art | Gültig bis | Umfang | Begründung |
|---|---|---|---|
| Ausgenommen | 2027-06-30 | 20 Tabellen | Technische Infrastruktur-, Push-, Cache- oder Protokolltabelle ohne eigenen fachlichen Workflow; geprüft wird die auslösende Funktion. |
| Ausgenommen | 2027-06-30 | 55 Tabellen | Konfigurations-, Lookup- oder Einstellungstabelle; das fachlich relevante Verhalten prüfen die Szenarien der zugehörigen Funktion. |
| Ausgenommen | 2027-06-30 | 27 Tabellen | Audit-, Verlaufs- oder Versionsprotokoll; wird von Datenbankfunktionen geschrieben und im Szenario der auslösenden Funktion mitgeprüft. |
| Ausgenommen | 2027-06-30 | 34 Tabellen | Reine Verknüpfungstabelle ohne eigene Fachlogik; die Beziehung entsteht im Szenario der zugehörigen Funktion. |
| Ausstehend | 2027-06-30 | 12 Tabellen | Sicherheits-, Onboarding- oder Automationsablauf: Für diese Tabelle fehlt ein eigenes Szenario; der Ausbau ist geplant. |
| Ausstehend | 2027-06-30 | 8 Tabellen | Knowledge 11–14 nutzen eine gezielte Abnahme-Suite; ein Live-Selbsttest-Szenario für diese Tabelle steht aus. |
| Ausstehend | 2027-06-30 | `parlis_proceedings`, `parlis_deputy_mandates` | Parlis: Der Selbsttest prüft importierte Referenzdaten lesend. Schreibzugriffe bleiben der Datenbankmigration vorbehalten. |
| Ausstehend | 2027-06-30 | 36 Tabellen | Wahlanalyse und Wahlhistorie: Szenarien prüfen Regeln und Lesezugriffe, schreiben aber bewusst keine importierten Bestandsdaten. |
| Ausstehend | 2027-03-31 | 50 Tabellen | Fachlicher Ausbau offen: Für diese Tabelle fehlt noch ein Szenario oder Step; der Eintrag muss bis zum Ablauf geprüft werden. |
| Ausstehend | 2027-06-30 | `parlis_ministry_assignments`, `parlis_ministry_lines`, `parlis_ministry_suggestions`, `parlis_ministry_topics` | Parlis-Ministerienzuordnung: Die Szenarien lesen Ressortlinien und Vorschläge nur; Zuordnungen schreibt die Administration, die Themen-Wolke der Trigger auf neue Büros. |

## Fachfunktionen ohne Selbsttest

Diese implementierten Fachfunktionen haben laut Funktionskatalog keine Selbsttest-Abdeckung — unabhängig davon, ob einzelne Tabellen von anderen Szenarien berührt werden.

| Funktion | Name | Bereich | Tabellen |
|---|---|---|---|
| `chat.messages` | Interner Chat über Matrix | kommunikation | messages, message_recipients, message_confirmations |
| `chat.team-announcements` | Team-Ankündigungen | kommunikation | team_announcements, team_announcement_dismissals |
| `dossiers.capture-radar` | Schnellerfassung und Mein Radar | organisation | dossiers, dossier_entries |
| `dossiers.entries` | Dossier-Einträge und Timeline | organisation | dossier_entries, dossiers |
| `dossiers.links-stakeholders` | Dossier-Verknüpfungen und Stakeholder | organisation | dossier_links, dossier_stakeholders |
| `dossiers.manage` | Dossier anlegen und führen | organisation | dossiers, dossier_entries |
| `dossiers.search` | Globale Dossier-Suche | organisation | dossier_entries, dossiers |
| `dossiers.talking-points` | Talking Points und Positionsversionen | organisation | dossier_talking_points, dossier_position_versions |
| `election.analysis-map` | Analyse-Karten und Wahlkreiszuschnitt | wahl | election_analysis_geographies, election_analysis_districts, election_history_districts |
| `election.history.districts-geometry` | Historische Wahlkreise und Geometrie | wahl | election_history_districts, election_analysis_geographies |
| `election.history.factions` | Historische Fraktionen | wahl | election_history_factions, election_history_mandates, election_history_candidacies, election_history_periods |
| `election.history.state-lists` | Landeslisten verwalten | wahl | election_history_state_lists, election_history_state_list_entries |
| `election.research-workbench` | Analyse-Workbench und Kommunalpanel | wahl | election_analysis_local_results, election_analysis_candidate_coverage, election_analysis_source_reviews, election_analysis_correction_audit |
| `election.seat-distribution` | Sitzverteilung und Hemizykel | wahl | election_analysis_state, election_analysis_bw_polls |
| `election.turnout` | Wahlbeteiligung | wahl | election_analysis_turnout |
| `employees.export-stats` | Gesprächs-PDF und Jahresstatistik | mitarbeit | employee_yearly_stats, employee_meetings |
| `facts.manage` | Fakten und Argumente pflegen | organisation | facts |
| `knowledge.attachments` | Anhänge an Wissensfragen | wissen | knowledge_question_attachments |
| `knowledge.sources` | Quellen und Belege | wissen | knowledge_question_sources |
| `knowledge.versions` | Snapshots und Versionen | wissen | knowledge_document_versions, knowledge_document_snapshots |
| `mywork.navigation-previews` | Vorschauen für Kalender, Aufgaben, Akten, Chat und Kontakte | arbeitsbereich | appointments, external_events, appointment_preparations, tasks, case_files, appointment_contacts, case_file_contacts, contacts |
| `mywork.quick-access` | Schnellzugriff und zuletzt besuchte Seiten | arbeitsbereich | user_navigation_visits, user_preferences |
| `mywork.tabs` | Meine Arbeit – Bereichsnavigation und Einstellungen | arbeitsbereich | user_mywork_settings, user_planning_preferences |
| `news.articles` | News-Artikel und Lesestatus | kommunikation | news_articles, news_article_states |
| `press.releases` | Pressemitteilungen erstellen und freigeben | kommunikation | press_releases |
| `profile.edit` | Eigenes Profil bearbeiten | arbeitsbereich | profiles, user_preferences, user_notification_settings |
| `redaktion.assets-campaigns` | Social-Assets und Kampagnen | kommunikation | social_assets, social_campaigns |
| `search.global` | Globale Suche und Befehlspalette | arbeitsbereich | search_analytics |
| `tasks.search-filter` | Aufgaben suchen, filtern und sortieren | aufgaben | tasks, task_statuses, task_categories |
| `timetracking.entries` | Arbeitszeit erfassen | mitarbeit | time_entries, time_entry_corrections, time_entry_history |

## Deklarierte Schreibfelder

Diese Manifeste sind keine Messung ausgeführter Assertions.

- appointment-briefing-lifecycle: `appointments`: title, tenant_id, user_id, start_time, end_time
- appointment-briefing-lifecycle: `appointment_change_alerts`: tenant_id, appointment_id, title, message, kind, new_start_time, new_location
- appointment-lifecycle: `appointments`: title, description, start_time, end_time, location, category, priority, status, is_all_day, user_id, tenant_id, reminder_minutes
- appointment-lifecycle: `appointment_preparations`: appointment_id, tenant_id, created_by, title, status, preparation_data, checklist_items, notes
- appointment-lifecycle: `appointment_feedback`: appointment_id, user_id, tenant_id, feedback_status, notes, event_type, completed_at
- appointment-request-lifecycle: `appointment_requests`: title, tenant_id, requested_date, requested_time, duration_minutes, channel, requester, location, notes
- case-file-lifecycle: `case_files`: title, description, case_type, case_scale, status, priority, reference_number, start_date, target_date, user_id, tenant_id, visibility, processing_status, current_status_note
- case-file-lifecycle: `case_file_participants`: case_file_id, user_id, role
- case-file-lifecycle: `case_file_status_history`: case_file_id, content, user_id, user_display_name
- case-file-lifecycle: `case_file_notes`: case_file_id, user_id, content, is_pinned
- case-file-lifecycle: `case_file_timeline`: case_file_id, event_date, event_type, title, description, created_by
- case-file-lifecycle: `documents`: tenant_id, user_id, title, file_name, file_path, file_size, file_type, status
- case-file-lifecycle: `case_file_documents`: case_file_id, document_id, relevance, notes
- case-file-lifecycle: `case_file_contacts`: case_file_id, contact_id, role
- case-file-lifecycle: `case_file_tasks`: case_file_id, task_id
- case-file-lifecycle: `case_file_appointments`: case_file_id, appointment_id, notes
- case-file-lifecycle: `case_file_letters`: case_file_id, letter_id, notes
- case-file-lifecycle: `document_contacts`: document_id, contact_id, relationship_type, notes, created_by
- case-file-lifecycle: `case_items`: subject, summary, user_id, tenant_id, case_file_id, case_scale
- case-file-lifecycle: `contacts`: name, user_id, tenant_id, category, notes
- case-file-lifecycle: `tasks`: title, user_id, tenant_id, assigned_to, priority, category, status, source_type, source_id
- case-file-lifecycle: `appointments`: title, user_id, tenant_id, start_time, end_time, category, status
- case-file-lifecycle: `letters`: title, subject, content, content_html, status, created_by, tenant_id, recipient_name, recipient_address, letter_date
- case-item-lifecycle: `case_items`: subject, summary, user_id, tenant_id, status, ball_owner, next_action_label, next_action_due_at, next_action_assignee_id, intake_payload, pending_for_jour_fixe, completion_note, completed_at, resolution_summary
- case-item-lifecycle: `case_item_interactions`: case_item_id, tenant_id, interaction_type, direction, interaction_at, summary, visibility, created_by
- case-item-lifecycle: `case_item_handover_log`: case_item_id, tenant_id, from_user_id, to_user_id, handed_over_by
- case-item-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, case_item_id
- case-item-lifecycle: `appointment_requests`: title, tenant_id, requested_date, channel, notes
- case-item-lifecycle: `day_slips`: user_id, tenant_id, day_key, data
- contact-lifecycle: `contacts`: name, user_id, tenant_id, email, phone, organization, title, category, tags, notes
- contact-lifecycle: `contact_activities`: contact_id, tenant_id, created_by, activity_type, title, description
- contact-lifecycle: `contact_usage_stats`: contact_id, tenant_id, user_id, usage_count
- contact-relations: `contacts`: name, user_id, tenant_id, email, phone, category, tags, notes, created_at, archived_at, archive_reason, archived_by
- contact-relations: `contact_activities`: contact_id, tenant_id, created_by, activity_type, title, description
- contact-relations: `contact_topics`: tenant_id, contact_id, topic_id
- contact-relations: `topics`: label, tenant_id
- contact-relations: `call_logs`: contact_id, user_id, call_type, duration_minutes, notes, follow_up_required, priority
- contact-relations: `distribution_lists`: user_id, tenant_id, name, description, topic
- contact-relations: `distribution_list_members`: distribution_list_id, contact_id
- contact-relations: `map_flag_types`: tenant_id, name, icon, color, created_by
- contact-relations: `map_flags`: tenant_id, flag_type_id, title, description, coordinates, created_by, tags, metadata
- contact-relations: `gdpr_requests`: tenant_id, request_type, subject_contact_id, subject_name, subject_email, reason, requested_by
- contact-relations: `contact_briefing_memory`: tenant_id, contact_id, kind, content, question, answer, pinned_by
- contact-relations: `fundings`: tenant_id, title, total_amount, status, created_by
- contact-relations: `funding_participants`: funding_id, contact_id, allocated_amount, role
- daily-briefing-lifecycle: `daily_briefings`: tenant_id, author_id, briefing_date, title, content
- day-slip-lifecycle: `day_slips`: user_id, tenant_id, day_key, data
- day-slip-lifecycle: `tasks`: id, user_id, tenant_id, title, description, status, priority, category, assigned_to, due_date
- day-slip-lifecycle: `quick_notes`: id, user_id, tenant_id, title, content
- decision-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, visible_to_all, priority, response_deadline, archived_at, archived_by
- decision-lifecycle: `task_decision_participants`: decision_id, user_id
- decision-lifecycle: `task_decision_responses`: decision_id, participant_id, response_type, comment
- decision-lifecycle: `task_decision_response_history`: response_id, decision_id, participant_id, response_type, comment, changed_by
- decision-lifecycle: `task_decision_attachments`: decision_id, file_name, file_path, file_size, file_type, uploaded_by
- decision-lifecycle: `task_decision_comments`: decision_id, user_id, parent_id, content
- decision-lifecycle: `task_decision_comment_reactions`: comment_id, user_id, emoji
- decision-lifecycle: `dashboard_decision_nudges`: decision_id, tenant_id, nudged_by, note
- employee-meetings: `employee_meeting_requests`: employee_id, tenant_id, reason, urgency, status
- employee-meetings: `employee_meetings`: employee_id, conducted_by, tenant_id, meeting_date, meeting_type, status, employee_preparation
- employee-meetings: `employee_meeting_private_notes`: meeting_id, user_id, notes
- employee-meetings: `employee_meeting_action_items`: meeting_id, tenant_id, description, owner, assigned_to
- employee-meetings: `employee_meeting_audit`: meeting_id, actor, action, reason, protocol_hash
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
- letter-lifecycle: `letters`: title, subject, content, content_html, status, created_by, tenant_id, recipient_name, recipient_address, letter_date, submitted_for_review_at, submitted_for_review_by, approved_at, approved_by, sent_at, sent_by, sent_date, workflow_locked, archived_document_id, revision_comment, revision_requested_at, revision_requested_by
- letter-lifecycle: `letter_attachments`: letter_id, file_name, file_path, file_type, file_size, uploaded_by
- letter-lifecycle: `letter_collaborators`: letter_id, user_id, role, assigned_by
- letter-lifecycle: `letter_comments`: letter_id, user_id, content, text_position, text_length, comment_type, resolved
- meeting-lifecycle: `meetings`: title, description, meeting_date, meeting_time, status, user_id, tenant_id, is_public, parent_meeting_id, is_recurring_instance
- meeting-lifecycle: `meeting_agenda_items`: meeting_id, title, description, order_index, is_completed, is_recurring, system_type, is_visible, is_optional, parent_id, task_id, notes, result_text, carry_over_to_next, carryover_notes, carried_over_from, original_meeting_date, original_meeting_title
- meeting-lifecycle: `meeting_agenda_documents`: meeting_agenda_item_id, user_id, file_name, file_path, file_type, file_size
- meeting-lifecycle: `meeting_participants`: meeting_id, user_id, role, status
- meeting-lifecycle: `appointments`: title, description, start_time, end_time, category, status, user_id, tenant_id, meeting_id
- meeting-lifecycle: `tasks`: title, description, status, priority, user_id, tenant_id
- notification-inbox: `notifications`: tenant_id, user_id, notification_type_id, title, message, data, priority, is_read, read_at
- poll-lifecycle: `appointment_polls`: title, description, deadline, status, user_id, tenant_id, confirmed_slot_id, confirmed_appointment_id
- poll-lifecycle: `poll_time_slots`: poll_id, start_time, end_time, order_index
- poll-lifecycle: `poll_participants`: poll_id, email, name, is_external, token
- poll-lifecycle: `appointment_guests`: appointment_id, tenant_id, name, email, status
- poll-lifecycle: `appointments`: title, description, start_time, end_time, category, status, priority, user_id, tenant_id, poll_id
- quick-note-lifecycle: `quick_notes`: title, content, user_id, tenant_id, priority_level, color, category, tags, is_pinned, task_id, is_archived, archived_at
- quick-note-lifecycle: `tasks`: title, description, user_id, tenant_id, status, priority
- social-content-lifecycle: `topic_backlog`: tenant_id, topic, short_description, status, priority, tags, created_by
- social-content-lifecycle: `social_content_items`: tenant_id, topic_backlog_id, created_by, format, hook, core_message, draft_text, cta, hashtags, approval_required, workflow_status, approval_state, approved_at, approved_by
- social-content-lifecycle: `social_content_channels`: tenant_id, name, slug
- social-content-lifecycle: `social_content_item_channels`: content_item_id, channel_id, tenant_id, created_by, is_primary
- social-content-lifecycle: `social_content_variants`: tenant_id, content_item_id, channel_id, created_by, caption, first_comment, media_type, asset_ids, platform_status
- social-content-lifecycle: `social_content_approval_events`: tenant_id, content_item_id, actor_id, actor_user_id, actor_name, action, from_state, to_state
- social-content-lifecycle: `social_approval_comments`: tenant_id, content_item_id, author_id, comment, is_change_request
- social-content-lifecycle: `tasks`: user_id, tenant_id, title, description, assigned_to, status, priority, category, due_date, ball_owner, ball_assignee_id, next_action, next_action_due, source_type, source_id, timeline
- social-content-lifecycle: `task_assignees`: task_id, user_id, assigned_by
- social-content-lifecycle: `notifications`: tenant_id, user_id, notification_type_id, title, message, data, priority
- task-lifecycle: `tasks`: title, description, status, priority, user_id, tenant_id, assigned_to, due_date, progress, pending_for_jour_fixe, completed_at, recurrence_rule, parent_task_id, ball_owner, ball_assignee_id, next_action, next_action_due, timeline
- task-lifecycle: `task_documents`: task_id, user_id, file_name, file_path, file_type, file_size
- task-lifecycle: `task_decisions`: title, description, status, created_by, tenant_id, task_id
- task-stafette-lifecycle: `tasks`: title, description, status, priority, tenant_id, user_id, ball_owner, ball_assignee_id, assigned_to, next_action, next_action_due, timeline
- task-stafette-lifecycle: `task_assignees`: task_id, user_id, assigned_by
- task-stafette-lifecycle: `task_snoozes`: user_id, task_id, snoozed_until
- task-stafette-lifecycle: `archived_tasks`: task_id, user_id, title, archived_at
- task-stafette-lifecycle: `task_batch_actions`: tenant_id, actor_id, action, affected_count, skipped_count, undo_payload, undone_at, undone_by
- topic-linking: `topics`: name, label, icon, color, order_index, is_active, tenant_id, created_by, merged_into, merged_at, updated_by
- topic-linking: `case_items`: subject, summary, user_id, tenant_id, intake_payload
- topic-linking: `case_item_topics`: tenant_id, case_item_id, topic_id, created_by
- topic-linking: `topic_module_settings`: requirement, max_topics, creation_policy, show_filter, is_enabled, updated_by
- topic-linking: `committees`: tenant_id, name, is_active, order_index
- topic-linking: `regions`: tenant_id, name, kind, is_active, order_index
- topic-linking: `employee_responsibilities`: tenant_id, user_id, kind, topic_id, committee_id, region_id, role_focus, level
- topic-linking: `topic_catalog_links`: tenant_id, topic_id, kind, committee_id, region_id
