import { useDossierEntries, usePinEntry } from "../hooks/useDossierEntries";
import { useDossiers, useUpdateDossier } from "../hooks/useDossiers";
import { SmartCapture } from "./SmartCapture";
import { EntryTimeline } from "./EntryTimeline";
import { DossierLinksView } from "./DossierLinksView";
import { DossierSummaryTab } from "./DossierSummaryTab";
import { DossierBriefingTab } from "./DossierBriefingTab";
import { DossierQualityFields } from "./DossierQualityFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Settings2 } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";
import { DOSSIER_STATUS_OPTIONS, DOSSIER_PRIORITY_OPTIONS, ENTRY_TYPE_CONFIG, type EntryType } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DossierDetailViewProps {
  dossierId: string;
  onBack: () => void;
}

export function DossierDetailView({ dossierId, onBack }: DossierDetailViewProps) {
  const { data: dossiers } = useDossiers();
  const { data: entries, isLoading } = useDossierEntries(dossierId);
  const updateDossier = useUpdateDossier();
  const pinEntry = usePinEntry();
  const dossier = dossiers?.find((d) => d.id === dossierId);
  const [activeSection, setActiveSection] = useState("uebersicht");

  useEffect(() => {
    if (dossier?.title) {
      trackPageVisit(`dossier-${dossierId}`, dossier.title, 'Database', `/dossiers?id=${dossierId}`);
    }
  }, [dossierId, dossier?.title]);
  const [activeEntryFilter, setActiveEntryFilter] = useState("alle");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");

  const entryTypes = Object.keys(ENTRY_TYPE_CONFIG) as EntryType[];
  const filteredEntries = activeEntryFilter === "alle"
    ? entries
    : entries?.filter((e) => e.entry_type === activeEntryFilter);

  const openEdit = () => {
    if (!dossier) return;
    setEditTitle(dossier.title);
    setEditSummary(dossier.summary ?? "");
    setEditStatus(dossier.status);
    setEditPriority(dossier.priority);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    updateDossier.mutate(
      { id: dossierId, title: editTitle, summary: editSummary, status: editStatus, priority: editPriority },
      { onSuccess: () => setEditOpen(false) }
    );
  };

  const handlePin = useCallback((entryId: string, pinned: boolean) => {
    pinEntry.mutate({ entryId, pinned });
  }, [pinEntry]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{dossier?.title ?? "Dossier"}</h2>
          {dossier?.summary && <p className="text-sm text-muted-foreground line-clamp-1">{dossier.summary}</p>}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
          {dossier?.status}
        </span>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" onClick={openEdit}><Settings2 className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Dossier bearbeiten</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Titel" />
              <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} placeholder="Zusammenfassung" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {DOSSIER_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger><SelectValue placeholder="Priorität" /></SelectTrigger>
                  <SelectContent>
                    {DOSSIER_PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveEdit} disabled={updateDossier.isPending || !editTitle.trim()} className="w-full">
                {updateDossier.isPending ? <Loader2 className="animate-spin" /> : null}
                Speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Section tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="uebersicht">📋 Übersicht</TabsTrigger>
          <TabsTrigger value="eintraege">📝 Einträge</TabsTrigger>
          <TabsTrigger value="verknuepfungen">🔗 Verknüpfungen</TabsTrigger>
          <TabsTrigger value="briefing">📄 Briefing</TabsTrigger>
        </TabsList>

        {/* Übersicht (default) */}
        <TabsContent value="uebersicht" className="space-y-4">
          {dossier && <DossierSummaryTab dossier={dossier} recentEntries={entries} />}
        </TabsContent>

        {/* Einträge */}
        <TabsContent value="eintraege" className="space-y-4">
          <SmartCapture dossierId={dossierId} />

          {/* Entry type filter tabs */}
          <Tabs value={activeEntryFilter} onValueChange={setActiveEntryFilter}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="alle">Alle</TabsTrigger>
              {entryTypes.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {ENTRY_TYPE_CONFIG[t].icon} {ENTRY_TYPE_CONFIG[t].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
          ) : (
            <EntryTimeline entries={filteredEntries ?? []} onPin={handlePin} />
          )}
        </TabsContent>

        {/* Verknüpfungen */}
        <TabsContent value="verknuepfungen" className="space-y-4">
          <DossierLinksView dossierId={dossierId} />
          {dossier && <DossierQualityFields dossier={dossier} />}
        </TabsContent>

        {/* Briefing */}
        <TabsContent value="briefing" className="space-y-4">
          {dossier && <DossierBriefingTab dossier={dossier} entries={entries} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
