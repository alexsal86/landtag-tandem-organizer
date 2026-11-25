# Vorgänge

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Bürgeranliegen und Eingänge erfassen, „Wer ist am Zug?" führen, Schritte und Fristen setzen und den Vorgang abschließen.

## Seiten

- `/vorgaenge/:caseItemId`
- `/mywork?tab=cases`
- `/casefiles`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointment_requests` | `case-item-lifecycle` |
| `case_item_handover_log` | `case-item-lifecycle` |
| `case_item_interactions` | `case-item-lifecycle` |
| `case_items` | `case-item-lifecycle` |
| `day_slips` | `case-item-lifecycle` |
| `task_decision_participants` | `case-item-lifecycle` |
| `task_decision_responses` | `case-item-lifecycle` |
| `task_decisions` | `case-item-lifecycle` |
| `tasks` | `case-item-lifecycle` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `appointment_requests` | `appointment_id` | `appointments` |
| `appointment_requests` | `tenant_id` | `tenants` |
| `case_item_handover_log` | `case_item_id` | `case_items` |
| `case_item_interactions` | `case_file_id` | `case_files` |
| `case_item_interactions` | `case_item_id` | `case_items` |
| `case_item_interactions` | `tenant_id` | `tenants` |
| `case_items` | `case_file_id` | `case_files` |
| `case_items` | `contact_id` | `contacts` |
| `case_items` | `meeting_id` | `meetings` |
| `case_items` | `tenant_id` | `tenants` |
| `day_slips` | `tenant_id` | `tenants` |
| `task_decision_participants` | `decision_id` | `task_decisions` |
| `task_decision_responses` | `participant_id` | `task_decision_participants` |
| `task_decision_responses` | `parent_response_id` | `task_decision_responses` |
| `task_decision_responses` | `decision_id` | `task_decisions` |
| `task_decisions` | `case_file_id` | `case_files` |
| `task_decisions` | `case_item_id` | `case_items` |
| `task_decisions` | `meeting_id` | `meetings` |
| `task_decisions` | `task_id` | `tasks` |
| `task_decisions` | `tenant_id` | `tenants` |
| `tasks` | `call_log_id` | `call_logs` |
| `tasks` | `meeting_id` | `meetings` |
| `tasks` | `parent_task_id` | `tasks` |
| `tasks` | `tenant_id` | `tenants` |

### Eingehend

| Zieltabelle im Bereich | Von | Spalte |
|---|---|---|
| `tasks` | `annual_task_completions` | `linked_task_id` |
| `tasks` | `case_file_tasks` | `task_id` |
| `case_items` | `case_item_attachments` | `case_item_id` |
| `case_items` | `case_item_escalation_suggestions` | `case_item_id` |
| `case_items` | `case_item_handover_log` | `case_item_id` |
| `case_items` | `case_item_interactions` | `case_item_id` |
| `case_items` | `case_item_participants` | `case_item_id` |
| `case_items` | `case_item_timeline` | `case_item_id` |
| `task_decisions` | `dashboard_decision_nudges` | `decision_id` |
| `task_decision_participants` | `decision_matrix_messages` | `participant_id` |
| `task_decisions` | `decision_matrix_messages` | `decision_id` |
| `tasks` | `document_annotation_tasks` | `task_id` |
| `tasks` | `employee_meeting_action_items` | `task_id` |
| `tasks` | `matrix_widget_callback_requests` | `task_id` |
| `case_items` | `quick_notes` | `case_item_id` |
| `task_decisions` | `quick_notes` | `decision_id` |
| `tasks` | `quick_notes` | `task_id` |
| `tasks` | `routine_package_runs` | `task_id` |
| `task_decisions` | `routine_package_steps` | `approval_id` |
| `tasks` | `subtasks` | `task_id` |
| `tasks` | `task_assignees` | `task_id` |
| `tasks` | `task_comments` | `task_id` |
| `task_decisions` | `task_decision_attachments` | `decision_id` |
| `task_decisions` | `task_decision_comments` | `decision_id` |
| `task_decisions` | `task_decision_participants` | `decision_id` |
| `task_decision_participants` | `task_decision_response_history` | `participant_id` |
| `task_decision_responses` | `task_decision_response_history` | `response_id` |
| `task_decisions` | `task_decision_response_history` | `decision_id` |
| `task_decision_participants` | `task_decision_responses` | `participant_id` |
| `task_decision_responses` | `task_decision_responses` | `parent_response_id` |
| `task_decisions` | `task_decision_responses` | `decision_id` |
| `task_decisions` | `task_decision_topics` | `decision_id` |
| `case_items` | `task_decisions` | `case_item_id` |
| `tasks` | `task_decisions` | `task_id` |
| `tasks` | `task_topics` | `task_id` |
| `tasks` | `tasks` | `parent_task_id` |

## Prüfumfang

### `case-item-lifecycle` — Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss)

- **Prüfungen:**
  - Geschäftsregeln für Wiedervorlage und Fristen
  - Übergabe über die Anwendungs-RPC
  - Entscheidung und Abstimmung
  - Tageszettel-Link nach erneutem Laden
  - Vorgang bleibt im eigenen Büro
- **Grenzen:**
  - Keine Bedienprüfung der Vorgangsoberfläche
  - Übergabe benötigt eine zweite aktive Person im Büro

## Detaildoku

- [case-items-intake-validation.md](../case-items-intake-validation.md)
- [my-work-architecture.md](../my-work-architecture.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
