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
