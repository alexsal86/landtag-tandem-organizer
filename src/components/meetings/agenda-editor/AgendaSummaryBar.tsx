import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { agendaTiming } from "./agendaTiming";
export function AgendaSummaryBar({
  allCollapsed,
  onToggleAll,
  timing,
  hideEmpty,
  onHideEmptyChange,
}: {
  allCollapsed?: boolean;
  onToggleAll?: () => void;
  timing: ReturnType<typeof agendaTiming>;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
}) {
  return (
    <div className="-mx-2 mb-2 overflow-hidden border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <span>
          <b>{timing.main.length}</b> Punkte
        </span>
        {timing.total > 0 && (
          <>
            <span>
              <b>{timing.total} min</b> geplant
            </span>
            {timing.end && (
              <span>
                Ende ca. <b>{timing.end}</b>
              </span>
            )}
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <Checkbox
            checked={hideEmpty}
            onCheckedChange={(value) => onHideEmptyChange(value === true)}
          />
          Leere Bausteine ausblenden
        </label>
        {onToggleAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onToggleAll}
          >
            {allCollapsed ? "Alles ausklappen" : "Alles einklappen"}
          </Button>
        )}
      </div>
      {timing.total > 0 && (
        <div
          className="mx-3 flex h-1 gap-0.5"
          aria-label="Zeitanteile der Hauptpunkte"
        >
          {timing.main.map((item, index) => (
            <span
              key={item.localKey || item.id || index}
              className={
                [
                  "bg-agenda-appointments",
                  "bg-agenda-notes",
                  "bg-agenda-tasks",
                  "bg-agenda-decisions",
                ][index % 4]
              }
              style={{
                width: `${(Math.max(0, item.duration_minutes ?? 0) / timing.total) * 100}%`,
              }}
              title={`${item.title}: ${item.duration_minutes ?? 0} min`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
