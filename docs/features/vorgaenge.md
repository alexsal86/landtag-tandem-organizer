# Vorgänge & Fallakten

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/vorgaenge.json`). Nicht von Hand bearbeiten._

**Zweck:** Bürgeranliegen erfassen, triagieren, über Schritte und Fristen führen, mit Terminen, Briefen und Entscheidungen verknüpfen und abschließen.

## Kennzahlen

- Funktionen: **16** in **6** Unterbereichen
- implementiert: **15**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **4**
- ohne Dokumentationsverweis: **11**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `cases.close-archive` Vorgang abschließen und archivieren | Abschluss | fachlich | implementiert | rollenabhängig | Selbsttest |
| `cases.escalation` Eskalationsvorschläge | Bearbeitung | automatisiert | implementiert | systemseitig | kein Test |
| `cases.interactions` Kontakte und Interaktionen am Vorgang | Bearbeitung | fachlich | implementiert | UI | kein Test |
| `cases.timeline` Vorgangs-Timeline und Änderungsprotokoll | Bearbeitung | fachlich | implementiert | UI | Unit-Test |
| `cases.steps` Vorgangsschritte und Aufgaben | Bearbeitung | fachlich | implementiert | systemseitig | Unit-Test |
| `cases.legacy-routes` Legacy-Vorgangsrouten | Erfassung | fachlich | veraltet | UI | kein Test |
| `cases.create` Vorgang erfassen | Erfassung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `casefiles.manage` Fallakte anlegen und führen | Fallakten | fachlich | implementiert | rollenabhängig | Selbsttest |
| `casefiles.links` Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen) | Fallakten | fachlich | implementiert | UI | Selbsttest |
| `casefiles.notes` Fallakten-Notizen | Fallakten | fachlich | implementiert | UI | Selbsttest |
| `casefiles.status-workflow` Fallakten-Status und Bearbeitungsstatus | Fallakten | fachlich | implementiert | UI | Selbsttest |
| `cases.triage` Vorgang triagieren (Wer ist am Zug?) | Triage | fachlich | implementiert | UI | Unit-Test |
| `cases.handover` Vorgang weitergeben | Triage | fachlich | implementiert | rollenabhängig | Selbsttest |
| `cases.link-letter` Vorgang mit Brief verknüpfen | Verknüpfung | fachlich | implementiert | UI | Unit-Test |
| `cases.link-decision` Vorgang mit Entscheidung verknüpfen | Verknüpfung | fachlich | implementiert | systemseitig | kein Test |
| `cases.link-appointment` Vorgang mit Termin verknüpfen | Verknüpfung | fachlich | implementiert | UI | Unit-Test |

## Unterbereiche

- Erfassung
- Triage
- Bearbeitung
- Verknüpfung
- Abschluss
- Fallakten

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `system`

## Datenbanktabellen

`appointments`, `audit_log_entries`, `case_file_appointments`, `case_file_contacts`, `case_file_documents`, `case_file_letters`, `case_file_notes`, `case_file_participants`, `case_file_processing_statuses`, `case_file_status_history`, `case_file_tasks`, `case_file_timeline`, `case_file_topics`, `case_file_types`, `case_files`, `case_item_categories`, `case_item_escalation_suggestions`, `case_item_handover_log`, `case_item_interactions`, `case_item_participants`, `case_item_timeline`, `case_item_topics`, `case_items`, `letters`, `task_decisions`, `tasks`, `topic_module_settings`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `case-file-lifecycle` | Fallakte mit Folgetabellen (Container) im Unterschied zum Vorgang | 14 | 8 | — |
| `case-item-lifecycle` | Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss) | 9 | 5 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `case-file-lifecycle` | `create` | Fallakte anlegen und Standardwerte prüfen | db | — |
| `case-file-lifecycle` | `scale-guard` | Ungültige Akten-Größe wird abgewiesen | db | — |
| `case-file-lifecycle` | `processing-status` | Bearbeitungsstatus setzen und Statusverlauf schreiben | db | — |
| `case-file-lifecycle` | `participants` | Beteiligte eintragen; Doppelung ist gesperrt | db | — |
| `case-file-lifecycle` | `notes-and-timeline` | Notiz und Verlaufseintrag zur Akte speichern | db | — |
| `case-file-lifecycle` | `links-contact-task` | Kontakt verknüpfen und Aufgabe über die Akten-RPC erzeugen | db | — |
| `case-file-lifecycle` | `links-appointment-letter` | Termin und Brief mit der Akte verknüpfen | db | — |
| `case-file-lifecycle` | `counts` | Akten-RPC zählt die Verknüpfungen | db | — |
| `case-file-lifecycle` | `vorgang-vs-akte` | Unterschied zum Vorgang: eigener Ball, geerbte Sichtbarkeit | db | — |
| `case-file-lifecycle` | `delete-detaches` | Akte löschen: Folgetabellen weg, Vorgang bleibt | db | — |
| `case-item-lifecycle` | `rules` | Regeln prüfen: Schritt, Wiedervorlage, Fristen (ohne Datenbank) | logic | — |
| `case-item-lifecycle` | `create` | Vorgang anlegen + Standardwerte (Büro am Zug, kein Schritt) | db | — |
| `case-item-lifecycle` | `interactions` | Interaktionen erfassen (Anruf, Mail, Treffen) | db | — |
| `case-item-lifecycle` | `draft-no-resubmission` | Am Zug nur vorbereiten → keine Wiedervorlage | db | — |
| `case-item-lifecycle` | `set-step` | Schritt festlegen mit Frist → Wiedervorlage + Verlauf | db | — |
| `case-item-lifecycle` | `office-task` | Büroschritt erzeugt genau eine verknüpfte Aufgabe | workflow | — |
| `case-item-lifecycle` | `reverse-task` | Aufgabe erledigen schließt den zugehörigen Vorgangsschritt | workflow | — |
| `case-item-lifecycle` | `ministry` | Am Zug: Ministerium (21-Tage-Frist + Verlauf) | db | — |
| `case-item-lifecycle` | `handover` | Übergabe an zweite Person über Freigabe-Funktion | workflow | — |
| `case-item-lifecycle` | `decision` | Entscheidung anfordern + abstimmen | db | — |
| `case-item-lifecycle` | `dayslip` | Auf Tageszettel → Link übersteht erneutes Laden | db | — |
| `case-item-lifecycle` | `jour-fixe` | Auf Jour fixe setzen | db | — |
| `case-item-lifecycle` | `onsite` | Ortstermin anfragen (Eingang per: Vorgang) | db | — |
| `case-item-lifecycle` | `step-done` | Schritt erledigt → Schritt leer, „Schritt festlegen“ erscheint wieder | db | — |
| `case-item-lifecycle` | `complete` | Vorgang abschließen | db | — |
| `case-item-lifecycle` | `tenant-boundary` | Vorgang lässt sich keinem fremden Büro zuordnen | workflow | — |

## Deklarierter Prüfumfang

### `case-file-lifecycle`

1. Fallakte wird mit Typ, Größe, Status und Standard-Sichtbarkeit „private“ angelegt und zurückgelesen
2. Ungültige Größe (case_scale) wird von der Datenbank abgewiesen
3. Bearbeitungsstatus und Statusverlauf werden gespeichert; derselbe Beteiligte kann nicht doppelt eingetragen werden
4. Kontakt, Aufgabe, Termin und Brief werden über die jeweilige Folgetabelle verknüpft; doppelte Verknüpfungen sind gesperrt
5. Die Aufgabe entsteht über create_case_file_task als offene Aufgabe für die anlegende Person mit source_type 'case_file' und Quellbezug; eine Wiederholung liefert dieselbe Aufgabe und keine zweite Verknüpfung
6. get_case_files_with_counts liefert die Verknüpfungen der Akte als Zählwerte
7. Ein Vorgang an einer privaten Akte ist für Büro-Kolleginnen unsichtbar, an einer öffentlichen Akte sichtbar (Sichtbarkeitsvererbung)
8. Das Löschen der Akte entfernt ihre Folgetabellen, lässt den Vorgang aber mit case_file_id = null bestehen

### `case-item-lifecycle`

1. Geschäftsregeln für Wiedervorlage und Fristen
2. Übergabe über die Anwendungs-RPC
3. Entscheidung und Abstimmung
4. Tageszettel-Link nach erneutem Laden
5. Vorgang bleibt im eigenen Büro

## Funktionsdetails

### `cases.create` — Vorgang erfassen
Legt einen Vorgang mit Kategorie, Priorität, Anliegen, Kontaktbezug, zentralen Themen und Zuständigkeit an und erzeugt den Timeline-Eintrag.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/vorgaenge/:caseItemId`
- **Frontend-Komponenten:** `src/components/my-work/CaseItemCreateDialog.tsx`, `src/features/cases/items/pages/CaseItemDetail.tsx`, `src/components/my-work/MyWorkCasesWorkspace.tsx`
- **Services:** —
- **Hooks:** `src/features/cases/items/hooks/useCaseItems.tsx`, `src/hooks/useCaseItemCategories.tsx`, `src/features/topics/useTopicModuleSettings.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_items`, `case_item_categories`, `case_item_timeline`, `case_item_participants`, `case_item_topics`, `topic_module_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** `case-item-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/case-items-intake-validation.md`, `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/components/my-work/CaseItemCreateDialog.tsx
- src/features/cases/items/pages/CaseItemDetail.tsx
- src/features/selftest/scenarios/case-item-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.triage` — Vorgang triagieren (Wer ist am Zug?)
Bestimmt Ball-Owner, nächsten Schritt und Fälligkeit aus Kategorie, Status und Zuweisung; die Regeln liegen als reine Funktionen vor.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/ball.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `validate_case_item_ball`
- **Tabellen:** `case_items`, `case_item_timeline`
- **Abhängigkeiten:** `cases.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/ball.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/case-items-intake-validation.md`

**Nachweise im Quellcode**

- src/features/cases/items/ball.ts
- src/features/cases/items/ball.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.handover` — Vorgang weitergeben
Übergibt einen Vorgang an eine andere aktive Person, protokolliert die Übergabe und erhält die Ball-Kategorie.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/timeline.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `handover_case_items`, `log_case_item_handover`, `assign_from_responsibility_matrix`
- **Tabellen:** `case_items`, `case_item_handover_log`, `case_item_timeline`
- **Abhängigkeiten:** `cases.triage`, `responsibilities.suggest`
- **Selbsttests:** `case-item-lifecycle`
- **Unit-Tests:** `src/features/cases/items/timeline.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/selftest/scenarios/case-item-lifecycle.ts
- src/features/cases/items/timeline.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.steps` — Vorgangsschritte und Aufgaben
Legt Schritte mit Frist und Zuständigkeit an und erzeugt daraus Büro-Aufgaben, deren Erledigung zurückgemeldet wird.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/workflow.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `sync_case_office_step_task`, `sync_case_step_from_task`, `journal_case_step_task`
- **Tabellen:** `case_items`, `case_file_tasks`, `tasks`, `case_item_timeline`
- **Abhängigkeiten:** `tasks.link-case`, `cases.create`, `tasks.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/workflow.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/workflow.ts
- src/features/cases/items/workflow.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.interactions` — Kontakte und Interaktionen am Vorgang
Erfasst Gespräche, E-Mails und Notizen mit Sichtbarkeitsstufe und verlangt vor dem Abschluss eine dokumentierte Reaktion.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/my-work/CaseItemInteractionQuickCapture.tsx`, `src/features/cases/files/components/CaseItemInteractionsTimeline.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `require_resolution_interaction_on_case_close`, `user_can_access_case_item_interaction`
- **Tabellen:** `case_item_interactions`, `case_items`
- **Abhängigkeiten:** `cases.create`, `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/case-items-intake-validation.md`

**Nachweise im Quellcode**

- src/components/my-work/CaseItemInteractionQuickCapture.tsx
- src/features/cases/files/components/CaseItemInteractionsTimeline.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.timeline` — Vorgangs-Timeline und Änderungsprotokoll
Zeigt Statuswechsel, Übergaben, Aufgaben und Interaktionen chronologisch und protokolliert lebenszyklusrelevante Änderungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/timeline.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `audit_case_item_lifecycle_changes`
- **Tabellen:** `case_item_timeline`, `audit_log_entries`
- **Abhängigkeiten:** `cases.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/timeline.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/timeline.ts
- src/features/cases/items/timeline.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.link-appointment` — Vorgang mit Termin verknüpfen
Verknüpft Vorgänge mit Terminen und Fallakten und zeigt anstehende Gespräche am Vorgang.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/appointmentLink.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_file_appointments`, `appointments`, `case_items`
- **Abhängigkeiten:** `cases.create`, `calendar.create-appointment`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/appointmentLink.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/appointmentLink.ts
- src/features/cases/items/appointmentLink.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.link-letter` — Vorgang mit Brief verknüpfen
Erzeugt aus einem Vorgang einen Briefentwurf mit Adress- und Bezugsdaten und verlinkt ihn zurück.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/cases/items/caseLetter.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_file_letters`, `letters`, `case_items`
- **Abhängigkeiten:** `letters.create`, `cases.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/cases/items/caseLetter.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/caseLetter.ts
- src/features/cases/items/caseLetter.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
Verknüpft Entscheidungen mit einem Vorgang und prüft die Zulässigkeit der Verknüpfung in der Datenbank.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `validate_decision_case_file`
- **Tabellen:** `task_decisions`, `case_file_tasks`, `case_items`
- **Abhängigkeiten:** `cases.create`, `decisions.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/pages/CaseItemDetail.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Verknüpfung wird nur über eine Validierungsfunktion und nicht über einen eigenen UI-Nachweis belegt.

### `cases.escalation` — Eskalationsvorschläge
Erkennt liegengebliebene Vorgänge und schlägt Eskalationen vor, ohne sie automatisch durchzuführen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `suggest-case-escalations`
- **Datenbankfunktionen:** —
- **Tabellen:** `case_item_escalation_suggestions`, `case_items`
- **Abhängigkeiten:** `cases.triage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/suggest-case-escalations/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Vorschlagsalgorithmus ist nicht durch einen Test abgedeckt.

### `cases.close-archive` — Vorgang abschließen und archivieren
Schließt Vorgänge nach dokumentierter Reaktion, erledigt offene Schritte und archiviert sie mit Verlauf.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/cases/items/components/CaseItemsArchiveSheet.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `complete_case_step_on_archive`, `require_resolution_interaction_on_case_close`
- **Tabellen:** `case_items`, `case_item_timeline`, `tasks`
- **Abhängigkeiten:** `cases.steps`, `cases.interactions`
- **Selbsttests:** `case-item-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/items/pages/CaseItemDetail.tsx
- src/features/cases/items/components/CaseItemsArchiveSheet.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `cases.legacy-routes` — Legacy-Vorgangsrouten
Leitet alte Vorgangs- und Fallaktenrouten auf die aktuellen Arbeitsbereiche um.

- **Kategorie:** fachlich
- **Implementierung:** veraltet
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/cases`, `/cases/:caseItemId`, `/vorgaenge`
- **Frontend-Komponenten:** `src/router/routes.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/router/routes.tsx

**Bekannte Einschränkungen**

- Reine Kompatibilitätsweiterleitung ohne eigenen Fachumfang.

**Offene Prüfpunkte**

- Offen: Altlinks zählen, bevor die Routen entfernt werden.

### `casefiles.manage` — Fallakte anlegen und führen
Führt Fallakten mit Typ, Status, Risiken, Chancen, nächsten Schritten, Beteiligten, Dokumenten und Themen; das Szenario prüft Anlage, Standardwerte, Sichtbarkeit, Folgetabellen und die Zählwerte der Akten-RPC.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/casefiles`
- **Frontend-Komponenten:** `src/features/casefiles/components/CaseFilesView.tsx`, `src/features/cases/files/components/CaseFileDetail.tsx`, `src/features/cases/files/components/CaseFileCreateDialog.tsx`, `src/components/topics/TopicPicker.tsx`
- **Services:** —
- **Hooks:** `src/features/cases/files/hooks/useCaseFiles.tsx`, `src/features/topics/useEntityTopics.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_case_files_with_counts`
- **Tabellen:** `case_files`, `case_file_types`, `case_file_participants`, `case_file_status_history`, `case_file_timeline`, `case_file_topics`, `topics`
- **Abhängigkeiten:** —
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/casefiles/components/CaseFilesView.tsx
- src/features/cases/files/components/CaseFileDetail.tsx
- src/features/selftest/scenarios/case-file-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Akte bleibt der Container: kein Ball und kein nächster Schritt wie beim Vorgang, dafür Typ, Sichtbarkeit und Bearbeitungsstatus.

### `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
Ändert den Bearbeitungsstatus einer Fallakte, protokolliert den Verlauf und zeigt offene Schritte; das Szenario prüft den Statuswechsel samt Verlaufseintrag.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/cases/files/components/CaseFileCurrentStatus.tsx`, `src/features/cases/files/components/CaseFileNextSteps.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useCaseFileProcessingStatuses.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_files`, `case_file_processing_statuses`, `case_file_status_history`
- **Abhängigkeiten:** `casefiles.manage`
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/files/components/CaseFileCurrentStatus.tsx
- src/hooks/useCaseFileProcessingStatuses.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
Verknüpft Dokumente, Kontakte, Themen und Notizen mit einer Fallakte und zeigt sie in der Akte; das Szenario prüft Kontakt-, Aufgaben-, Termin- und Briefverknüpfung samt doppelter Verknüpfungssperre.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/cases/files/components/CaseFileDocumentsCard.tsx`, `src/features/cases/files/components/CaseFileUnifiedTimeline.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_file_documents`, `case_file_contacts`, `case_file_topics`, `case_file_notes`
- **Abhängigkeiten:** `casefiles.manage`, `documents.upload-version`, `contacts.create`
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/files/components/CaseFileDocumentsCard.tsx
- src/features/cases/files/components/CaseFileUnifiedTimeline.tsx

**Bekannte Einschränkungen**

- Dokument- und Themenverknüpfung prüft kein Szenario: dafür sind eine echte Datei bzw. ein eigener Themenkatalog nötig.

**Offene Prüfpunkte**

- Keine.

### `casefiles.notes` — Fallakten-Notizen
Erfasst interne Notizen an einer Fallakte und zeigt sie im Verlauf; das Szenario prüft Notiz und Verlaufseintrag an der Akte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/cases/files/components/CaseFileRightSidebar.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `case_file_notes`, `case_files`
- **Abhängigkeiten:** `casefiles.manage`
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/cases/files/components/CaseFileRightSidebar.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
