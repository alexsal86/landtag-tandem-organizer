# Aufgaben & Stafette

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/aufgaben.json`). Nicht von Hand bearbeiten._

**Zweck:** Aufgaben anlegen, zuweisen, über Fristen, Wiedervorlagen und Stafette führen, mit Entscheidungen und Vorgängen verknüpfen und archivieren.

## Kennzahlen

- Funktionen: **18** in **12** Unterbereichen
- implementiert: **18**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **7**
- ohne Dokumentationsverweis: **9**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `tasks.archive` Aufgabe archivieren und wiederherstellen | Archiv | fachlich | implementiert | UI | kein Test |
| `tasks.complete` Aufgabe abschließen | Bearbeitung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.edit` Aufgabe bearbeiten | Bearbeitung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.subtasks` Unteraufgaben | Bearbeitung | fachlich | implementiert | UI | kein Test |
| `tasks.create` Aufgabe erstellen | Erfassung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.nudge` Aufgabe anmahnen und Erinnerungen versenden | Erinnerungen | automatisiert | implementiert | systemseitig | kein Test |
| `tasks.snooze` Aufgabe zurückstellen (Wiedervorlage) | Fristen | fachlich | implementiert | UI | kein Test |
| `tasks.deadline` Frist setzen und überwachen | Fristen | fachlich | implementiert | UI | kein Test |
| `tasks.annual` Jahresaufgaben und Jahresabschluss | Jahresaufgaben | automatisiert | implementiert | systemseitig | Selbsttest |
| `tasks.handover-stafette` Aufgabe weitergeben (Stafette) | Stafette | fachlich | implementiert | UI | Selbsttest |
| `tasks.ball-owner` Wer ist am Zug? (Ball-Owner) | Stafette | fachlich | implementiert | UI | Unit-Test |
| `tasks.search-filter` Aufgaben suchen, filtern und sortieren | Suchen & Filtern | fachlich | implementiert | UI | kein Test |
| `tasks.link-document` Aufgabe mit Dokument verknüpfen | Verknüpfung | fachlich | implementiert | UI | kein Test |
| `tasks.link-decision` Aufgabe mit Entscheidung verknüpfen | Verknüpfung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.link-case` Aufgabe mit Vorgang verknüpfen | Verknüpfung | fachlich | implementiert | systemseitig | Unit-Test |
| `tasks.templates` Aufgabenvorlagen anwenden und pflegen | Vorlagen | fachlich | implementiert | UI | Unit-Test |
| `tasks.recurring` Wiederkehrende Aufgabe | Wiederholung | automatisiert | implementiert | systemseitig | Unit-Test |
| `tasks.assign` Aufgabe zuweisen | Zuweisung | fachlich | implementiert | rollenabhängig | Selbsttest |

## Unterbereiche

- Erfassung
- Bearbeitung
- Zuweisung
- Stafette
- Fristen
- Verknüpfung
- Wiederholung
- Vorlagen
- Archiv
- Suchen & Filtern
- Erinnerungen
- Jahresaufgaben

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `system`, `admin`

## Datenbanktabellen

`annual_task_completions`, `annual_tasks`, `archived_tasks`, `bulk_action_audit`, `case_file_tasks`, `case_item_timeline`, `dashboard_decision_nudges`, `documents`, `notifications`, `preparation_templates`, `profiles`, `routine_package_runs`, `routine_package_steps`, `subtasks`, `task_archive_settings`, `task_assignees`, `task_categories`, `task_decision_participants`, `task_decisions`, `task_documents`, `task_snoozes`, `task_statuses`, `task_topics`, `tasks`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `annual-task-stafette` | Jahresaufgabe → Büroaufgabe → Jahresabschluss | 3 | 5 |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 3 | 0 |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | 2 | 0 |
| `task-stafette-lifecycle` | Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe) | 1 | 4 |

## Funktionsdetails

### `tasks.create` — Aufgabe erstellen
Legt eine Aufgabe mit Titel, Beschreibung, Fälligkeit, Priorität, Kategorie, Empfängern und optionaler Verknüpfung an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/tasks/new`, `/tasks/:taskId`
- **Frontend-Komponenten:** `src/pages/CreateTask.tsx`, `src/features/tasks/components/TodoCreateDialog.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useTaskCategories.ts`, `src/hooks/useTaskStatuses.ts`, `src/hooks/useTaskTopics.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tasks`, `task_assignees`, `task_categories`, `task_statuses`, `task_topics`
- **Abhängigkeiten:** —
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/pages/CreateTask.tsx
- src/features/tasks/components/TodoCreateDialog.tsx
- src/features/selftest/scenarios/task-lifecycle.ts

**Bekannte Einschränkungen**

- Das Szenario deckt den Standardpfad ab, nicht jede Feldkombination.

**Offene Prüfpunkte**

- Keine.

### `tasks.edit` — Aufgabe bearbeiten
Ändert Felder, Status, Priorität und Beschreibung einer bestehenden Aufgabe inklusive Protokollierung der Änderung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/tasks/components/TaskDetailSidebar.tsx`, `src/components/tasks/TaskDialogs.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tasks`, `task_statuses`, `task_snoozes`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/tasks/components/TaskDetailSidebar.tsx
- src/features/tasks/components/TasksView.tsx

**Bekannte Einschränkungen**

- Ein Statuswechsel ist nur auf einen Namen aus der konfigurierbaren Liste task_statuses möglich; der Trigger enforce_task_status lehnt andere Werte ab. Der frühere Bindestrich-Wert ist migriert und wird nicht mehr geschrieben. Die technischen Namen der Kernstatus (todo, in_progress, completed, cancelled, review) sind gegen Umbenennen und Löschen geschützt, weil Spalten-Default, Client und Datenbankfunktionen sie direkt schreiben; ändern lässt sich der Anzeigename. Fehlte ein Kernstatus, stellt die Migration 20261126130000 ihn wieder her.

**Offene Prüfpunkte**

- Keine.

### `tasks.complete` — Aufgabe abschließen
Setzt eine Aufgabe auf abgeschlossen, stempelt die Erledigung und stößt Folgeprozesse wie Wiederholung und Ball-Rückgabe an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/stafette.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `stamp_task_completion`
- **Tabellen:** `tasks`, `archived_tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-lifecycle`, `task-stafette-lifecycle`
- **Unit-Tests:** `src/features/tasks/stafette.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/tasks/stafette.ts
- src/features/tasks/components/TasksView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.assign` — Aufgabe zuweisen
Weist eine oder mehrere Personen zu, hält die Zuweisungsliste synchron und erlaubt die Übergabe an die Stellvertretung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/lib/taskAssignees.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `parse_task_assignee_ids`, `sync_task_assignees_from_task`, `handover_tasks_to_deputy`, `list_task_deputy_ids`
- **Tabellen:** `tasks`, `task_assignees`, `profiles`
- **Abhängigkeiten:** `tasks.create`, `tasks.ball-owner`
- **Selbsttests:** `task-lifecycle`, `task-stafette-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/lib/taskAssignees.ts
- src/hooks/useAllPersonContacts.tsx
- src/hooks/useTenantProfiles.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Regel, wer wem zuweisen darf, liegt teils in RLS und teils im Code; sie ist hier nicht vollständig rekonstruiert.

### `tasks.handover-stafette` — Aufgabe weitergeben (Stafette)
Übergibt den Ball an eine andere Person oder ein Büro, schreibt Timeline-Eintrag, nächsten Schritt und Benachrichtigung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/stafette.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `record_task_stafette_handover`, `batch_task_stafette_action`, `batch_task_stafette_preview`, `undo_task_batch_action`, `task_batch_plan`, `task_stafette_batch_snapshot`
- **Tabellen:** `tasks`, `task_assignees`, `task_snoozes`, `bulk_action_audit`
- **Abhängigkeiten:** `tasks.ball-owner`, `tasks.create`
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** `src/features/tasks/stafette.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`, `docs/workflow-consistency.md`

**Nachweise im Quellcode**

- src/features/tasks/stafette.ts
- src/features/selftest/scenarios/task-stafette-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
Bestimmt aus Status, Zuweisung und Stafette, bei wem die Aufgabe liegt, und zeigt das in Listen und Filtern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskBadges.tsx`
- **Services:** `src/features/tasks/stafette.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `validate_task_ball_owner`
- **Tabellen:** `tasks`, `task_assignees`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/tasks/stafette.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/tasks/stafette.ts
- src/features/tasks/stafette.test.ts
- src/components/tasks/TaskBadges.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die reine Regel ist getestet; die Anzeige in allen Listen ist nicht durchgängig geprüft.

### `tasks.deadline` — Frist setzen und überwachen
Setzt Fälligkeiten, hebt überfällige Aufgaben hervor und speist Fristen-Widgets und Erinnerungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/DeadlineReviewDialog.tsx`, `src/components/dashboard/TasksSummary.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDashboardDeadlines.ts`, `src/hooks/useDeadlineActions.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tasks`, `task_snoozes`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/hooks/useDashboardDeadlines.ts
- src/components/dashboard/DeadlineReviewDialog.tsx
- src/components/dashboard/TasksSummary.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
Verschiebt die Wiedervorlage einer Aufgabe, protokolliert den Zeitpunkt und blendet sie bis dahin aus den aktiven Listen aus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/DeadlineSnoozeButton.tsx`, `src/components/notifications/SnoozeManagementSidebar.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useSnoozeDeadline.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_snoozes`, `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useSnoozeDeadline.ts
- src/components/dashboard/DeadlineSnoozeButton.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Ob Rückstellungen fachlich als Wiedervorlage oder nur als Anzeige-Unterdrückung gelten, ist im Code nicht abschließend dokumentiert.

### `tasks.subtasks` — Unteraufgaben
Zerlegt Aufgaben in Unteraufgaben und zeigt deren Fortschritt in der Hauptaufgabe.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskListRow.tsx`, `src/components/tasks/TaskCard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `subtasks`, `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/tasks/TaskListRow.tsx
- src/components/tasks/TaskCard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Unteraufgaben-Oberfläche wurde nicht im Browser geprüft; der Nachweis stützt sich auf Komponenten und Tabelle.

### `tasks.link-decision` — Aufgabe mit Entscheidung verknüpfen
Erzeugt aus einer Aufgabe eine Entscheidung oder verknüpft sie; nach der Abstimmung gibt ein Trigger den Ball an den Ersteller zurück.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/NoteDecisionCreator.tsx`, `src/components/task-decisions`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_decision_task`, `return_task_ball_after_vote`, `user_can_access_task_decision`
- **Tabellen:** `task_decisions`, `tasks`, `task_decision_participants`
- **Abhängigkeiten:** `tasks.create`, `decisions.create`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/task-decision-reactions-rollout.md`, `docs/my-work-decisions-button-flowchart.md`

**Nachweise im Quellcode**

- src/features/decisions/useDeputyDashboardDecisions.ts
- src/components/shared/NoteDecisionCreator.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.link-case` — Aufgabe mit Vorgang verknüpfen
Verknüpft Aufgaben mit Vorgängen und Fallakten und synchronisiert Schritt- und Erledigungsstatus in beide Richtungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/taskEvents.ts`, `src/features/cases/items/workflow.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `sync_case_office_step_task`, `sync_case_step_from_task`, `journal_case_step_task`, `create_case_file_task`
- **Tabellen:** `case_file_tasks`, `case_item_timeline`, `tasks`
- **Abhängigkeiten:** `cases.steps`, `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/taskEvents.test.ts`, `src/features/cases/items/workflow.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/taskEvents.ts
- src/features/cases/items/workflow.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.link-document` — Aufgabe mit Dokument verknüpfen
Hängt Dokumente an Aufgaben und öffnet sie aus der Aufgabenansicht.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskDocumentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_documents`, `documents`
- **Abhängigkeiten:** `tasks.create`, `documents.upload-version`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/tasks/TaskDocumentDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.recurring` — Wiederkehrende Aufgabe
Erzeugt beim Abschluss automatisch die nächste Aufgabe anhand einer Wiederholungsregel; die Datumsberechnung liegt in reinen Funktionen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/templates.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `spawn_recurring_task`, `next_recurrence_date`, `validate_task_recurrence`
- **Tabellen:** `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/tasks/templates.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`

**Nachweise im Quellcode**

- src/features/tasks/templates.ts
- src/features/tasks/templates.test.ts

**Bekannte Einschränkungen**

- Ob die Wiederholung im Browser sichtbar ausgelöst wurde, ist nicht geprüft; der Nachweis ist die Trigger-/RPC-Kette.

**Offene Prüfpunkte**

- Keine.

### `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
Speichert Mandats-/Bürovorlagen und wendet sie beim Anlegen an, inklusive Frist- und Zuweisungsfeldern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `mitarbeiter`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/templates.ts`
- **Hooks:** `src/hooks/usePreparationTemplates.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `preparation_templates`, `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/tasks/templates.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/tasks/templates.ts
- src/hooks/usePreparationTemplates.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.archive` — Aufgabe archivieren und wiederherstellen
Verschiebt abgeschlossene Aufgaben ins Archiv, erlaubt Wiederherstellung und protokolliert Archivaktionen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/tasks/archive`
- **Frontend-Komponenten:** `src/features/tasks/components/TaskArchiveView.tsx`, `src/features/tasks/components/TaskArchiveModal.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `archive_completed_task`, `restore_archived_task`, `undo_task_batch_action`
- **Tabellen:** `archived_tasks`, `tasks`, `task_archive_settings`, `bulk_action_audit`
- **Abhängigkeiten:** `tasks.create`, `tasks.complete`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/tasks/components/TaskArchiveView.tsx
- src/features/tasks/components/TaskArchiveModal.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
Filtert Aufgaben nach Status, Kategorie, Zuständigkeit, Frist und Text und sortiert die Ergebnisliste.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/tasks/components/TasksView.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkTasksData.ts`, `src/hooks/useTaskStatuses.ts`, `src/hooks/useTaskCategories.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tasks`, `task_statuses`, `task_categories`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/tasks/components/TasksView.tsx
- src/hooks/useMyWorkTasksData.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Filterlogik liegt in der Ansicht; eine eigene getestete Regeldatei existiert nicht.

### `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
Erlaubt Anmahnen über eine RPC mit 24-Stunden-Grenze und versendet fällige Erinnerungen stündlich per Cron.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `nudge_task`, `ack_task_nudge`, `dispatch_due_task_reminders`, `escalate_task`, `task_approval_sla`
- **Tabellen:** `tasks`, `notifications`, `dashboard_decision_nudges`
- **Abhängigkeiten:** `tasks.create`, `tasks.ball-owner`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/workflow-consistency.md`

**Nachweise im Quellcode**

- supabase/functions/_shared/security.ts
- src/hooks/useNotifications.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Cron-Versand ist nicht in dieser Umgebung ausgeführt worden.

### `tasks.annual` — Jahresaufgaben und Jahresabschluss
Führt wiederkehrende Jahresaufgaben mit Abschlusshistorie, Sperre je Jahr und Überführung in die Stafette.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/timetracking/annualTaskRules.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `execute_annual_automation_routine`, `spawn_annual_task_to_stafette`, `sync_annual_task_completion`, `guard_annual_completion_link`
- **Tabellen:** `annual_tasks`, `annual_task_completions`, `routine_package_runs`, `routine_package_steps`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `annual-task-stafette`
- **Unit-Tests:** `src/features/timetracking/annualTaskRules.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`

**Nachweise im Quellcode**

- src/features/timetracking/annualTaskRules.ts
- src/features/selftest/scenarios/annual-task-stafette.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
