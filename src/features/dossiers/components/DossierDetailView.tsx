import { useDossierEntries } from "../hooks/useDossierEntries";
import { useDossiers } from "../hooks/useDossiers";
import { QuickCapture } from "./QuickCapture";
import { EntryCard } from "./EntryCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface DossierDetailViewProps {
  dossierId: string;
  onBack: () => void;
}

export function DossierDetailView({ dossierId, onBack }: DossierDetailViewProps) {
  const { data: dossiers } = useDossiers();
  const { data: entries, isLoading } = useDossierEntries(dossierId);
  const dossier = dossiers?.find((d) => d.id === dossierId);

  return (
    <div className="space-y-4">
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
      </div>

      <QuickCapture dossierId={dossierId} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        </div>
      ) : !entries?.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">Noch keine Einträge in diesem Dossier</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
