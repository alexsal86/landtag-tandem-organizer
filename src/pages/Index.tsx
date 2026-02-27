import { useState, useEffect, Suspense, useMemo } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { AppNavigation, getNavigationGroups } from "@/components/AppNavigation";
import { Dashboard } from "@/components/Dashboard";

// Lazy load all major view components for better initial load performance
const CustomizableDashboard = lazyWithRetry(() => import("@/components/CustomizableDashboard").then(m => ({ default: m.CustomizableDashboard })));
const CalendarView = lazyWithRetry(() => import("@/components/CalendarView").then(m => ({ default: m.CalendarView })));
const ContactsView = lazyWithRetry(() => import("@/components/ContactsView").then(m => ({ default: m.ContactsView })));
const DocumentsView = lazyWithRetry(() => import("@/components/DocumentsView").then(m => ({ default: m.DocumentsView })));
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
const MatrixChatView = lazyWithRetry(() => import("@/components/chat/MatrixChatView").then(m => ({ default: m.MatrixChatView })));
const MyWorkView = lazyWithRetry(() => import("@/components/MyWorkView").then(m => ({ default: m.MyWorkView })));
const CallsView = lazyWithRetry(() => import("@/components/CallsView").then(m => ({ default: m.CallsView })));
const DataView = lazyWithRetry(() => import("@/components/DataView").then(m => ({ default: m.DataView })));
const EditProfile = lazyWithRetry(() => import("@/pages/EditProfile"));
const NotificationsPage = lazyWithRetry(() => import("@/pages/NotificationsPage"));
import { CreateAppointmentDialog } from "@/components/CreateAppointmentDialog";
import { GlobalQuickActionHandler } from "@/components/layout/GlobalQuickActionHandler";
import { GlobalAnnouncementBanner } from "@/components/announcements/GlobalAnnouncementBanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/MobileHeader";
import { AppHeader } from "@/components/layout/AppHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SubNavigation } from "@/components/layout/SubNavigation";
import { MobileSubNavigation } from "@/components/layout/MobileSubNavigation";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { documentId } = useParams();
  
  // Wait for both auth AND tenant to be loaded before rendering
  const loading = authLoading || (user && tenantLoading);
  
  // Determine active section from URL
  const getActiveSectionFromPath = (pathname: string) => {
    if (pathname === '/') return 'dashboard';
    const section = pathname.slice(1).split('/')[0];
    return section || 'dashboard';
  };
  
  const [activeSection, setActiveSection] = useState(() => getActiveSectionFromPath(location.pathname));
  
  // Dialog state management
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState(false);

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

  // Handle navigation to sections
  const handleSectionChange = (section: string) => {
    const path = section === 'dashboard' ? '/' : `/${section}`;
    navigate(path);
  };
  
  // Handle dialog close
  const handleCreateAppointmentDialogChange = (open: boolean) => {
    setShowCreateAppointmentDialog(open);
    if (!open) {
      // Remove action parameter from URL when closing dialog
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

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <CustomizableDashboard />;
      case "mywork":
        return <MyWorkView />;
      case "calendar":
        return <CalendarView />;
      case "contacts":
        return <ContactsView />;
      case "tasks":
        return <TasksView />;
      case "decisions":
        return <DecisionOverview />;
      case "time":
        return <TimeTrackingView />;
      case "meetings":
        return <MeetingsView />;
      case "eventplanning":
        return <EventPlanningView />;
      case "karten":
        return <MapsView />;
      case "kreisverbände":
        return <PartyAssociationsMapView />;
      case "documents":
        return <DocumentsView />;
      case "knowledge":
        return <KnowledgeBaseView />;
      case "settings":
        return <SettingsView />;
      case "employee":
        return <EmployeesView />;
      case "administration":
        return <Administration />;
      case "drucksachen":
        return <DrucksachenView />;
      case "casefiles":
        return <CaseFilesView />;
      case "chat":
        return <MatrixChatView />;
      case "calls":
        return <CallsView />;
      case "daten":
        return <DataView />;
      case "notifications":
        return <NotificationsPage />;
      case "profile-edit":
        return <EditProfile />;
      default:
        return <Dashboard />;
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
      
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <div className="hidden md:block sticky top-0 h-screen z-30">
          <AppNavigation 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange}
          />
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto h-screen">
          {/* Header und SubNavigation fixiert am oberen Rand */}
          <div className="hidden md:block sticky top-0 z-40">
            <AppHeader />
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
          <main id="main-content" className="flex-1 bg-gradient-to-b from-background to-muted/20" tabIndex={-1}>
            <ErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                {renderActiveSection()}
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
