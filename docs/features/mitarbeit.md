# Mitarbeit, Personal & Zeit

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/mitarbeit.json`). Nicht von Hand bearbeiten._

**Zweck:** Mitarbeitergespräche und Protokolle führen, Onboarding/Offboarding, Zuständigkeiten, Teamrituale sowie Zeit- und Urlaubskonten verwalten.

## Kennzahlen

- Funktionen: **20** in **5** Unterbereichen
- implementiert: **20**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **10**
- ohne Dokumentationsverweis: **14**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `employees.export-stats` Gesprächs-PDF und Jahresstatistik | Mitarbeitergespräche | fachlich | implementiert | UI | kein Test |
| `employees.requests` Gesprächsanfragen der Mitarbeitenden | Mitarbeitergespräche | fachlich | implementiert | rollenabhängig | kein Test |
| `employees.protocol` Gesprächsprotokoll freigeben und sperren | Mitarbeitergespräche | fachlich | implementiert | rollenabhängig | kein Test |
| `employees.preparation` Gesprächsvorbereitung und Erinnerungen | Mitarbeitergespräche | automatisiert | implementiert | systemseitig | kein Test |
| `employees.action-tasks` Maßnahmen als Aufgaben | Mitarbeitergespräche | fachlich | implementiert | systemseitig | kein Test |
| `employees.meetings` Mitarbeitergespräch planen und führen | Mitarbeitergespräche | fachlich | implementiert | rollenabhängig | kein Test |
| `employees.review` Vorgesprächs-Review | Mitarbeitergespräche | fachlich | implementiert | UI | kein Test |
| `employees.wellbeing` Wohlbefinden und Trends | Mitarbeitergespräche | sicherheit | implementiert | rollenabhängig | kein Test |
| `hr.templates` HR-Vorlagen und DSGVO-Erklärung | Onboarding & Offboarding | administrativ | implementiert | rollenabhängig | Unit-Test |
| `hr.offboarding` Offboarding mit Übergaben | Onboarding & Offboarding | fachlich | implementiert | systemseitig | Selbsttest |
| `hr.onboarding` Onboarding-Ablauf | Onboarding & Offboarding | fachlich | implementiert | rollenabhängig | Selbsttest |
| `teamrituals.games` Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts) | Teamrituale | fachlich | implementiert | UI | Unit-Test |
| `teamrituals.weekly` Wöchentliche Teamfrage | Teamrituale | fachlich | implementiert | rollenabhängig | Selbsttest |
| `timetracking.entries` Arbeitszeit erfassen | Zeiterfassung | fachlich | implementiert | rollenabhängig | kein Test |
| `timetracking.annual-tasks` Jahresaufgaben im Zeitbereich | Zeiterfassung | fachlich | implementiert | UI | Unit-Test |
| `timetracking.vacation` Urlaub und Resturlaub | Zeiterfassung | fachlich | implementiert | rollenabhängig | Unit-Test |
| `timetracking.admin` Zeiterfassung administrieren | Zeiterfassung | administrativ | implementiert | rollenabhängig | kein Test |
| `responsibilities.coverage` Abdeckungsprüfung | Zuständigkeiten | fachlich | implementiert | UI | Unit-Test |
| `responsibilities.matrix` Zuständigkeitsmatrix | Zuständigkeiten | fachlich | implementiert | UI | Selbsttest |
| `responsibilities.suggest` Zuständigkeitsvorschläge | Zuständigkeiten | fachlich | implementiert | UI | Unit-Test |

## Unterbereiche

- Mitarbeitergespräche
- Onboarding & Offboarding
- Zuständigkeiten
- Teamrituale
- Zeiterfassung

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`, `admin`, `praktikant`

## Datenbanktabellen

`annual_task_completions`, `annual_tasks`, `carryover_items`, `case_items`, `committees`, `employee_hr_evidence`, `employee_hr_gdpr_declarations`, `employee_hr_reminder_log`, `employee_hr_templates`, `employee_lifecycle`, `employee_meeting_action_items`, `employee_meeting_audit`, `employee_meeting_private_notes`, `employee_meeting_requests`, `employee_meetings`, `employee_responsibilities`, `employee_settings`, `employee_settings_history`, `employee_yearly_stats`, `leave_requests`, `regions`, `routine_package_runs`, `routine_package_steps`, `sick_days`, `tasks`, `team_bingo_settings`, `team_fun_facts`, `team_question_answers`, `team_question_weeks`, `team_questions`, `team_ritual_settings`, `team_two_truths_answers`, `team_two_truths_months`, `time_entries`, `time_entry_corrections`, `time_entry_history`, `topics`, `vacation_checklist_templates`, `vacation_history`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `onboarding-hr` | HR-Onboarding und Offboarding | 11 | 0 |
| `responsibilities` | Zuständigkeiten & Matrix | 1 | 0 |
| `team-rituals` | Freiwillige Team-Rituale | 0 | 0 |

## Funktionsdetails

### `employees.meetings` — Mitarbeitergespräch planen und führen
Plant Gespräche, verwaltet Anfragen und führt das Gespräch mit Protokoll, Maßnahmen und Vertraulichkeitsstufen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/employee`, `/employee-meeting/:id`
- **Frontend-Komponenten:** `src/features/employees/components/EmployeesView.tsx`, `src/features/employees/components/EmployeeMeetingScheduler.tsx`, `src/pages/EmployeeMeetingDetail.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_employee_meeting`, `require_employee_meeting_access`, `guard_employee_protocol`, `delete_employee_meeting`
- **Tabellen:** `employee_meetings`, `employee_meeting_requests`, `employee_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/employee-meeting-leadership.md`

**Nachweise im Quellcode**

- src/features/employees/components/EmployeesView.tsx
- src/features/employees/components/EmployeeMeetingScheduler.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Für Mitarbeitergespräche existiert kein registriertes Selbsttest-Szenario.

### `employees.protocol` — Gesprächsprotokoll freigeben und sperren
Führt Protokolle durch Freigabe, Widerspruch und Wiedereröffnung, schützt eingefrorene Inhalte und speichert private Notizen je Nutzer.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/employees/components/EmployeeMeetingProtocol.tsx`
- **Services:** `src/features/employees/protocolWorkflow.ts`, `src/features/employees/protocolText.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `mutate_employee_meeting_action`, `request_protocol_acknowledgement`, `acknowledge_meeting_protocol`, `reopen_meeting_protocol`, `employee_protocol_hash`
- **Tabellen:** `employee_meetings`, `employee_meeting_audit`, `employee_meeting_private_notes`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/employee-meeting-leadership.md`

**Nachweise im Quellcode**

- src/features/employees/protocolWorkflow.ts
- src/features/employees/components/EmployeeMeetingProtocol.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Protokollfreigabe ist eine sensible Regel ohne zugeordneten Test.

### `employees.action-tasks` — Maßnahmen als Aufgaben
Erzeugt nach unbestrittener Protokollabnahme genau eine Aufgabe mit Ball bei der Mitarbeiterschaft und synchronisiert den Abschluss in beide Richtungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/employees/actionTasks.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_meeting_action_task`, `sync_employee_action_task_status`, `guard_employee_action_content`
- **Tabellen:** `employee_meeting_action_items`, `tasks`
- **Abhängigkeiten:** `tasks.create`, `employees.protocol`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/employees/actionTasks.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `employees.preparation` — Gesprächsvorbereitung und Erinnerungen
Öffnet die Vorbereitung sieben Kalendertage vor dem Gespräch, erinnert per Cron und füllt leere Felder mit Vorschlägen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `mitarbeiter`, `bueroleitung`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/employees/preparation.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `dispatch_employee_preparation_reminders`, `guard_employee_preparation_window`, `remind_employee_hr`, `automation_private.remind_employee_hr`
- **Tabellen:** `employee_hr_reminder_log`, `employee_meetings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/employee-meeting-leadership.md`

**Nachweise im Quellcode**

- src/features/employees/preparation.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Cron-Versand wurde nicht ausgeführt.

### `employees.review` — Vorgesprächs-Review
Vergleicht mit dem letzten abgeschlossenen Gespräch, übernimmt offene Maßnahmen und dokumentiert Review-Gründe am aktuellen Protokoll.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/employees/components/PreviousMeetingReview.tsx`
- **Services:** `src/features/employees/previousMeeting.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_latest_employee_meetings`
- **Tabellen:** `employee_meetings`, `employee_meeting_action_items`, `tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/employees/previousMeeting.ts
- src/features/employees/components/PreviousMeetingReview.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `employees.wellbeing` — Wohlbefinden und Trends
Erfasst Wohlbefinden als geschützte JSON-Daten und zeigt Trends ausschließlich der Person und der direkten Führungskraft.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `mitarbeiter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/employees/components/WellbeingTrend.tsx`
- **Services:** `src/features/employees/wellbeing.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `guard_employee_settings_entitlements`, `get_employee_meeting_trend`
- **Tabellen:** `employee_settings`, `employee_settings_history`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/employees/wellbeing.ts
- src/features/employees/components/WellbeingTrend.tsx

**Bekannte Einschränkungen**

- Schwellenwerte liegen im reinen Modul; teamweite Auswertungen sind ausdrücklich ausgeschlossen.

**Offene Prüfpunkte**

- Kein Test für die Datenbankpolitik der Wohlbefindensdaten vorhanden.

### `employees.requests` — Gesprächsanfragen der Mitarbeitenden
Erlaubt Mitarbeitenden, Gespräche anzufragen, und gleicht Anfragen mit geplanten Gesprächen ab.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `mitarbeiter`, `bueroleitung`, `abgeordneter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/employees/components/EmployeeMeetingRequestManager.tsx`, `src/features/employees/components/EmployeeMeetingRequestDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `reconcile_employee_meeting_requests`
- **Tabellen:** `employee_meeting_requests`, `employee_meetings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/employees/components/EmployeeMeetingRequestManager.tsx
- src/features/employees/components/EmployeeMeetingRequestDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `employees.export-stats` — Gesprächs-PDF und Jahresstatistik
Exportiert Protokolle als PDF und erzeugt Jahresstatistiken je Mitarbeiter.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/employees/components/EmployeeMeetingPDFExport.tsx`, `src/features/employees/components/EmployeeYearlyStatsView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `generate_current_year_stats`, `generate_yearly_stats_for_year`, `archive_employee_year_stats`
- **Tabellen:** `employee_yearly_stats`, `employee_meetings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/employees/components/EmployeeMeetingPDFExport.tsx
- src/features/employees/components/EmployeeYearlyStatsView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `hr.onboarding` — Onboarding-Ablauf
Führt neue Mitarbeitende durch einen Routineablauf mit Schritten, Nachweisen, Fristen und DSGVO-Erklärung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/onboarding-hr/HrWorkspace.tsx`, `src/features/onboarding-hr/EmploymentFields.tsx`, `src/features/onboarding-hr/EmployeeEmploymentEditor.tsx`
- **Services:** —
- **Hooks:** `src/features/onboarding-hr/useHrData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `start_employee_hr`, `complete_employee_hr_step`, `save_employee_lifecycle`, `confirm_employee_hr_gdpr`, `hr_task_visible`, `selftest_employee_hr`
- **Tabellen:** `routine_package_runs`, `routine_package_steps`, `employee_lifecycle`, `employee_hr_evidence`, `employee_hr_gdpr_declarations`
- **Abhängigkeiten:** —
- **Selbsttests:** `onboarding-hr`
- **Unit-Tests:** `src/features/onboarding-hr/progress.test.ts`, `src/features/onboarding-hr/useHrData.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/features/onboarding-hr/HrWorkspace.tsx
- src/features/onboarding-hr/useHrData.ts
- src/features/selftest/scenarios/onboarding-hr.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `hr.templates` — HR-Vorlagen und DSGVO-Erklärung
Verwaltet Onboarding-/Offboarding-Vorlagen, Standardfelder und die datenschutzrechtliche Erklärung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/onboarding-hr/HrTemplateEditor.tsx`, `src/features/onboarding-hr/GdprDeclarationDialog.tsx`
- **Services:** `src/features/onboarding-hr/templates.ts`, `src/features/onboarding-hr/progress.ts`, `src/features/onboarding-hr/gdpr.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_employee_hr_template`, `seed_employee_hr_templates`, `save_employee_hr_gdpr_declaration`
- **Tabellen:** `employee_hr_templates`, `employee_hr_gdpr_declarations`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/onboarding-hr/GdprDeclarationEditor.test.tsx`, `src/features/onboarding-hr/GdprDeclarationDialog.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/onboarding-hr/HrTemplateEditor.tsx
- src/features/onboarding-hr/gdpr.ts
- src/features/onboarding-hr/GdprDeclarationEditor.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `hr.offboarding` — Offboarding mit Übergaben
Führt Offboarding-Schritte aus, bewahrt Ball-Owner bei Übergaben und schließt persönliche HR-Ziele aus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/onboarding-hr/progress.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_employee_lifecycle`, `guard_employee_hr_target`, `delete_employee_lifecycle`, `delete_employee_hr`
- **Tabellen:** `employee_lifecycle`, `routine_package_runs`, `tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** `onboarding-hr`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/onboarding-hr/useHrData.ts
- src/features/selftest/scenarios/onboarding-hr.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `responsibilities.matrix` — Zuständigkeitsmatrix
Ordnet Themen und Bereiche mehreren Hauptzuständigkeiten zu und schreibt die Matrix über geprüfte RPCs.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/responsibilities/ResponsibilityMatrix.tsx`
- **Services:** —
- **Hooks:** `src/features/responsibilities/useResponsibilities.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_responsibility_catalog`, `merge_responsibility_catalog`, `set_employee_responsibility`
- **Tabellen:** `employee_responsibilities`, `topics`, `committees`, `regions`
- **Abhängigkeiten:** —
- **Selbsttests:** `responsibilities`
- **Unit-Tests:** `src/features/responsibilities/suggest.test.ts`, `src/features/responsibilities/matrixCoverage.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/responsibilities/ResponsibilityMatrix.tsx
- src/features/selftest/scenarios/responsibilities.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `responsibilities.suggest` — Zuständigkeitsvorschläge
Schlägt anhand von Thema, Region und Kontakt die zuständige Person vor und kennzeichnet Abdeckungslücken.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/responsibilities/ResponsibleSuggestion.tsx`, `src/features/responsibilities/AssignmentPicker.tsx`
- **Services:** `src/features/responsibilities/suggest.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `assign_from_responsibility_matrix`
- **Tabellen:** `employee_responsibilities`, `topics`, `case_items`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/responsibilities/suggest.test.ts`, `src/features/responsibilities/ResponsibleSuggestion.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/responsibilities/suggest.ts
- src/features/responsibilities/ResponsibleSuggestion.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `responsibilities.coverage` — Abdeckungsprüfung
Unterscheidet fehlenden Hauptansprechpartner von gänzlich unbesetzten Bereichen und zeigt Lücken.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/features/responsibilities/useResponsibilities.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `employee_responsibilities`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/responsibilities/matrixCoverage.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/responsibilities/matrixCoverage.test.ts
- src/features/responsibilities/useResponsibilities.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `teamrituals.weekly` — Wöchentliche Teamfrage
Stellt wöchentliche Fragen, sammelt Antworten und zeigt Teilnahme sowie Historie.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/team-rituals/TeamRitualWorkspace.tsx`, `src/features/team-rituals/WeeklyQuestionWidget.tsx`, `src/features/team-rituals/WeeklyAnswers.tsx`
- **Services:** `src/features/team-rituals/logic.ts`, `src/features/team-rituals/history.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_team_question`, `upsert_weekly_answer`, `delete_weekly_answer`, `team_weekly_question_participation`, `configure_team_rituals`, `save_team_ritual_profile`, `team_ritual_employment`, `team_ritual_enabled`, `team_ritual_member`, `team_ritual_visible`
- **Tabellen:** `team_questions`, `team_question_weeks`, `team_question_answers`, `team_ritual_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** `team-rituals`
- **Unit-Tests:** `src/features/team-rituals/logic.test.ts`, `src/features/team-rituals/history.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/team-rituals.md`

**Nachweise im Quellcode**

- src/features/team-rituals/TeamRitualWorkspace.tsx
- src/features/selftest/scenarios/team-rituals.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `teamrituals.games` — Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts)
Betreibt Bingo, Zwei-Wahrheiten-Runden und Fun-Facts mit Monatsarchiv und Teilnehmerverwaltung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/team-rituals/BingoWidget.tsx`, `src/features/team-rituals/TwoTruthsWidget.tsx`, `src/features/team-rituals/FunFactsEditor.tsx`
- **Services:** `src/features/team-rituals/bingo.ts`, `src/features/team-rituals/twoTruths.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_team_bingo_config`, `answer_two_truths_quiz`, `save_team_fun_facts`, `own_team_fun_facts`, `delete_team_fun_facts`, `clear_team_quiz_consent`, `team_bingo_config`, `team_two_truths_archive`, `team_two_truths_snapshot`, `team_ritual_participant`, `team_ritual_snapshot`
- **Tabellen:** `team_bingo_settings`, `team_two_truths_answers`, `team_two_truths_months`, `team_fun_facts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/team-rituals/bingo.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/team-rituals.md`

**Nachweise im Quellcode**

- src/features/team-rituals/BingoWidget.tsx
- src/features/team-rituals/bingo.ts
- src/features/team-rituals/twoTruths.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `timetracking.entries` — Arbeitszeit erfassen
Erfasst Arbeitszeiten, Pausen und Korrekturen mit Verlauf und Prüfung der Arbeitszeitregeln.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/timetracking/components/TimeTrackingView.tsx`
- **Services:** `src/features/timetracking/arbzg.ts`, `src/features/timetracking/weeklyTarget.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `ensure_net_minutes`, `get_daily_hours`, `get_latest_time_entry_dates`, `auto_calculate_hours_per_month`
- **Tabellen:** `time_entries`, `time_entry_corrections`, `time_entry_history`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/timetracking/components/TimeTrackingView.tsx
- src/features/timetracking/arbzg.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Arbeitszeitregeln sind als reine Funktionen vorhanden, aber ohne dedizierten Test für arbzg.ts.

### `timetracking.vacation` — Urlaub und Resturlaub
Beantragt Urlaub, berechnet Anspruch und Resttage, überträgt Resturlaub und archiviert Krankheitstage.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/timetracking/components/VacationHistoryDialog.tsx`, `src/components/administration/VacationChecklistAdmin.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useYearlyBalance.ts`, `src/hooks/useVacationReminders.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `execute_reset_vacation_days`, `execute_expire_carry_over`, `execute_archive_sick_days`, `notify_on_leave_request`, `handle_leave_request_notifications`, `expire_carry_over_vacation`
- **Tabellen:** `leave_requests`, `vacation_history`, `carryover_items`, `sick_days`, `vacation_checklist_templates`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/timetracking/annualTaskRules.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/timetracking/components/VacationHistoryDialog.tsx
- src/hooks/useYearlyBalance.ts
- src/hooks/useVacationReminders.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `timetracking.admin` — Zeiterfassung administrieren
Korrigiert Zeiten, zeigt Teamauswertungen und schützt sensible Datensätze durch Maskierung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/timetracking/components/AdminTimeEntryEditor.tsx`, `src/components/admin/AdminTimeTrackingView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `mask_secured_record`, `read_secured_letters`, `get_employee_admin_overview`
- **Tabellen:** `time_entries`, `employee_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/timetracking/components/AdminTimeEntryEditor.tsx
- src/components/admin/AdminTimeTrackingView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `timetracking.annual-tasks` — Jahresaufgaben im Zeitbereich
Zeigt und erledigt jährliche Pflichtaufgaben mit Fristen und Abschlusshistorie.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/timetracking/components/AnnualTasksView.tsx`
- **Services:** `src/features/timetracking/annualTaskRules.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `execute_annual_automation_routine`, `spawn_annual_task_to_stafette`
- **Tabellen:** `annual_tasks`, `annual_task_completions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/timetracking/annualTaskRules.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/timetracking/components/AnnualTasksView.tsx
- src/features/timetracking/annualTaskRules.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
