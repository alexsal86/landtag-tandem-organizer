import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDate, type DaySlipStore } from "./dayslipTypes";
import { moodTrend } from "./daySlipState";

const MOOD_ICONS = ["😞", "🙁", "😐", "🙂", "😄"] as const;
const MOOD_LABELS = ["schlecht", "eher schlecht", "neutral", "gut", "sehr gut"] as const;
const MOOD_BARS = ["bg-palette-red", "bg-palette-amber", "bg-muted-foreground/40", "bg-palette-green/60", "bg-palette-green"] as const;

/** Show the 14-day trend before folding it into the day-end action row. */
export function DaySlipMoodTrend({
  store,
  todayKey,
  moodPicker,
  children,
}: {
  store: DaySlipStore;
  todayKey: string;
  moodPicker: ReactNode;
  children: ReactNode;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCompact(true), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  const points = moodTrend(store, todayKey);
  const values = points.flatMap(point => (point.mood ? [point.mood] : []));
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const averageLabel = average === null ? "Ø —" : `Ø ${average.toFixed(1)}`;
  const averageDescription = average === null ? "noch keine Werte" : `${averageLabel} von 5`;

  return (
    <div className="space-y-2 [--mood-compact-width:4.5rem] [--mood-trend-height:5rem]">
      {moodPicker}
      <div>
        {/* Shrink the space in normal flow so the content above the footer moves with the card. */}
        <div
          aria-hidden="true"
          className={cn("motion-safe:transition-[height] motion-safe:duration-700 motion-safe:ease-in-out",
            compact ? "h-0" : "h-[calc(var(--mood-trend-height)_+_0.5rem)]",
          )}
        />
        <div className="relative">
          <div
            className={cn(
              "absolute left-0 overflow-hidden rounded-lg border border-border/60 bg-background",
              "motion-safe:[transition:width_400ms_ease-in-out,bottom_500ms_ease-in-out_200ms,height_500ms_ease-in-out_200ms]",
              compact
                ? "bottom-0 h-full w-[var(--mood-compact-width)]"
                : "bottom-[calc(100%_+_0.5rem)] h-[var(--mood-trend-height)] w-full",
            )}
          >
            <div
              aria-hidden={compact}
              className={cn(
                "absolute inset-x-3 top-2 space-y-1 whitespace-nowrap",
                "motion-safe:transition-opacity motion-safe:duration-200",
                compact && "pointer-events-none opacity-0",
              )}
            >
              <div className="flex items-center justify-between text-[10px] leading-4 text-muted-foreground">
                <span>Stimmung · 14 Tage</span>
                <span>{averageDescription}</span>
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
              <div className="flex justify-between text-[9px] leading-3 text-muted-foreground/80">
                <span>{points[0]?.weekday}</span>
                <span>{points[points.length - 1]?.weekday}</span>
              </div>
            </div>
            <span
              aria-hidden={!compact}
              className={cn(
                "absolute inset-0 grid place-items-center whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground",
                "motion-safe:transition-opacity motion-safe:duration-300",
                compact ? "motion-safe:delay-[400ms]" : "pointer-events-none opacity-0",
              )}
              title={`Stimmung · 14 Tage · ${averageDescription}`}
            >
              <span aria-hidden="true">{averageLabel}</span>
              <span className="sr-only">Durchschnittliche Stimmung der letzten 14 Tage, {averageDescription}</span>
            </span>
          </div>
          <div
            className={cn(
              "motion-safe:transition-[margin-left] motion-safe:duration-[400ms] motion-safe:ease-in-out",
              compact && "ml-[calc(var(--mood-compact-width)_+_0.5rem)]",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
