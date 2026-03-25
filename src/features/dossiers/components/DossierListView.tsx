import { useState } from "react";
import { useDossiers, useCreateDossier } from "../hooks/useDossiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface DossierListViewProps {
  onSelect?: (id: string) => void;
}

export function DossierListView({ onSelect }: DossierListViewProps) {
  const { data: dossiers, isLoading } = useDossiers();
  const createDossier = useCreateDossier();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const handleCreate = () => {
    if (!title.trim()) return;
    createDossier.mutate({ title, summary }, {
      onSuccess: () => { setOpen(false); setTitle(""); setSummary(""); },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Neues Dossier</Button>
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

      {!dossiers?.length ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <FolderOpen className="h-10 w-10" />
          <p className="text-sm">Noch keine Dossiers vorhanden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dossiers.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect?.(d.id)}
              className="w-full text-left rounded-md border border-border bg-card p-3 hover:bg-muted/50 transition-colors space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium truncate flex-1">{d.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{d.status}</span>
              </div>
              {d.summary && <p className="text-sm text-muted-foreground line-clamp-2">{d.summary}</p>}
              <p className="text-xs text-muted-foreground">
                Aktualisiert {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: de })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
