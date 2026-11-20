import { Checkbox } from "@/components/ui/checkbox";
import type { AgendaItem, Profile } from "../types";

export function AgendaRowDetails({ item, profiles, onComplete }: {
  item: AgendaItem;
  profiles: Profile[];
  onComplete?: (completed: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {item.source_meeting_id && (
        <span title={item.original_meeting_title ?? undefined} className="rounded-full bg-palette-blue/10 px-2 py-0.5 text-xs font-medium text-palette-blue">
          Übertragen
        </span>
      )}
      {item.carry_over_to_next && (
        <span className="rounded-full bg-palette-amber/10 px-2 py-0.5 text-xs font-medium text-palette-amber">
          Für nächstes Meeting
        </span>
      )}
      {(item.assigned_to ?? []).map((id) => {
        const name = profiles.find((profile) => profile.user_id === id)?.display_name || "Unbekannt";
        return (
          <span key={id} title={name} className="grid size-7 place-items-center rounded-full border border-border bg-muted text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
        );
      })}
      {!item.parent_id && !item.parentLocalKey && item.duration_minutes != null && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {item.duration_minutes} Min.
        </span>
      )}
      <Checkbox
        checked={item.is_completed}
        disabled={!onComplete}
        onCheckedChange={(checked) => onComplete?.(checked === true)}
        aria-label={`Erledigt: ${item.title || "Tagesordnungspunkt"}`}
        className="size-5 rounded-md"
      />
    </div>
  );
}
