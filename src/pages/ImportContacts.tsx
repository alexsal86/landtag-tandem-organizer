import React from "react";
import { ContactImport } from "@/components/ContactImport";
import { Navigation } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function ImportContacts() {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gradient-subtle w-full">
        <Navigation activeSection="contacts" onSectionChange={() => {}} />
        <div className="p-6 max-w-6xl mx-auto">
          <ContactImport />
        </div>
      </div>
    </SidebarProvider>
  );
}