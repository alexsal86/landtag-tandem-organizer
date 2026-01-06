import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { AppNavigation, getNavigationGroups } from "@/components/AppNavigation";
import { Dashboard } from "@/components/Dashboard";
import { CustomizableDashboard } from "@/components/CustomizableDashboard";
import { CalendarView } from "@/components/CalendarView";
import { ContactsView } from "@/components/ContactsView";
import { DocumentsView } from "@/components/DocumentsView";
import KnowledgeBaseView from "@/components/KnowledgeBaseView";
import { TasksView } from "@/components/TasksView";
import { SettingsView } from "@/components/SettingsView";
import { MeetingsView } from "@/components/MeetingsView";
import { EventPlanningView } from "@/components/EventPlanningView";
import { MapsView } from '@/pages/MapsView';
import { PartyAssociationsMapView } from "@/components/PartyAssociationsMapView";
import { EmployeesView } from "@/components/EmployeesView";
import { TimeTrackingView } from "@/components/TimeTrackingView";
import Administration from "@/pages/Administration";
import { DecisionOverview } from "@/components/task-decisions/DecisionOverview";
import { DrucksachenView } from "@/components/DrucksachenView";
import { CaseFilesView } from "@/components/CaseFilesView";
import { MatrixChatView } from "@/components/chat/MatrixChatView";
import { MyWorkView } from "@/components/MyWorkView";
import { CallsView } from "@/components/CallsView";
import { CreateAppointmentDialog } from "@/components/CreateAppointmentDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/MobileHeader";
import { AppHeader } from "@/components/layout/AppHeader";
import { SubNavigation } from "@/components/layout/SubNavigation";
import { MobileSubNavigation } from "@/components/layout/MobileSubNavigation";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { documentId } = useParams();
  
  // Determine active section from URL
  const getActiveSectionFromPath = (pathname: string) => {
    if (pathname === '/') return 'dashboard';
    const section = pathname.slice(1).split('/')[0];
    return section || 'dashboard';
  };
  
  const [activeSection, setActiveSection] = useState(() => getActiveSectionFromPath(location.pathname));
  
  // Dialog state management
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState(false);
  
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
    console.log('Active section changed to:', newSection);
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
    if (!loading && !user && activeSection !== 'knowledge') {
      navigate("/auth");
    }
  }, [user, loading, navigate, activeSection]);

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
    console.log('=== renderActiveSection called ===');
    console.log('Current activeSection:', activeSection);
    
    switch (activeSection) {
      case 'dashboard':
        console.log('Rendering CustomizableDashboard');
        return <CustomizableDashboard />;
      case "mywork":
        console.log('Rendering MyWorkView');
        return <MyWorkView />;
      case "calendar":
        console.log('Rendering CalendarView');
        return <CalendarView />;
      case "contacts":
        console.log('Rendering ContactsView');
        return <ContactsView />;
      case "tasks":
        console.log('Rendering TasksView');
        return <TasksView />;
      case "decisions":
        console.log('Rendering DecisionOverview');
        return <DecisionOverview />;
      case "time":
        console.log('Rendering TimeTrackingView');
        return <TimeTrackingView />;
      case "meetings":
        console.log('Rendering MeetingsView');
        return <MeetingsView />;
      case "eventplanning":
        console.log('Rendering EventPlanningView');
        return <EventPlanningView />;
      case "karten":
        console.log('Rendering MapsView');
        return <MapsView />;
      case "kreisverbände":
        console.log('Rendering PartyAssociationsMapView');
        return <PartyAssociationsMapView />;
      case "documents":
        console.log('Rendering DocumentsView');
        return <DocumentsView />;
      case "knowledge":
        console.log('Rendering KnowledgeBaseView');
        return <KnowledgeBaseView />;
      case "settings":
        console.log('Rendering SettingsView');
        return <SettingsView />;
      case "employee":
        console.log('Rendering EmployeesView');
        // Admin-only view is handled inside the component
        return <EmployeesView />;
      case "administration":
        console.log('Rendering Administration');
        return <Administration />;
      case "drucksachen":
        console.log('Rendering DrucksachenView');
        return <DrucksachenView />;
      case "casefiles":
        console.log('Rendering CaseFilesView');
        return <CaseFilesView />;
      case "chat":
        console.log('Rendering MatrixChatView');
        return <MatrixChatView />;
      case "calls":
        console.log('Rendering CallsView');
        return <CallsView />;
      default:
        console.log('Rendering default Dashboard');
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Skip to Content Link for Accessibility */}
      <a 
        href="#main-content" 
        className="absolute -top-10 left-0 bg-primary text-primary-foreground px-4 py-2 z-[100] focus:top-0 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Zum Hauptinhalt springen
      </a>
      
      <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppNavigation 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange}
          />
        </div>
        <div className="flex flex-col flex-1">
          {/* Header und SubNavigation fixiert am oberen Rand */}
          <div className="hidden md:block sticky top-0 z-40">
            <AppHeader />
            {/* Sekundäre Navigation für aktive Gruppe */}
            {(() => {
              const navGroups = getNavigationGroups();
              const activeGroup = navGroups.find(g => 
                g.subItems?.some(item => item.id === activeSection) ||
                (g.route && g.route.slice(1) === activeSection) ||
                g.id === activeSection
              );
              
              if (activeGroup?.subItems && activeGroup.subItems.length > 1) {
                return (
                  <SubNavigation
                    items={activeGroup.subItems}
                    activeItem={activeSection}
                    onItemChange={handleSectionChange}
                  />
                );
              }
              return null;
            })()}
          </div>
          <MobileHeader />
          {/* Mobile Sub-Navigation */}
          <div className="md:hidden">
            {(() => {
              const navGroups = getNavigationGroups();
              const activeGroup = navGroups.find(g => 
                g.subItems?.some(item => item.id === activeSection) ||
                (g.route && g.route.slice(1) === activeSection) ||
                g.id === activeSection
              );
              
              if (activeGroup?.subItems && activeGroup.subItems.length > 1) {
                return (
                  <MobileSubNavigation
                    items={activeGroup.subItems}
                    activeItem={activeSection}
                    onItemChange={handleSectionChange}
                  />
                );
              }
              return null;
            })()}
          </div>
          <main id="main-content" className="flex-1 bg-gradient-to-b from-background to-muted/20" tabIndex={-1}>
            {renderActiveSection()}
          </main>
        </div>
        
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