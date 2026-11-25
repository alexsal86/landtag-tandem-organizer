# Automatisierung & Workflows

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/automation.json`). Nicht von Hand bearbeiten._

**Zweck:** Regeln, Jahresroutinen, Routinepakete, Workflow-Definitionen und zeitgesteuerte Läufe verwalten und ausführen.

## Kennzahlen

- Funktionen: **15** in **8** Unterbereichen
- implementiert: **15**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **9**
- ohne Dokumentationsverweis: **8**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `automation.runs` Regelläufe und Fehlerdashboard | Ausführung | automatisiert | implementiert | UI | kein Test |
| `automation.office-packages` Saisonale Büropakete | Büropakete | automatisiert | implementiert | rollenabhängig | Unit-Test |
| `automation.annual-routines` Jahresroutinen verwalten | Jahresroutinen | administrativ | implementiert | rollenabhängig | Unit-Test |
| `automation.rss` RSS-Quellen und Monitoring | Quellen | integration | implementiert | rollenabhängig | Selbsttest |
| `automation.templates` Automatisierungs-Vorlagen | Regeln | administrativ | implementiert | UI | kein Test |
| `automation.rules` Automatisierungsregel verwalten | Regeln | administrativ | implementiert | rollenabhängig | Selbsttest |
| `automation.conditions` Regelbedingungen und Feldtypen | Regeln | automatisiert | implementiert | systemseitig | kein Test |
| `automation.rule-validation` Regelvalidierung im Editor | Regeln | administrativ | implementiert | UI | kein Test |
| `automation.rule-versions` Regelversionen und Import/Export | Regeln | administrativ | implementiert | UI | kein Test |
| `automation.task-packages` Aufgabenpakete | Routineabläufe | automatisiert | implementiert | rollenabhängig | kein Test |
| `automation.routine-packages` Dauerhafte Routineabläufe | Routineabläufe | automatisiert | implementiert | systemseitig | kein Test |
| `automation.workflows` Workflow-Definitionen und -Läufe | Workflows | administrativ | implementiert | rollenabhängig | Selbsttest |
| `automation.webhooks` Automatisierungs-Webhooks | Zeitsteuerung | integration | implementiert | systemseitig | kein Test |
| `automation.calendar-schedule` Kalenderbezogene Zeitberechnung | Zeitsteuerung | technisch | implementiert | systemseitig | Unit-Test |
| `automation.scheduler` Zeitgesteuerte Automatisierung | Zeitsteuerung | automatisiert | implementiert | systemseitig | kein Test |

## Unterbereiche

- Regeln
- Ausführung
- Jahresroutinen
- Büropakete
- Routineabläufe
- Zeitsteuerung
- Workflows
- Quellen

## Rollen

`admin`, `bueroleitung`, `system`

## Datenbanktabellen

`annual_task_completions`, `annual_tasks`, `automation_rate_limits`, `automation_rule_run_steps`, `automation_rule_runs`, `automation_rule_versions`, `automation_rules`, `calendar_sync_settings`, `case_items`, `routine_package_runs`, `routine_package_steps`, `rss_cache`, `rss_settings`, `rss_sources`, `scheduled_emails`, `tasks`, `workflow_action_log`, `workflow_definitions`, `workflow_runs`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `admin-controls` | Adminregeln: Feldschutz, Aktionen, Export, Rücknahme und Feeds | 0 | 4 |
| `annual-task-stafette` | Jahresaufgabe → Büroaufgabe → Jahresabschluss | 3 | 5 |
| `workflow-rules` | Geschäftsregeln (Freigabe, Rollen, Fristen) | 0 | 3 |

## Funktionsdetails

### `automation.rules` — Automatisierungsregel verwalten
Erstellt, bearbeitet und löscht Regeln mit Auslöser, Bedingungen und Aktionen und führt sie manuell oder ereignisgesteuert aus.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AutomationRulesManager.tsx`, `src/components/administration/AutomationRulesList.tsx`, `src/components/administration/AutomationRuleWizard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `run-automation-rule`
- **Datenbankfunktionen:** `enforce_configured_action`, `validate_annual_rule_action`
- **Tabellen:** `automation_rules`, `automation_rate_limits`
- **Abhängigkeiten:** —
- **Selbsttests:** `workflow-rules`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`, `docs/automation`

**Nachweise im Quellcode**

- src/components/administration/AutomationRulesManager.tsx
- src/features/selftest/scenarios/workflow-rules.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.conditions` — Regelbedingungen und Feldtypen
Wertet Bedingungsbäume in Browser und Executor identisch aus und vergleicht Datumswerte in Berliner Kalendertagen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/automation/conditions.ts`, `supabase/functions/_shared/automationConditions.ts`
- **Hooks:** —
- **Edge Functions:** `run-automation-rule`
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rules`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`

**Nachweise im Quellcode**

- src/features/automation/conditions.ts
- supabase/functions/_shared/automationConditions.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.rule-validation` — Regelvalidierung im Editor
Prüft Regeldefinitionen feldgenau, zeigt Inline-Fehler und verlinkt sie mit der Zusammenfassung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/automationRule/RuleValidationContext.tsx`, `src/components/administration/automationRule/RuleEditorSummary.tsx`
- **Services:** `src/components/administration/automationRule/ruleValidation.ts`, `src/components/administration/automationRule/editorModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rules`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/automationRule/ruleValidation.ts
- src/components/administration/automationRule/RuleValidationContext.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.rule-versions` — Regelversionen und Import/Export
Versioniert Regeln automatisch, zeigt Fassungen und erlaubt Import und Export.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AutomationRuleVersions.tsx`, `src/components/administration/AutomationRuleImportExport.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `auto_version_automation_rule`
- **Tabellen:** `automation_rule_versions`, `automation_rules`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/AutomationRuleVersions.tsx
- src/components/administration/AutomationRuleImportExport.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.runs` — Regelläufe und Fehlerdashboard
Protokolliert Läufe und Schritte, zeigt Fehler und erlaubt die Nachverfolgung.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AutomationErrorDashboard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rule_runs`, `automation_rule_run_steps`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/AutomationErrorDashboard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.annual-routines` — Jahresroutinen verwalten
Synchronisiert Jahresroutinen transaktional mit Jahresaufgaben und sperrt den Jahresabschluss gegen Doppelausführung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AnnualRoutinesOverview.tsx`
- **Services:** `src/features/automation/annualRoutines.ts`, `src/features/automation/annualRoutinePresentation.ts`
- **Hooks:** —
- **Edge Functions:** `execute-annual-tasks`
- **Datenbankfunktionen:** `execute_annual_automation_routine`, `sync_annual_automation_rule`, `guard_linked_annual_routine`, `automation_private.spawn_annual_task_to_stafette`
- **Tabellen:** `automation_rules`, `annual_tasks`, `annual_task_completions`
- **Abhängigkeiten:** —
- **Selbsttests:** `annual-task-stafette`
- **Unit-Tests:** `src/features/automation/annualRoutines.test.ts`, `src/features/automation/annualRoutinePresentation.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/automation/annualRoutines.ts
- src/components/administration/AnnualRoutinesOverview.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.office-packages` — Saisonale Büropakete
Stellt editierbare Standardpakete bereit und erzeugt Haupt- und Unteraufgaben atomar nach Jahresbestätigung.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/OfficeRoutineTemplates.tsx`, `src/components/administration/RoutinePackageProgress.tsx`
- **Services:** `src/features/automation/officeRoutineTemplates.ts`, `supabase/functions/_shared/officeRoutinePlan.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `execute_annual_automation_routine`, `office_routine_steps`, `office_routine_step_kinds`, `office_routine_step_settings_v2`, `office_routine_deadline`, `office_routine_step_settings`, `validate_office_routine_package`
- **Tabellen:** `automation_rules`, `annual_tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/automation/officeRoutineTemplates.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/automation/officeRoutineTemplates.ts
- src/components/administration/OfficeRoutineTemplates.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.routine-packages` — Dauerhafte Routineabläufe
Snapshotet Schritte, führt sie unter Sperre und Savepoints aus und lässt nur den Fortschrittsdienst Ziele erzeugen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/automation/routineWorkflow.ts`, `src/features/automation/routinePackages.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_routine_packages`, `refresh_routine_package`, `automation_private.advance_routine_package`, `reassign_routine_step`, `update_waiting_routine_steps`, `guard_open_routine_package`, `automation_private.apply_routine_deputy`, `automation_private.prepare_routine_step`, `automation_private.routine_due_day`, `automation_private.routine_effective_deputy`, `automation_private.routine_graph_visit`, `automation_private.routine_vote`, `automation_private.track_routine_completion`
- **Tabellen:** `routine_package_runs`, `routine_package_steps`, `tasks`, `case_items`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/automation-no-code-umsetzung.md`

**Nachweise im Quellcode**

- src/features/automation/routineWorkflow.ts
- src/features/automation/routinePackages.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Fortschrittsdienst ist als Datenbankfunktion nachgewiesen; ein Szenario dafür existiert nicht.

### `automation.task-packages` — Aufgabenpakete
Erzeugt aus Aufgabenpaketen mehrere Aufgaben und führt manuelle und ausgelöste Ausführung über denselben Executor.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/automationRule/TaskPackageFields.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `execute_task_package`
- **Tabellen:** `automation_rules`, `tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/automationRule/TaskPackageFields.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.scheduler` — Zeitgesteuerte Automatisierung
Führt fällige Regeln, Workflows und geplante E-Mails über Cron- und Dispatcher-Funktionen aus.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `run-scheduled-automation-rules`, `workflow-dispatcher`, `run-workflow-cron`, `process-scheduled-emails`
- **Datenbankfunktionen:** `dispatch_scheduled_emails_if_due`, `dispatch_workflow_trigger`
- **Tabellen:** `automation_rules`, `automation_rule_runs`, `workflow_runs`, `scheduled_emails`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/operations`

**Nachweise im Quellcode**

- supabase/functions/run-scheduled-automation-rules/index.ts
- supabase/functions/workflow-dispatcher/index.ts
- supabase/functions/run-workflow-cron/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Cron-Zeitpläne und Service-Role-Prüfungen wurden nicht in dieser Umgebung ausgeführt.

### `automation.webhooks` — Automatisierungs-Webhooks
Nimmt externe Webhook-Aufrufe je Regel mit Secret-Prüfung und Ratenbegrenzung entgegen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `automation-webhook`
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rules`, `automation_rate_limits`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- supabase/functions/automation-webhook/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Secret-Prüfung ist dokumentiert; ein eigener Webhook-Test existiert nicht.

### `automation.workflows` — Workflow-Definitionen und -Läufe
Definiert mehrstufige Workflows, validiert sie und führt Läufe mit Aktionen und Verknüpfungen aus.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/WorkflowEngineManager.tsx`, `src/components/workflow/WorkflowLinks.tsx`
- **Services:** `src/features/automation/runtime/workflowRuntime.ts`, `src/features/automation/domain/workflowDefinition.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `validate_workflow_definition`, `touch_workflow_definitions`, `cleanup_workflow_runs`, `trg_workflow_on_task_created`, `trg_workflow_on_case_created`
- **Tabellen:** `workflow_definitions`, `workflow_runs`, `workflow_action_log`
- **Abhängigkeiten:** —
- **Selbsttests:** `workflow-rules`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/workflow-consistency.md`

**Nachweise im Quellcode**

- src/components/administration/WorkflowEngineManager.tsx
- src/features/automation/runtime/workflowRuntime.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.rss` — RSS-Quellen und Monitoring
Verwaltet RSS-Quellen, testet Feeds und überwacht eingehende Meldungen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/RSSSourceManager.tsx`, `src/components/administration/RSSMonitoringManager.tsx`, `src/components/administration/RSSSettingsManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `fetch-rss-feeds`, `test-rss-feed`
- **Datenbankfunktionen:** —
- **Tabellen:** `rss_sources`, `rss_cache`, `rss_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** `admin-controls`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/components/administration/RSSSourceManager.tsx
- supabase/functions/fetch-rss-feeds/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.templates` — Automatisierungs-Vorlagen
Stellt vorgefertigte Regelvorlagen zur Auswahl und Übernahme bereit.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AutomationTemplateGallery.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rules`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/AutomationTemplateGallery.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `automation.calendar-schedule` — Kalenderbezogene Zeitberechnung
Berechnet Berliner Vorkommensschlüssel und Vorschauen für kalenderbezogene Regeln.

- **Kategorie:** technisch
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/automation/calendarSchedule.ts`, `supabase/functions/_shared/calendarSchedule.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `automation_rules`, `calendar_sync_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/automation/calendarSchedule.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/automation/calendarSchedule.ts
- supabase/functions/_shared/calendarSchedule.ts

**Bekannte Einschränkungen**

- Reine Hilfsfunktion; fachlich den Kalender- und Automatisierungsfunktionen zugeordnet.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
