import { useMemo, useState } from "react";
import type { DossierEntry } from "../types";
import { EntryCard } from "./EntryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { isToday, isThisWeek } from "date-fns";

interface EntryTimelineProps {
  entries: DossierEntry[];
  onPin?: (entryId: string, pinned: boolean) => void;
  /** External tag filter (E) */
  tagFilter?: string | null;
  onTagClick?: (tag: string) => void;
}

interface GroupedEntries {
  label: string;
  entries: DossierEntry[];
}

export function EntryTimeline({ entries, onPin, tagFilter, onTagClick }: EntryTimelineProps) {
  const [search, setSearch] = useState("");
  const trimmed = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    let result = entries;
    if (tagFilter) {
      result = result.filter((e) => e.tags.includes(tagFilter));
    }
    if (trimmed.length >= 2) {
      result = result.filter((e) =>
        (e.title?.toLowerCase().includes(trimmed) ?? false) ||
        (e.content?.toLowerCase().includes(trimmed) ?? false) ||
        e.tags.some((t) => t.includes(trimmed))
      );
    }
    return result;
  }, [entries, trimmed, tagFilter]);

  const grouped = useMemo(() => {
    const pinned = filtered.filter((e) => e.is_pinned);
    const unpinned = filtered.filter((e) => !e.is_pinned);

    const groups: GroupedEntries[] = [];

    if (pinned.length > 0) {
      groups.push({ label: "📌 Angepinnt", entries: pinned });
    }

    const today: DossierEntry[] = [];
    const thisWeek: DossierEntry[] = [];
    const older: DossierEntry[] = [];

    for (const entry of unpinned) {
      const date = new Date(entry.created_at);
      if (isToday(date)) today.push(entry);
      else if (isThisWeek(date, { weekStartsOn: 1 })) thisWeek.push(entry);
      else older.push(entry);
    }

    if (today.length > 0) groups.push({ label: "Heute", entries: today });
    if (thisWeek.length > 0) groups.push({ label: "Diese Woche", entries: thisWeek });
    if (older.length > 0) groups.push({ label: "Älter", entries: older });

    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Inline search (C) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="In Einträgen suchen …"
            className="pl-8 h-8 text-sm"
          />
        </div>
        {tagFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => onTagClick?.(tagFilter)}
          >
            <span className="text-primary">#{tagFilter}</span>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Noch keine Einträge
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Keine Treffer für „{search || tagFilter}“
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.label} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              {group.label}
            </h4>
            {group.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onPin={onPin}
                highlight={trimmed.length >= 2 ? trimmed : undefined}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
