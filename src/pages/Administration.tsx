import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GeneralSettings } from "@/components/GeneralSettings";
import { ExpenseManagement } from "@/components/ExpenseManagement";
import { StatusAdminSettings } from "@/components/StatusAdminSettings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Clock, MapPin, Building, Users } from "lucide-react";
import { TenantCollaboration } from "@/components/TenantCollaboration";
import { DecisionEmailTemplates } from "@/components/task-decisions/DecisionEmailTemplates";
import { DefaultGuestsAdmin } from "@/components/DefaultGuestsAdmin";
import AppointmentPreparationTemplateAdmin from "@/components/AppointmentPreparationTemplateAdmin";
import { DistrictSupportManager } from "@/components/administration/DistrictSupportManager";
import { PartyDistrictMappingManager } from "@/components/administration/PartyDistrictMappingManager";
import { CalendarSyncDebug } from "@/components/CalendarSyncDebug";
import { PartyAssociationsAdmin } from "@/components/PartyAssociationsAdmin";
import { RSSSourceManager } from "@/components/administration/RSSSourceManager";
import { RSSSettingsManager } from "@/components/administration/RSSSettingsManager";
import { CalendarSyncSettings } from "@/components/administration/CalendarSyncSettings";
import { LoginCustomization } from "@/components/administration/LoginCustomization";
import { UserColorManager } from "@/components/administration/UserColorManager";
import { DecisionArchiveSettings } from "@/components/administration/DecisionArchiveSettings";
import { MatrixSettings } from "@/components/MatrixSettings";
import { VacationChecklistAdmin } from "@/components/administration/VacationChecklistAdmin";
import { NewsEmailTemplateManager } from "@/components/administration/NewsEmailTemplateManager";
import { EventEmailTemplateManager } from "@/components/administration/EventEmailTemplateManager";
import { AuditLogViewer } from "@/components/administration/AuditLogViewer";
import { TopicSettings } from "@/components/administration/TopicSettings";
import { ConfigurableTypeSettings } from "@/components/administration/ConfigurableTypeSettings";
import { AnnualTasksView } from "@/components/AnnualTasksView";
import LetterTemplateManager from "@/components/LetterTemplateManager";
import { AdminSidebar, adminMenuItems } from "@/components/administration/AdminSidebar";
import { LetterOccasionManager } from "@/components/administration/LetterOccasionManager";
import { PressTemplateManager } from "@/components/administration/PressTemplateManager";
import { PressOccasionManager } from "@/components/administration/PressOccasionManager";
import { SuperadminTenantManagement } from "@/components/administration/SuperadminTenantManagement";
import { GeoDataImport } from "@/components/administration/GeoDataImport";
import { MapLayerAdmin } from "@/components/administration/MapLayerAdmin";
import { MyWorkSystemOverview } from "@/components/administration/MyWorkSystemOverview";
import { DashboardHintSettings } from "@/components/administration/DashboardHintSettings";
import { MotivationalMessagesOverview } from "@/components/administration/MotivationalMessagesOverview";
import { StakeholderNetworkTagSettings } from "@/components/administration/StakeholderNetworkTagSettings";
import { PushNotificationTest } from "@/components/PushNotificationTest";
import { VapidKeyTest } from "@/components/VapidKeyTest";
import { DirectPushTest } from "@/components/DirectPushTest";
import { AutomationRulesManager } from "@/components/administration/AutomationRulesManager";
import { MeetingTemplateManager } from "@/components/administration/MeetingTemplateManager";
import { PlanningTemplateManager } from "@/components/administration/PlanningTemplateManager";
import { UserRolesManager } from "@/components/administration/UserRolesManager";
import { OfficeSocialMediaSettings } from "@/components/administration/OfficeSocialMediaSettings";
import { CelebrationSettingsCard } from "@/components/administration/CelebrationSettingsCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

const DEFAULT_SUB_SECTION: Record<string, string> = {
  security: "general",
  users: "status",
  calendar: "config",
  content: "topics",
  templates: "letters",
  politics: "associations",
  automation: "rules",
  superadmin: "tenants",
};

const resolveNavigationState = (
  section: string | null,
  subSection: string | null,
  isSuperAdmin: boolean,
) : { section: string; subSection: string } => {
  const visibleSections = adminMenuItems.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const fallbackSection = visibleSections[0]?.id ?? "security";
  const matchedSection = visibleSections.find((item) => item.id === section) ??
    visibleSections.find((item) => item.id === fallbackSection);

  const nextSection = matchedSection?.id ?? "security";
  const visibleSubSections = matchedSection?.children?.filter((child) => !child.superAdminOnly || isSuperAdmin) ?? [];
  const fallbackSubSection =
    visibleSubSections.find((child) => child.id === DEFAULT_SUB_SECTION[nextSection])?.id ??
    visibleSubSections[0]?.id ??
    "";
  const nextSubSection = visibleSubSections.find((child) => child.id === subSection)?.id ?? fallbackSubSection;

  return { section: nextSection, subSection: nextSubSection };
};

export default function Administration(): React.JSX.Element | null {
  const { user, loading } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [checkingAdmin, setCheckingAdmin] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const isMobile = useIsMobile();

  // Navigation state
  const [activeSection, setActiveSection] = useState(() =>
    resolveNavigationState(new URLSearchParams(location.search).get("adminSection"), new URLSearchParams(location.search).get("adminSubSection"), false).section,
  );
  const [activeSubSection, setActiveSubSection] = useState(() =>
    resolveNavigationState(new URLSearchParams(location.search).get("adminSection"), new URLSearchParams(location.search).get("adminSubSection"), false).subSection,
  );
  const [annualTasksBadge, setAnnualTasksBadge] = useState<number>(0);

  useEffect(() => {
    if (!loading && user && currentTenant) {
      checkAdminStatus();
      loadAnnualTasksBadge();
    }
  }, [loading, user, currentTenant]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextNavigation = resolveNavigationState(params.get("adminSection"), params.get("adminSubSection"), isSuperAdmin);

    setActiveSection(nextNavigation.section);
    setActiveSubSection(nextNavigation.subSection);

    if (
      params.get("adminSection") !== nextNavigation.section ||
      params.get("adminSubSection") !== nextNavigation.subSection
    ) {
      params.set("adminSection", nextNavigation.section);
      if (nextNavigation.subSection) {
        params.set("adminSubSection", nextNavigation.subSection);
      } else {
        params.delete("adminSubSection");
      }

      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [isSuperAdmin, location.pathname, location.search, navigate]);

  const checkAdminStatus = async (): Promise<void> => {
    if (!user) {
      setCheckingAdmin(false);
      return;
    }
    
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsAdmin(roleData?.role === 'abgeordneter' || roleData?.role === 'bueroleitung');
      setIsSuperAdmin(roleData?.role === 'abgeordneter');
    } catch (error: unknown) {
      debugConsole.error('Error checking admin status:', error);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const loadAnnualTasksBadge = async (): Promise<void> => {
    if (!currentTenant?.id) return;
    
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      const { data: tasks } = await supabase
        .from('annual_tasks')
        .select('id, due_month')
        .or(`tenant_id.eq.${currentTenant.id},is_system_task.eq.true`);
      
      if (!tasks) return;
      
      const { data: completions } = await supabase
        .from('annual_task_completions')
        .select('annual_task_id')
        .eq('year', currentYear);
      
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
  };

  const handleNavigate = (section: string, subSection?: string): void => {
    const nextNavigation = resolveNavigationState(section, subSection ?? null, isSuperAdmin);
    const params = new URLSearchParams(location.search);
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

  if (loading || checkingAdmin) return null;

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">Sie besitzen keine Berechtigung, diese Seite zu sehen.</p>
        </header>
      </main>
    );
  }

  const renderContent = (): React.JSX.Element | null => {
    // SECTION 1: System & Sicherheit
    if (activeSection === "security") {
      switch (activeSubSection) {
        case "general": return <GeneralSettings />;
        case "login": return <LoginCustomization />;
        case "roles":
          if (!isSuperAdmin) return null;
          return <UserRolesManager />;
        case "tenants": return <SuperadminTenantManagement />;
        case "auditlogs": return <AuditLogViewer />;
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
        case "expense": return <ExpenseManagement />;
        default: return <GeneralSettings />;
      }
    }

    // SECTION 2: Benutzer & Kommunikation
    if (activeSection === "users") {
      switch (activeSubSection) {
        case "status": return <StatusAdminSettings />;
        case "usercolors":
          if (!isSuperAdmin) return null;
          return <UserColorManager />;
        case "collaboration": return <TenantCollaboration />;
        case "matrix": return <MatrixSettings />;
        case "office-social-media": return <OfficeSocialMediaSettings />;
        case "vacation-checklist": return <VacationChecklistAdmin />;
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
              <ConfigurableTypeSettings title="Aufgaben-Status" tableName="task_statuses" entityName="Status" hasIcon={false} hasColor={false} deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?" />
            </div>
          );
        case "todos":
          return <ConfigurableTypeSettings title="ToDo-Kategorien" tableName="todo_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="ListTodo" defaultColor="#10b981" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />;
        case "decisions": return <DecisionEmailTemplates />;
        case "documents":
          return <ConfigurableTypeSettings title="Dokumenten-Kategorien" tableName="document_categories" entityName="Kategorie" hasIcon={true} hasColor={true} defaultIcon="FileText" defaultColor="#6366f1" deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />;
        case "casefiles":
          return (
            <div className="space-y-6">
              <ConfigurableTypeSettings title="Fallakten-Typen" tableName="case_file_types" entityName="Typ" hasIcon={true} hasColor={true} defaultIcon="Briefcase" defaultColor="#3b82f6" deleteWarning="Sind Sie sicher, dass Sie diesen Typ löschen möchten?" />
              <ConfigurableTypeSettings title="Bearbeitungsstatus" tableName="case_file_processing_statuses" entityName="Status" hasIcon={true} hasColor={true} defaultIcon="Circle" defaultColor="#6b7280" deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?" />
            </div>
          );
        case "case-items":
          return <ConfigurableTypeSettings title="Vorgangs-Kategorien" tableName="case_item_categories" entityName="Kategorie" hasIcon={false} hasColor={false} deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?" />;
        case "stakeholder-network-tags": return <StakeholderNetworkTagSettings />;
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
    if (activeSection === "superadmin") {
      switch (activeSubSection) {
        case "tenants": return <SuperadminTenantManagement />;
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
          return <div><h3 className="text-lg font-medium mb-4">No-Code Regel-Builder</h3><AutomationRulesManager /></div>;
        case "rss-sources":
          return <div><h3 className="text-lg font-medium mb-4">RSS-Quellen verwalten</h3><RSSSourceManager /></div>;
        case "rss-settings":
          return <div><h3 className="text-lg font-medium mb-4">RSS-Einstellungen</h3><RSSSettingsManager /></div>;
        case "annual": return <AnnualTasksView />;
        default: return null;
      }
    }

    return null;
  };

  return (
    <div className="flex h-app-headerless flex-col md:flex-row">
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
        className="hidden md:block"
      />

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 md:p-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
