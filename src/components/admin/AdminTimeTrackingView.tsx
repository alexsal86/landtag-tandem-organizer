import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addMonths, subMonths, getYear, parseISO, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useYearlyBalance } from "@/hooks/useYearlyBalance";
import { AdminTimeEntryEditor, type EntryType } from "@/features/timetracking/components/AdminTimeEntryEditor";
import type { CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";

import { useAdminAccessControl } from "./hooks/useAdminAccessControl";
import { useAdminEmployees } from "./hooks/useAdminEmployees";
import { useAdminMonthData } from "./hooks/useAdminMonthData";
import { useAdminTimeCalculations } from "./hooks/useAdminTimeCalculations";
import { useAdminEntryCreation } from "./hooks/useAdminEntryCreation";
import { useAdminEntryEditing } from "./hooks/useAdminEntryEditing";
import { useAdminTypeConversion } from "./hooks/useAdminTypeConversion";
import { useAdminCorrections } from "./hooks/useAdminCorrections";

import { AdminEmployeePicker } from "./components/AdminEmployeePicker";
import { AdminTimeMetricsCards } from "./components/AdminTimeMetricsCards";
import { AdminEntriesTab } from "./components/AdminEntriesTab";
import { AdminAbsencesTab } from "./components/AdminAbsencesTab";
import { AdminCorrectionsTab } from "./components/AdminCorrectionsTab";

import { AdminCorrectionDialog } from "./dialogs/AdminCorrectionDialog";
import { AdminCreateEntryDialog } from "./dialogs/AdminCreateEntryDialog";
import { AdminInitialBalanceDialog } from "./dialogs/AdminInitialBalanceDialog";
import { AdminBreakdownDialog } from "./dialogs/AdminBreakdownDialog";

import type { TimeEntry } from "./types";

export function AdminTimeTrackingView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMonth = searchParams.get("month");
  const currentMonth = useMemo(() => {
    if (requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
      return parseISO(`${requestedMonth}-01`);
    }
    return startOfMonth(new Date());
  }, [requestedMonth]);
  const requestedTimeTab = searchParams.get("timeTab");
  const activeTimeTab = requestedTimeTab && ["entries", "absences", "corrections"].includes(requestedTimeTab)
    ? requestedTimeTab : "entries";
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingCombinedEntry, setEditingCombinedEntry] = useState<CombinedTimeEntry | null>(null);

  // Dialog open states
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [createEntryDialogOpen, setCreateEntryDialogOpen] = useState(false);
  const [initialBalanceDialogOpen, setInitialBalanceDialogOpen] = useState(false);
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

  // Core hooks
  const { isAdmin, roleLoading } = useAdminAccessControl(user);
  const { loading, employees } = useAdminEmployees({
    currentTenant,
    isAdmin,
    roleLoading,
  });
  const requestedEmployee = searchParams.get("employee");
  const selectedUserId = employees.find(employee => employee.user_id === requestedEmployee)?.user_id
    ?? employees[0]?.user_id ?? "";

  const setSelectedUserId = (userId: string) => {
    if (!employees.some(employee => employee.user_id === userId)) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("employee", userId);
      return next;
    });
  };
  const setCurrentMonth = (month: Date) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("month", format(month, "yyyy-MM"));
      return next;
    });
  };
  const handleTimeTabChange = (tab: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("timeTab", tab);
      return next;
    });
  };

  // Make the initial selection shareable too; invalid IDs fall back to an accessible employee.
  useEffect(() => {
    if (loading || !isAdmin || !selectedUserId) return;
    const month = format(currentMonth, "yyyy-MM");
    if (requestedEmployee === selectedUserId && requestedMonth === month) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("employee", selectedUserId);
      next.set("month", month);
      return next;
    }, { replace: true });
  }, [loading, isAdmin, selectedUserId, requestedEmployee, requestedMonth, currentMonth, setSearchParams]);

  const { timeEntries, leaveRequests, corrections, holidays, monthStart, monthEnd, loadMonthData } =
    useAdminMonthData({ selectedUserId, currentMonth, isAdmin });

  const selectedEmployee = employees.find((e) => e.user_id === selectedUserId);

  const calculations = useAdminTimeCalculations({
    selectedEmployee,
    timeEntries,
    leaveRequests,
    corrections,
    holidays,
    monthStart,
    monthEnd,
  });

  const {
    yearlyBalance,
    yearlyBreakdown,
    loading: loadingYearlyBalance,
    refetch: refetchYearlyBalance,
  } = useYearlyBalance(selectedUserId || null, getYear(currentMonth), selectedEmployee ?? null);

  // Action hooks
  const { handleCreateEntry, isSaving: isCreating } = useAdminEntryCreation({
    user,
    selectedUserId,
    dailyHours: calculations.dailyHours,
    yearlyBalance,
    onSuccess: () => {
      loadMonthData();
      refetchYearlyBalance();
    },
  });

  const { handleSaveEntry } = useAdminEntryEditing({
    user,
    selectedUserId,
    onSuccess: () => {
      setEditingEntry(null);
      setEditingCombinedEntry(null);
      loadMonthData();
    },
  });

  const { handleTypeChange, isSaving: isConverting } = useAdminTypeConversion({
    user,
    selectedUserId,
    onSuccess: loadMonthData,
  });

  const { handleAddCorrection, handleAddInitialBalance } = useAdminCorrections({
    user,
    selectedUserId,
    currentMonth,
    onSuccess: () => {
      loadMonthData();
      refetchYearlyBalance();
    },
  });

  // Loading / access guards
  if (roleLoading || loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>Dieser Bereich ist nur für Administratoren verfügbar.</AlertDescription>
      </Alert>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">Keine Mitarbeiter gefunden</p>
      </div>
    );
  }

  const isSaving = isCreating || isConverting;

  return (
    <div className="space-y-6">
      {/* Header: employee picker + month navigation */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="min-w-0 flex-1">
          <AdminEmployeePicker
            employees={employees}
            selectedUserId={selectedUserId}
            onSelectEmployee={setSelectedUserId}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Vorheriger Monat"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium">
            {format(currentMonth, "MMMM yyyy", { locale: de })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Nächster Monat"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Warning: incomplete employee settings */}
      {calculations.hasIncompleteSettings && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{selectedEmployee?.display_name}</strong> hat keine vollständigen
            Arbeitszeit-Einstellungen. Die Berechnungen verwenden Standardwerte (39,5h/Woche, 5
            Tage). Bitte die Einstellungen im Team-Bereich vervollständigen.
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics cards (yearly balance + monthly stats) */}
      <AdminTimeMetricsCards
        currentMonth={currentMonth}
        yearlyBalance={yearlyBalance}
        yearlyBreakdown={yearlyBreakdown}
        loadingYearlyBalance={loadingYearlyBalance}
        totalCorrectionMinutes={calculations.totalCorrectionMinutes}
        monthlyTargetMinutes={calculations.monthlyTargetMinutes}
        workedMinutes={calculations.workedMinutes}
        creditMinutes={calculations.creditMinutes}
        overtimeReductionMinutes={calculations.overtimeReductionMinutes}
        balanceMinutes={calculations.balanceMinutes}
        totalActual={calculations.totalActual}
        workdaysInMonth={calculations.workdaysInMonth}
        dailyMinutes={calculations.dailyMinutes}
        combinedEntries={calculations.combinedEntries}
        onCreateEntry={() => setCreateEntryDialogOpen(true)}
        onAddCorrection={() => setCorrectionDialogOpen(true)}
        onShowBreakdown={() => setShowBreakdownDialog(true)}
        onInitialBalance={() => setInitialBalanceDialogOpen(true)}
      />

      {/* Tabs */}
      <Tabs value={activeTimeTab} onValueChange={handleTimeTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Zeiteinträge</TabsTrigger>
          <TabsTrigger value="absences">Abwesenheiten</TabsTrigger>
          <TabsTrigger value="corrections">Korrekturen</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <AdminEntriesTab
            currentMonth={currentMonth}
            combinedEntries={calculations.combinedEntries}
            timeEntries={timeEntries}
            actualAfterEntryById={calculations.actualAfterEntryById}
            dailyMinutes={calculations.dailyMinutes}
            holidays={holidays}
            onEditEntry={(original, combined) => {
              setEditingEntry(original ?? null);
              setEditingCombinedEntry(combined);
            }}
          />
        </TabsContent>

        <TabsContent value="absences">
          <AdminAbsencesTab leaveRequests={leaveRequests} />
        </TabsContent>

        <TabsContent value="corrections">
          <AdminCorrectionsTab
            corrections={corrections}
            onAddCorrection={() => setCorrectionDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Entry editor dialog */}
      {editingCombinedEntry && (
        <AdminTimeEntryEditor
          entry={{
            id: editingEntry?.id || editingCombinedEntry.id,
            work_date: editingCombinedEntry.work_date,
            started_at: editingEntry?.started_at || editingCombinedEntry.started_at,
            ended_at: editingEntry?.ended_at || editingCombinedEntry.ended_at,
            minutes: editingEntry?.minutes || editingCombinedEntry.minutes,
            pause_minutes: editingEntry?.pause_minutes || editingCombinedEntry.pause_minutes || 0,
            notes: editingEntry?.notes || editingCombinedEntry.notes,
            user_name: selectedEmployee?.display_name || "Mitarbeiter",
            edited_by: editingEntry?.edited_by,
            edited_at: editingEntry?.edited_at,
            edit_reason: editingEntry?.edit_reason,
            leave_id: editingCombinedEntry.leave_id,
          }}
          isOpen={!!editingCombinedEntry}
          onClose={() => {
            setEditingEntry(null);
            setEditingCombinedEntry(null);
          }}
          onSave={handleSaveEntry}
          onTypeChange={(entryId, newType, reason, leaveId) =>
            handleTypeChange(entryId, newType as EntryType, reason, editingCombinedEntry, leaveId)
          }
          isLoading={isSaving}
          currentEntryType={editingCombinedEntry.entry_type as EntryType}
          allowTypeChange={true}
        />
      )}

      {/* Dialogs */}
      <AdminCorrectionDialog
        isOpen={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
        selectedEmployee={selectedEmployee}
        onSave={handleAddCorrection}
      />

      <AdminCreateEntryDialog
        isOpen={createEntryDialogOpen}
        onOpenChange={(open) => {
          setCreateEntryDialogOpen(open);
        }}
        selectedEmployee={selectedEmployee}
        yearlyBalance={yearlyBalance}
        dailyHours={calculations.dailyHours}
        isSaving={isCreating}
        onSave={async (data) => {
          await handleCreateEntry(data);
          setCreateEntryDialogOpen(false);
        }}
      />

      <AdminInitialBalanceDialog
        isOpen={initialBalanceDialogOpen}
        onOpenChange={setInitialBalanceDialogOpen}
        selectedEmployee={selectedEmployee}
        currentMonth={currentMonth}
        onSave={handleAddInitialBalance}
      />

      <AdminBreakdownDialog
        isOpen={showBreakdownDialog}
        onOpenChange={setShowBreakdownDialog}
        selectedEmployee={selectedEmployee}
        currentMonth={currentMonth}
        yearlyBalance={yearlyBalance}
        yearlyBreakdown={yearlyBreakdown}
        totalCorrectionMinutes={calculations.totalCorrectionMinutes}
      />
    </div>
  );
}
