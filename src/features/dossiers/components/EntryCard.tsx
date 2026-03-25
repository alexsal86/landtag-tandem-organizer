import type { DossierEntry, EntryType } from "../types";
import { ENTRY_TYPE_CONFIG } from "../types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useDossiers } from "../hooks/useDossiers";
import { useAssignEntryToDossier } from "../hooks/useDossierEntries";
import { useDeleteEntry } from "../hooks/useDossierEntries";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, FolderInput, Check } from "lucide-react";
import { useState } from "react";

interface EntryCardProps {
  entry: DossierEntry;
  showAssign?: boolean;
}

export function EntryCard({ entry, showAssign = false }: EntryCardProps) {
  const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { label: entry.entry_type, icon: '📄' };
  const { data: dossiers } = useDossiers();
  const assignEntry = useAssignEntryToDossier();
  const deleteEntry = useDeleteEntry();
  const [assigning, setAssigning] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<string>("");

  const isInbox = entry.dossier_id === null;
  const emailMeta = entry.entry_type === "email" && entry.metadata
    ? entry.metadata as Record<string, unknown>
    : null;

  const handleAssign = () => {
    if (!selectedDossier) return;
    assignEntry.mutate(
      { entryId: entry.id, dossierId: selectedDossier },
      { onSuccess: () => { setAssigning(false); setSelectedDossier(""); } }
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5 group">
      <div className="flex items-center gap-2 text-sm">
        <span>{config.icon}</span>
        <span className="font-medium truncate flex-1">{entry.title || 'Ohne Titel'}</span>
        {!entry.is_curated && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0">roh</span>
        )}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: de })}
        </span>
      </div>

      {/* Email metadata */}
      {emailMeta && (
        <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
          {emailMeta.from ? <p>Von: {String(emailMeta.from)}</p> : null}
          {emailMeta.to ? <p>An: {String(emailMeta.to)}</p> : null}
          {emailMeta.date ? <p>Datum: {String(emailMeta.date)}</p> : null}
        </div>
      )}

      {entry.content && (
        <p className="text-sm text-muted-foreground line-clamp-3 pl-6">{entry.content}</p>
      )}
      {entry.source_url && (
        <a
          href={entry.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate block pl-6"
        >
          {entry.source_url}
        </a>
      )}
      {entry.file_name && (
        <p className="text-xs text-muted-foreground pl-6">📎 {entry.file_name}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isInbox && !assigning && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAssigning(true)}
          >
            <FolderInput className="h-3 w-3" /> Zuordnen
          </Button>
        )}
        {assigning && (
          <div className="flex items-center gap-1 flex-1">
            <Select value={selectedDossier} onValueChange={setSelectedDossier}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Dossier wählen …" />
              </SelectTrigger>
              <SelectContent>
                {dossiers?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleAssign}
              disabled={!selectedDossier || assignEntry.isPending}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto text-destructive/60 hover:text-destructive"
          onClick={() => deleteEntry.mutate(entry.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
