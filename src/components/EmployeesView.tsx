import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, Clock, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { EmployeeMeetingScheduler } from "./EmployeeMeetingScheduler";
import { EmployeeMeetingHistory } from "./EmployeeMeetingHistory";
import { EmployeeMeetingRequestManager } from "./EmployeeMeetingRequestManager";
import { EmployeeYearlyStatsView } from "./EmployeeYearlyStatsView";
import { AdminTimeTrackingView } from "./admin/AdminTimeTrackingView";

import { useEmployeesData } from "./employees/hooks/useEmployeesData";
import { useEmployeeOperations } from "./employees/hooks/useEmployeeOperations";
import { EmployeeSelfView } from "./employees/EmployeeSelfView";
import { PendingLeavesTable, EmployeeListTable } from "./employees/EmployeeAdminTable";

export function EmployeesView() {
  const data = useEmployeesData();
  const ops = useEmployeeOperations({
    setEmployees: data.setEmployees,
    pendingLeaves: data.pendingLeaves,
    setPendingLeaves: data.setPendingLeaves,
  });

  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);
  const [yearlyStatsOpen, setYearlyStatsOpen] = useState(false);
  const [meetingHistoryRefreshTrigger, setMeetingHistoryRefreshTrigger] = useState(0);

  const reloadMeetingFlows = useCallback(async (): Promise<void> => {
    setMeetingHistoryRefreshTrigger((prev) => prev + 1);
    await data.reloadPendingRequestsCount();
  }, [data.reloadPendingRequestsCount]);

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
      <EmployeeSelfView
        loading={data.loading}
        selfSettings={data.selfSettings}
        selfLeaveAgg={data.selfLeaveAgg}
        selfProfile={data.selfProfile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
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

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><Calendar className="h-4 w-4 mr-2" />Übersicht</TabsTrigger>
          <TabsTrigger value="timetracking"><Clock className="h-4 w-4 mr-2" />Zeiterfassung</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PendingLeavesTable
            pendingLeaves={data.pendingLeaves}
            onLeaveAction={ops.handleLeaveAction}
            onCancelApproval={ops.handleCancelApproval}
          />
          <EmployeeListTable
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
          <section className="pb-6">
            <EmployeeMeetingHistory showFilters={true} refreshTrigger={meetingHistoryRefreshTrigger} />
          </section>
        </TabsContent>

        <TabsContent value="timetracking">
          <AdminTimeTrackingView />
        </TabsContent>
      </Tabs>

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
