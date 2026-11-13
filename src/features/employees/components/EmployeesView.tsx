import { TeamRitualWorkspace } from '@/features/team-rituals/TeamRitualWorkspace';
import { HrWorkspace } from "@/features/onboarding-hr/HrWorkspace";
import { ResponsibilityMatrix } from "@/features/responsibilities/ResponsibilityMatrix";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NewUserForm } from "@/components/admin/NewUserForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, Clock, Loader2, MessageSquare, Plus, Network, UserRoundCog, UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeMeetingScheduler } from "@/features/employees/components/EmployeeMeetingScheduler";
import { EmployeeMeetingHistory } from "@/features/employees/components/EmployeeMeetingHistory";
import { EmployeeMeetingRequestManager } from "@/features/employees/components/EmployeeMeetingRequestManager";
import { EmployeeYearlyStatsView } from "@/features/employees/components/EmployeeYearlyStatsView";
import { AdminTimeTrackingView } from "@/components/admin/AdminTimeTrackingView";

import { useEmployeesData } from "@/components/employees/hooks/useEmployeesData";
import { useEmployeeOperations } from "@/components/employees/hooks/useEmployeeOperations";
import { EmployeeSelfView } from "@/components/employees/EmployeeSelfView";
import { PendingLeavesTable, EmployeeListTable } from "@/components/employees/EmployeeAdminTable";

export function EmployeesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && ["overview", "meetings", "timetracking", "responsibilities", "hr", "rituals"].includes(requestedTab)
    ? requestedTab : "overview";
  const handleTabChange = (tab: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab);
      return next;
    });
  };
  const data = useEmployeesData();
  const { reloadPendingRequestsCount } = data;
  const ops = useEmployeeOperations({
    setEmployees: data.setEmployees,
    pendingLeaves: data.pendingLeaves,
    setPendingLeaves: data.setPendingLeaves,
  });

  const [newEmployeeOpen, setNewEmployeeOpen] = useState(false);
  const [meetingEmployeePickerOpen, setMeetingEmployeePickerOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);
  const [yearlyStatsOpen, setYearlyStatsOpen] = useState(false);
  const [meetingHistoryRefreshTrigger, setMeetingHistoryRefreshTrigger] = useState(0);

  const reloadMeetingFlows = useCallback(async (): Promise<void> => {
    setMeetingHistoryRefreshTrigger((prev) => prev + 1);
    await reloadPendingRequestsCount();
  }, [reloadPendingRequestsCount]);

  // SEO
  useEffect(() => {
    document.title = "Mitarbeiterverwaltung | Admin Dashboard";
    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", window.location.href);
    document.head.appendChild(canonical);
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Admin-Übersicht: Mitarbeiter, Stunden pro Woche sowie Krank- und Urlaubsanträge verwalten.");
    document.head.appendChild(meta);
    return () => { document.head.removeChild(canonical); document.head.removeChild(meta); };
  }, []);

  if (!data.isAdmin) {
    return (
      <div><Tabs value={["responsibilities", "hr", "rituals"].includes(activeTab) ? activeTab : "overview"} onValueChange={handleTabChange}><TabsList className="h-auto flex-wrap"><TabsTrigger value="overview">Mein Profil</TabsTrigger><TabsTrigger value="responsibilities"><Network className="h-4 w-4 mr-2" aria-hidden="true" />Zuständigkeiten</TabsTrigger><TabsTrigger value="hr"><UserRoundCog className="h-4 w-4 mr-2" aria-hidden="true" />HR-Onboarding & Offboarding</TabsTrigger><TabsTrigger value="rituals"><UsersRound className="h-4 w-4 mr-2" aria-hidden="true" />Team-Rituale</TabsTrigger></TabsList><TabsContent value="responsibilities"><ResponsibilityMatrix /></TabsContent><TabsContent value="hr"><HrWorkspace /></TabsContent><TabsContent value="rituals"><TeamRitualWorkspace /></TabsContent><TabsContent value="overview"><EmployeeSelfView
        loading={data.loading}
        selfSettings={data.selfSettings}
        selfLeaveAgg={data.selfLeaveAgg}
        selfProfile={data.selfProfile}
      /></TabsContent></Tabs></div>
    );
  }

  return (
    <div className="min-h-0 bg-gradient-subtle p-3 sm:p-6">
      <header>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Mitarbeiterverwaltung</h1>
            <p className="text-muted-foreground">Überblick über Mitarbeitende, Stunden & Abwesenheiten</p>
            {data.loading && (
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Mitarbeiterdaten ...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setYearlyStatsOpen(true)} className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />Jahresstatistik
            </Button>
            {data.pendingRequestsCount > 0 && (
              <Button onClick={() => setRequestManagerOpen(true)} className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />Gesprächsanfragen<Badge variant="secondary">{data.pendingRequestsCount}</Badge>
              </Button>
            )}
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="overview"><Calendar className="h-4 w-4 mr-2" />Übersicht</TabsTrigger>
          <TabsTrigger value="meetings"><MessageSquare className="h-4 w-4 mr-2" />Gespräche</TabsTrigger>
          <TabsTrigger value="responsibilities"><Network className="h-4 w-4 mr-2" aria-hidden="true" />Zuständigkeiten</TabsTrigger><TabsTrigger value="hr"><UserRoundCog className="h-4 w-4 mr-2" aria-hidden="true" />HR-Onboarding & Offboarding</TabsTrigger><TabsTrigger value="rituals"><UsersRound className="h-4 w-4 mr-2" aria-hidden="true" />Team-Rituale</TabsTrigger>
          <TabsTrigger value="timetracking"><Clock className="h-4 w-4 mr-2" />Zeiterfassung</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PendingLeavesTable
            pendingLeaves={data.pendingLeaves}
            onLeaveAction={ops.handleLeaveAction}
            onCancelApproval={ops.handleCancelApproval}
          />
          <EmployeeListTable
            headerAction={<Button onClick={() => setNewEmployeeOpen(true)} className="h-11 rounded-xl bg-lime-600 px-5 text-white hover:bg-lime-700"><Plus className="mr-2 h-4 w-4" />Mitarbeiter</Button>}
            loading={data.loading}
            employees={data.employees}
            leaves={data.leaves}
            sickDays={data.sickDays}
            setEmployees={data.setEmployees}
            updateHours={ops.updateHours}
            updateDaysPerWeek={ops.updateDaysPerWeek}
            updateVacationDays={ops.updateVacationDays}
            updateStartDate={ops.updateStartDate}
            onScheduleMeeting={(emp): void => { setSelectedEmployee(emp); setSchedulerOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="meetings" className="pb-6">
          <EmployeeMeetingHistory showFilters={true} refreshTrigger={meetingHistoryRefreshTrigger} onScheduleMeeting={() => setMeetingEmployeePickerOpen(true)} />
        </TabsContent>

        <TabsContent value="responsibilities"><ResponsibilityMatrix /></TabsContent><TabsContent value="hr"><HrWorkspace /></TabsContent><TabsContent value="rituals"><TeamRitualWorkspace /></TabsContent>
        <TabsContent value="timetracking">
          <AdminTimeTrackingView />
        </TabsContent>
      </Tabs>

      <Dialog open={newEmployeeOpen} onOpenChange={setNewEmployeeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mitarbeiter hinzufügen</DialogTitle></DialogHeader>
          <NewUserForm onSuccess={() => { setNewEmployeeOpen(false); void reloadPendingRequestsCount(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={meetingEmployeePickerOpen} onOpenChange={setMeetingEmployeePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gespräch planen</DialogTitle>
            <DialogDescription>Mit wem möchten Sie ein Gespräch planen?</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {data.employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Mitarbeitenden zugewiesen.</p>
            ) : data.employees.map(employee => (
              <Button key={employee.user_id} variant="outline" className="w-full justify-start rounded-xl" onClick={() => {
                setSelectedEmployee({ id: employee.user_id, name: employee.display_name || "Unbenannt" });
                setMeetingEmployeePickerOpen(false);
                setSchedulerOpen(true);
              }}>{employee.display_name || "Unbenannt"}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedEmployee && (
        <EmployeeMeetingScheduler
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          open={schedulerOpen}
          onOpenChange={setSchedulerOpen}
          onScheduled={async (): Promise<void> => {
            setSchedulerOpen(false);
            setSelectedEmployee(null);
            await reloadMeetingFlows();
          }}
        />
      )}

      <Dialog open={requestManagerOpen} onOpenChange={setRequestManagerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gesprächsanfragen verwalten</DialogTitle></DialogHeader>
          <EmployeeMeetingRequestManager onPendingCountChange={data.setPendingRequestsCount} onMeetingScheduled={reloadMeetingFlows} />
        </DialogContent>
      </Dialog>

      <EmployeeYearlyStatsView isOpen={yearlyStatsOpen} onClose={() => setYearlyStatsOpen(false)} />
    </div>
  );
}

export default EmployeesView;
