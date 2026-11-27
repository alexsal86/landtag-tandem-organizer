import { TeamRitualWorkspace } from '@/features/team-rituals/TeamRitualWorkspace';
import { HrWorkspace } from "@/features/onboarding-hr/HrWorkspace";
import { ResponsibilityMatrix } from "@/features/responsibilities/ResponsibilityMatrix";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NewUserForm } from "@/components/admin/NewUserForm";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, Clock, Loader2, MessageSquare, Plus, Network, UserRound, UserRoundCog, UsersRound } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { NavigationIslandTrack, navigationIslandClass, navigationIslandItemClass } from "@/components/layout/NavigationIsland";
import { WorkspaceToolbar } from "@/components/layout/WorkspaceToolbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeMeetingScheduler } from "@/features/employees/components/EmployeeMeetingScheduler";
import { EmployeeMeetingHistory } from "@/features/employees/components/EmployeeMeetingHistory";
import { EmployeeMeetingRequestManager } from "@/features/employees/components/EmployeeMeetingRequestManager";
import { EmployeeYearlyStatsView } from "@/features/employees/components/EmployeeYearlyStatsView";
import { AdminTimeTrackingView } from "@/components/admin/AdminTimeTrackingView";

import { useEmployeesData } from "@/components/employees/hooks/useEmployeesData";
import { resolveEmployeeTab } from "@/features/employees/tabs";
import { useEmployeeOperations } from "@/components/employees/hooks/useEmployeeOperations";
import { EmployeeSelfView } from "@/components/employees/EmployeeSelfView";
import { PendingLeavesTable, EmployeeListTable } from "@/components/employees/EmployeeAdminTable";

export function EmployeesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveEmployeeTab(searchParams.get("tab"));
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

  const visibleTab = !data.isAdmin && (activeTab === "meetings" || activeTab === "timetracking")
    ? "overview"
    : activeTab;
  const tabs = [
    { value: "overview", label: data.isAdmin ? "Übersicht" : "Mein Profil", icon: data.isAdmin ? Calendar : UserRound },
    ...(data.isAdmin ? [{ value: "meetings", label: "Gespräche", icon: MessageSquare }] : []),
    { value: "responsibilities", label: "Zuständigkeiten", icon: Network },
    { value: "hr", label: "HR-Onboarding & Offboarding", icon: UserRoundCog },
    { value: "rituals", label: "Team-Rituale", icon: UsersRound },
    ...(data.isAdmin ? [{ value: "timetracking", label: "Zeiterfassung", icon: Clock }] : []),
  ];
  const toolbar = (
    <WorkspaceToolbar>
      <TabsPrimitive.List aria-label="Mitarbeiterverwaltung" className={navigationIslandClass}>
        <NavigationIslandTrack activeItem={visibleTab}>
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsPrimitive.Trigger key={value} value={value} className={navigationIslandItemClass}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </TabsPrimitive.Trigger>
          ))}
        </NavigationIslandTrack>
      </TabsPrimitive.List>
    </WorkspaceToolbar>
  );

  if (!data.isAdmin) {
    return (
      <Tabs value={visibleTab} onValueChange={handleTabChange}>
        {toolbar}
        <TabsContent value="responsibilities"><ResponsibilityMatrix /></TabsContent>
        <TabsContent value="hr"><HrWorkspace /></TabsContent>
        <TabsContent value="rituals"><TeamRitualWorkspace /></TabsContent>
        <TabsContent value="overview">
          <EmployeeSelfView
            loading={data.loading}
            selfSettings={data.selfSettings}
            selfLeaveAgg={data.selfLeaveAgg}
            selfProfile={data.selfProfile}
          />
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <Tabs value={visibleTab} onValueChange={handleTabChange}>
      {toolbar}
      <div className="min-h-0 p-3 sm:p-6">
        <header className="mb-4">
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
            updateWorkdays={ops.updateWorkdays}
            updateVacationDays={ops.updateVacationDays}
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
      </div>

      <Dialog open={newEmployeeOpen} onOpenChange={setNewEmployeeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
          <div className="flex max-h-80 flex-wrap gap-2 overflow-y-auto p-1">
            {data.employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Mitarbeitenden zugewiesen.</p>
            ) : data.employees.map(employee => (
              <Button key={employee.user_id} variant="outline" size="sm" className="h-auto min-h-9 max-w-full justify-start rounded-full py-1 pl-1 pr-3" onClick={() => {
                setSelectedEmployee({ id: employee.user_id, name: employee.display_name || "Unbenannt" });
                setMeetingEmployeePickerOpen(false);
                setSchedulerOpen(true);
              }}>
                <Avatar className="h-7 w-7" aria-hidden="true">
                  <AvatarImage src={employee.avatar_url ?? undefined} alt="" />
                  <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <span className="min-w-0 whitespace-normal break-words text-left">{employee.display_name || "Unbenannt"}</span>
              </Button>
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
    </Tabs>
  );
}

export default EmployeesView;
