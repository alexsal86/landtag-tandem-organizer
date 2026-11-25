# Aufgaben & Stafette

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Aufgaben anlegen, zuweisen, über Fristen und Wiedervorlagen führen, im Stafette-Modell weitergeben und abschließen.

## Seiten

- `/tasks`
- `/tasks/archive`
- `/tasks/new`
- `/mywork?tab=tasks`
- `/mywork?tab=dashboard`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `annual_task_completions` | `annual-task-stafette` |
| `annual_tasks` | `annual-task-stafette` |
| `daily_briefings` | `daily-briefing-lifecycle` |
| `day_slips` | `day-slip-lifecycle` |
| `meeting_agenda_items` | `jour-fixe-platform-integration` |
| `meetings` | `jour-fixe-platform-integration` |
| `task_decisions` | `task-lifecycle`, `jour-fixe-platform-integration` |
| `tasks` | `task-lifecycle`, `task-stafette-lifecycle`, `annual-task-stafette`, `jour-fixe-platform-integration` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `annual_task_completions` | `annual_task_id` | `annual_tasks` |
| `annual_task_completions` | `linked_task_id` | `tasks` |
| `annual_tasks` | `automation_rule_id` | `automation_rules` |
| `annual_tasks` | `tenant_id` | `tenants` |
| `day_slips` | `tenant_id` | `tenants` |
| `meeting_agenda_items` | `parent_id` | `meeting_agenda_items` |
| `meeting_agenda_items` | `meeting_id` | `meetings` |
| `meetings` | `parent_meeting_id` | `meetings` |
| `meetings` | `tenant_id` | `tenants` |
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
| `annual_tasks` | `annual_task_completions` | `annual_task_id` |
| `tasks` | `annual_task_completions` | `linked_task_id` |
| `meetings` | `appointments` | `meeting_id` |
| `meetings` | `archived_tasks` | `meeting_id` |
| `tasks` | `case_file_tasks` | `task_id` |
| `meetings` | `case_items` | `meeting_id` |
| `daily_briefings` | `daily_briefing_reads` | `briefing_id` |
| `task_decisions` | `dashboard_decision_nudges` | `decision_id` |
| `task_decisions` | `decision_matrix_messages` | `decision_id` |
| `tasks` | `document_annotation_tasks` | `task_id` |
| `tasks` | `employee_meeting_action_items` | `task_id` |
| `tasks` | `matrix_widget_callback_requests` | `task_id` |
| `meeting_agenda_items` | `meeting_agenda_items` | `parent_id` |
| `meetings` | `meeting_agenda_items` | `meeting_id` |
| `meetings` | `meeting_participants` | `meeting_id` |
| `meetings` | `meeting_protocol_addenda` | `meeting_id` |
| `meetings` | `meeting_protocol_details` | `meeting_id` |
| `meetings` | `meetings` | `parent_meeting_id` |
| `meetings` | `quick_notes` | `meeting_id` |
| `task_decisions` | `quick_notes` | `decision_id` |
| `tasks` | `quick_notes` | `task_id` |
| `annual_tasks` | `routine_package_runs` | `annual_task_id` |
| `tasks` | `routine_package_runs` | `task_id` |
| `task_decisions` | `routine_package_steps` | `approval_id` |
| `meetings` | `starred_appointments` | `meeting_id` |
| `tasks` | `subtasks` | `task_id` |
| `tasks` | `task_assignees` | `task_id` |
| `tasks` | `task_comments` | `task_id` |
| `task_decisions` | `task_decision_attachments` | `decision_id` |
| `task_decisions` | `task_decision_comments` | `decision_id` |
| `task_decisions` | `task_decision_participants` | `decision_id` |
| `task_decisions` | `task_decision_response_history` | `decision_id` |
| `task_decisions` | `task_decision_responses` | `decision_id` |
| `task_decisions` | `task_decision_topics` | `decision_id` |
| `meetings` | `task_decisions` | `meeting_id` |
| `tasks` | `task_decisions` | `task_id` |
| `tasks` | `task_topics` | `task_id` |
| `meetings` | `tasks` | `meeting_id` |
| `tasks` | `tasks` | `parent_task_id` |

## Prüfumfang

### `task-lifecycle` — Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `task-stafette-lifecycle` — Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe)

- **Prüfungen:**
  - Zonen Mein Zug / Wartet / Wiedervorlage
  - Verlaufseinträge bei Übergaben und Erledigungen
  - Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme
  - Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln
- **Grenzen:**
  - Regeln laufen ohne Datenbank; die Sammelaktionen werden zusätzlich über die RPCs geprüft.
  - Weitere Speicherungen deckt der Aufgaben-Lebenszyklus ab.

### `annual-task-stafette` — Jahresaufgabe → Büroaufgabe → Jahresabschluss

- **Prüfungen:**
  - Exakte Stichtage
  - System-Routinen nicht delegierbar
  - Eine Aufgabe pro Jahr
  - Abschluss und Wiederöffnung synchron
  - Direkter Jahresabschluss gesperrt
- **Grenzen:**
  - Die automatische Ausführung am tatsächlichen Stichtag und Personaländerungen werden nicht durch diesen Selbsttest ausgelöst.

### `jour-fixe-platform-integration` — Jour Fixe: Plattformquellen & Stafetten-Abschluss

- **Prüfungen:**
  - Quellenabfragen unter bestehenden Zugriffsrechten
  - Folgeaufgaben mit Zuständigkeit und Verlauf
  - Notizen ändern keine Abstimmung
  - Wiederholung erzeugt keine Duplikate
- **Grenzen:**
  - Quellenabfragen bestätigen bei leerem Bestand nur die Erreichbarkeit.
  - Freigaben und Sichtbarkeit für andere Rollen erfordern zusätzliche persönliche Sitzungen.

### `day-slip-lifecycle` — Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag)

- **Prüfungen:**
  - Speichern und erneutes Laden
  - Link-Erhalt bei Übernahme
  - Keine doppelte Übernahme
- **Grenzen:**
  - Die verlinkten Ziele sind Test-IDs; ihre Bedienung wird nicht geprüft.

### `daily-briefing-lifecycle` — Tages-Briefings (Vortag-Regel)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [my-work-architecture.md](../my-work-architecture.md)
- [workflow-consistency.md](../workflow-consistency.md)
- [automation-no-code-umsetzung.md](../automation-no-code-umsetzung.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
