import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "../types";
import { zombieAdvice, zombieSummary } from "@/features/meetings/zombiePoints";

/**
 * Zeigt die Punkte, die immer wieder verschoben werden, direkt über der Agenda.
 * Reine Anzeige – die Entscheidung selbst treffen die Beteiligten in der Sitzung.
 */
export function ZombiePointsNotice({ items, className }: { items: AgendaItem[]; className?: string }) {
  const { points, escalated } = zombieSummary(items);
  if (points.length === 0) return null;

  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950",
        "dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
        className,
      )}
      aria-label="Zombie-Punkte in dieser Agenda"
    >
      <div className="flex flex-wrap items-center gap-2 font-medium">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          {points.length === 1 ? "Ein Punkt wird immer wieder verschoben" : `${points.length} Punkte werden immer wieder verschoben`}
        </span>
        {escalated > 0 && <Badge variant="destructive">{escalated} eskaliert</Badge>}
      </div>
      <ul className="space-y-1">
        {points.slice(0, 5).map((point) => (
          <li key={`${point.item.title}-${point.count}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{point.item.title}</span>
            <span className="tabular-nums text-amber-800 dark:text-amber-200">
              {point.count}. Verschiebung
            </span>
            <span className="text-amber-800/90 dark:text-amber-200/90">{zombieAdvice(point.level)}</span>
          </li>
        ))}
      </ul>
      {points.length > 5 && (
        <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
          … und {points.length - 5} weitere. Bitte in dieser Sitzung entscheiden, beauftragen oder verwerfen.
        </p>
      )}
    </section>
  );
}
