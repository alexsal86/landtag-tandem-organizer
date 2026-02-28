import { useMemo } from "react";
import { Calendar } from "lucide-react";

type RecurringTemplate = {
  id: string;
  text: string;
  weekday: string;
};

const GRID_DAYS = [
  { key: "monday", label: "Mo" },
  { key: "tuesday", label: "Di" },
  { key: "wednesday", label: "Mi" },
  { key: "thursday", label: "Do" },
  { key: "friday", label: "Fr" },
] as const;

interface WeeklyRoutineGridProps {
  recurringItems: RecurringTemplate[];
  onChangeWeekday: (id: string, newWeekday: string) => void;
}

export function WeeklyRoutineGrid({ recurringItems, onChangeWeekday }: WeeklyRoutineGridProps) {
  const columns = useMemo(() => {
    return GRID_DAYS.map((day) => {
      const items = recurringItems.filter(
        (item) => item.weekday === "all" || item.weekday === day.key
      );
      return { ...day, items };
    });
  }, [recurringItems]);

  const hasItems = recurringItems.length > 0;

  if (!hasItems) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        Wochenroutine
      </p>
      <div className="grid grid-cols-5 gap-2">
        {columns.map((col) => (
          <div key={col.key} className="min-h-[80px] rounded-md border border-border/60 bg-background/70 p-1.5 shadow-sm">
            <p className="mb-1 border-b border-border/60 pb-1 text-center text-[10px] font-semibold text-muted-foreground uppercase">
              {col.label}
            </p>
            <div className="space-y-1">
              {col.items.map((item) => (
                <div
                  key={`${col.key}-${item.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-routine-id", item.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab rounded border border-border/50 bg-muted/40 px-1.5 py-1 text-[10px] leading-tight text-foreground/80 hover:bg-muted/60 active:cursor-grabbing truncate"
                  title={`${item.text} (${item.weekday === "all" ? "Jeden Tag" : item.weekday})`}
                >
                  {item.text}
                </div>
              ))}
            </div>
            <div
              className="mt-1 min-h-[24px] rounded border border-dashed border-transparent transition-colors hover:border-border/40"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary/40", "bg-primary/5"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary/40", "bg-primary/5"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-primary/40", "bg-primary/5");
                const routineId = e.dataTransfer.getData("application/x-routine-id");
                if (routineId) {
                  onChangeWeekday(routineId, col.key);
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
