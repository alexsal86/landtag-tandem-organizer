import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InboxView } from "./InboxView";
import { DossierListView } from "./DossierListView";
import { DossierDetailView } from "./DossierDetailView";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

const KnowledgeBaseView = lazyWithRetry(() => import("@/components/KnowledgeBaseView"));

export function DossiersMainView() {
  const [activeTab, setActiveTab] = useState("eingang");
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);

  const handleSelectDossier = (id: string) => {
    setSelectedDossierId(id);
  };

  const handleBack = () => {
    setSelectedDossierId(null);
  };

  // If a dossier is selected, show its detail view
  if (selectedDossierId) {
    return <DossierDetailView dossierId={selectedDossierId} onBack={handleBack} />;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="eingang">📥 Eingang</TabsTrigger>
          <TabsTrigger value="dossiers">📁 Dossiers</TabsTrigger>
          <TabsTrigger value="artikel">📄 Artikel</TabsTrigger>
        </TabsList>

        <TabsContent value="eingang">
          <InboxView />
        </TabsContent>

        <TabsContent value="dossiers">
          <DossierListView onSelect={handleSelectDossier} />
        </TabsContent>

        <TabsContent value="artikel">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>}>
            <KnowledgeBaseView />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
