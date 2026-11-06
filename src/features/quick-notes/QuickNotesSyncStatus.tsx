import { Cloud, CloudOff, CloudUpload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuickNotesData } from "./useQuickNotesData";
import { getErrorMessage } from "@/utils/errorHandler";
import { notify } from "@/lib/notify";

function useSyncLabel() {
  const { sync } = useQuickNotesData();
  const label = !sync.online ? "Offline – Notizen werden auf diesem Gerät gespeichert" :
    sync.syncing ? "Notizen werden synchronisiert…" :
    sync.writes.length ? `${sync.writes.length} Änderung(en) warten auf Synchronisierung` : "Alle Notizen synchronisiert";
  const state = !sync.online ? "offline" : sync.syncing || sync.writes.length ? "pending" : "ok";
  return { label, state };
}

export function QuickNotesSyncIndicator() {
  const { label, state } = useSyncLabel();
  const Icon = state === "offline" ? CloudOff : state === "pending" ? CloudUpload : Cloud;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="status" aria-label={label} tabIndex={0} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", state === "offline" && "text-warning")}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function QuickNotesSyncStatus() {
  const { sync, error, repository } = useQuickNotesData();
  const failed = sync.writes.filter(write => write.status !== "pending");
  if (!sync.error && !error && failed.length === 0) return null;
  return <div className="space-y-2 text-xs text-muted-foreground">
    {(sync.error || error) && <p role="alert" className="text-destructive">{sync.error || getErrorMessage(error)}</p>}
    {failed.map(write => <div key={write.id} className="rounded-md border border-destructive/40 p-3 space-y-2">
      <p className="font-medium">{write.title?.replace(/<[^>]*>/g, "") || "Notiz ohne Titel"}: {write.status === "conflict" ? "Inzwischen an anderer Stelle geändert. Dein Text bleibt lokal erhalten." : write.error}</p>
      <div className="flex flex-wrap gap-2">
        {write.status !== "conflict" && <Button size="sm" variant="outline" disabled={sync.syncing} onClick={() => void repository.retry(write).catch(e => notify.error(getErrorMessage(e)))}>Erneut versuchen</Button>}
        <Button size="sm" variant="outline" disabled={sync.syncing} onClick={() => void repository.rescue(write).catch(e => notify.error(getErrorMessage(e)))}>Meinen Text als neue Notiz sichern</Button>
      </div>
    </div>)}
  </div>;
}
