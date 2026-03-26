import { useState, useMemo } from "react";
import { useDossiers, useCreateDossier } from "../hooks/useDossiers";
import { DossierCard } from "./DossierCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, FolderOpen, Search, ArrowUpDown } from "lucide-react";
import { isPast } from "date-fns";
import { DOSSIER_STATUS_OPTIONS, DOSSIER_PRIORITY_OPTIONS } from "../types";

interface DossierListViewProps {
  onSelect?: (id: string) => void;
}

type SortField = "updated_at" | "title" | "priority" | "status";

export function DossierListView({ onSelect }: DossierListViewProps) {
  const { data: dossiers, isLoading } = useDossiers();
  const createDossier = useCreateDossier();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [filterPriority, setFilterPriority] = useState<string>("alle");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredAndSorted = useMemo(() => {
    if (!dossiers) return [];
    let result = [...dossiers];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.summary?.toLowerCase().includes(q) ?? false)
      );
    }

    if (filterStatus !== "alle") {
      result = result.filter((d) => d.status === filterStatus);
    }

    if (filterPriority !== "alle") {
      result = result.filter((d) => d.priority === filterPriority);
    }

    const priorityOrder: Record<string, number> = { hoch: 0, mittel: 1, niedrig: 2 };
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, "de");
          break;
        case "priority":
          cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status, "de");
          break;
        case "updated_at":
        default:
          cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
      }
      return sortAsc ? -cmp : cmp;
    });

    return result;
  }, [dossiers, searchTerm, filterStatus, filterPriority, sortField, sortAsc]);

  const handleCreate = () => {
    if (!title.trim()) return;
    createDossier.mutate(
      { title, summary },
      { onSuccess: () => { setOpen(false); setTitle(""); setSummary(""); } }
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Dossier suchen …"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Neu</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Dossier anlegen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Kurzbeschreibung (optional)" value={summary} onChange={(e) => setSummary(e.target.value)} />
                <Button onClick={handleCreate} disabled={createDossier.isPending || !title.trim()} className="w-full">
                  {createDossier.isPending ? <Loader2 className="animate-spin" /> : null}
                  Erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {DOSSIER_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[120px]">
              <SelectValue placeholder="Priorität" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Prioritäten</SelectItem>
              {DOSSIER_PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => toggleSort(sortField === "updated_at" ? "title" : sortField === "title" ? "priority" : "updated_at")}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortField === "updated_at" ? "Datum" : sortField === "title" ? "Name" : sortField === "priority" ? "Priorität" : "Status"}
          </Button>
        </div>
      </div>

      {/* Cards */}
      {!filteredAndSorted.length ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <FolderOpen className="h-10 w-10" />
          <p className="text-sm">
            {dossiers?.length ? "Keine Dossiers für diesen Filter" : "Noch keine Dossiers vorhanden"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSorted.map((d) => (
            <DossierCard key={d.id} dossier={d} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
