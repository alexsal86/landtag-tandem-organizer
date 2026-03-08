

# Zu grosse Dateien -- Analyse und Aufteillungsplan

## Ranking der groessten Dateien

| Datei | Zeilen | Prioritaet |
|-------|--------|-----------|
| `supabase/types.ts` | 10.885 | auto-generiert, kein Handlungsbedarf |
| **`MeetingsView.tsx`** | **5.383** | KRITISCH |
| **`TasksView.tsx`** | **2.719** | KRITISCH |
| **`DocumentsView.tsx`** | **2.564** | HOCH |
| **`LetterEditor.tsx`** | **2.261** | HOCH |
| **`GlobalDaySlipPanel.tsx`** | **1.977** | HOCH |
| **`TimeTrackingView.tsx`** | **1.836** | HOCH |
| **`EmployeesView.tsx`** | **1.763** | MITTEL |
| **`ContactsView.tsx`** | **1.397** | MITTEL |
| **`CalendarView.tsx`** | **1.330** | MITTEL |
| `LetterTemplateManager.tsx` | 1.134 | MITTEL |
| `LetterPDFExport.tsx` | 1.033 | MITTEL |
| `StakeholderView.tsx` | 993 | MITTEL |
| `AppointmentDetailsSidebar.tsx` | 962 | MITTEL |
| `ExpenseManagement.tsx` | 915 | MITTEL |
| `KnowledgeBaseView.tsx` | 897 | MITTEL |
| `SuperadminTenantManagement.tsx` | 838 | MITTEL |
| `CreateAppointmentDialog.tsx` | 808 | MITTEL |

## Empfohlene Aufteilung (Top 6 Prioritaeten)

### 1. `MeetingsView.tsx` (5.383 Zeilen) -- KRITISCH

Aktuell: Monolith mit Agenda-Editor, Archivierung, System-Items, Fokus-Modus, Voting, Notizen, Protokoll-Erstellung.

Vorgeschlagene Aufteilung:

```text
src/components/meetings/
  MeetingsView.tsx           (~300)  Shell + State-Orchestrierung
  MeetingsList.tsx           (~200)  Meeting-Liste + Erstellung
  MeetingAgendaEditor.tsx    (~600)  Agenda Items CRUD + Drag/Drop
  MeetingSystemItems.tsx     (~400)  System-Agenda (Tasks, Decisions, CaseItems)
  MeetingArchiving.tsx       (~300)  Archivierungs-Logik + Ergebnis-Speicherung
  MeetingVoting.tsx          (~200)  Abstimmungs-UI + Logik
  MeetingNotes.tsx           (~200)  Notizen-Panel
  hooks/
    useMeetingState.ts       (~400)  Zentraler Meeting-State-Hook
    useMeetingAgenda.ts      (~300)  Agenda-CRUD-Operationen
    useMeetingArchive.ts     (~200)  Archiv-Logik
```

### 2. `TasksView.tsx` (2.719 Zeilen) -- KRITISCH

Aktuell: Aufgabenliste, Subtasks, Kommentare, Filter, Snooze, Archiv, UUID-Resolution in einer Datei.

Vorgeschlagene Aufteilung:

```text
src/components/tasks/
  TasksView.tsx              (~200)  Shell + Tab-Routing
  TaskList.tsx               (~400)  Aufgaben-Tabelle + Filter
  TaskDetailPanel.tsx        (~300)  Detail-Ansicht mit Kommentaren
  TaskSubtasksList.tsx       (~300)  Zugewiesene Subtasks
  TaskSnoozeManager.tsx      (~150)  Snooze-Logik
  hooks/
    useTasksData.ts          (~400)  Daten laden, Filter, Sort
    useTaskComments.ts       (~200)  Kommentar-CRUD
    useAssignedSubtasks.ts   (~300)  Subtask-Aggregation (Planning + Call Follow-ups)
```

### 3. `DocumentsView.tsx` (2.564 Zeilen) -- HOCH

Vorgeschlagene Aufteilung:

```text
src/components/documents/
  DocumentsView.tsx          (~200)  Shell
  DocumentsList.tsx          (~400)  Liste/Grid + Filter
  DocumentUploader.tsx       (~300)  Upload + Kategorisierung
  DocumentDetailPanel.tsx    (~300)  Preview + Metadaten
  DocumentTemplates.tsx      (~300)  Template-Verwaltung
  hooks/
    useDocumentsData.ts      (~400)  CRUD + Filter-Logik
```

### 4. `LetterEditor.tsx` (2.261 Zeilen) -- HOCH

Vorgeschlagene Aufteilung:

```text
src/components/letters/
  LetterEditor.tsx           (~300)  Editor-Shell
  LetterMetadataForm.tsx     (~200)  Absender/Empfaenger-Formulare
  LetterContentEditor.tsx    (~300)  Rich-Text-Bereich
  LetterPreviewPanel.tsx     (~200)  Vorschau
  LetterStatusBar.tsx        (~100)  Speicherstatus, Zusammenarbeit
  LetterToolbar.tsx          (~200)  Aktions-Toolbar
  hooks/
    useLetterEditor.ts       (~400)  State + Auto-Save + Collaboration
```

### 5. `GlobalDaySlipPanel.tsx` (1.977 Zeilen) -- HOCH

Vorgeschlagene Aufteilung:

```text
src/components/dayslip/
  GlobalDaySlipPanel.tsx     (~200)  Panel-Shell
  DaySlipEditor.tsx          (~400)  Editor-Kern
  DaySlipToolbar.tsx         (~200)  Toolbar
  DaySlipSidebar.tsx         (~200)  Sidebar mit Metadaten
  hooks/
    useDaySlipState.ts       (~300)  State-Management
    useDaySlipPersistence.ts (~200)  Speichern/Laden
```

### 6. `TimeTrackingView.tsx` (1.836 Zeilen) -- HOCH

Vorgeschlagene Aufteilung:

```text
src/components/time-tracking/
  TimeTrackingView.tsx       (~200)  Shell + Tab-Routing
  TimeEntryList.tsx          (~300)  Eintrags-Tabelle
  TimeEntryForm.tsx          (~200)  Erfassungs-Formular
  TimeTrackingSummary.tsx    (~200)  Zusammenfassungen/Charts
  TimeTrackingExport.tsx     (~150)  PDF/Excel-Export
  hooks/
    useTimeTrackingData.ts   (~300)  Daten + Filter
```

## Vorgehen

Jede Aufteilung folgt dem gleichen Muster:
1. State und Logik in eigene Hooks extrahieren
2. UI in thematische Sub-Komponenten aufteilen
3. Urspruengliche Datei wird zur Shell/Orchestrierung (~200-300 Zeilen)
4. Barrel-Exports (`index.ts`) fuer saubere Import-Pfade

Ich empfehle, mit **MeetingsView** (5.383 Zeilen) zu beginnen, da sie die mit Abstand groesste Datei ist. Alternativ koennen wir mit 2-3 der mittleren Dateien anfangen, um das Muster zu etablieren.

