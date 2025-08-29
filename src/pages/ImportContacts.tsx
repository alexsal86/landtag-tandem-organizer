import React from "react";
import { ContactImport } from "@/components/ContactImport";
import { Navigation } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

export default function ImportContacts() {
  const navigate = useNavigate();

  const handleSectionChange = (section: string) => {
    switch (section) {
      case "dashboard":
        navigate("/");
        break;
      case "contacts":
        navigate("/contacts");
        break;
      case "calendar":
        navigate("/calendar");
        break;
      case "tasks":
        navigate("/tasks");
        break;
      case "meetings":
        navigate("/meetings");
        break;
      case "eventplanning":
        navigate("/event-planning");
        break;
      case "documents":
        navigate("/documents");
        break;
      case "knowledge":
        navigate("/knowledge");
        break;
      case "settings":
        navigate("/settings");
        break;
      case "time":
        navigate("/time-tracking");
        break;
      case "employee":
        navigate("/employees");
        break;
      case "administration":
        navigate("/administration");
        break;
      default:
        navigate("/");
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gradient-subtle w-full">
        <Navigation activeSection="contacts" onSectionChange={handleSectionChange} />
        <main className="flex-1 overflow-hidden">
          <div className="h-full p-6">
            <div className="max-w-6xl mx-auto h-full">
              <ContactImport />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}