import { useMemo } from "react";
import type { DossierEntry } from "../types";
import { EntryCard } from "./EntryCard";
import { isToday, isThisWeek, startOfDay } from "date-fns";

interface EntryTimelineProps {
  entries: DossierEntry[];
  onPin?: (entryId: string, pinned: boolean) => void;
}

interface GroupedEntries {
  label: string;
  entries: DossierEntry[];
}

export function EntryTimeline({ entries, onPin }: EntryTimelineProps) {
  const grouped = useMemo(() => {
    // Pinned always first
    const pinned = entries.filter((e) => e.is_pinned);
    const unpinned = entries.filter((e) => !e.is_pinned);

    const groups: GroupedEntries[] = [];

    if (pinned.length > 0) {
      groups.push({ label: "📌 Angepinnt", entries: pinned });
    }

    const today: DossierEntry[] = [];
    const thisWeek: DossierEntry[] = [];
    const older: DossierEntry[] = [];

    for (const entry of unpinned) {
      const date = new Date(entry.created_at);
      if (isToday(date)) {
        today.push(entry);
      } else if (isThisWeek(date, { weekStartsOn: 1 })) {
        thisWeek.push(entry);
      } else {
        older.push(entry);
      }
    }

    if (today.length > 0) groups.push({ label: "Heute", entries: today });
    if (thisWeek.length > 0) groups.push({ label: "Diese Woche", entries: thisWeek });
    if (older.length > 0) groups.push({ label: "Älter", entries: older });

    return groups;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Noch keine Einträge
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            {group.label}
          </h4>
          {group.entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onPin={onPin} />
          ))}
        </div>
      ))}
    </div>
  );
}
