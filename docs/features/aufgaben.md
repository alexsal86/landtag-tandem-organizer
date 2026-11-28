# Aufgaben & Stafette

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/aufgaben.json`). Nicht von Hand bearbeiten._

**Zweck:** Aufgaben anlegen, zuweisen, über Fristen, Wiedervorlagen und Stafette führen, mit Entscheidungen und Vorgängen verknüpfen und archivieren.

## Kennzahlen

- Funktionen: **18** in **12** Unterbereichen
- implementiert: **18**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **1**
- ohne Dokumentationsverweis: **9**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `tasks.archive` Aufgabe archivieren und wiederherstellen | Archiv | fachlich | implementiert | UI | Selbsttest |
| `tasks.complete` Aufgabe abschließen | Bearbeitung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.edit` Aufgabe bearbeiten | Bearbeitung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.subtasks` Unteraufgaben | Bearbeitung | fachlich | implementiert | UI | Selbsttest |
| `tasks.create` Aufgabe erstellen | Erfassung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.nudge` Aufgabe anmahnen und Erinnerungen versenden | Erinnerungen | automatisiert | implementiert | systemseitig | Selbsttest |
| `tasks.snooze` Aufgabe zurückstellen (Wiedervorlage) | Fristen | fachlich | implementiert | UI | Selbsttest |
| `tasks.deadline` Frist setzen und überwachen | Fristen | fachlich | implementiert | UI | Selbsttest |
| `tasks.annual` Jahresaufgaben und Jahresabschluss | Jahresaufgaben | automatisiert | implementiert | systemseitig | Selbsttest |
| `tasks.handover-stafette` Aufgabe weitergeben (Stafette) | Stafette | fachlich | implementiert | UI | Selbsttest |
| `tasks.ball-owner` Wer ist am Zug? (Ball-Owner) | Stafette | fachlich | implementiert | UI | Selbsttest |
| `tasks.search-filter` Aufgaben suchen, filtern und sortieren | Suchen & Filtern | fachlich | implementiert | UI | kein Test |
| `tasks.link-document` Aufgabe mit Dokument verknüpfen | Verknüpfung | fachlich | implementiert | UI | Selbsttest |
| `tasks.link-decision` Aufgabe mit Entscheidung verknüpfen | Verknüpfung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `tasks.link-case` Aufgabe mit Vorgang verknüpfen | Verknüpfung | fachlich | implementiert | systemseitig | Unit-Test |
| `tasks.templates` Aufgabenvorlagen anwenden und pflegen | Vorlagen | fachlich | implementiert | UI | Unit-Test |
| `tasks.recurring` Wiederkehrende Aufgabe | Wiederholung | automatisiert | implementiert | systemseitig | Selbsttest |
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

`annual_task_completions`, `annual_tasks`, `archived_tasks`, `bulk_action_audit`, `case_file_tasks`, `case_item_timeline`, `dashboard_decision_nudges`, `documents`, `notifications`, `preparation_templates`, `profiles`, `routine_package_runs`, `routine_package_steps`, `subtasks`, `task_archive_settings`, `task_assignees`, `task_batch_actions`, `task_categories`, `task_decision_participants`, `task_decisions`, `task_documents`, `task_snoozes`, `task_statuses`, `task_topics`, `tasks`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `annual-task-stafette` | Jahresaufgabe → Büroaufgabe → Jahresabschluss | 3 | 5 | — |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 11 | 9 | — |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | 6 | 8 | — |
| `task-stafette-lifecycle` | Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe) | 5 | 8 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `annual-task-stafette` | `seasonal-office-backend` | Büropakete: Backend und Abschluss im Folgejahr | workflow | — |
| `annual-task-stafette` | `seasonal-office-packages` | Bürojahr: alle Pakete, Vorlauf, Jahreswechsel und Terminbestätigung | logic | — |
| `annual-task-stafette` | `annual-overview` | Jahresübersicht: Statusfilter und Berliner Tagesgrenze | logic | — |
| `annual-task-stafette` | `unified-routine` | Jahresroutine im gemeinsamen Regel-Assistenten prüfen | logic | — |
| `annual-task-stafette` | `rules` | Stichtage und System-Routinen prüfen | logic | — |
| `annual-task-stafette` | `create` | Organisatorische Jahresaufgabe anlegen | db | — |
| `annual-task-stafette` | `delegate` | Übergeben: Stafette, Frist und Quelle lesen | workflow | — |
| `annual-task-stafette` | `duplicate` | Erneute Übergabe liefert dieselbe Aufgabe | workflow | — |
| `annual-task-stafette` | `guard` | Jahresabschluss außerhalb der Büroaufgabe blockiert | db | — |
| `decision-lifecycle` | `dashboard-nudges` | Anstupsen: zehn Sekunden und 24-Stunden-Sperre | logic | — |
| `decision-lifecycle` | `dashboard-voting` | Dashboard: nur eigene ausstehende Abstimmungen, keine eigenen Anfragen | logic | — |
| `decision-lifecycle` | `create` | Entscheidung anlegen (active) | db | — |
| `decision-lifecycle` | `add-participant` | Teilnehmer (sich selbst) hinzufügen | db | — |
| `decision-lifecycle` | `withdraw-responses` | Ja, Nein und Rückfrage speichern und nachweisbar zurücknehmen | workflow | — |
| `decision-lifecycle` | `withdraw-task-vote` | Rücknahme eines Votums an einer verknüpften Aufgabe | workflow | — |
| `decision-lifecycle` | `check-options` | Default-Antwortoptionen prüfen | db | — |
| `decision-lifecycle` | `change-vote-history` | Antwort ändern und den bisherigen Stand im Verlauf behalten | workflow | — |
| `decision-lifecycle` | `decision-attachments` | Anhang-Metadaten an die Entscheidung hängen, lesen und entfernen | workflow | — |
| `decision-lifecycle` | `comments-and-reactions` | Kommentar, Antwort und Emoji-Reaktion speichern und entfernen | workflow | — |
| `decision-lifecycle` | `notifications` | Meldungen entstehen im Mandanten der Entscheidung | workflow | — |
| `decision-lifecycle` | `invitation-dispatch` | Einladungsversand wird serverseitig eingestellt und übernommen | workflow | — |
| `decision-lifecycle` | `lifecycle-notifications` | Frist, Rückzug, Ergebnis und direkte Antwort melden | workflow | — |
| `decision-lifecycle` | `delivery-preferences` | Persönliche Zustellfrequenz und Ruhezeiten respektieren | workflow | — |
| `decision-lifecycle` | `digest-items` | Digest zeigt Einzelmeldungen mit Person und Sprungziel | workflow | — |
| `decision-lifecycle` | `comment-mentions` | Direkte Erwähnungen sofort und außerhalb des Digests zustellen | workflow | — |
| `decision-lifecycle` | `deadline-reminders` | Frist-Erinnerungen 24 h/2 h einmalig und mit Ruhezeiten | workflow | — |
| `decision-lifecycle` | `notification-metrics` | Zustellungen, Abschaltquote, Antwortzeit, Anstupser und Trigger-Fehler messen | workflow | — |
| `decision-lifecycle` | `notification-actions` | Aus der Meldung abstimmen und Antwort aktualisieren | workflow | — |
| `decision-lifecycle` | `digest` | Meldungen werden gebündelt und nur der Digest wird gepusht | workflow | — |
| `decision-lifecycle` | `set-open` | Status auf 'open' | db | — |
| `decision-lifecycle` | `archive` | Archivieren | db | — |
| `decision-lifecycle` | `verify` | Verifikation | db | — |
| `decision-lifecycle` | `nudge-boundary` | Fremde oder unbekannte Entscheidung lässt sich nicht anstupsen | workflow | — |
| `decision-lifecycle` | `nudge-open-decision` | Offene Entscheidung anmahnen: Eintrag, Meldung und 24-Stunden-Sperre | workflow | — |
| `task-lifecycle` | `status-registry` | Status-Registry führt die fünf Kernstatus | db | — |
| `task-lifecycle` | `create` | Aufgabe anlegen | db | — |
| `task-lifecycle` | `document-link` | Dokument an Aufgabe hängen und wieder lösen | db | — |
| `task-lifecycle` | `subtasks` | Unteraufgaben: Verknüpfung, Hauptliste und Fortschritt | workflow | — |
| `task-lifecycle` | `assign` | Aufgabe zuweisen + Frist setzen | db | — |
| `task-lifecycle` | `deadline-review` | Fristen: Berliner Gruppierung, Verwerfen und Rückgängig | workflow | — |
| `task-lifecycle` | `decision` | Entscheidung aus Aufgabe erstellen | db | — |
| `task-lifecycle` | `jour-fixe` | Für Jour fixe markieren | db | — |
| `task-lifecycle` | `complete` | Status → completed | db | — |
| `task-lifecycle` | `completion-stamp` | Abschluss stempelt completed_at, Wiederöffnen löscht den Stempel | db | — |
| `task-lifecycle` | `recurrence-spawn` | Wiederholung legt beim Abschluss genau eine Folgeaufgabe an | workflow | — |
| `task-lifecycle` | `decision-ball` | Votum holt den Ball zurück; Folgeaufgabe entsteht genau einmal | workflow | — |
| `task-lifecycle` | `decision-ball-withdrawal` | Rücknahme des Votums stellt Ball und Schritt wieder her | workflow | — |
| `task-lifecycle` | `tenant-boundary` | Aufgabe lässt sich keinem fremden Büro zuordnen | workflow | — |
| `task-stafette-lifecycle` | `nudge` | Anstupsen: Empfänger sieht Aufgabe oben, 24h-Limit | logic | — |
| `task-stafette-lifecycle` | `checklist-batch` | Checkpunkt im Verlauf, Frist +1 Woche | logic | — |
| `task-stafette-lifecycle` | `reminder` | Fällige Erinnerung holt wartende Aufgabe in Mein Zug | logic | — |
| `task-stafette-lifecycle` | `set-step` | Frist bleibt sichtbar; eine ausdrückliche Wiedervorlage verschiebt die Anzeige | logic | — |
| `task-stafette-lifecycle` | `handover` | Zur Freigabe vorlegen → Wartet auf andere + Verlauf | logic | — |
| `task-stafette-lifecycle` | `return` | Rückgabe ans Büro → wieder Mein Zug | logic | — |
| `task-stafette-lifecycle` | `complete` | Abschluss: verschwindet aus allen Zonen + Verlauf | logic | — |
| `task-stafette-lifecycle` | `recurrence` | Wiederholung: nächste Frist korrekt berechnet | logic | — |
| `task-stafette-lifecycle` | `template-validation` | Aufgabenpakete: Fristen und Unteraufgaben verbindlich | logic | — |
| `task-stafette-lifecycle` | `template-automation-rule` | Aufgabenpaket ist eine manuelle Automatisierungsregel | logic | — |
| `task-stafette-lifecycle` | `template-subtasks` | Vorlage legt Hauptaufgabe mit verknüpften Unteraufgaben an | logic | — |
| `task-stafette-lifecycle` | `week-review` | Wochenreview findet fehlende Schritte, namenlose Bälle, Stille und Duplikate | logic | — |
| `task-stafette-lifecycle` | `task-command` | Einzeiler-Befehle und SLA-Stufen | logic | — |
| `task-stafette-lifecycle` | `batch-create` | Sammelaktion: Aufgabe ohne Frist wird übersprungen | db | — |
| `task-stafette-lifecycle` | `batch-keeps-step` | Sammelaktion: Freigabe behält den vorhandenen nächsten Schritt | db | — |
| `task-stafette-lifecycle` | `batch-undo` | Sammelaktion: Frist +1 Woche samt Rücknahme | db | — |
| `task-stafette-lifecycle` | `nudge-boundary` | Anstupsen erreicht keine Aufgabe außerhalb des eigenen Büros | workflow | — |
| `task-stafette-lifecycle` | `multi-assign` | Mehrfachzuweisung hält task_assignees und assigned_to synchron | db | — |
| `task-stafette-lifecycle` | `deputy-handover` | Vertretungsübergabe: nur Leitung, nie an sich selbst, verschiebt den Ball | workflow | — |
| `task-stafette-lifecycle` | `nudge-ack` | Anstupsen: 24-Stunden-Sperre der Datenbank und Quittung im Verlauf | workflow | — |
| `task-stafette-lifecycle` | `snooze-rows` | Wiedervorlage: task_snoozes je Person, genau ein Ziel | db | — |
| `task-stafette-lifecycle` | `archive-restore` | Archivieren entfernt Aufgabe und Wiedervorlage, Wiederherstellen holt sie zurück | workflow | — |

## Deklarierter Prüfumfang

### `annual-task-stafette`

1. Exakte Stichtage
2. System-Routinen nicht delegierbar
3. Eine Aufgabe pro Jahr
4. Abschluss und Wiederöffnung synchron
5. Direkter Jahresabschluss gesperrt

### `decision-lifecycle`

1. Ja, Nein und Rückfrage werden gespeichert und nachweisbar zurückgenommen
2. Die Rücknahme eines Votums an einer verknüpften Aufgabe gibt Ball und nächsten Schritt zurück und entfernt den Votum-Eintrag
3. Eine geänderte Antwort schreibt den bisherigen und den neuen Stand in task_decision_response_history
4. Anhang-Metadaten hängen an der Entscheidung, sind für Teilnehmende lesbar und wieder entfernbar (ohne Datei-Upload)
5. Kommentar und Antwort werden gespeichert; Emoji-Reaktionen folgen der Allowlist, sind je Person eindeutig und wieder entfernbar
6. Das Anmahnen speichert den Eintrag mit Absender und Notiz und weist die zweite Mahnung innerhalb von 24 Stunden ab
7. Anstupsen ist auf die eigene offene Entscheidung beschränkt; ohne wartenden Abgeordneten wird abgewiesen
8. Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und Abschlussmeldung entstehen im Mandanten der Entscheidung
9. Teilnehmer-Insert stellt genau eine Einladungs-Versandzeile ein, die der Worker übernimmt und verbucht

### `task-lifecycle`

1. Status-Registry führt die fünf Kernstatus
2. Dokument hängt an der Aufgabe, bleibt auf eigene Aufgaben beschränkt und lässt sich wieder lösen
3. Unteraufgaben tragen parent_task_id, erscheinen nicht als eigene Hauptaufgabe und treiben den Fortschritt auf 50 bzw. 100 Prozent
4. Fristen werden nach Berliner Tagen gruppiert; Verwerfen löscht nur die Frist und Rückgängig stellt sie wieder her
5. Abschluss setzt completed_at, Wiederöffnen entfernt es
6. Wiederholungsregel legt beim Abschluss genau eine Folgeaufgabe an
7. Votum zu einer verknüpften Entscheidung holt den Ball zurück und erzeugt die Folgeaufgabe genau einmal
8. Rücknahme des Votums gibt Ball, nächsten Schritt und Frist zurück und entfernt den Votum-Eintrag; eine weitergelaufene Aufgabe bleibt stehen und wird nur vermerkt

### `task-stafette-lifecycle`

1. Zonen Mein Zug / Wartet / Wiedervorlage
2. Verlaufseinträge bei Übergaben und Erledigungen
3. Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme
4. Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln
5. Mehrfachzuweisung hält task_assignees und assigned_to synchron
6. Vertretungsübergabe verschiebt nur eigene Bälle und verweigert Selbstübergabe
7. Anstupsen: 24-Stunden-Sperre in der Datenbank und Quittung im Verlauf
8. Wiedervorlage kennt genau ein Ziel; Archivieren räumt sie mit ab, Wiederherstellen bringt die Aufgabe zurück

## Funktionsdetails

### `tasks.create` — Aufgabe erstellen
Legt eine Aufgabe mit Titel, Beschreibung, Fälligkeit, Priorität, Kategorie, Empfängern und optionaler Verknüpfung an. Der Selbsttest prüft vor dem Anlegen, dass task_statuses die fünf Kernstatus führt, und meldet Registry-Drift direkt.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
Setzt eine Aufgabe auf abgeschlossen, stempelt die Erledigung und stößt Folgeprozesse wie Wiederholung und Ball-Rückgabe an. Der Selbsttest prüft, dass completed_at dem Status in beide Richtungen folgt, dass eine Wiederholungsregel genau eine Folgeaufgabe erzeugt und dass ein Votum den Ball zurückholt.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
Weist eine oder mehrere Personen zu, hält die Zuweisungsliste synchron und erlaubt die Übergabe an die Stellvertretung. Der Selbsttest prüft Mehrfachzuweisung über task_assignees samt Altfeld sowie die Vertretungsübergabe mit Selbstübergabe-Sperre.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- src/features/selftest/scenarios/task-stafette-lifecycle.ts

**Bekannte Einschränkungen**

- Die positive Vertretungsübergabe läuft nur, wenn die gewählte Vertretung keine eigenen offenen Aufgaben hat; sonst prüft der Selbsttest ausschließlich die Selbstübergabe-Sperre, damit keine fremden Bälle verschoben werden.

**Offene Prüfpunkte**

- Die Regel, wer wem zuweisen darf, liegt teils in RLS und teils im Code; sie ist hier nicht vollständig rekonstruiert.

### `tasks.handover-stafette` — Aufgabe weitergeben (Stafette)
Übergibt den Ball an eine andere Person oder ein Büro, schreibt Timeline-Eintrag, nächsten Schritt und Benachrichtigung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/stafette.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `record_task_stafette_handover`, `batch_task_stafette_action`, `batch_task_stafette_preview`, `undo_task_batch_action`, `task_batch_plan`, `task_stafette_batch_snapshot`
- **Tabellen:** `tasks`, `task_assignees`, `task_snoozes`, `task_batch_actions`, `bulk_action_audit`
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
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskBadges.tsx`
- **Services:** `src/features/tasks/stafette.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `validate_task_ball_owner`
- **Tabellen:** `tasks`, `task_assignees`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** `src/features/tasks/stafette.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/tasks/stafette.ts
- src/features/tasks/stafette.test.ts
- src/features/selftest/scenarios/task-stafette-lifecycle.ts
- src/components/tasks/TaskBadges.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Zonenregel ist im Selbsttest als Logic-Step und über die Stafette-RPCs geprüft; die Anzeige in allen Listen ist nicht durchgängig geprüft.

### `tasks.deadline` — Frist setzen und überwachen
Setzt Fälligkeiten, hebt überfällige Aufgaben hervor und speist Fristen-Widgets und Erinnerungen. Der Selbsttest prüft die Gruppierung nach Berliner Tagen, die Auswahl der Aufräum-Fristen sowie Verwerfen und Rückgängig.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/DeadlineReviewDialog.tsx`, `src/components/dashboard/TasksSummary.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDashboardDeadlines.ts`, `src/hooks/useDeadlineActions.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tasks`, `task_snoozes`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/hooks/useDashboardDeadlines.ts
- src/components/dashboard/DeadlineReviewDialog.tsx
- src/components/dashboard/TasksSummary.tsx
- src/utils/deadlineFormatting.ts
- src/features/selftest/scenarios/task-lifecycle.ts

**Bekannte Einschränkungen**

- Der Step prüft Gruppierung und Verwerfen/Rückgängig; Widget-Darstellung und der stündliche Erinnerungsversand werden nicht ausgelöst.

**Offene Prüfpunkte**

- Keine.

### `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
Verschiebt die Wiedervorlage einer Aufgabe, protokolliert den Zeitpunkt und blendet sie bis dahin aus den aktiven Listen aus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/DeadlineSnoozeButton.tsx`, `src/components/notifications/SnoozeManagementSidebar.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useSnoozeDeadline.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_snoozes`, `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** `src/hooks/__tests__/deadlineActions.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useSnoozeDeadline.ts
- src/components/dashboard/DeadlineSnoozeButton.tsx
- src/features/selftest/scenarios/task-stafette-lifecycle.ts

**Bekannte Einschränkungen**

- Der Selbsttest prüft die task_snoozes-Zeile samt Zielregel und das Aufräumen beim Archivieren; das Verschieben der Frist im Dashboard deckt nur der Unit-Test ab.

**Offene Prüfpunkte**

- Ob Rückstellungen fachlich als Wiedervorlage oder nur als Anzeige-Unterdrückung gelten, ist im Code nicht abschließend dokumentiert.

### `tasks.subtasks` — Unteraufgaben
Zerlegt Aufgaben in Unteraufgaben und zeigt deren Fortschritt in der Hauptaufgabe. Der Selbsttest legt Unteraufgaben über parent_task_id an, prüft die Verknüpfung, ihre Ausblendung aus der Hauptliste und den Fortschritt.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskListRow.tsx`, `src/components/tasks/TaskCard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `subtasks`, `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/tasks/TaskListRow.tsx
- src/components/tasks/TaskCard.tsx
- src/features/tasks/templates.ts
- src/features/selftest/scenarios/task-lifecycle.ts

**Bekannte Einschränkungen**

- Der Step prüft die Aufgaben-basierten Unteraufgaben (parent_task_id); die ältere Tabelle subtasks wird von der Oberfläche nicht gelesen.

**Offene Prüfpunkte**

- Die Unteraufgaben-Oberfläche wurde nicht im Browser geprüft; der Nachweis stützt sich auf Komponenten und Tabelle.

### `tasks.link-decision` — Aufgabe mit Entscheidung verknüpfen
Erzeugt aus einer Aufgabe eine Entscheidung oder verknüpft sie; nach der Abstimmung gibt ein Trigger den Ball an den Ersteller zurück.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/NoteDecisionCreator.tsx`, `src/components/task-decisions`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_decision_task`, `return_task_ball_after_vote`, `user_can_access_task_decision`
- **Tabellen:** `task_decisions`, `tasks`, `task_decision_participants`
- **Abhängigkeiten:** `tasks.create`, `decisions.create`
- **Selbsttests:** `decision-lifecycle`, `task-lifecycle`
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
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
Hängt Dokumente an Aufgaben und öffnet sie aus der Aufgabenansicht. Der Selbsttest verknüpft eine Dokumentzeile mit einer eigenen Aufgabe, prüft die Ablage und löst die Verknüpfung wieder; fremde Aufgaben bleiben gesperrt.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/tasks/TaskDocumentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_documents`, `documents`
- **Abhängigkeiten:** `tasks.create`, `documents.upload-version`
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/tasks/TaskDocumentDialog.tsx
- src/features/selftest/scenarios/task-lifecycle.ts

**Bekannte Einschränkungen**

- Der Selbsttest prüft die Datenbank-Verknüpfung, nicht den Upload in den Storage-Bucket.

**Offene Prüfpunkte**

- Keine.

### `tasks.recurring` — Wiederkehrende Aufgabe
Erzeugt beim Abschluss automatisch die nächste Aufgabe anhand einer Wiederholungsregel; die Datumsberechnung liegt in reinen Funktionen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/tasks/templates.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `spawn_recurring_task`, `next_recurrence_date`, `validate_task_recurrence`
- **Tabellen:** `tasks`
- **Abhängigkeiten:** `tasks.create`
- **Selbsttests:** `task-lifecycle`
- **Unit-Tests:** `src/features/tasks/templates.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`

**Nachweise im Quellcode**

- src/features/tasks/templates.ts
- src/features/tasks/templates.test.ts
- src/features/selftest/scenarios/task-lifecycle.ts

**Bekannte Einschränkungen**

- Der Selbsttest löst den Trigger über einen Statuswechsel aus und vergleicht die Folgeffrist mit der reinen Regel; die Anzeige im Browser ist nicht geprüft.

**Offene Prüfpunkte**

- Keine.

### `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
Speichert Mandats-/Bürovorlagen und wendet sie beim Anlegen an, inklusive Frist- und Zuweisungsfeldern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/tasks/archive`
- **Frontend-Komponenten:** `src/features/tasks/components/TaskArchiveView.tsx`, `src/features/tasks/components/TaskArchiveModal.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `archive_completed_task`, `restore_archived_task`, `undo_task_batch_action`
- **Tabellen:** `archived_tasks`, `tasks`, `task_archive_settings`, `bulk_action_audit`
- **Abhängigkeiten:** `tasks.create`, `tasks.complete`
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** `src/hooks/__tests__/deadlineActions.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/tasks/components/TaskArchiveView.tsx
- src/features/tasks/components/TaskArchiveModal.tsx
- src/features/selftest/scenarios/task-stafette-lifecycle.ts

**Bekannte Einschränkungen**

- Der Selbsttest archiviert eine Aufgabe samt Wiedervorlage, prüft die Fremdarchivierungssperre und stellt sie zurück; die Archivansicht selbst ist nicht im Browser geprüft.

**Offene Prüfpunkte**

- Keine.

### `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
Filtert Aufgaben nach Status, Kategorie, Zuständigkeit, Frist und Text und sortiert die Ergebnisliste.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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

- Kein Selbsttest: Filter- und Sortierlogik liegen in der Ansicht; eine eigene getestete Regeldatei fehlt.

**Offene Prüfpunkte**

- Die Filterlogik liegt in der Ansicht; eine eigene getestete Regeldatei existiert nicht.

### `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
Erlaubt Anmahnen über eine RPC mit 24-Stunden-Grenze und versendet fällige Erinnerungen stündlich per Cron.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `nudge_task`, `ack_task_nudge`, `dispatch_due_task_reminders`, `escalate_task`, `task_approval_sla`
- **Tabellen:** `tasks`, `notifications`, `dashboard_decision_nudges`
- **Abhängigkeiten:** `tasks.create`, `tasks.ball-owner`
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/workflow-consistency.md`

**Nachweise im Quellcode**

- supabase/functions/_shared/security.ts
- src/hooks/useNotifications.tsx
- src/features/selftest/scenarios/task-stafette-lifecycle.ts

**Bekannte Einschränkungen**

- Der Selbsttest prüft die 24-Stunden-Sperre, die Quittung mit Verlaufseintrag und die Zugriffssperre der RPCs; der stündliche Cron-Versand, escalate_task und task_approval_sla werden nicht ausgelöst.

**Offene Prüfpunkte**

- Der Cron-Versand ist nicht in dieser Umgebung ausgeführt worden.

### `tasks.annual` — Jahresaufgaben und Jahresabschluss
Führt wiederkehrende Jahresaufgaben mit Abschlusshistorie, Sperre je Jahr und Überführung in die Stafette.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
