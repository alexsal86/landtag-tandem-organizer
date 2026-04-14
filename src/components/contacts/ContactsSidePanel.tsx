import { Link } from "react-router-dom";
import { Search, Plus, Building, User, Users, Archive, Network, Tag, Copy } from "lucide-react";
import type { ContactsTab } from "./hooks/useContactsViewPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";

interface ContactsSidePanelProps {
  activeTab: string;
  setActiveTab: (tab: ContactsTab) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedTagFilter: string;
  setSelectedTagFilter: (val: string) => void;
  contactsCount: number;
  stakeholdersCount: number;
  distributionListsCount: number;
  archiveCount: number;
  navigate: (path: string) => void;
  setCreatingDistribution: (val: boolean) => void;
  setIsDuplicateSheetOpen: (val: boolean) => void;
  selectedContactId: string | null;
  setSelectedContactId: (id: string | null) => void;
  refreshContacts: () => void;
}

export function ContactsSidePanel({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  selectedTagFilter,
  setSelectedTagFilter,
  contactsCount,
  stakeholdersCount,
  distributionListsCount,
  archiveCount,
  navigate,
  setCreatingDistribution,
  setIsDuplicateSheetOpen,
  selectedContactId,
  setSelectedContactId,
  refreshContacts,
}: ContactsSidePanelProps) {
  if (selectedContactId) {
    return (
      <div className="w-[40%] min-w-[420px] border-r border-border bg-background overflow-hidden flex flex-col">
        <ContactDetailPanel
          contactId={selectedContactId}
          onClose={() => setSelectedContactId(null)}
          onContactUpdate={refreshContacts}
        />
      </div>
    );
  }

  const tabs = [
    { key: "contacts", label: "Kontakte", icon: User, count: contactsCount, path: "/contacts" },
    { key: "stakeholders", label: "Stakeholder", icon: Building, count: stakeholdersCount, path: "/contacts/stakeholder" },
    { key: "stakeholder-network", label: "Netzwerk", icon: Network, count: null, path: "/contacts/netzwerk" },
    { key: "distribution-lists", label: "Verteiler", icon: Users, count: distributionListsCount, path: "/contacts" },
    { key: "archive", label: "Archiv", icon: Archive, count: archiveCount, path: "/contacts" },
  ];

  return (
    <div className="w-[280px] min-w-[280px] border-r border-border bg-background flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-lg font-bold text-foreground">Kontakte</h1>
            <p className="text-xs text-muted-foreground">Kontakte, Organisationen & Beziehungen</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Link to="/contacts/new">
              <Button className="w-full gap-2" size="sm">
                <Plus className="h-4 w-4" />Neuer Kontakt
              </Button>
            </Link>
            {activeTab === "distribution-lists" && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setCreatingDistribution(true)}>
                <Plus className="h-4 w-4" />Neuer Verteiler
              </Button>
            )}
          </div>

          {/* Search */}
          {activeTab !== "stakeholder-network" && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          )}

          {/* Tag filter */}
          {selectedTagFilter && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 rounded-md text-sm">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium truncate">{selectedTagFilter}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTagFilter("")} className="h-auto p-0 ml-auto text-muted-foreground hover:text-foreground">×</Button>
            </div>
          )}

          <Separator />

          {/* Tabs */}
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === "stakeholders") {
                    navigate("/contacts/stakeholder");
                  } else if (tab.key === "stakeholder-network") {
                    navigate("/contacts/netzwerk");
                  } else {
                    setActiveTab(tab.key as ContactsTab);
                    navigate("/contacts");
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {tab.count !== null && (
                  <span className={`ml-auto text-xs ${activeTab === tab.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <Separator />

          {/* Tools */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-3 mb-1">Werkzeuge</p>
            <button
              onClick={() => setIsDuplicateSheetOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Copy className="h-4 w-4 shrink-0" />
              <span>Duplikate prüfen</span>
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
