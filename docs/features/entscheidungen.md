# Entscheidungen

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Entscheidungen anlegen, Teilnehmende abstimmen lassen, Antworten zurücknehmen und archivieren.

## Seiten

- `/decisions`
- `/decision-response/:participantId`

## Rollen

Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `task_decision_participants` | `decision-lifecycle` |
| `task_decision_responses` | `decision-lifecycle` |
| `task_decisions` | `decision-lifecycle` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `task_decision_participants` | `decision_id` | `task_decisions` |
| `task_decision_responses` | `participant_id` | `task_decision_participants` |
| `task_decision_responses` | `parent_response_id` | `task_decision_responses` |
| `task_decision_responses` | `decision_id` | `task_decisions` |
| `task_decisions` | `case_file_id` | `case_files` |
| `task_decisions` | `case_item_id` | `case_items` |
| `task_decisions` | `meeting_id` | `meetings` |
| `task_decisions` | `task_id` | `tasks` |
| `task_decisions` | `tenant_id` | `tenants` |

### Eingehend

| Zieltabelle im Bereich | Von | Spalte |
|---|---|---|
| `task_decisions` | `dashboard_decision_nudges` | `decision_id` |
| `task_decision_participants` | `decision_matrix_messages` | `participant_id` |
| `task_decisions` | `decision_matrix_messages` | `decision_id` |
| `task_decisions` | `quick_notes` | `decision_id` |
| `task_decisions` | `routine_package_steps` | `approval_id` |
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

## Prüfumfang

### `decision-lifecycle` — Entscheidungs-Lifecycle (active → open → archived)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [my-work-decisions-button-flowchart.md](../my-work-decisions-button-flowchart.md)
- [task-decision-reactions-rollout.md](../task-decision-reactions-rollout.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
