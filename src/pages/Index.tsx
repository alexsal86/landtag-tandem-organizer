import { useState, useEffect, Suspense, useMemo, useCallback, startTransition } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { AppNavigation, getNavigationGroups } from "@/components/AppNavigation";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useNavWidth } from "@/hooks/useNavWidth";

// Lazy load all major view components for better initial load performance
const CustomizableDashboard = lazyWithRetry(() => import("@/components/CustomizableDashboard").then(m => ({ default: m.CustomizableDashboard })));
const CalendarView = lazyWithRetry(() => import("@/components/CalendarView").then(m => ({ default: m.CalendarView })));
const ContactsView = lazyWithRetry(() => import("@/components/ContactsView").then(m => ({ default: m.ContactsView })));
const DocumentsView = lazyWithRetry(() => import("@/components/DocumentsView").then(m => ({ default: m.DocumentsView as React.ComponentType })));
const KnowledgeBaseView = lazyWithRetry(() => import("@/components/KnowledgeBaseView"));
const TasksView = lazyWithRetry(() => import("@/components/TasksView").then(m => ({ default: m.TasksView })));
const SettingsView = lazyWithRetry(() => import("@/components/SettingsView").then(m => ({ default: m.SettingsView })));
const MeetingsView = lazyWithRetry(() => import("@/components/MeetingsView").then(m => ({ default: m.MeetingsView })));
const EventPlanningView = lazyWithRetry(() => import("@/components/EventPlanningView").then(m => ({ default: m.EventPlanningView })));
const MapsView = lazyWithRetry(() => import("@/pages/MapsView").then(m => ({ default: m.MapsView })));
const PartyAssociationsMapView = lazyWithRetry(() => import("@/components/PartyAssociationsMapView").then(m => ({ default: m.PartyAssociationsMapView })));
const EmployeesView = lazyWithRetry(() => import("@/components/EmployeesView").then(m => ({ default: m.EmployeesView })));
const TimeTrackingView = lazyWithRetry(() => import("@/components/TimeTrackingView").then(m => ({ default: m.TimeTrackingView })));
const Administration = lazyWithRetry(() => import("@/pages/Administration"));
const DecisionOverview = lazyWithRetry(() => import("@/components/task-decisions/DecisionOverview").then(m => ({ default: m.DecisionOverview })));
const DrucksachenView = lazyWithRetry(() => import("@/components/DrucksachenView").then(m => ({ default: m.DrucksachenView })));
const CaseFilesView = lazyWithRetry(() => import("@/components/CaseFilesView").then(m => ({ default: m.CaseFilesView })));
const DossiersMainView = lazyWithRetry(() => import("@/features/dossiers/components/DossiersMainView").then(m => ({ default: m.DossiersMainView })));
const MatrixChatView = lazyWithRetry(() => import("@/components/chat/MatrixChatView").then(m => ({ default: m.MatrixChatView })));
const MatrixClientProvider = lazyWithRetry(() => import("@/contexts/MatrixClientContext").then(m => ({ default: m.MatrixClientProvider })));
const MyWorkView = lazyWithRetry(() => import("@/components/MyWorkView").then(m => ({ default: m.MyWorkView })));
const DataView = lazyWithRetry(() => import("@/components/DataView").then(m => ({ default: m.DataView })));
const EditProfile = lazyWithRetry(() => import("@/pages/EditProfile"));
const NotificationsPage = lazyWithRetry(() => import("@/pages/NotificationsPage"));
const LetterDetail = lazyWithRetry(() => import("@/pages/LetterDetail"));
const EmployeeMeetingDetail = lazyWithRetry(() => import("@/pages/EmployeeMeetingDetail"));
const AppointmentPreparationDetail = lazyWithRetry(() => import("@/pages/AppointmentPreparationDetail"));
const BriefingLivePage = lazyWithRetry(() => import("@/pages/BriefingLivePage"));
const CreateAppointmentDialog = lazyWithRetry(() => import("@/components/CreateAppointmentDialog").then(m => ({ default: m.CreateAppointmentDialog })));
const GlobalQuickActionHandler = lazyWithRetry(() => import("@/components/layout/GlobalQuickActionHandler").then(m => ({ default: m.GlobalQuickActionHandler })));
const GlobalAnnouncementBanner = lazyWithRetry(() => import("@/components/announcements/GlobalAnnouncementBanner").then(m => ({ default: m.GlobalAnnouncementBanner })));
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/MobileHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { SubNavigation } from "@/components/layout/SubNavigation";
import { MobileSubNavigation } from "@/components/layout/MobileSubNavigation";
const CreateContact = lazyWithRetry(() => import("./CreateContact"));
const NotFound = lazyWithRetry(() => import("./NotFound"));

const Index = (): React.JSX.Element => {
  const { width: navWidth, isResizing, startResize } = useNavWidth();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { section, subId } = useParams();
  
  // Wait for both auth AND tenant to be loaded before rendering
  const loading = authLoading || (user && tenantLoading);
  
  // Determine active section from URL
  const getActiveSectionFromPath = (pathname: string): string => {
    if (pathname === '/') return 'dashboard';
    const pathSection = pathname.slice(1).split('/')[0];

    if (pathSection === 'letters') {
      return 'documents';
    }

    return pathSection || 'dashboard';
  };
  
  const [activeSection, setActiveSection] = useState<string>(() => getActiveSectionFromPath(location.pathname));
  const isCalendar = activeSection === "calendar";
  const isCreateContactRoute = activeSection === "contacts" && new URLSearchParams(location.search).get("action") === "new";
  
  // Dialog state management
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState<boolean>(false);

  const navGroups = useMemo(() => getNavigationGroups(), []);
  const activeGroup = useMemo(() =>
    navGroups.find(g =>
      g.subItems?.some(item => item.id === activeSection) ||
      (g.route && g.route.slice(1) === activeSection) ||
      g.id === activeSection
    ),
  [navGroups, activeSection]);
  
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

  // Update active section when URL changes
  useEffect(() => {
    const newSection = getActiveSectionFromPath(location.pathname);
    setActiveSection(newSection);
  }, [location.pathname]);

  // Handle navigation to sections – wrapped in startTransition for non-blocking rendering
  const handleSectionChange = useCallback((section: string) => {
    prefetchRoute(section);
    const path = section === 'dashboard' ? '/' : `/${section}`;
    startTransition(() => {
      navigate(path);
    });
  }, [navigate]);
  
  // Handle dialog close
  const handleCreateAppointmentDialogChange = useCallback((open: boolean) => {
    setShowCreateAppointmentDialog(open);
    if (!open) {
      const urlParams = new URLSearchParams(location.search);
      urlParams.delete('action');
      const newSearch = urlParams.toString();
      const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
      navigate(newUrl, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

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
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && activeSection !== 'knowledge') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
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
      case 'dashboard':
        return withSectionBoundary('Dashboard', <CustomizableDashboard />);
      case "mywork":
        return withSectionBoundary('Meine Arbeit', <MyWorkView />);
      case "calendar":
        return withSectionBoundary('Kalender', <CalendarView />);
      case "contacts":
        if (subId === "new" || isCreateContactRoute) {
          return withSectionBoundary('Kontakt erstellen', <CreateContact />);
        }
        return withSectionBoundary('Kontakte', <ContactsView />);
      case "tasks":
        return withSectionBoundary('Aufgaben', <TasksView />);
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
        if (section === 'letters' && subId) {
          return withSectionBoundary('Brief', <LetterDetail />);
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
      case "drucksachen":
        return withSectionBoundary('Drucksachen', <DrucksachenView />);
      case "casefiles":
        return withSectionBoundary('Vorgänge', <CaseFilesView />);
      case "dossiers":
        return withSectionBoundary('Wissen', <DossiersMainView />);
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
      default:
        return <NotFound />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Global Announcement Banner - above everything */}
      <GlobalAnnouncementBanner />
      
      {/* Skip to Content Link for Accessibility */}
      <a 
        href="#main-content" 
        className="absolute -top-10 left-0 bg-primary text-primary-foreground px-4 py-2 z-[100] focus:top-0 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Zum Hauptinhalt springen
      </a>
      
      <div className={cn("flex min-h-screen w-full bg-background overflow-hidden", isResizing && "select-none")}>
        <div className="hidden md:flex sticky top-0 h-screen z-30" style={{ width: navWidth }}>
          <AppNavigation 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange}
          />
          {/* Resize Handle */}
          <div
            onMouseDown={startResize}
            className={cn(
              "w-1 cursor-col-resize hover:bg-primary/30 transition-colors shrink-0",
              isResizing && "bg-primary/40"
            )}
          />
        </div>
        <div className={`flex flex-col flex-1 h-screen ${isCalendar ? "overflow-hidden min-h-0" : "overflow-y-auto"}`}>
          {/* Header und SubNavigation fixiert am oberen Rand */}
          <div className="hidden md:block sticky top-0 z-40">
            {/* Sekundäre Navigation für aktive Gruppe */}
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <SubNavigation
                items={activeGroup.subItems}
                activeItem={activeSection}
                onItemChange={handleSectionChange}
              />
            ) : null}
          </div>
          <MobileHeader />
          {/* Mobile Sub-Navigation */}
          <div className="md:hidden">
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <MobileSubNavigation
                items={activeGroup.subItems}
                activeItem={activeSection}
                onItemChange={handleSectionChange}
              />
            ) : null}
          </div>
          <main id="main-content" className="flex-1 min-h-0 bg-gradient-to-b from-background to-muted/20" tabIndex={-1}>
            <ErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                <MatrixClientProvider>
                  {renderActiveSection()}
                </MatrixClientProvider>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        
        {/* Global QuickAction Handler - für Actions, die Navigation erfordern */}
        <GlobalQuickActionHandler />
        
        {/* Create Appointment Dialog */}
        <CreateAppointmentDialog
          open={showCreateAppointmentDialog}
          onOpenChange={handleCreateAppointmentDialogChange}
        />
      </div>
    </ThemeProvider>
  );
};

export default Index;
