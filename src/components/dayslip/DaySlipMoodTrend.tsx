import { cn } from "@/lib/utils";
import { formatDate, type DaySlipStore } from "./dayslipTypes";
import { moodTrend } from "./daySlipState";

const MOOD_ICONS = ["😞", "🙁", "😐", "🙂", "😄"] as const;
const MOOD_LABELS = ["schlecht", "eher schlecht", "neutral", "gut", "sehr gut"] as const;
const MOOD_BARS = ["bg-palette-red", "bg-palette-amber", "bg-muted-foreground/40", "bg-palette-green/60", "bg-palette-green"] as const;

/** Narrow 14-day mood strip; days without a recorded mood stay as low neutral ticks. */
export function DaySlipMoodTrend({ store, todayKey }: { store: DaySlipStore; todayKey: string }) {
  const points = moodTrend(store, todayKey);
  const values = points.flatMap(point => (point.mood ? [point.mood] : []));
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Stimmung · 14 Tage</span>
        <span>{average === null ? "noch keine Werte" : `Ø ${average.toFixed(1)} von 5`}</span>
      </div>
      <div
        className="flex items-end gap-[3px]"
        role="img"
        aria-label={`Stimmungsverlauf der letzten 14 Tage, ${values.length} ${values.length === 1 ? "Tag" : "Tage"} erfasst`}
      >
        {points.map(point => (
          <div
            key={point.dayKey}
            className="flex h-6 flex-1 flex-col justify-end"
            title={`${formatDate(point.dayKey)}: ${point.mood ? `${MOOD_ICONS[point.mood - 1]} ${MOOD_LABELS[point.mood - 1]}` : "keine Stimmung erfasst"}`}
          >
            <span
              className={cn("w-full rounded-sm", point.mood ? MOOD_BARS[point.mood - 1] : "bg-muted")}
              style={{ height: point.mood ? 5 + point.mood * 4 : 3 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/80">
        <span>{points[0]?.weekday}</span>
        <span>{points[points.length - 1]?.weekday}</span>
      </div>
    </div>
  );
}
