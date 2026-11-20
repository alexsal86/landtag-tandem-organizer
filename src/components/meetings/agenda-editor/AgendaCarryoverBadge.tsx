import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "../types";

export function AgendaCarryoverBadge({ item }: {
  item: Pick<AgendaItem, "carryover_count" | "source_meeting_id" | "original_meeting_title">;
}) {
  const count = item.carryover_count || (item.source_meeting_id ? 1 : 0);
  if (!count) return null;

  return (
    <Badge
      variant="outline"
      title={item.original_meeting_title ?? undefined}
      className={cn(
        "shrink-0",
        count === 1 && "border-palette-blue/30 bg-palette-blue/10 text-palette-blue",
        count === 2 && "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200",
        count >= 3 && "border-red-300 bg-red-100 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200",
      )}
    >
      {count}. Verschiebung
    </Badge>
  );
}
