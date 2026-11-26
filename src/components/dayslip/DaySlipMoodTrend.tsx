import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timeout = window.setTimeout(() => setCompact(true), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  const transition = { duration: reduceMotion ? 0 : 0.4, ease: "easeInOut" as const };
  const points = moodTrend(store, todayKey);
  const values = points.flatMap(point => (point.mood ? [point.mood] : []));
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const actionRow = moodPicker ? (compact ? "row-start-2" : "row-start-3") : (compact ? "row-start-1" : "row-start-2");
  const averageLabel = average === null ? "Ø —" : `Ø ${average.toFixed(1)}`;
  const averageDescription = average === null ? "noch keine Werte" : `${averageLabel} von 5`;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <motion.div
        layout={!reduceMotion}
        transition={transition}
        className={cn(
          "relative min-w-0 overflow-hidden rounded-lg border border-border/60 px-3",
          compact ? cn("col-start-1 flex items-center", actionRow) : "col-span-2 row-start-1 py-2",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {compact ? (
            <motion.span
              key="average"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground"
              aria-label={`Durchschnittliche Stimmung der letzten 14 Tage, ${averageDescription}`}
              title={`Stimmung · 14 Tage · ${averageDescription}`}
            >
              {averageLabel}
            </motion.span>
          ) : (
            <motion.div key="trend" exit={{ opacity: 0 }} transition={transition} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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
              <div className="flex justify-between text-[9px] text-muted-foreground/80">
                <span>{points[0]?.weekday}</span>
                <span>{points[points.length - 1]?.weekday}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {moodPicker && (
        <motion.div
          layout={!reduceMotion}
          transition={transition}
          className={cn("col-span-2", compact ? "row-start-1" : "row-start-2")}
        >
          {moodPicker}
        </motion.div>
      )}
      <motion.div
        layout={!reduceMotion}
        transition={transition}
        className={cn("min-w-0", actionRow, compact ? "col-start-2" : "col-span-2")}
      >
        {children}
      </motion.div>
    </div>
  );
}
