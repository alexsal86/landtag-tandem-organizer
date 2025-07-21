import { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { CalendarView } from "@/components/CalendarView";
import { ContactsView } from "@/components/ContactsView";
import { TasksView } from "@/components/TasksView";
import { SettingsView } from "@/components/SettingsView";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderActiveSection = () => {
    switch (activeSection) {
      case "calendar":
        return <CalendarView />;
      case "contacts":
        return <ContactsView />;
      case "tasks":
        return <TasksView />;
      case "documents":
        return (
          <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Dokumente</h1>
              <p className="text-muted-foreground">Dokumentenverwaltung wird bald verfügbar sein.</p>
            </div>
          </div>
        );
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen w-full bg-background">
        <Navigation 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
        />
        <main className="flex-1">
          {renderActiveSection()}
        </main>
      </div>
    </ThemeProvider>
  );
};

export default Index;