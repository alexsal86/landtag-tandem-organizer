import { useInboxEntries } from "../hooks/useDossierEntries";
import { QuickCapture } from "./QuickCapture";
import { EntryCard } from "./EntryCard";
import { Loader2, Inbox } from "lucide-react";
import type { DossierEntry } from "../types";

export function InboxView() {
  const { data: entries, isLoading } = useInboxEntries();

  return (
    <div className="space-y-4">
      <QuickCapture />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        </div>
      ) : !entries?.length ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">Noch keine Einträge im Eingang</p>
          <p className="text-xs">Erfasse oben eine Notiz, einen Link oder eine Datei</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: DossierEntry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
