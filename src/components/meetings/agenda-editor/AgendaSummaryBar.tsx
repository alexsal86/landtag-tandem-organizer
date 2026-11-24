import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { agendaTiming } from "./agendaTiming";
import { formatDeviation } from "./agendaElapsed";

export function AgendaSummaryBar({
  allCollapsed,
  onToggleAll,
  timing,
  actualTotal = 0,
  hideEmpty,
  onHideEmptyChange,
  onOpenCarryover,
}: {
  allCollapsed?: boolean;
  onToggleAll?: () => void;
  timing: ReturnType<typeof agendaTiming>;
  /** Summe der erfassten Ist-Minuten aller Hauptpunkte. */
  actualTotal?: number;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
  onOpenCarryover?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>{timing.main.length} {timing.main.length === 1 ? "Punkt" : "Punkte"}</strong>
        {timing.total > 0 && (
          <span className="rounded-full border px-2.5 py-1 tabular-nums text-muted-foreground">Σ {timing.total} Min.</span>
        )}
        {actualTotal > 0 && (
          <span className="rounded-full border px-2.5 py-1 tabular-nums text-muted-foreground">
            Ist {actualTotal} Min.{formatDeviation(actualTotal, timing.total) ? ` (${formatDeviation(actualTotal, timing.total)})` : ""}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs text-muted-foreground">
          <Checkbox checked={hideEmpty} onCheckedChange={(value) => onHideEmptyChange(value === true)} />
          Leere Bausteine ausblenden
        </label>
        {onOpenCarryover && <Button variant="outline" size="sm" onClick={onOpenCarryover}>Überträge</Button>}
        {onToggleAll && (
          <Button variant="outline" size="sm" onClick={onToggleAll}>
            {allCollapsed ? "Alles ausklappen" : "Alles einklappen"}
          </Button>
        )}
      </div>
    </div>
  );
}
