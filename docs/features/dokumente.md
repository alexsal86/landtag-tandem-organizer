# Dokumente & Wissen

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Dokumente ablegen, Anmerkungen und Antworten mit Aufgaben verknüpfen und den Wissensbereich nutzen.

## Seiten

- `/documents`
- `/knowledge`
- `/wissen`

## Rollen

Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `document_annotation_events` | `document-annotation` |
| `document_annotation_tasks` | `document-annotation` |
| `document_annotations` | `document-annotation` |
| `documents` | `document-annotation` |
| `knowledge_qa_notification_deliveries` | `knowledge-lifecycle` |
| `knowledge_question_events` | `knowledge-lifecycle` |
| `knowledge_questions` | `knowledge-lifecycle` |
| `task_assignees` | `document-annotation` |
| `tasks` | `document-annotation` |

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `document_annotation_events` | `document_id` | `documents` |
| `document_annotation_tasks` | `annotation_id` | `document_annotations` |
| `document_annotation_tasks` | `document_id` | `documents` |
| `document_annotation_tasks` | `task_id` | `tasks` |
| `document_annotations` | `parent_id` | `document_annotations` |
| `document_annotations` | `document_id` | `documents` |
| `documents` | `folder_id` | `document_folders` |
| `documents` | `tenant_id` | `tenants` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_question_cards` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_question_summaries` |
| `knowledge_question_events` | `tenant_id`, `question_id` | `knowledge_questions` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_question_cards` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_question_summaries` |
| `knowledge_questions` | `tenant_id`, `merged_into` | `knowledge_questions` |
| `knowledge_questions` | `tenant_id` | `tenants` |
| `task_assignees` | `assigned_by` | `profiles` |
| `task_assignees` | `user_id` | `profiles` |
| `task_assignees` | `task_id` | `tasks` |
| `tasks` | `call_log_id` | `call_logs` |
| `tasks` | `meeting_id` | `meetings` |
| `tasks` | `parent_task_id` | `tasks` |
| `tasks` | `tenant_id` | `tenants` |

### Eingehend

| Zieltabelle im Bereich | Von | Spalte |
|---|---|---|
| `tasks` | `annual_task_completions` | `linked_task_id` |
| `documents` | `case_file_documents` | `document_id` |
| `tasks` | `case_file_tasks` | `task_id` |
| `documents` | `case_item_attachments` | `document_id` |
| `documents` | `document_annotation_events` | `document_id` |
| `document_annotations` | `document_annotation_tasks` | `annotation_id` |
| `documents` | `document_annotation_tasks` | `document_id` |
| `tasks` | `document_annotation_tasks` | `task_id` |
| `document_annotations` | `document_annotations` | `parent_id` |
| `documents` | `document_annotations` | `document_id` |
| `documents` | `document_contacts` | `document_id` |
| `documents` | `document_topics` | `document_id` |
| `documents` | `employee_hr_evidence` | `document_id` |
| `tasks` | `employee_meeting_action_items` | `task_id` |
| `knowledge_questions` | `knowledge_question_attachments` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_question_comments` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_question_events` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_question_followers` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_question_outdated_reports` | `tenant_id`, `question_id` |
| `documents` | `knowledge_question_sources` | `document_id` |
| `knowledge_questions` | `knowledge_question_sources` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_question_tags` | `tenant_id`, `question_id` |
| `knowledge_questions` | `knowledge_questions` | `tenant_id`, `merged_into` |
| `tasks` | `matrix_widget_callback_requests` | `task_id` |
| `tasks` | `quick_notes` | `task_id` |
| `tasks` | `routine_package_runs` | `task_id` |
| `tasks` | `subtasks` | `task_id` |
| `tasks` | `task_assignees` | `task_id` |
| `tasks` | `task_comments` | `task_id` |
| `tasks` | `task_decisions` | `task_id` |
| `tasks` | `task_topics` | `task_id` |
| `tasks` | `tasks` | `parent_task_id` |

## Prüfumfang

### `document-list` — Dokumente: Suche, Kategorien, Sortierung und Auswahl

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `document-annotation` — Dokument-Annotation

- **Prüfungen:**
  - Mehrseitige Textauswahl
  - Suche und Navigation
  - OCR-Geometrie
  - PDF-Exportkoordinaten
  - Textanker und Änderungsverlauf
  - Dateityp
  - Bruchteil-Koordinaten
  - Polygon-Mindestpunkte
  - Verschieben und Eckpunkte
  - Zoomgrenzen
  - Anlegen, Antworten, Erledigen und Löschen
  - Fremde Autorenschaft und Mandatsgrenzen
  - Serverrollen und aktive RLS/Trigger
  - Erwähnungen mit Thread-Link
- **Grenzen:**
  - OCR-Erkennungsqualität, Textauswahl und PDF-Exportdarstellung erfordern eine interaktive Prüfung.
  - Realtime, Scrollen und Benachrichtigungszustellung erfordern zwei interaktive Sitzungen. Die Serverrollenprüfung gilt für das angemeldete Konto; die UI-Regeln decken alle Rollen ab. Fremde Datensätze werden nicht testweise verändert.

### `knowledge-lifecycle` — Wissen: Fragen, Antworten und manuelle Prüfung

- **Prüfungen:**
  - Frage als einziges Pflichtfeld
  - Validierte Antwort und sichere Links
  - Drei Prüfzustände und Fälligkeit
  - Anhanggrenzen
  - Lesen außerhalb des eigenen Büros
- **Grenzen:**
  - Zwei-Büro-Isolation, FTS und Storage-Policies werden zusätzlich mit scripts/test-knowledge-qa.mjs in isoliertem PostgreSQL geprüft. Echte Storage-HTTP-Zugriffe benötigen eine Supabase-Testinstanz.

## Detaildoku

- [knowledge-validity.md](../knowledge-validity.md)
- [knowledge-global-question.md](../knowledge-global-question.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
