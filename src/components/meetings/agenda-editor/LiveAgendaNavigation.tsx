import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LiveAgendaNavigation({ position, count, title, onMove, onStop, onArchive, busy }: {
  position: number;
  count: number;
  title?: string;
  onMove: (offset: number) => void;
  onStop: () => void;
  onArchive: () => void;
  busy: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b bg-card px-4 py-2">
      <div className="min-w-0 text-sm" role="status">
        {position >= 0 ? (
          <><span className="font-semibold text-success">Punkt {position + 1} von {count}</span>{title && ` · ${title}`}</>
        ) : "Keine Tagesordnungspunkte"}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy || position <= 0} onClick={() => onMove(-1)}>
          <ChevronLeft className="size-4" /> Zurück
        </Button>
        <Button size="sm" variant="outline" disabled={busy || position < 0 || position >= count - 1} onClick={() => onMove(1)}>
          Weiter <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onStop}>Unterbrechen</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={busy}>Beenden und archivieren</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Besprechung archivieren</AlertDialogTitle>
              <AlertDialogDescription>
                Die Besprechung wird beendet. Beschlossene Folgeaufgaben werden beim Archivieren erstellt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={onArchive}>Archivieren</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
