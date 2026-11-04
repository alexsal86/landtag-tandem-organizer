import { Button } from "@/components/ui/button";
import { useQuickNotesData } from "./useQuickNotesData";
import { getErrorMessage } from "@/utils/errorHandler";
import { notify } from "@/lib/notify";

export function QuickNotesSyncStatus() {
  const { sync, error, repository } = useQuickNotesData();
  const failed = sync.writes.filter(write => write.status !== "pending");
  const label = !sync.online ? "Offline – Notizen werden auf diesem Gerät gespeichert" :
    sync.syncing ? "Notizen werden synchronisiert…" :
    sync.writes.length ? `${sync.writes.length} Änderung(en) warten auf Synchronisierung` : "Alle Notizen synchronisiert";
  return <div className="space-y-2 text-xs text-muted-foreground">
    <p role="status">{label}</p>
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
