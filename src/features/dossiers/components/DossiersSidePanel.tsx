import { useMemo, useState } from "react";
import { Inbox, FolderOpen, FileText, Radio, ChevronRight, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { QuickCapture } from "./QuickCapture";
import { GlobalEntrySearch } from "./GlobalEntrySearch";
import { useInboxEntries } from "../hooks/useDossierEntries";
import { useDossiers } from "../hooks/useDossiers";
import type { Dossier } from "../types";

type DossierTab = "eingang" | "radar" | "dossiers" | "artikel";

interface DossiersSidePanelProps {
  activeTab: DossierTab;
  setActiveTab: (tab: DossierTab) => void;
  selectedDossierId: string | null;
  onSelectDossier: (id: string) => void;
}

export function DossiersSidePanel({
  activeTab,
  setActiveTab,
  selectedDossierId,
  onSelectDossier,
}: DossiersSidePanelProps) {
  const { data: inboxEntries } = useInboxEntries();
  const { data: dossiers } = useDossiers();

  const inboxCount = inboxEntries?.length ?? 0;
  const dossiersCount = dossiers?.length ?? 0;

  const tabs = [
    { key: "eingang" as DossierTab, label: "Eingang", icon: Inbox, count: inboxCount },
    { key: "radar" as DossierTab, label: "Mein Radar", icon: Radio, count: null },
    { key: "dossiers" as DossierTab, label: "Dossiers", icon: FolderOpen, count: dossiersCount },
    { key: "artikel" as DossierTab, label: "Artikel", icon: FileText, count: null },
  ];

  return (
    <div className="w-[280px] min-w-[280px] border-r border-border bg-background flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-lg font-bold text-foreground">Wissen</h1>
            <p className="text-xs text-muted-foreground">Dossiers, Artikel & Recherche</p>
          </div>

          {/* Quick Capture */}
          <QuickCapture />

          {/* Globale Eintragssuche (A) */}
          <GlobalEntrySearch onSelectDossier={onSelectDossier} />

          <Separator />

          {/* Navigation */}
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === tab.key && !selectedDossierId
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {tab.count !== null && (
                  <span className={`ml-auto text-xs ${
                    activeTab === tab.key && !selectedDossierId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Dossier list when in dossiers tab or detail view */}
          {(activeTab === "dossiers" || selectedDossierId) && dossiers && dossiers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-3 mb-1">Dossiers</p>
                {dossiers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onSelectDossier(d.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors truncate ${
                      selectedDossierId === d.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
