# Mitarbeit & Personal

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Onboarding und Offboarding, Mitarbeitergespräche, Zuständigkeiten und Teamrituale inklusive Sichtbarkeitsregeln.

## Seiten

- `/employee`
- `/employee-meeting/:id`
- `/meetings`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointments` | `meeting-lifecycle` |
| `employee_hr_evidence` | `onboarding-hr` |
| `employee_hr_gdpr_declarations` | `onboarding-hr` |
| `employee_hr_reminder_log` | `onboarding-hr` |
| `employee_hr_templates` | `onboarding-hr` |
| `employee_lifecycle` | `onboarding-hr` |
| `meeting_agenda_documents` | `meeting-lifecycle` |
| `meeting_agenda_items` | `meeting-lifecycle` |
| `meeting_participants` | `meeting-lifecycle` |
| `meeting_protocol_addenda` | `meeting-lifecycle` |
| `meeting_protocol_details` | `meeting-lifecycle` |
| `meeting_templates` | `meeting-lifecycle` |
| `meetings` | `meeting-lifecycle` |
| `notification_types` | `onboarding-hr` |
| `notifications` | `onboarding-hr` |
| `routine_package_runs` | `onboarding-hr` |
| `routine_package_steps` | `onboarding-hr` |
| `subtasks` | `onboarding-hr` |
| `tasks` | `onboarding-hr`, `responsibilities`, `meeting-lifecycle` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `appointments` | `poll_id` | `appointment_polls` |
| `appointments` | `call_log_id` | `call_logs` |
| `appointments` | `contact_id` | `contacts` |
| `appointments` | `district_id` | `election_districts` |
| `appointments` | `meeting_id` | `meetings` |
| `appointments` | `party_association_id` | `party_associations` |
| `appointments` | `tenant_id` | `tenants` |
| `employee_hr_evidence` | `document_id` | `documents` |
| `employee_hr_evidence` | `step_id` | `routine_package_steps` |
| `employee_hr_evidence` | `tenant_id` | `tenants` |
| `employee_hr_gdpr_declarations` | `tenant_id` | `tenants` |
| `employee_hr_reminder_log` | `lifecycle_id` | `employee_lifecycle` |
| `employee_hr_reminder_log` | `tenant_id` | `tenants` |
| `employee_hr_templates` | `tenant_id` | `tenants` |
| `employee_lifecycle` | `tenant_id` | `tenants` |
| `meeting_agenda_items` | `parent_id` | `meeting_agenda_items` |
| `meeting_agenda_items` | `meeting_id` | `meetings` |
| `meeting_participants` | `meeting_id` | `meetings` |
| `meeting_participants` | `user_id` | `profiles` |
| `meeting_protocol_addenda` | `meeting_id` | `meetings` |
| `meeting_protocol_details` | `meeting_id` | `meetings` |
| `meeting_templates` | `tenant_id` | `tenants` |
| `meetings` | `parent_meeting_id` | `meetings` |
| `meetings` | `tenant_id` | `tenants` |
| `notification_types` | `tenant_id` | `tenants` |
| `notifications` | `notification_type_id` | `notification_types` |
| `notifications` | `tenant_id` | `tenants` |
| `routine_package_runs` | `annual_task_id` | `annual_tasks` |
| `routine_package_runs` | `rule_id` | `automation_rules` |
| `routine_package_runs` | `hr_template_id` | `employee_hr_templates` |
| `routine_package_runs` | `tenant_id`, `employee_lifecycle_id` | `employee_lifecycle` |
| `routine_package_runs` | `task_id` | `tasks` |
| `routine_package_runs` | `tenant_id` | `tenants` |
| `routine_package_steps` | `run_id` | `routine_package_runs` |
| `routine_package_steps` | `approval_id` | `task_decisions` |
| `subtasks` | `task_id` | `tasks` |
| `tasks` | `call_log_id` | `call_logs` |
| `tasks` | `meeting_id` | `meetings` |
| `tasks` | `parent_task_id` | `tasks` |
| `tasks` | `tenant_id` | `tenants` |

### Eingehend

| Zieltabelle im Bereich | Von | Spalte |
|---|---|---|
| `tasks` | `annual_task_completions` | `linked_task_id` |
| `appointments` | `appointment_contacts` | `appointment_id` |
| `appointments` | `appointment_documents` | `appointment_id` |
| `appointments` | `appointment_feedback` | `appointment_id` |
| `appointments` | `appointment_guests` | `appointment_id` |
| `appointments` | `appointment_polls` | `confirmed_appointment_id` |
| `appointments` | `appointment_preparations` | `appointment_id` |
| `appointments` | `appointment_reminder_dispatches` | `appointment_id` |
| `notifications` | `appointment_reminder_dispatches` | `notification_id` |
| `appointments` | `appointment_requests` | `appointment_id` |
| `appointments` | `appointment_topics` | `appointment_id` |
| `meetings` | `appointments` | `meeting_id` |
| `meetings` | `archived_tasks` | `meeting_id` |
| `appointments` | `case_file_appointments` | `appointment_id` |
| `tasks` | `case_file_tasks` | `task_id` |
| `meetings` | `case_items` | `meeting_id` |
| `tasks` | `document_annotation_tasks` | `task_id` |
| `routine_package_steps` | `employee_hr_evidence` | `step_id` |
| `employee_lifecycle` | `employee_hr_reminder_log` | `lifecycle_id` |
| `tasks` | `employee_meeting_action_items` | `task_id` |
| `appointments` | `event_planning_dates` | `appointment_id` |
| `tasks` | `matrix_widget_callback_requests` | `task_id` |
| `meeting_agenda_items` | `meeting_agenda_items` | `parent_id` |
| `meetings` | `meeting_agenda_items` | `meeting_id` |
| `meetings` | `meeting_participants` | `meeting_id` |
| `meetings` | `meeting_protocol_addenda` | `meeting_id` |
| `meetings` | `meeting_protocol_details` | `meeting_id` |
| `meetings` | `meetings` | `parent_meeting_id` |
| `notification_types` | `notifications` | `notification_type_id` |
| `meetings` | `quick_notes` | `meeting_id` |
| `tasks` | `quick_notes` | `task_id` |
| `employee_hr_templates` | `routine_package_runs` | `hr_template_id` |
| `employee_lifecycle` | `routine_package_runs` | `tenant_id`, `employee_lifecycle_id` |
| `tasks` | `routine_package_runs` | `task_id` |
| `routine_package_runs` | `routine_package_steps` | `run_id` |
| `appointments` | `starred_appointments` | `appointment_id` |
| `meetings` | `starred_appointments` | `meeting_id` |
| `tasks` | `subtasks` | `task_id` |
| `tasks` | `task_assignees` | `task_id` |
| `tasks` | `task_comments` | `task_id` |
| `meetings` | `task_decisions` | `meeting_id` |
| `tasks` | `task_decisions` | `task_id` |
| `tasks` | `task_topics` | `task_id` |
| `meetings` | `tasks` | `meeting_id` |
| `tasks` | `tasks` | `parent_task_id` |
| `notification_types` | `user_notification_settings` | `notification_type_id` |

## Prüfumfang

### `onboarding-hr` — HR-Onboarding und Offboarding

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Der Servertest rollt seine vollständigen Fixtures zurück. Echte Zustellung und der 15-Minuten-Job benötigen eine bereitgestellte Datenbank.

### `responsibilities` — Zuständigkeiten & Matrix

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Der Fremdtenant-Lesetest verwendet für das angemeldete Konto nicht zugängliche IDs. Zwei echte Sitzungen und RPC-Schreibtests werden zusätzlich im isolierten Datenbanktest geprüft.

### `team-rituals` — Freiwillige Team-Rituale

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - RLS, Rollen, parallele RPC-Aufrufe, Freigaben und GDPR-Löschung mit Anmeldung separat prüfen.

### `meeting-lifecycle` — Meeting-Lifecycle (vollständig + Field-Verifikation)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [employee-meeting-leadership.md](../employee-meeting-leadership.md)
- [team-rituals.md](../team-rituals.md)
- [rollenrechte-matrix.md](../rollenrechte-matrix.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
