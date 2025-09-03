import { useState, useEffect, Suspense, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import React from "react";

// Lazy load heavy components that aren't immediately needed
const CustomizableDashboard = React.lazy(() => import("@/components/CustomizableDashboard"));
const CalendarView = React.lazy(() => import("@/components/CalendarView"));
const ContactsView = React.lazy(() => import("@/components/ContactsView"));
const DocumentsView = React.lazy(() => import("@/components/DocumentsView"));
const KnowledgeBaseView = React.lazy(() => import("@/components/KnowledgeBaseView"));
const TasksView = React.lazy(() => import("@/components/TasksView"));
const SettingsView = React.lazy(() => import("@/components/SettingsView"));
const MeetingsView = React.lazy(() => import("@/components/MeetingsView"));
const EventPlanningView = React.lazy(() => import("@/components/EventPlanningView"));
const EmployeesView = React.lazy(() => import("@/components/EmployeesView"));
const TimeTrackingView = React.lazy(() => import("@/components/TimeTrackingView"));
const Administration = React.lazy(() => import("@/pages/Administration"));

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

  // Memoize to prevent unnecessary recalculations
  const currentSection = useMemo(() => getActiveSectionFromPath(location.pathname), [location.pathname]);

  // Update active section when URL changes
  useEffect(() => {
    setActiveSection(currentSection);
  }, [currentSection]);

  // Handle navigation to sections
  const handleSectionChange = (section: string) => {
    const path = section === 'dashboard' ? '/' : `/${section}`;
    navigate(path);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
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
      case "calendar":
        return <CalendarView />;
      case "contacts":
        return <ContactsView />;
      case "tasks":
        return <TasksView />;
      case "time":
        return <TimeTrackingView />;
      case "meetings":
        return <MeetingsView />;
      case "eventplanning":
        return <EventPlanningView />;
      case "documents":
        return <DocumentsView />;
      case "knowledge":
        return <KnowledgeBaseView />;
      case "settings":
        return <SettingsView />;
      case "employee":
        // Admin-only view is handled inside the component
        return <EmployeesView />;
      case "administration":
        return <Administration />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Navigation 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange} 
          />
          <main className="flex-1">
            <Suspense fallback={
              <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              {renderActiveSection()}
            </Suspense>
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default Index;