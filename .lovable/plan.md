

# Refactoring: EmployeesView.tsx (1.763 → ~250 Zeilen)

## Analyse

Die Datei enthaelt:
- **Typen** (Zeilen 29-86): 7 Type-Definitionen
- **EmployeeHistoryPopover** (Zeilen 88-169): Eigenstaendige Subkomponente
- **Admin-Datenlogik** (Zeilen 236-445): Grosser useEffect fuer Mitarbeiterdaten, Leaves, Meetings
- **Self-View-Datenlogik** (Zeilen 448-630): useEffect fuer Nicht-Admin-Nutzer
- **Hilfsfunktionen** (Zeilen 632-639): calculateWorkingDays
- **Leave-Operationen** (Zeilen 641-903): createLeaveCalendarEntry, handleLeaveAction, handleCancelApproval
- **Settings-Updates** (Zeilen 905-1113): updateHours, updateDaysPerWeek, updateDaysPerMonth, updateVacationDays, updateStartDate
- **Self-View UI** (Zeilen 1115-1296): Komplette Nicht-Admin-Ansicht
- **Admin-View UI** (Zeilen 1299-1763): Pending-Leaves-Tabelle, Mitarbeiterliste, Dialoge

## Plan

### 1. `src/components/employees/types.ts`
- Alle Typen: LeaveType, LeaveStatus, EmployeeSettingsRow, Profile, LeaveRow, PendingLeaveRequest, Employee, LeaveAgg
- Hilfsfunktion: calculateWorkingDays

### 2. `src/components/employees/hooks/useEmployeesData.ts`
- Admin-Check (isAdmin)
- Admin-Daten laden (Zeilen 236-445): employees, leaves, pendingLeaves, sickDays, pendingRequestsCount
- Self-Daten laden (Zeilen 448-630): selfSettings, selfLeaveAgg, selfProfile

### 3. `src/components/employees/hooks/useEmployeeOperations.ts`
- Leave-Aktionen: handleLeaveAction, handleCancelApproval, createLeaveCalendarEntry
- Settings-Updates: updateHours, updateDaysPerWeek, updateDaysPerMonth, updateVacationDays, updateStartDate

### 4. `src/components/employees/EmployeeSelfView.tsx`
- Komplette Nicht-Admin-Ansicht (Zeilen 1115-1296)

### 5. `src/components/employees/EmployeeAdminTable.tsx`
- Mitarbeiterliste-Tabelle (Zeilen 1445-1717) inkl. EmployeeHistoryPopover
- Pending-Leaves-Tabelle (Zeilen 1336-1443)

### 6. Shell: `EmployeesView.tsx` (~250 Zeilen)
- Importiert Hooks und Subkomponenten
- Orchestriert Tabs (Uebersicht / Zeiterfassung), Header, Dialoge

