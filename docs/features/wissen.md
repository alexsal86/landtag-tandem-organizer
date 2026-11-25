# Wissensbereich

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/wissen.json`). Nicht von Hand bearbeiten._

**Zweck:** Fragen im Büro stellen und beantworten, Antworten prüfen, mit Quellen, Tags und Anhängen versehen und die Gültigkeit überwachen.

## Kennzahlen

- Funktionen: **15** in **8** Unterbereichen
- implementiert: **15**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **7**
- ohne Dokumentationsverweis: **10**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `knowledge.management` Wissensverwaltung | Administration | administrativ | implementiert | rollenabhängig | kein Test |
| `knowledge.answer` Frage beantworten | Antworten | fachlich | implementiert | UI | Selbsttest |
| `knowledge.global-question` Globale Wissensfrage aus jedem Bereich | Fragen | fachlich | implementiert | UI | kein Test |
| `knowledge.ask` Wissensfrage stellen | Fragen | fachlich | implementiert | UI | Selbsttest |
| `knowledge.validity` Gültigkeit und Veraltung | Qualität | automatisiert | implementiert | systemseitig | Unit-Test |
| `knowledge.versions` Snapshots und Versionen | Qualität | fachlich | implementiert | UI | kein Test |
| `knowledge.review` Wissensantwort prüfen und freigeben | Qualität | fachlich | implementiert | rollenabhängig | Selbsttest |
| `knowledge.permissions` Zugriffsrechte auf Wissensdokumente | Sicherheit | sicherheit | implementiert | systemseitig | Selbsttest |
| `knowledge.attachments` Anhänge an Wissensfragen | Struktur | fachlich | implementiert | UI | kein Test |
| `knowledge.sources` Quellen und Belege | Struktur | fachlich | implementiert | UI | kein Test |
| `knowledge.tags` Tags und Themenzuordnung | Struktur | fachlich | implementiert | UI | Unit-Test |
| `knowledge.persons` Wissenspersonen und Zuständigkeit | Struktur | fachlich | implementiert | UI | Unit-Test |
| `knowledge.search` Wissenssuche | Suchen | fachlich | implementiert | UI | Selbsttest |
| `knowledge.collaboration` Kollaborative Wissensbearbeitung | Zusammenarbeit | integration | implementiert | systemseitig | kein Test |
| `knowledge.comments-follow` Kommentare und Folgen | Zusammenarbeit | fachlich | implementiert | UI | kein Test |

## Unterbereiche

- Fragen
- Antworten
- Qualität
- Struktur
- Zusammenarbeit
- Suchen
- Sicherheit
- Administration

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `admin`, `system`

## Datenbanktabellen

`knowledge_document_collaborators`, `knowledge_document_permissions`, `knowledge_document_snapshots`, `knowledge_document_topics`, `knowledge_document_versions`, `knowledge_documents`, `knowledge_qa_notification_deliveries`, `knowledge_question_attachments`, `knowledge_question_comments`, `knowledge_question_events`, `knowledge_question_followers`, `knowledge_question_outdated_reports`, `knowledge_question_sources`, `knowledge_question_summaries`, `knowledge_question_tags`, `knowledge_questions`, `knowledge_tags`, `notifications`, `profiles`, `tasks`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `access-boundaries` | Zugriffsschutz (Bürogrenzen und Entscheiderrolle) | 1 | 4 |
| `knowledge-lifecycle` | Wissen: Fragen, Antworten und manuelle Prüfung | 3 | 5 |

## Funktionsdetails

### `knowledge.ask` — Wissensfrage stellen
Erstellt eine Frage mit Titel, Kontext, Frist, Zuständigkeit, Tags und optionalen Anhängen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/knowledge`, `/wissen`
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeBaseView.tsx`, `src/features/knowledge/components/AskQuestionDialog.tsx`, `src/features/knowledge/components/KnowledgeQuestionCard.tsx`
- **Services:** —
- **Hooks:** `src/features/knowledge/hooks/useKnowledgeQuestions.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_create_question`, `knowledge_qa_list`
- **Tabellen:** `knowledge_questions`, `knowledge_question_tags`, `knowledge_question_attachments`, `knowledge_question_followers`
- **Abhängigkeiten:** —
- **Selbsttests:** `knowledge-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/knowledge-global-question.md`

**Nachweise im Quellcode**

- src/features/knowledge/components/AskQuestionDialog.tsx
- src/features/knowledge/components/KnowledgeBaseView.tsx
- src/features/selftest/scenarios/knowledge-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.answer` — Frage beantworten
Verfasst und speichert Antworten mit Rich-Text, speichert Versionen und benachrichtigt Fragende und Folgende.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeAnswerEditor.tsx`, `src/features/knowledge/components/KnowledgeDetailPanel.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_save_answer`, `knowledge_qa_notify`, `knowledge_qa_refresh_tags`, `knowledge_qa_guard_archived`, `knowledge_qa_keep_legacy_identity`, `knowledge_qa_node_text`, `knowledge_qa_normalize`, `knowledge_qa_record_event`
- **Tabellen:** `knowledge_questions`, `knowledge_document_versions`, `knowledge_document_snapshots`
- **Abhängigkeiten:** `knowledge.ask`
- **Selbsttests:** `knowledge-lifecycle`
- **Unit-Tests:** `src/features/knowledge/logic.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeAnswerEditor.tsx
- src/features/knowledge/components/KnowledgeDetailPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.review` — Wissensantwort prüfen und freigeben
Führt Antworten durch Review, setzt Prüffristen, versendet Review-Erinnerungen und dokumentiert Ablehnungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/ReviewPanel.tsx`
- **Services:** —
- **Hooks:** `src/features/knowledge/hooks/useReviewDeadline.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_review`, `knowledge_qa_sync_review_task`, `dispatch_due_knowledge_reviews`, `knowledge_qa_notify_event`, `knowledge_qa_review_task_trigger`, `knowledge_qa_seed_notifications`, `knowledge_qa_seed_tenant_notifications`, `knowledge_qa_notification_selftest`, `knowledge_qa_selftest`
- **Tabellen:** `knowledge_questions`, `knowledge_question_events`, `tasks`, `notifications`
- **Abhängigkeiten:** `knowledge.answer`, `tasks.create`
- **Selbsttests:** `knowledge-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/knowledge-validity.md`

**Nachweise im Quellcode**

- src/features/knowledge/components/ReviewPanel.tsx
- src/features/knowledge/hooks/useReviewDeadline.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.validity` — Gültigkeit und Veraltung
Überwacht Gültigkeitsdaten, meldet veraltete Antworten und erzwingt Regeln beim Speichern.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/knowledge/logic.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_enforce_validity`, `knowledge_qa_report_outdated`, `knowledge_qa_max_valid_until`
- **Tabellen:** `knowledge_questions`, `knowledge_question_outdated_reports`
- **Abhängigkeiten:** `knowledge.answer`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/knowledge/logic.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/knowledge-validity.md`

**Nachweise im Quellcode**

- src/features/knowledge/hooks/useReviewDeadline.ts
- src/features/knowledge/logic.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.tags` — Tags und Themenzuordnung
Vergibt Tags, schlägt Tag-Zuordnungen vor und synchronisiert Wissen mit Themen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeTagsPanel.tsx`
- **Services:** —
- **Hooks:** `src/features/knowledge/hooks/useKnowledgeExtras.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_set_tags`, `knowledge_qa_tag_suggestions`, `knowledge_qa_tag_topics`, `knowledge_tag_sync_topic`, `knowledge_qa_manage_tag`
- **Tabellen:** `knowledge_tags`, `knowledge_question_tags`, `knowledge_document_topics`, `topics`
- **Abhängigkeiten:** `knowledge.answer`, `topics.manage`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/knowledge/logic.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeTagsPanel.tsx
- src/features/knowledge/hooks/useKnowledgeExtras.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.sources` — Quellen und Belege
Hinterlegt Quellen, prüft sie und protokolliert Quellenänderungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeSourcesPanel.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_add_source`, `knowledge_qa_remove_source`, `knowledge_qa_source_guard`, `knowledge_qa_source_audit`
- **Tabellen:** `knowledge_question_sources`
- **Abhängigkeiten:** `knowledge.answer`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeSourcesPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.attachments` — Anhänge an Wissensfragen
Reserviert Uploads, prüft Dateitypen und schließt Anhänge an Fragen ab.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeAttachments.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_reserve_attachment`, `knowledge_qa_file_allowed`, `knowledge_qa_finish_attachment`
- **Tabellen:** `knowledge_question_attachments`
- **Abhängigkeiten:** `knowledge.ask`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeAttachments.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.comments-follow` — Kommentare und Folgen
Kommentiert Fragen und Antworten, folgt Fragen und steuert Benachrichtigungen für Mitlesende.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgeConversationPanel.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_comment`, `knowledge_qa_follow`, `knowledge_qa_auto_follow`
- **Tabellen:** `knowledge_question_comments`, `knowledge_question_followers`, `knowledge_qa_notification_deliveries`
- **Abhängigkeiten:** `knowledge.ask`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeConversationPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.search` — Wissenssuche
Durchsucht Fragen und Antworten mit gepflegtem Suchindex und liefert Trefferzahlen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_update_search`, `search_knowledge_questions`, `knowledge_qa_counts`
- **Tabellen:** `knowledge_questions`, `knowledge_question_summaries`
- **Abhängigkeiten:** `knowledge.ask`
- **Selbsttests:** `knowledge-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** `e2e/knowledge.spec.ts`, `e2e/knowledge-workspace.spec.ts`
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/KnowledgeQuestionRow.tsx
- src/features/knowledge/hooks/useKnowledgeQuestions.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.versions` — Snapshots und Versionen
Erzeugt Snapshots von Wissensdokumenten und zeigt frühere Fassungen im Verlauf.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/HistoryPanel.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_knowledge_document_snapshot`
- **Tabellen:** `knowledge_document_versions`, `knowledge_document_snapshots`
- **Abhängigkeiten:** `knowledge.answer`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/HistoryPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.permissions` — Zugriffsrechte auf Wissensdokumente
Beschränkt Wissensdokumente auf berechtigte Personen und prüft Lesen und Bearbeiten getrennt.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/knowledge/logic.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `can_access_knowledge_document`, `can_edit_knowledge_document`, `knowledge_qa_can_access`, `knowledge_qa_manage`
- **Tabellen:** `knowledge_document_permissions`, `knowledge_documents`, `knowledge_document_collaborators`
- **Abhängigkeiten:** —
- **Selbsttests:** `access-boundaries`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/features/knowledge/logic.ts
- src/features/selftest/scenarios/access-boundaries.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.collaboration` — Kollaborative Wissensbearbeitung
Synchronisiert Wissensdokumente in Echtzeit über einen eigenen Kollaborationskanal.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useYjsCollaboration.tsx`
- **Edge Functions:** `knowledge-collaboration`
- **Datenbankfunktionen:** —
- **Tabellen:** `knowledge_documents`, `knowledge_document_collaborators`
- **Abhängigkeiten:** `knowledge.answer`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/knowledge-collaboration/index.ts
- src/hooks/useYjsCollaboration.tsx

**Bekannte Einschränkungen**

- Öffentlicher Kollaborationsendpunkt; ein zusätzlicher serverseitiger Guard ist laut Sicherheitsmatrix empfohlen.

**Offene Prüfpunkte**

- Sicherheitsklassifikation public-webhook; Schutzbedarf prüfen.

### `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
Öffnet den FrageDialog aus anderen Fachbereichen und übergibt den Kontext an den Wissensbereich.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/GlobalKnowledgeQuestionHost.tsx`
- **Services:** `src/features/knowledge/globalQuestion.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `knowledge_questions`
- **Abhängigkeiten:** `knowledge.ask`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/knowledge-global-question.md`

**Nachweise im Quellcode**

- src/features/knowledge/globalQuestion.ts
- src/features/knowledge/components/GlobalKnowledgeQuestionHost.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.persons` — Wissenspersonen und Zuständigkeit
Verknüpft Wissensfragen mit Personen und zeigt Ansprechpartner für Themen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/KnowledgePersonAvatar.tsx`
- **Services:** `src/features/knowledge/person.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_set_assignee`
- **Tabellen:** `knowledge_questions`, `profiles`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/knowledge/person.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/person.ts
- src/features/knowledge/person.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `knowledge.management` — Wissensverwaltung
Verwaltet Tags, Berechtigungen, Review-Zuweisungen und administrative Wissenseinstellungen.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/knowledge/components/ManagementPanel.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `knowledge_qa_manage`, `knowledge_qa_manage_selftest`, `knowledge_qa_seed_manage_permission`
- **Tabellen:** `knowledge_documents`, `knowledge_document_permissions`, `knowledge_tags`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/knowledge/components/ManagementPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
