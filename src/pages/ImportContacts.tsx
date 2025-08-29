import React from "react";
import { ContactImport } from "@/components/ContactImport";
import { Navigation } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function ImportContacts() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gradient-subtle">
        <Navigation activeSection="contacts" onSectionChange={() => {}} />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <ContactImport />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}