import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Building } from "lucide-react";
import { AdminSidebar, adminMenuItems } from "@/components/administration/AdminSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAdministrationAccess } from "@/components/administration/useAdministrationAccess";
import { resolveNavigationState } from "@/components/administration/adminNavigation";
import { normalizeAutomationParams } from "@/components/administration/automationNavigation";

const ElectionHistoryAdmin = lazy(() => import("@/features/election-history/ElectionHistoryAdmin"));
const HrTemplateEditor = lazy(() => import("@/features/onboarding-hr/HrTemplateEditor"));
const PlanningDefaultCollaboratorsSettings = lazy(() => import("@/components/administration/PlanningDefaultCollaboratorsSettings").then(module => ({ default: module.PlanningDefaultCollaboratorsSettings })));
const GeneralSettings = lazy(() => import("@/components/admin/GeneralSettings").then(module => ({ default: module.GeneralSettings })));
const ExpenseManagement = lazy(() => import("@/features/expenses/components/ExpenseManagement").then(module => ({ default: module.ExpenseManagement })));
const StatusAdminSettings = lazy(() => import("@/components/status/StatusAdminSettings").then(module => ({ default: module.StatusAdminSettings })));
const DecisionEmailTemplates = lazy(() => import("@/components/task-decisions/DecisionEmailTemplates").then(module => ({ default: module.DecisionEmailTemplates })));
const DefaultGuestsAdmin = lazy(() => import("@/features/appointments/components/DefaultGuestsAdmin").then(module => ({ default: module.DefaultGuestsAdmin })));
const AppointmentPreparationTemplateAdmin = lazy(() => import("@/features/appointments/components/AppointmentPreparationTemplateAdmin"));
const DistrictSupportManager = lazy(() => import("@/components/administration/DistrictSupportManager").then(module => ({ default: module.DistrictSupportManager })));
const PartyDistrictMappingManager = lazy(() => import("@/components/administration/PartyDistrictMappingManager").then(module => ({ default: module.PartyDistrictMappingManager })));
const CalendarSyncDebug = lazy(() => import("@/features/calendar/components/CalendarSyncDebug").then(module => ({ default: module.CalendarSyncDebug })));
const PartyAssociationsAdmin = lazy(() => import("@/features/election-districts/components/PartyAssociationsAdmin").then(module => ({ default: module.PartyAssociationsAdmin })));
const RSSMonitoringManager = lazy(() => import("@/components/administration/RSSMonitoringManager").then(module => ({ default: module.RSSMonitoringManager })));
const CalendarSyncSettings = lazy(() => import("@/components/administration/CalendarSyncSettings").then(module => ({ default: module.CalendarSyncSettings })));
const LoginCustomization = lazy(() => import("@/components/administration/LoginCustomization").then(module => ({ default: module.LoginCustomization })));
const UserColorManager = lazy(() => import("@/components/administration/UserColorManager").then(module => ({ default: module.UserColorManager })));
const DecisionArchiveSettings = lazy(() => import("@/components/administration/DecisionArchiveSettings").then(module => ({ default: module.DecisionArchiveSettings })));
const MatrixSettings = lazy(() => import("@/components/admin/MatrixSettings").then(module => ({ default: module.MatrixSettings })));
const VacationChecklistAdmin = lazy(() => import("@/components/administration/VacationChecklistAdmin").then(module => ({ default: module.VacationChecklistAdmin })));
const NewsEmailTemplateManager = lazy(() => import("@/components/administration/NewsEmailTemplateManager").then(module => ({ default: module.NewsEmailTemplateManager })));
const EventEmailTemplateManager = lazy(() => import("@/components/administration/EventEmailTemplateManager").then(module => ({ default: module.EventEmailTemplateManager })));
const AuditLogViewer = lazy(() => import("@/components/administration/AuditLogViewer").then(module => ({ default: module.AuditLogViewer })));
const PermissionsManager = lazy(() => import("@/components/administration/PermissionsManager").then(module => ({ default: module.PermissionsManager })));
const TopicSettings = lazy(() => import("@/components/administration/TopicSettings").then(module => ({ default: module.TopicSettings })));
const ConfigurableTypeSettings = lazy(() => import("@/components/administration/ConfigurableTypeSettings").then(module => ({ default: module.ConfigurableTypeSettings })));
const AnnualTasksView = lazy(() => import("@/features/timetracking/components/AnnualTasksView").then(module => ({ default: module.AnnualTasksView })));
const LetterTemplateManager = lazy(() => import("@/features/letters/components/LetterTemplateManager"));
const LetterOccasionManager = lazy(() => import("@/components/administration/LetterOccasionManager").then(module => ({ default: module.LetterOccasionManager })));
const PressTemplateManager = lazy(() => import("@/components/administration/PressTemplateManager").then(module => ({ default: module.PressTemplateManager })));
const PressOccasionManager = lazy(() => import("@/components/administration/PressOccasionManager").then(module => ({ default: module.PressOccasionManager })));
const SuperadminTenantManagement = lazy(() => import("@/components/administration/SuperadminTenantManagement").then(module => ({ default: module.SuperadminTenantManagement })));
const GeoDataImport = lazy(() => import("@/components/administration/GeoDataImport").then(module => ({ default: module.GeoDataImport })));
const MapLayerAdmin = lazy(() => import("@/components/administration/MapLayerAdmin").then(module => ({ default: module.MapLayerAdmin })));
const MyWorkSystemOverview = lazy(() => import("@/components/administration/MyWorkSystemOverview").then(module => ({ default: module.MyWorkSystemOverview })));
const OnboardingSlidesManager = lazy(() => import("@/components/administration/OnboardingSlidesManager").then(module => ({ default: module.OnboardingSlidesManager })));
const DashboardHintSettings = lazy(() => import("@/components/administration/DashboardHintSettings").then(module => ({ default: module.DashboardHintSettings })));
const MotivationalMessagesOverview = lazy(() => import("@/components/administration/MotivationalMessagesOverview").then(module => ({ default: module.MotivationalMessagesOverview })));
const StakeholderNetworkTagSettings = lazy(() => import("@/components/administration/StakeholderNetworkTagSettings").then(module => ({ default: module.StakeholderNetworkTagSettings })));
const DataLintDashboard = lazy(() => import("@/components/administration/DataLintDashboard").then(module => ({ default: module.DataLintDashboard })));
const DuplicateScanDashboard = lazy(() => import("@/components/administration/DuplicateScanDashboard").then(module => ({ default: module.DuplicateScanDashboard })));
const BulkActionAuditViewer = lazy(() => import("@/components/administration/BulkActionAuditViewer").then(module => ({ default: module.BulkActionAuditViewer })));
const PushNotificationTest = lazy(() => import("@/dev/PushNotificationTest").then(module => ({ default: module.PushNotificationTest })));
const VapidKeyTest = lazy(() => import("@/dev/VapidKeyTest").then(module => ({ default: module.VapidKeyTest })));
const DirectPushTest = lazy(() => import("@/dev/DirectPushTest").then(module => ({ default: module.DirectPushTest })));
const AutomationRulesManager = lazy(() => import("@/components/administration/AutomationRulesManager").then(module => ({ default: module.AutomationRulesManager })));
const MeetingTemplateManager = lazy(() => import("@/components/administration/MeetingTemplateManager").then(module => ({ default: module.MeetingTemplateManager })));
const PlanningTemplateManager = lazy(() => import("@/components/administration/PlanningTemplateManager").then(module => ({ default: module.PlanningTemplateManager })));
const UserRolesManager = lazy(() => import("@/components/administration/UserRolesManager").then(module => ({ default: module.UserRolesManager })));
const OfficeSocialMediaSettings = lazy(() => import("@/components/administration/OfficeSocialMediaSettings").then(module => ({ default: module.OfficeSocialMediaSettings })));
const CelebrationSettingsCard = lazy(() => import("@/components/administration/CelebrationSettingsCard").then(module => ({ default: module.CelebrationSettingsCard })));
const SelftestView = lazy(() => import("@/features/selftest/components/SelftestView").then(module => ({ default: module.SelftestView })));
const PerformanceDashboard = lazy(() => import("@/components/administration/PerformanceDashboard").then(module => ({ default: module.PerformanceDashboard })));
const SecurityCockpit = lazy(() => import("@/components/administration/SecurityCockpit").then(module => ({ default: module.SecurityCockpit })));
const GdprRequestsManager = lazy(() => import("@/components/administration/GdprRequestsManager").then(module => ({ default: module.GdprRequestsManager })));

export default function Administration(): React.JSX.Element | null {
  const { user, loading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { checkingAdmin, isAdmin, isSuperAdmin, error: accessError } = useAdministrationAccess(
    user?.id, currentTenant?.id, loading || tenantLoading,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const isMobile = useIsMobile();

  const { section: activeSection, subSection: activeSubSection } = resolveNavigationState(
    new URLSearchParams(location.search).get("adminSection"),
    new URLSearchParams(location.search).get("adminSubSection"),
    isSuperAdmin,
  );
  const [annualTasksBadge, setAnnualTasksBadge] = useState<number>(0);

  useEffect(() => {
    if (checkingAdmin || !isAdmin || location.pathname.split('/')[1] !== 'administration') return;
    const params = normalizeAutomationParams(new URLSearchParams(location.search));
    const nextNavigation = resolveNavigationState(params.get("adminSection"), params.get("adminSubSection"), isSuperAdmin);

    if (
      params.get("adminSection") !== nextNavigation.section ||
      params.get("adminSubSection") !== nextNavigation.subSection ||
      params.toString() !== new URLSearchParams(location.search).toString()
    ) {
      params.set("adminSection", nextNavigation.section);
      if (nextNavigation.subSection) {
        params.set("adminSubSection", nextNavigation.subSection);
      } else {
        params.delete("adminSubSection");
      }

      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [checkingAdmin, isAdmin, isSuperAdmin, location.pathname, location.search, navigate]);

  const loadAnnualTasksBadge = useCallback(async (): Promise<void> => {
    if (!currentTenant?.id) return;
    
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      const { data: tasks } = await supabase
        .from('annual_tasks')
        .select('id, due_month')
        .eq('tenant_id', currentTenant.id);
      
      if (!tasks?.length) { setAnnualTasksBadge(0); return; }
      
      const { data: completions } = await supabase
        .from('annual_task_completions')
        .select('annual_task_id')
        .eq('year', currentYear).in('annual_task_id', tasks.map(task => task.id)).not('completed_at', 'is', null);
      
      const completedIds = new Set((completions ?? []).map((completion) => completion.annual_task_id));
      
      const pendingCount = tasks.filter((task) => {
        const isDue = task.due_month <= currentMonth;
        const isCompleted = completedIds.has(task.id);
        return isDue && !isCompleted;
      }).length;
      
      setAnnualTasksBadge(pendingCount);
    } catch (error: unknown) {
      debugConsole.error('Error loading annual tasks badge:', error);
    }
  }, [currentTenant]);

  useEffect(() => {
    if (isAdmin) void loadAnnualTasksBadge();
  }, [isAdmin, loadAnnualTasksBadge]);

  const handleNavigate = (section: string, subSection?: string): void => {
    if (location.pathname.split('/')[1] !== 'administration') return;
    const nextNavigation = resolveNavigationState(section, subSection ?? null, isSuperAdmin);
    const params = new URLSearchParams(location.search);
    if (activeSection !== nextNavigation.section || activeSubSection !== nextNavigation.subSection) {
      params.delete("automationTab");
      params.delete("rssTab");
    }
    params.set("adminSection", nextNavigation.section);
    if (nextNavigation.subSection) {
      params.set("adminSubSection", nextNavigation.subSection);
    } else {
      params.delete("adminSubSection");
    }

    navigate({ pathname: location.pathname, search: params.toString() });

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const currentSectionLabel = adminMenuItems.find((item) => item.id === activeSection)?.label ?? "Administration";
  const currentSubSectionLabel = adminMenuItems
    .find((item) => item.id === activeSection)
    ?.children?.find((child) => child.id === activeSubSection)?.label;

  if (checkingAdmin) return <main className="container mx-auto p-6" role="status">Berechtigungen werden geprüft…</main>;

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">{accessError ? "Die Berechtigungen konnten nicht geprüft werden. Bitte laden Sie die Seite erneut." : "Sie besitzen keine Berechtigung, diese Seite zu sehen."}</p>
        </header>
      </main>
    );
  }

  const renderContent = (): React.JSX.Element | null => {
    if (!currentTenant && (activeSection !== "superadmin" || ["roles", "map-layers"].includes(activeSubSection)) && activeSection !== "personal") {
      return <p role="status">Bitte wählen Sie ein Büro aus. Die Plattformverwaltung ist unter „Super-Admin · Tenants“ erreichbar.</p>;
    }
    if (activeSection === "finance") return <ExpenseManagement />;
    if (activeSection === "personal") {
      if (activeSubSection === "matrix") return <MatrixSettings />;
      if (activeSubSection === "archiving") return <DecisionArchiveSettings />;
      if (activeSubSection === "celebrations") return <CelebrationSettingsCard />;
    }
    // SECTION 1: System & Sicherheit
    if (activeSection === "security") {
      switch (activeSubSection) {
        case "general": return <GeneralSettings />;
        case "roles":
          if (!isSuperAdmin) return null;
          return <UserRolesManager />;
        case "tenants": return <SuperadminTenantManagement />;
        case "auditlogs": return <AuditLogViewer />;
        case "permissions": return <PermissionsManager />;
        case "security-cockpit":
          if (!isSuperAdmin) return null;
          return <SecurityCockpit />;
        case "gdpr": return <GdprRequestsManager />;
        case "performance":
          if (!isSuperAdmin) return null;
          return <PerformanceDashboard />;
        case "expense": return <ExpenseManagement />;
        case "selftest": return <SelftestView />;
        default: return <GeneralSettings />;
      }
    }

    // SECTION 2: Benutzer & Kommunikation
    if (activeSection === "users") {
      switch (activeSubSection) {
        case "status": return <StatusAdminSettings />;
        case "planning-collaborators": return <PlanningDefaultCollaboratorsSettings />;
        case "usercolors":
          if (!isSuperAdmin) return null;
          return <UserColorManager />;
        case "matrix": return <MatrixSettings />;
        case "office-social-media": return <OfficeSocialMediaSettings />;
        case "vacation-checklist": return <VacationChecklistAdmin />;
        case "onboarding": return <OnboardingSlidesManager />;
        default: return <StatusAdminSettings />;
      }
    }

    // SECTION 3: Kalender & Termine
    if (activeSection === "calendar") {
      switch (activeSubSection) {
        case "config":
          return (
            <div className="space-y-6">
              <ConfigurableTypeSettings title="Termin-Kategorien" tableName="appointment_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="Calendar" defaultColor="#3b82f6" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />
              <ConfigurableTypeSettings title="Termin-Status" tableName="appointment_statuses" entityName="Status" hasIcon={true} hasColor={true} defaultIcon="CircleDot" defaultColor="#3b82f6" deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?" />
              <ConfigurableTypeSettings title="Termin-Orte" tableName="appointment_locations" entityName="Ort" hasIcon={true} hasColor={true} defaultIcon="MapPin" defaultColor="#6366f1" deleteWarning="Sind Sie sicher, dass Sie diesen Ort löschen möchten?" />
            </div>
          );
        case "guests": return <DefaultGuestsAdmin />;
        case "preparation": return <AppointmentPreparationTemplateAdmin />;
        case "sync": return <CalendarSyncSettings />;
        case "debug": return <CalendarSyncDebug />;
        default: return null;
      }
    }

    // SECTION 4: Inhalte & Daten
    if (activeSection === "content") {
      switch (activeSubSection) {
        case "topics": return <TopicSettings />;
        case "tasks":
          return (
            <div className="space-y-6">
              <ConfigurableTypeSettings title="Aufgaben-Kategorien" tableName="task_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="CheckSquare" defaultColor="#3b82f6" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />
              <ConfigurableTypeSettings readOnly={!isSuperAdmin} title="Aufgaben-Status (plattformweit)" tableName="task_statuses" entityName="Status" hasIcon={false} hasColor={false} deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?" />
            </div>
          );
        case "todos":
          return <ConfigurableTypeSettings readOnly={!isSuperAdmin} title="ToDo-Kategorien (plattformweit)" tableName="todo_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="ListTodo" defaultColor="#10b981" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />;
        case "decisions": return <DecisionEmailTemplates />;
        case "archiving":
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Entscheidungsarchivierung</CardTitle>
                <CardDescription>Verwalten Sie die automatische Archivierung von Entscheidungsanfragen</CardDescription>
              </CardHeader>
              <CardContent><DecisionArchiveSettings /></CardContent>
            </Card>
          );
        case "documents":
          return <ConfigurableTypeSettings title="Dokumenten-Kategorien" tableName="document_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="FileText" defaultColor="#6366f1" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />;
        case "casefiles":
          return (
            <div className="space-y-6">
              <ConfigurableTypeSettings title="Fallakten-Typen" tableName="case_file_types" entityName="Typ" hasIcon={true} hasColor={true} defaultIcon="Briefcase" defaultColor="#3b82f6" deleteWarning="Sind Sie sicher, dass Sie diesen Typ löschen möchten?" />
              <ConfigurableTypeSettings title="Bearbeitungsstatus" tableName="case_file_processing_statuses" entityName="Status" hasIcon={true} hasColor={true} defaultIcon="Circle" defaultColor="#6b7280" deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?" />
            </div>
          );
        case "stakeholder-network-tags": return <StakeholderNetworkTagSettings />;
        case "data-quality": return <DataLintDashboard />;
        case "duplicates": return <DuplicateScanDashboard />;
        case "bulk-audit": return <BulkActionAuditViewer />;
        default: return <TopicSettings />;
      }
    }

    // SECTION 5: Vorlagen
    if (activeSection === "templates") {
      switch (activeSubSection) {
        case "letters": return <div className="space-y-6"><LetterTemplateManager /></div>;
        case "occasions":
          return <Card><CardContent className="pt-6"><LetterOccasionManager /></CardContent></Card>;
        case "press-templates":
          return <Card><CardContent className="pt-6"><PressTemplateManager /></CardContent></Card>;
        case "press-occasions":
          return <Card><CardContent className="pt-6"><PressOccasionManager /></CardContent></Card>;
        case "meetings": return <MeetingTemplateManager />;
        case "plannings": return <PlanningTemplateManager />;
        case "emails":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">News E-Mail-Vorlagen</h3>
              <NewsEmailTemplateManager />
            </div>
          );
        case "event-emails":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">Veranstaltungs-E-Mail-Vorlagen</h3>
              <EventEmailTemplateManager />
            </div>
          );
        case "celebrations":
          return <CelebrationSettingsCard />;
        default: return null;
      }
    }

    // SECTION 6: Politik & Organisation
    if (activeSection === "politics") {
      switch (activeSubSection) {
        case "associations": return <PartyAssociationsAdmin />;
        case "districts":
          return (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Betreuungswahlkreise</CardTitle></CardHeader>
              <CardContent><DistrictSupportManager /></CardContent>
            </Card>
          );
        case "mapping":
          return (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Wahlkreis-Zuordnung</CardTitle></CardHeader>
              <CardContent><PartyDistrictMappingManager /></CardContent>
            </Card>
          );
        default: return <PartyAssociationsAdmin />;
      }
    }

    // SECTION 7: Super-Admin
    if (activeSection === "superadmin" && isSuperAdmin) {
      switch (activeSubSection) {
        case "tenants": return <SuperadminTenantManagement />;
        case "election-history": return <ElectionHistoryAdmin />;
        case "push-tests":
          return (
            <Card>
              <CardHeader>
                <CardTitle>Push-System Tests</CardTitle>
                <CardDescription>Technische Push-Tests sind ausschließlich im Superadmin-Bereich verfügbar.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <VapidKeyTest />
                  <PushNotificationTest />
                  <DirectPushTest />
                </div>
              </CardContent>
            </Card>
          );
        case "roles": return <UserRolesManager />;
        case "associations": return <PartyAssociationsAdmin />;
        case "districts":
          return (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Betreuungswahlkreise</CardTitle></CardHeader>
              <CardContent><DistrictSupportManager /></CardContent>
            </Card>
          );
        case "mapping":
          return (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Wahlkreis-Zuordnung</CardTitle></CardHeader>
              <CardContent><PartyDistrictMappingManager /></CardContent>
            </Card>
          );
        case "geo-import": return <GeoDataImport />;
        case "map-layers": return <MapLayerAdmin />;
        case "login": return <LoginCustomization />;
        case "mywork-overview": return <MyWorkSystemOverview />;
        case "dashboard-hints": return <DashboardHintSettings />;
        case "motivational-messages": return <MotivationalMessagesOverview />;
        default: return null;
      }
    }

    // SECTION 8: Automatisierung
    if (activeSection === "automation") {
      switch (activeSubSection) {
        case "rules":
          return <AutomationRulesManager />;
        case "hr": return <HrTemplateEditor />;
        case "rss":
          return <RSSMonitoringManager />;
        case "annual": return <AutomationRulesManager />;
        default: return null;
      }
    }

    return null;
  };

  return (
    <div data-testid="administration-layout" className="flex h-full min-h-0 flex-col overflow-hidden bg-background md:flex-row">
      <div className="border-b bg-background p-3 md:hidden px-safe">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Menu className="h-4 w-4" />
              <span className="truncate">{currentSectionLabel}{currentSubSectionLabel ? ` · ${currentSubSectionLabel}` : ""}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[90vw] max-w-none p-0 pb-safe-bottom">
            <SheetHeader className="sr-only">
              <SheetTitle>Administrations-Navigation</SheetTitle>
            </SheetHeader>
            <AdminSidebar
              activeSection={activeSection}
              activeSubSection={activeSubSection}
              onNavigate={handleNavigate}
              isSuperAdmin={isSuperAdmin}
              annualTasksBadge={annualTasksBadge}
              className="h-full w-full border-r-0"
            />
          </SheetContent>
        </Sheet>
      </div>

      <AdminSidebar
        activeSection={activeSection}
        activeSubSection={activeSubSection}
        onNavigate={handleNavigate}
        isSuperAdmin={isSuperAdmin}
        annualTasksBadge={annualTasksBadge}
        className="hidden md:flex"
      />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 md:p-6">
            <header className={activeSection === "automation" && activeSubSection === "rules" ? "mb-5" : "mb-5 border-b pb-3"}>
              <p className="text-xs text-muted-foreground">{activeSection === "personal" ? `Persönliche Einstellung · Büro: ${currentTenant?.name ?? "Kein Büro ausgewählt"}` : `Aktuelles Büro: ${currentTenant?.name ?? "Kein Büro ausgewählt"}`}</p>
              {activeSection === "automation" && activeSubSection === "rules" ? <h1 className="mt-1 text-2xl font-semibold tracking-tight">Automatisierung: Regeln und Workflows</h1> : <p className="mt-1 text-sm font-medium">{currentSectionLabel}{currentSubSectionLabel ? ` · ${currentSubSectionLabel}` : ""}</p>}
            </header>
            <Suspense fallback={<p role="status">Bereich wird geladen…</p>}>
              <div key={`${currentTenant?.id ?? "platform"}:${activeSection}:${activeSubSection}`}>{renderContent()}</div>
            </Suspense>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
