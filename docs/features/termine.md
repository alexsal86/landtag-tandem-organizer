# Termine & Briefings

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Kalender, Terminanfragen, Briefings, Veranstaltungen und Terminabstimmungen inklusive Einladungs- und Erinnerungsregeln.

## Seiten

- `/calendar`
- `/eventplanning`
- `/appointment-preparation/:id`
- `/briefing-live/:id`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointment_change_alerts` | `appointment-briefing-lifecycle` |
| `appointment_feedback` | `appointment-lifecycle` |
| `appointment_guests` | `poll-lifecycle` |
| `appointment_polls` | `poll-lifecycle` |
| `appointment_preparations` | `appointment-lifecycle` |
| `appointment_requests` | `appointment-request-lifecycle` |
| `appointments` | `appointment-lifecycle`, `appointment-request-lifecycle`, `appointment-briefing-lifecycle`, `poll-lifecycle` |
| `event_planning_checklist_items` | `event-planning-lifecycle` |
| `event_planning_contacts` | `event-planning-lifecycle` |
| `event_planning_dates` | `event-planning-lifecycle` |
| `event_planning_speakers` | `event-planning-lifecycle` |
| `event_planning_timeline_assignments` | `event-planning-lifecycle` |
| `event_plannings` | `event-planning-lifecycle` |
| `poll_participants` | `poll-lifecycle` |
| `poll_time_slots` | `poll-lifecycle` |
| `tasks` | `appointment-briefing-lifecycle` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `appointment_feedback` | `appointment_id` | `appointments` |
| `appointment_feedback` | `external_event_id` | `external_events` |
| `appointment_feedback` | `tenant_id` | `tenants` |
| `appointment_guests` | `appointment_id` | `appointments` |
| `appointment_polls` | `confirmed_appointment_id` | `appointments` |
| `appointment_polls` | `confirmed_slot_id` | `poll_time_slots` |
| `appointment_polls` | `tenant_id` | `tenants` |
| `appointment_preparations` | `template_id` | `appointment_preparation_templates` |
| `appointment_preparations` | `appointment_id` | `appointments` |
| `appointment_preparations` | `tenant_id` | `tenants` |
| `appointment_requests` | `appointment_id` | `appointments` |
| `appointment_requests` | `tenant_id` | `tenants` |
| `appointments` | `poll_id` | `appointment_polls` |
| `appointments` | `call_log_id` | `call_logs` |
| `appointments` | `contact_id` | `contacts` |
| `appointments` | `district_id` | `election_districts` |
| `appointments` | `meeting_id` | `meetings` |
| `appointments` | `party_association_id` | `party_associations` |
| `appointments` | `tenant_id` | `tenants` |
| `event_planning_checklist_items` | `event_planning_id` | `event_plannings` |
| `event_planning_contacts` | `event_planning_id` | `event_plannings` |
| `event_planning_dates` | `appointment_id` | `appointments` |
| `event_planning_dates` | `event_planning_id` | `event_plannings` |
| `event_planning_speakers` | `event_planning_id` | `event_plannings` |
| `event_planning_timeline_assignments` | `checklist_item_id` | `event_planning_checklist_items` |
| `event_planning_timeline_assignments` | `event_planning_id` | `event_plannings` |
| `event_plannings` | `template_id` | `planning_templates` |
| `event_plannings` | `tenant_id` | `tenants` |
| `poll_participants` | `poll_id` | `appointment_polls` |
| `poll_time_slots` | `poll_id` | `appointment_polls` |
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
| `poll_time_slots` | `appointment_polls` | `confirmed_slot_id` |
| `appointment_preparations` | `appointment_preparation_documents` | `preparation_id` |
| `appointments` | `appointment_preparations` | `appointment_id` |
| `appointments` | `appointment_reminder_dispatches` | `appointment_id` |
| `appointments` | `appointment_requests` | `appointment_id` |
| `appointments` | `appointment_topics` | `appointment_id` |
| `appointment_polls` | `appointments` | `poll_id` |
| `appointments` | `case_file_appointments` | `appointment_id` |
| `tasks` | `case_file_tasks` | `task_id` |
| `tasks` | `document_annotation_tasks` | `task_id` |
| `tasks` | `employee_meeting_action_items` | `task_id` |
| `event_planning_checklist_items` | `event_planning_action_logs` | `checklist_item_id` |
| `event_plannings` | `event_planning_checklist_items` | `event_planning_id` |
| `event_plannings` | `event_planning_collaborators` | `event_planning_id` |
| `event_plannings` | `event_planning_contacts` | `event_planning_id` |
| `appointments` | `event_planning_dates` | `appointment_id` |
| `event_plannings` | `event_planning_dates` | `event_planning_id` |
| `event_plannings` | `event_planning_documents` | `event_planning_id` |
| `event_planning_checklist_items` | `event_planning_item_actions` | `checklist_item_id` |
| `event_plannings` | `event_planning_speakers` | `event_planning_id` |
| `event_planning_checklist_items` | `event_planning_timeline_assignments` | `checklist_item_id` |
| `event_plannings` | `event_planning_timeline_assignments` | `event_planning_id` |
| `event_plannings` | `event_rsvps` | `event_planning_id` |
| `tasks` | `matrix_widget_callback_requests` | `task_id` |
| `appointment_polls` | `poll_notifications` | `poll_id` |
| `poll_participants` | `poll_notifications` | `participant_id` |
| `appointment_polls` | `poll_participants` | `poll_id` |
| `appointment_polls` | `poll_responses` | `poll_id` |
| `poll_participants` | `poll_responses` | `participant_id` |
| `poll_time_slots` | `poll_responses` | `time_slot_id` |
| `appointment_polls` | `poll_time_slots` | `poll_id` |
| `appointment_polls` | `poll_versions` | `poll_id` |
| `tasks` | `quick_notes` | `task_id` |
| `tasks` | `routine_package_runs` | `task_id` |
| `appointments` | `starred_appointments` | `appointment_id` |
| `tasks` | `subtasks` | `task_id` |
| `tasks` | `task_assignees` | `task_id` |
| `tasks` | `task_comments` | `task_id` |
| `tasks` | `task_decisions` | `task_id` |
| `tasks` | `task_topics` | `task_id` |
| `tasks` | `tasks` | `parent_task_id` |

## Prüfumfang

### `appointment-lifecycle` — Termin-Lifecycle (Kalender + Briefing + Feedback)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `appointment-request-lifecycle` — Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin)

- **Prüfungen:**
  - Statussperre bei direktem Schreiben
  - Zusage über die Anwendungs-RPC
  - Verknüpfter Termin
  - Wiederholung erzeugt keinen zweiten Termin
- **Grenzen:**
  - Bedienung der Kalenderoberfläche und externe Kalendersynchronisation werden nicht geprüft.

### `appointment-briefing-lifecycle` — Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben)

- **Prüfungen:**
  - Regeln für Freigabe und Fristvorschlag
  - Aufgabe entsteht beim Vergeben
  - Ball wechselt bei Vorlage
  - Freigabe erledigt Aufgabe
  - Kein Briefing schließt Aufgabe
- **Grenzen:**
  - Bedienung von Kalender- und Jour-Fixe-Oberfläche wird nicht geprüft.

### `event-planning-lifecycle` — Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `poll-lifecycle` — Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen)

- **Prüfungen:**
  - confirm_poll_winner legt genau einen Termin an und verknüpft ihn mit der Abstimmung
  - Zweiter Aufruf (gleicher und anderer Slot) liefert denselben Termin und den tatsächlich gespeicherten Slot
  - Externe Teilnehmer werden als Gäste am Termin angelegt, interne nicht
  - Fremde Slots und unbekannte Abstimmungen werden abgelehnt
  - Fremde Abstimmungen im Mandanten können nicht übernommen werden
  - get_poll_availability verweigert fremde Mandanten
- **Grenzen:**
  - Die Erstellerprüfung läuft gegen eine vorhandene fremde Abstimmung im Mandanten; in einem Büro ohne fremde Abstimmung meldet der Schritt diese Teilprüfung als nicht ausführbar.
  - Eine ausgeschiedene Büromitgliedschaft lässt sich im Selbsttest nicht gefahrlos simulieren; die Prüfung auf aktive Mitgliedschaft und der Versand der Erinnerungswarteschlange sind in der Migration und in den Logikschritten abgesichert.

## Detaildoku

- [dossier-umsetzungsplan.md](../dossier-umsetzungsplan.md)
- [public-event-invitations.md](../public-event-invitations.md)
- [rollenrechte-matrix.md](../rollenrechte-matrix.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
