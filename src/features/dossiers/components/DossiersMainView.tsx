import { useState, useCallback, Suspense } from "react";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";
import { InboxView } from "./InboxView";
import { DossierListView } from "./DossierListView";
import { DossierDetailView } from "./DossierDetailView";
import { DossiersSidePanel } from "./DossiersSidePanel";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Loader2 } from "lucide-react";

const KnowledgeBaseView = lazyWithRetry(() => import("@/components/KnowledgeBaseView"));

type DossierTab = "eingang" | "dossiers" | "artikel";

const DOSSIER_TAB_LABELS: Record<DossierTab, string> = {
  eingang: "Eingang",
  dossiers: "Dossiers",
  artikel: "Artikel",
};

export function DossiersMainView() {
  const [activeTab, setActiveTab] = useState<DossierTab>("eingang");
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);

  const handleTabChange = useCallback((tab: DossierTab) => {
    setActiveTab(tab);
    setSelectedDossierId(null);
    const label = DOSSIER_TAB_LABELS[tab];
    trackPageVisit(`dossiers-${tab}`, `Wissen › ${label}`, "Database", `/dossiers?tab=${tab}`);
  }, []);

  const handleSelectDossier = (id: string) => {
    setSelectedDossierId(id);
    setActiveTab("dossiers");
  };

  const handleBack = () => {
    setSelectedDossierId(null);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <DossiersSidePanel
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        selectedDossierId={selectedDossierId}
        onSelectDossier={handleSelectDossier}
      />

      <div className="flex-1 overflow-auto">
        {selectedDossierId ? (
          <DossierDetailView dossierId={selectedDossierId} onBack={handleBack} />
        ) : activeTab === "eingang" ? (
          <InboxView />
        ) : activeTab === "dossiers" ? (
          <DossierListView onSelect={handleSelectDossier} />
        ) : (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>}>
            <KnowledgeBaseView />
          </Suspense>
        )}
      </div>
    </div>
  );
}
