import React from "react";
import { ContactImport } from "@/components/ContactImport";
import { Navigation } from "@/components/Navigation";

export default function ImportContacts() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation activeSection="contacts" onSectionChange={() => {}} />
      <div className="p-6 max-w-6xl mx-auto">
        <ContactImport />
      </div>
    </div>
  );
}