# Refactor: 10 große Dateien in Sub-Module splitten

Ziel: Alle 10 Dateien > 1000 Zeilen werden in fokussierte Sub-Module aufgeteilt. Pro Datei gilt: jeder neue Teil ≤ ~600 Zeilen, klare Trennung nach **types / constants / hooks / sub-components**. Public API (Default-/Named-Export) bleibt gleich, sodass keine Imports an anderen Stellen angepasst werden müssen.

## Vorgehen pro Datei

### 1. `components/administration/AutomationRuleWizard.tsx` (1481)
Enthält bereits viele freistehende Konstanten, Typen und Validatoren — leicht extrahierbar.
- `AutomationRuleWizard.constants.ts` → `MODULE_OPTIONS`, `CONDITION_OPERATORS`, `ACTION_TYPES`, `MODULE_TO_TABLE`, `STATUS_TABLE_OPTIONS`, `TASK_PRIORITY_OPTIONS`, `TRIGGER_TYPES`, `RULE_TEMPLATES`, `DEFAULT_*`.
- `AutomationRuleWizard.types.ts` → `FieldType`, `FieldSpec`, `ConditionItem`, `ConditionGroup`, `ActionItem`, `WizardForm`.
- `AutomationRuleWizard.logic.ts` → `validateConditionGroup`, `countConditions`, `evaluateCondition`, `evaluateConditionGroup`, `collectSemanticIssues`, `sanitizeTriggerValue`, `isIsoDate`, `toComparableNumber`.
- Hauptdatei behält nur die Wizard-Komponente + `useState`/Steps.

### 2. `components/navigation/AppNavigation.tsx` (1480)
Mehrere Sidebar-Panels in einer Datei.
- `AppNavigation.types.ts` → `ActivePanel`, `NotificationFilter`, `QuickAccessAddCategory`, `UpcomingAppointmentItem`, `NavigationProps`.
- `panels/HomePanel.tsx`, `panels/NotificationsPanel.tsx`, `panels/CasefilesPanel.tsx`, `panels/AppointmentsPanel.tsx` (je ein Panel-Render-Block).
- `useAppointmentsForPanel.ts` falls Datenladen lokal vorhanden.
- Haupt-`AppNavigation.tsx` orchestriert nur noch Layout + Panel-Switch.

### 3. `components/my-work/MyWorkCasesWorkspace.tsx` (1321)
- `MyWorkCasesWorkspace.types.ts` → `TimelineEntry` und Hilfs-Typen.
- `useMyWorkCases.ts` → Datenladen/Filter (Query-Hook + Memos).
- `MyWorkCasesList.tsx`, `MyWorkCaseDetail.tsx`, `MyWorkCaseTimeline.tsx` als Sub-Komponenten der Master-Detail-Ansicht.

### 4. `components/meetings/FocusModeView.tsx` (1238)
- `FocusModeView.types.ts` → `AgendaItem`, `Meeting`, `Profile`, `NavigableItem`, `SystemSubItemResultEntry`, `FocusModeViewProps`.
- `FocusModeView.utils.ts` → `formatMeetingTime` u. ä.
- `FocusAgendaList.tsx`, `FocusItemDetail.tsx`, `FocusKeyboardShortcuts.ts` (Tastatur-Bindings als Hook).

### 5. `components/administration/SuperadminTenantManagement.tsx` (1174)
- `SuperadminTenantManagement.constants.ts` → `BUNDESLAENDER`, `ROLE_OPTIONS`.
- `SuperadminTenantManagement.types.ts` → `TenantWithStats`, `UserWithTenants`.
- `TenantList.tsx`, `TenantUsersDialog.tsx`, `CreateTenantDialog.tsx` als drei Sub-Komponenten.

### 6. `components/task-decisions/TaskDecisionDetails.tsx` (1138)
- `TaskDecisionDetails.types.ts` → `DecisionDetailsState`, `ResponseThread`, `Participant`, `TaskDecisionDetailsProps`.
- `TaskDecisionResponses.tsx` (Antworten-Liste/Threads), `TaskDecisionParticipants.tsx`, `TaskDecisionComments.tsx`.
- Konstante `DELETED_COMMENT_TEXT` + Sub-Component-Helfer in `TaskDecisionDetails.constants.ts`.

### 7. `contexts/matrix/MatrixClientProvider.tsx` (1063)
Schwierigster Kandidat: ein großer Provider mit vielen privaten Helfern.
- `matrixClient/createClient.ts` → Initialisierung & Login-Helfer.
- `matrixClient/syncHandlers.ts` → Event-Listener-Setup.
- `matrixClient/notificationBridge.ts` → Push-/Toast-Bridge.
- Provider-Datei orchestriert nur noch State + Effekte.
- `useMatrixClient`-Export bleibt unverändert.

### 8. `features/employees/components/EmployeeMeetingProtocol.tsx` (1040)
Schon teilweise modular: enthält intern `RatingScale`, `StatusProgress`, `SaveIndicator`, `ProtocolField`.
- Diese vier in eigene Dateien unter `EmployeeMeetingProtocol/` extrahieren.
- `EmployeeMeetingProtocol.utils.ts` → `extractPlainTextFromHtml`, Konstante `ACTION_ITEM_MIN_LENGTH`.

### 9. `components/letters/DIN5008LetterLayout.tsx` (1016)
- `DIN5008LetterLayout.types.ts` → `DIN5008LetterLayoutProps` und ggf. interne Block-Typen.
- `din5008/AddressBlock.tsx`, `din5008/SubjectBlock.tsx`, `din5008/BodyBlock.tsx`, `din5008/SignatureBlock.tsx`, `din5008/AttachmentsBlock.tsx`.
- Hauptdatei platziert die Blöcke nur im 210×297mm-Canvas.

### 10. `hooks/useQuickNotes.ts` (1001)
- `quickNotes/constants.ts` → `noteColors`, Default-Werte.
- `quickNotes/utils.ts` → `stripHtml`, `toEditorHtml`, `getCardBackground`, `hasInactiveMeetingLink`, `normalizeMeetingLink`.
- `quickNotes/types.ts` → `GroupedNotes` etc.
- Haupthook behält Query/Mutation-Logik.

## Allgemeine Regeln

- Public API (`export`-Namen der Hauptdateien) bleibt 1:1 erhalten — keine Konsumenten müssen geändert werden.
- TypeScript-Strict beibehalten; wo `as any` lauert, durch `@ts-expect-error` mit Begründung ersetzen.
- Nach jedem Split: `tsc`-Prüfung wird vom Harness automatisch ausgeführt; bei Fehlern direkt korrigieren.
- Keine Funktionsänderung, kein Verhaltens-Refactor — rein strukturell.

## Out of Scope

- `src/integrations/supabase/types.ts` (auto-generiert).
- Tests/Story-Files (sofern vorhanden) bleiben unverändert, sofern Imports stabil sind.
- Keine Performance- oder Style-Optimierungen in diesem Schritt.

## Risiko

Mittel. Hauptrisiken: zirkuläre Imports zwischen extrahierten Sub-Dateien (Lösung: Typen/Konstanten in dedizierte Dateien ohne React-Imports) und Matrix-Provider-Refactor (komplexester Teil; konservativ extrahieren, Effekte beibehalten).
