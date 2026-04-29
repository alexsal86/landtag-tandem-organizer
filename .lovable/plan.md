## Ziel

`src/components/` enthält aktuell **118 lose Top-Level-Dateien** neben **49 Unterordnern**. Das ist Wildwuchs: Feature-Komponenten, View-Roots, Dialoge, Admin-Settings und Debug-Tools liegen alle gleichberechtigt nebeneinander. Ich räume das in Wellen auf — **Hard Move + alle Imports umbiegen**, analog zur erfolgreichen MeetingsView/EmployeesView-Migration.

## Vorgehen (4 Wellen)

Damit das Risiko klein bleibt, gehe ich Domäne für Domäne. Pro Welle: verschieben, Re-Exports anlegen wo nötig, alle Importer per `rg` umbiegen, Build prüfen.

### Welle 1 — Feature-Slices verdichten (~35 Dateien)

In bereits existierende `src/features/<domain>/` einsortieren:

| Ziel-Slice | Dateien |
|---|---|
| `features/contacts/` | ContactsView, ContactDetailPanel, ContactDetailSheet, ContactEditForm, ContactImport, ContactSelector, ContactSkeleton, DistributionListForm, DuplicateWarning, StakeholderToDistributionDialog, StakeholderView |
| `features/meetings/` | MeetingArchiveView, MeetingProtocolView |
| `features/employees/` | EmployeeInfoTab, EmployeeMeetingHistory, EmployeeMeetingPDFExport, EmployeeMeetingProtocol, EmployeeMeetingRequestDialog, EmployeeMeetingRequestManager, EmployeeMeetingScheduler, EmployeeYearlyStatsView |
| `features/appointments/` | AppointmentPreparationSidebar, AppointmentPreparationTemplateAdmin, CreateAppointmentDialog, GlobalAppointmentRequestDialog, DefaultGuestsAdmin, GuestManager |
| `features/timetracking/` | AdminTimeEntryEditor, AnnualTasksView, VacationHistoryDialog |

### Welle 2 — Neue Feature-Slices anlegen (~30 Dateien)

| Neuer Slice | Dateien |
|---|---|
| `features/letters/` | LettersView, LetterEditor, LetterDOCXExport, LetterPDFExport, LetterTemplateManager, LetterTemplateSelector |
| `features/tasks/` | TasksView, TaskArchiveModal, TaskArchiveView, TaskDetailSidebar, TodoCreateDialog |
| `features/documents/` | DocumentsView, DocumentCategoryAdminSettings |
| `features/calendar/` | CalendarView, CalendarSyncDebug, ExternalCalendarSettings |
| `features/dashboard/` | Dashboard, DashboardWidget, CustomizableDashboard, MyWorkView, BlackBoard |
| `features/election-districts/` | ElectionDistrictsView, DistrictDetailDialog, KarlsruheMap, LeafletBasicKarlsruheMap, LeafletKarlsruheMap, LeafletMapFallback, SimpleLeafletMap, PartyAssociationsAdmin, PartyAssociationsMapView |
| `features/casefiles/` | CaseFilesView |
| `features/drucksachen/` | DrucksachenView |
| `features/expenses/` | ExpenseManagement |
| `features/event-planning/` | EventPlanningView |

### Welle 3 — Cross-cutting in thematische Unterordner (~30 Dateien)

In bestehende oder neue Unterordner unter `src/components/`:

| Unterordner | Dateien |
|---|---|
| `components/navigation/` | AppNavigation, Navigation, NavigationBadge, MobileHeader, AppHeadManager |
| `components/notifications/` | NotificationBell, NotificationCenter, NotificationDot, NotificationSettings, NewItemIndicator, SnoozeManagementSidebar |
| `components/lexical/` | EnhancedLexicalEditor, EnhancedLexicalToolbar, LexicalToolbar, FixedTextToolbar, FloatingTextFormatToolbar, FloatingTextToolbar, EmojiPicker, LabeledHorizontalRuleNode, DaySlipLineNode |
| `components/dayslip/` (existiert) | GlobalDaySlipPanel |
| `components/search/` | GlobalSearchCommand, GlobalQuickNoteDialog, NavDossierCapture |
| `components/messages/` (existiert) | MessageComposer, MessageSystem, CombinedMessagesWidget |
| `components/status/` | AutoStatusDetection, CompactStatusSelector, QuickStatusButtons, StatusAdminSettings, UserStatusSelector, OnlineUsersWidget |
| `components/admin/` (existiert) | TenantCollaboration, NewUserForm, CreateDemoUsers, TwoFactorSettings, GeneralSettings, SettingsView, MatrixSettings, MatrixMorningSettings, TagAdminSettings, ReviewAssignmentDialog, UserAssignmentDialog, UserSelector, DataView |
| `components/shared/` (existiert) | InfiniteScrollTrigger, ErrorBoundary, UnicornAnimation, SpeechCommandsDialog, SpeechSessionStats |

### Welle 4 — Debug-Helfer in `src/dev/` (~5 Dateien)

`PushNotificationTest`, `DirectPushTest`, `VapidKeyTest`, `CalendarSyncDebug` (falls nicht in calendar) → `src/dev/` (außerhalb von `components/`), damit sie klar als Tooling erkennbar sind.

## Migrationsregeln

1. **Hard Move** mit `git mv`-Semantik (über das Tooling), keine Re-Export-Stubs in alter Position — sauberer Schnitt.
2. **Imports umbiegen** per `rg -l "from ['\"].*components/<File>" | xargs sed`-Schritt, **vor** jedem Build-Check.
3. **Pro Welle ein Commit-Block** — wenn etwas bricht, ist die Ursache klar.
4. **Index-Dateien** in jedem neuen Slice (`features/<x>/index.ts`) für stabile Public API.
5. **Memory-konform**: Routing-Imports in `src/pages/Index.tsx` und `src/lib/routePrefetch.ts` mit anpassen.
6. **Keine TS-Strict-Regression** — `tsconfig.flow-auth-tenant-strict.json` muss nach jeder Welle bei 0 Fehlern bleiben.

## Nicht angefasst

- Bereits gut sortierte Unterordner (`ui/`, `plugins/`, `nodes/`, `widgets/`, `my-work/`, `task-decisions/` …) bleiben unverändert.
- Keine inhaltlichen Refactorings — reine Strukturarbeit. Splits großer Dateien (AppNavigation 66k, DocumentsView 51k) wären eine separate Aufgabe.

## Erwartetes Ergebnis

`src/components/` enthält danach **~5–10 lose Dateien** (echte Cross-cutting-Primitives) statt 118. Alle Domänen-Komponenten leben unter `src/features/<domain>/` mit klarer Public-API.

## Frage vor Start

Soll ich **alle 4 Wellen am Stück** durchziehen (großer Diff, viele Importer berührt), oder **Welle für Welle** mit Zwischenstand-Bericht?
