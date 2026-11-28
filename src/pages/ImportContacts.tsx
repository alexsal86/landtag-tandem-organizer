import { ContactImport } from "@/features/contacts/components/ContactImport";
import { DesktopSidebar } from "@/components/navigation/appNavigation/DesktopSidebar";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { WorkspaceToolbar } from "@/components/layout/WorkspaceToolbar";

export default function ImportContacts() {
  return (
    <div className="flex h-app w-full bg-background">
      <DesktopSidebar activeSection="contacts" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <WorkspaceToolbar />
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-6" tabIndex={-1}>
          <div className="mx-auto max-w-6xl"><ContactImport /></div>
        </main>
      </div>
    </div>
  );
}
