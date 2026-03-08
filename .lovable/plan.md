

# Aktualisierte Prioritaetenliste nach Refactoring

## Status der bisherigen Arbeit

Die 6 groessten Dateien wurden erfolgreich aufgeteilt:

| Datei | Vorher | Nachher | Status |
|-------|--------|---------|--------|
| MeetingsView.tsx | 5.383 | 4.011 | Teilweise (noch gross!) |
| TasksView.tsx | 2.719 | 406 | Erledigt |
| DocumentsView.tsx | 2.564 | 478 | Erledigt |
| LetterEditor.tsx | 2.261 | 732 | Erledigt |
| GlobalDaySlipPanel.tsx | 1.977 | 434 | Erledigt |
| TimeTrackingView.tsx | 1.836 | 391 | Erledigt |

## Aktuelles Ranking (alle Dateien > 700 Zeilen)

| # | Datei | Zeilen | Prioritaet |
|---|-------|--------|-----------|
| 1 | **MeetingsView.tsx** | **4.011** | KRITISCH -- Refactoring war unvollstaendig |
| 2 | **EmployeesView.tsx** | **1.763** | HOCH |
| 3 | **ContactsView.tsx** | **1.397** | HOCH |
| 4 | **CalendarView.tsx** | **1.330** | HOCH |
| 5 | **TaskDetailSidebar.tsx** | **1.235** | HOCH |
| 6 | **LetterTemplateManager.tsx** | **1.134** | MITTEL |
| 7 | **ContactImport.tsx** | **1.060** | MITTEL |
| 8 | **LetterPDFExport.tsx** | **1.033** | MITTEL |
| 9 | **StakeholderView.tsx** | **993** | MITTEL |
| 10 | **ExpenseManagement.tsx** | **915** | MITTEL |
| 11 | **KnowledgeBaseView.tsx** | **897** | MITTEL |
| 12 | **CreateAppointmentDialog.tsx** | **808** | MITTEL |
| 13 | **LetterEditor.tsx** | **732** | OK (koennte weiter) |
| 14 | **ContactDetailPanel.tsx** | **692** | OK |
| 15 | **LettersView.tsx** | **677** | OK |

Dazu kommen durch das Refactoring neu entstandene groessere Dateien:
- ActiveMeetingPanel.tsx: 551 (aus MeetingsView extrahiert, OK)
- tasks/hooks/useTasksData.ts: 507 (OK)

## Empfohlene naechste Schritte

### Runde 1 -- KRITISCH

**MeetingsView.tsx (4.011 Zeilen)** muss nochmal angefasst werden. Beim ersten Refactoring wurden nur ~1.400 Zeilen extrahiert. Hier fehlt noch die Aufteilung der Agenda-Editor-Logik, System-Item-Rendering und Archivierungs-Code.

### Runde 2 -- HOCH (je ~1.200-1.800 Zeilen)

1. **EmployeesView.tsx** (1.763) -- Mitarbeiterverwaltung mit vermutlich Tabelle, Formularen, Rollen
2. **ContactsView.tsx** (1.397) -- Kontaktliste mit Filter, Suche, Import-Verknuepfung
3. **CalendarView.tsx** (1.330) -- Kalender-Shell mit diversen Ansichten
4. **TaskDetailSidebar.tsx** (1.235) -- Task-Detail mit Kommentaren, Attachments, Subtasks

### Runde 3 -- MITTEL (je ~900-1.134 Zeilen)

5. LetterTemplateManager.tsx (1.134)
6. ContactImport.tsx (1.060)
7. LetterPDFExport.tsx (1.033)
8. StakeholderView.tsx (993)
9. ExpenseManagement.tsx (915)
10. KnowledgeBaseView.tsx (897)
11. CreateAppointmentDialog.tsx (808)

### Empfehlung

Mit **MeetingsView.tsx** weitermachen (ist immer noch bei 4.011 Zeilen und damit doppelt so gross wie die naechste Datei), dann EmployeesView und ContactsView.

