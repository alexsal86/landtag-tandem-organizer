import React, { useState, useEffect, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { DesktopSidebar } from "@/components/navigation/appNavigation/DesktopSidebar";
import { activeNavigationSection, sectionForPath } from "@/components/navigation/navigationConfig";
import { useDaySlipLayout } from "@/components/dayslip/DaySlipLayout";

const NewsPage = lazyWithRetry(() => import("@/pages/NewsPage"));

// Lazy load all major view components for better initial load performance
const CalendarView = lazyWithRetry(() => import("@/features/calendar/components/CalendarView").then(m => ({ default: m.CalendarView })));
const ContactsView = lazyWithRetry(() => import("@/features/contacts/components/ContactsView").then(m => ({ default: m.ContactsView })));
const DocumentsView = lazyWithRetry(() => import("@/features/documents/components/DocumentsView").then(m => ({ default: m.DocumentsView as React.ComponentType })));
const TopicOverview = lazyWithRetry(() => import("@/features/topics/TopicOverview").then(m => ({ default: m.TopicOverview })));
const KnowledgeBaseView = lazyWithRetry(() => import("@/features/knowledge/components/KnowledgeBaseView"));
const KnowledgeWorkspace = lazyWithRetry(() => import("@/features/knowledge").then(m => ({ default: m.KnowledgeWorkspace })));
const SettingsView = lazyWithRetry(() => import("@/components/admin/SettingsView").then(m => ({ default: m.SettingsView })));
const MeetingsView = lazyWithRetry(() => import("@/features/meetings").then(m => ({ default: m.MeetingsView })));
const EventPlanningView = lazyWithRetry(() => import("@/features/event-planning/components/EventPlanningView").then(m => ({ default: m.EventPlanningView })));
const MapsView = lazyWithRetry(() => import("@/pages/MapsView").then(m => ({ default: m.MapsView })));
const PartyAssociationsMapView = lazyWithRetry(() => import("@/features/election-districts/components/PartyAssociationsMapView").then(m => ({ default: m.PartyAssociationsMapView })));
const EmployeesView = lazyWithRetry(() => import("@/features/employees").then(m => ({ default: m.EmployeesView })));
const TimeTrackingView = lazyWithRetry(() => import("@/features/timetracking").then(m => ({ default: m.TimeTrackingView })));
const Administration = lazyWithRetry(() => import("@/pages/Administration"));
const DecisionOverview = lazyWithRetry(() => import("@/components/task-decisions/DecisionOverview").then(m => ({ default: m.DecisionOverview })));
const CaseFilesView = lazyWithRetry(() => import("@/features/casefiles/components/CaseFilesView").then(m => ({ default: m.CaseFilesView })));
const DossiersMainView = lazyWithRetry(() => import("@/features/dossiers/components/DossiersMainView").then(m => ({ default: m.DossiersMainView })));
const FactsLibraryView = lazyWithRetry(() => import("@/features/facts/components/FactsLibraryView").then(m => ({ default: m.FactsLibraryView })));
const MatrixChatView = lazyWithRetry(() => import("@/components/chat/MatrixChatView").then(m => ({ default: m.MatrixChatView })));
const MatrixClientProvider = lazyWithRetry(() => import("@/contexts/MatrixClientContext").then(m => ({ default: m.MatrixClientProvider })));
const TasksWorkspace = lazyWithRetry(() => import("@/components/my-work/MyWorkTasksTab").then(m => ({ default: m.MyWorkTasksTab })));
const MyWorkView = lazyWithRetry(() => import("@/features/dashboard/components/MyWorkView").then(m => ({ default: m.MyWorkView })));
const DataView = lazyWithRetry(() => import("@/components/admin/DataView").then(m => ({ default: m.DataView })));
const EditProfile = lazyWithRetry(() => import("@/pages/EditProfile"));
const NotificationsPage = lazyWithRetry(() => import("@/pages/NotificationsPage"));
const QuickNotes = lazyWithRetry(() => import("@/pages/QuickNotes"));
const LetterDetail = lazyWithRetry(() => import("@/pages/LetterDetail"));
const EmployeeMeetingDetail = lazyWithRetry(() => import("@/pages/EmployeeMeetingDetail"));
const AppointmentPreparationDetail = lazyWithRetry(() => import("@/pages/AppointmentPreparationDetail"));
const BriefingLivePage = lazyWithRetry(() => import("@/pages/BriefingLivePage"));
const SelftestView = lazyWithRetry(() => import("@/features/selftest/components/SelftestView").then(m => ({ default: m.SelftestView })));
const CreateAppointmentDialog = lazyWithRetry(() => import("@/features/appointments/components/CreateAppointmentDialog").then(m => ({ default: m.CreateAppointmentDialog })));
const GlobalQuickActionHandler = lazyWithRetry(() => import("@/components/layout/GlobalQuickActionHandler").then(m => ({ default: m.GlobalQuickActionHandler })));
const GlobalAnnouncementBanner = lazyWithRetry(() => import("@/components/announcements/GlobalAnnouncementBanner").then(m => ({ default: m.GlobalAnnouncementBanner })));
import { OnboardingHost } from "@/components/onboarding/OnboardingHost";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn } from "@/lib/utils";
import { WorkspaceToolbar } from "@/components/layout/WorkspaceToolbar";
const CreateContact = lazyWithRetry(() => import("./CreateContact"));
const NotFound = lazyWithRetry(() => import("./NotFound"));

const Index = (): React.JSX.Element => {
  const daySlipReservedWidth = useDaySlipLayout()?.reservedWidth ?? 0;
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading, currentTenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { subId, letterId } = useParams();
  
  // Wait for both auth AND tenant to be loaded before rendering
  const loading = authLoading || (user && tenantLoading);
  
  const activeSection = sectionForPath(location.pathname);
  const isCalendar = activeSection === "calendar";
  const searchParams = new URLSearchParams(location.search);
  const isCreateContactRoute = activeSection === "contacts" && searchParams.get("action") === "new";
  const isContactsWorkspace = activeSection === "contacts" && subId !== "new" && !isCreateContactRoute;
  const isTeamPage = activeSection === "employee";
  const hasSectionToolbar = activeSection === "mywork" || activeSection === "notes" || isTeamPage || (activeSection === "employee-meeting" && !subId);
  
  // Dialog state management
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState<boolean>(false);

  // Check URL parameters for dialog state
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const action = urlParams.get('action');
    
    if (action === 'create-appointment') {
      setShowCreateAppointmentDialog(true);
    } else {
      setShowCreateAppointmentDialog(false);
    }
  }, [location.search]);


  // Handle dialog close
  const handleCreateAppointmentDialogChange = (open: boolean) => {
    setShowCreateAppointmentDialog(open);
    if (!open) {
      const urlParams = new URLSearchParams(location.search);
      urlParams.delete('action');
      const newSearch = urlParams.toString();
      const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
      navigate(newUrl, { replace: true });
    }
  };

  useEffect(() => {
    // Allow access to knowledge section without authentication (demo mode)
    // Only redirect when auth is fully loaded (not when tenant is still loading)
    if (!authLoading && !user && activeSection !== 'knowledge') {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, activeSection]);

  // Preload the MatrixChatView bundle in the background so the first click on
  // the chat tab never triggers a network fetch.
  useEffect(() => {
    if (!user) return;
    const preload = () => {
      import("@/components/chat/MatrixChatView").catch(() => {/* ignore */});
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(preload, 1000);
      return () => clearTimeout(id);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-app bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && activeSection !== 'knowledge') {
    return (
      <div className="min-h-app bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Landtag System</CardTitle>
            <CardDescription>
              Sie müssen sich anmelden, um auf das System zuzugreifen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /** Wraps a section component with its own ErrorBoundary for isolated crash recovery */
  const withSectionBoundary = (label: string, node: React.ReactNode): React.JSX.Element => (
    <ErrorBoundary fallbackMessage={`Der Bereich „${label}" konnte nicht geladen werden. Bitte laden Sie die Seite neu.`}>
      {node}
    </ErrorBoundary>
  );

  const renderActiveSection = (): React.JSX.Element => {
    switch (activeSection) {
      case "news":
        return withSectionBoundary('News', <NewsPage />);
      case "mywork":
        return withSectionBoundary('Meine Arbeit', <MyWorkView />);
      case "notes":
        return withSectionBoundary('Notizen', <QuickNotes />);
      case "calendar":
        return withSectionBoundary('Kalender', <CalendarView />);
      case "contacts":
        if (subId === "new" || isCreateContactRoute) {
          return withSectionBoundary('Kontakt erstellen', <CreateContact />);
        }
        return withSectionBoundary('Kontakte', <ContactsView />);
      case "tasks":
        return withSectionBoundary('Aufgaben', <div className="min-h-[calc(100vh-8rem)] p-6"><TasksWorkspace /></div>);
      case "decisions":
        return withSectionBoundary('Entscheidungen', <DecisionOverview />);
      case "time":
        return withSectionBoundary('Zeiterfassung', <TimeTrackingView />);
      case "meetings":
        return withSectionBoundary('Sitzungen', <MeetingsView />);
      case "eventplanning":
        return withSectionBoundary('Veranstaltungen', <EventPlanningView />);
      case "karten":
        return withSectionBoundary('Karten', <MapsView />);
      case "kreisverbände":
        return withSectionBoundary('Kreisverbände', <PartyAssociationsMapView />);
      case "documents":
        if (letterId) {
          return withSectionBoundary('Brief', <LetterDetail key={letterId} />);
        }
        return withSectionBoundary('Dokumente', <DocumentsView />);
      case "knowledge":
        return withSectionBoundary('Wissensdatenbank', <KnowledgeBaseView />);
      case "settings":
        return withSectionBoundary('Einstellungen', <SettingsView />);
      case "employee":
        return withSectionBoundary('Mitarbeiter', <EmployeesView />);
      case "employee-meeting":
        return withSectionBoundary('Mitarbeiter-Sitzung', subId ? <EmployeeMeetingDetail /> : <EmployeesView />);
      case "administration":
        return withSectionBoundary('Verwaltung', <Administration />);
      case "casefiles":
        return withSectionBoundary('Vorgänge', <CaseFilesView />);
      case "dossiers":
        return withSectionBoundary('Wissen', <DossiersMainView />);
      case "themen":
        return withSectionBoundary('Themen', <TopicOverview />);
      case "wissen":
        if (subId === "fakten") {
          return withSectionBoundary('Fakten-Bibliothek', <FactsLibraryView />);
        }
        return withSectionBoundary('Wissen', <KnowledgeWorkspace />);
      case "chat":
        return withSectionBoundary('Chat', <MatrixChatView />);
      case "daten":
        return withSectionBoundary('Daten', <DataView />);
      case "notifications":
        return withSectionBoundary('Benachrichtigungen', <NotificationsPage />);
      case "profile-edit":
        return withSectionBoundary('Profil bearbeiten', <EditProfile />);
      case "appointment-preparation":
        return withSectionBoundary('Terminvorbereitung', <AppointmentPreparationDetail />);
      case "briefing-live":
        return withSectionBoundary('Live Briefing', <BriefingLivePage />);
      case "selftest":
      case "selbsttest":
        return withSectionBoundary('Selbsttest', <SelftestView />);
      default:
        return <NotFound />;
    }
  };

  return (
    <>
      {/* Global Announcement Banner - above everything */}
      <GlobalAnnouncementBanner />
      
      {/* Skip to Content Link for Accessibility */}
      <a 
        href="#main-content" 
        className="absolute -top-10 left-0 bg-primary text-primary-foreground px-4 py-2 z-[100] focus:top-0 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Zum Hauptinhalt springen
      </a>
      
      <div
        className={cn(
          "fixed inset-0 flex h-app bg-background overflow-hidden",
          // Bei angedocktem Tageszettel keine feste Breite setzen: mit left/right
          // bestimmt der Browser die Breite dann selbst und der Inhalt wird schmaler.
          daySlipReservedWidth > 0 ? "w-auto" : "w-full"
        )}
        style={daySlipReservedWidth > 0 ? { right: daySlipReservedWidth } : undefined}
      >
        <DesktopSidebar activeSection={activeNavigationSection(activeSection)} />
        <div className="flex min-w-0 flex-col flex-1 h-app overflow-hidden">
          <MobileHeader />
          {!hasSectionToolbar && <WorkspaceToolbar />}
          <main
            id="main-content"
            className={cn(
              "min-h-0 flex-1",
              isContactsWorkspace || isTeamPage ? "bg-background" : "bg-gradient-to-b from-background to-muted/20",
              isCalendar || isContactsWorkspace ? "overflow-hidden" : "overflow-y-auto has-[[data-task-detail]]:[scrollbar-gutter:stable]",
            )}
            tabIndex={-1}
          >
            <ErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                <MatrixClientProvider key={`${user?.id ?? ""}:${currentTenant?.id ?? ""}`}>
                  {renderActiveSection()}
                </MatrixClientProvider>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        
        {/* Global QuickAction Handler - für Actions, die Navigation erfordern */}
        <GlobalQuickActionHandler />

        {/* Onboarding Modal (allgemein + büro-spezifisch) */}
        <OnboardingHost />

        {/* Create Appointment Dialog */}
        <CreateAppointmentDialog
          open={showCreateAppointmentDialog}
          onOpenChange={handleCreateAppointmentDialogChange}
        />
      </div>
    </>
  );
};

export default Index;
