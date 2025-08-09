import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { CustomizableDashboard } from "@/components/CustomizableDashboard";
import { CalendarView } from "@/components/CalendarView";
import { ContactsView } from "@/components/ContactsView";
import { DocumentsView } from "@/components/DocumentsView";
import { TasksView } from "@/components/TasksView";
import { SettingsView } from "@/components/SettingsView";
import { MeetingsView } from "@/components/MeetingsView";
import { EventPlanningView } from "@/components/EventPlanningView";
import { EmployeesView } from "@/components/EmployeesView";
import TimeTrackingView from "@/components/TimeTrackingView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Debug: Zeige aktuelle Sektion
  useEffect(() => {
    console.log('Active section changed to:', activeSection);
  }, [activeSection]);

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
    console.log('=== renderActiveSection called ===');
    console.log('Current activeSection:', activeSection);
    
    switch (activeSection) {
      case 'dashboard':
        console.log('Rendering CustomizableDashboard');
        return <CustomizableDashboard />;
      case "calendar":
        console.log('Rendering CalendarView');
        return <CalendarView />;
      case "contacts":
        console.log('Rendering ContactsView');
        return <ContactsView />;
      case "tasks":
        console.log('Rendering TasksView');
        return <TasksView />;
      case "time":
        console.log('Rendering TimeTrackingView');
        return <TimeTrackingView />;
      case "meetings":
        console.log('Rendering MeetingsView');
        return <MeetingsView />;
      case "eventplanning":
        console.log('Rendering EventPlanningView');
        return <EventPlanningView />;
      case "documents":
        console.log('Rendering DocumentsView');
        return <DocumentsView />;
      case "settings":
        console.log('Rendering SettingsView');
        return <SettingsView />;
      case "employee":
        console.log('Rendering EmployeesView');
        // Admin-only view is handled inside the component
        return <EmployeesView />;
      default:
        console.log('Rendering default Dashboard');
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Navigation 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
          <main className="flex-1">
            {renderActiveSection()}
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default Index;