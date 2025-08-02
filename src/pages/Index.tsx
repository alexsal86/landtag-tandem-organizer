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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
      case "documents":
        return <DocumentsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          {/* Header with trigger */}
          <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="ml-4" />
          </header>
          
          <Navigation 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
          <main className="flex-1 pt-12">
            {renderActiveSection()}
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default Index;