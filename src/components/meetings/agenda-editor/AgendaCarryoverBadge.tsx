import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { carryoverCount, zombieAdvice, zombieLevel } from "@/features/meetings/zombiePoints";

export function AgendaCarryoverBadge({ item }: {
  item: { carryover_count?: number | null; source_meeting_id?: string | null; original_meeting_title?: string | null };
}) {
  const count = carryoverCount(item);
  if (!count) return null;

  const level = zombieLevel(item);
  const isZombie = level === "zombie" || level === "escalated";

  return (
    <Badge
      variant="outline"
      title={[item.original_meeting_title, zombieAdvice(level)].filter(Boolean).join(" · ") || undefined}
      className={cn(
        "shrink-0",
        count === 1 && "border-palette-blue/30 bg-palette-blue/10 text-palette-blue",
        count === 2 && "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200",
        count >= 3 && "border-red-300 bg-red-100 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200",
        level === "escalated" && "font-semibold",
      )}
    >
      {isZombie ? `${count}× · Zombie-Punkt` : `${count}. Verschiebung`}
    </Badge>
  );
}
