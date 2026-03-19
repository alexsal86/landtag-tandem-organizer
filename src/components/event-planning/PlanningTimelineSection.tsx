import { useCallback, useMemo, useRef, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Flag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Droppable } from "@hello-pangea/dnd";
import type { ChecklistItem, EventPlanningDate, EventPlanningTimelineAssignment } from "./types";
import { useTimelineGeometry } from "./useTimelineGeometry";

const MIN_ENTRY_GAP_PX = 18;
const TARGET_TIMELINE_HEIGHT_PX = 560;
const DOT_SIZE_CLASS = "h-5 w-5";
const DOT_LEFT_CLASS = "-left-7";

interface PlanningTimelineSectionProps {
  planningCreatedAt?: string | null;
  planningDates: EventPlanningDate[];
  checklistItems: ChecklistItem[];
  assignments: EventPlanningTimelineAssignment[];
  onRemoveAssignment: (checklistItemId: string) => void;
  checklistItemRefs?: Record<string, RefObject<HTMLDivElement | null>>;
}

function formatTimelineDate(date: Date) {
  const hasExplicitTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  return format(date, hasExplicitTime ? "dd.MM.yyyy, HH:mm" : "dd.MM.yyyy", { locale: de });
}

type TimelineEntry = {
  id: string;
  checklistItemId?: string;
  date: Date;
  title: string;
  type: "known" | "checklist";
  isConfirmed?: boolean;
  isCompleted?: boolean;
};

export function PlanningTimelineSection({
  planningCreatedAt,
  planningDates,
  checklistItems,
  assignments,
  onRemoveAssignment,
  checklistItemRefs,
}: PlanningTimelineSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const timelineListRef = useRef<HTMLDivElement | null>(null);
  const timelinePointRefs = useRef(new Map<string, HTMLSpanElement>());

  const entries = useMemo<TimelineEntry[]>(() => {
    const planningStartEntry: TimelineEntry[] = planningCreatedAt
      ? [{
          id: "planning-start",
          date: new Date(planningCreatedAt),
          title: "Planungsbeginn",
          type: "known",
          isConfirmed: true,
        }]
      : [];

    const knownEntries: TimelineEntry[] = planningDates
      .filter((d) => !!d.date_time)
      .map((d) => ({
        id: `known-${d.id}`,
        date: new Date(d.date_time),
        title: d.is_confirmed ? "Bestätigter Termin" : "Geplanter Termin",
        type: "known",
        isConfirmed: d.is_confirmed,
      }));

    const assignmentEntries = assignments
      .map((assignment) => {
        const checklistItem = checklistItems.find((item) => item.id === assignment.checklist_item_id);
        if (!checklistItem) return null;

        return {
          id: `item-${assignment.checklist_item_id}`,
          checklistItemId: assignment.checklist_item_id,
          date: new Date(assignment.due_date),
          title: checklistItem.title,
          type: "checklist" as const,
          isCompleted: checklistItem.is_completed,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null) as TimelineEntry[];

    return [...planningStartEntry, ...knownEntries, ...assignmentEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assignments, checklistItems, planningCreatedAt, planningDates]);

  const now = Date.now();

  const timelineProgress = useMemo(() => {
    if (entries.length < 2) return null;
    const start = entries[0].date.getTime();
    const end = entries[entries.length - 1].date.getTime();
    if (end <= start) return null;
    const raw = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [entries, now]);

  const entrySpacings = useMemo(() => {
    if (entries.length === 0) {
      return [];
    }

    if (entries.length === 1) {
      return [0];
    }

    const firstTimestamp = entries[0].date.getTime();
    const lastTimestamp = entries[entries.length - 1].date.getTime();
    const totalDuration = Math.max(1, lastTimestamp - firstTimestamp);

    const proportionalOffsets = entries.map((entry) => {
      const elapsed = Math.max(0, entry.date.getTime() - firstTimestamp);
      return Math.round((elapsed / totalDuration) * TARGET_TIMELINE_HEIGHT_PX);
    });

    const resolvedOffsets = proportionalOffsets.reduce<number[]>((offsets, offset, index) => {
      if (index === 0) {
        offsets.push(0);
        return offsets;
      }

      offsets.push(Math.max(offset, offsets[index - 1] + MIN_ENTRY_GAP_PX));
      return offsets;
    }, []);

    return resolvedOffsets.map((offset, index) => {
      if (index === 0) {
        return 0;
      }

      return offset - resolvedOffsets[index - 1];
    });
  }, [entries]);

  const { connectorLines, timelineAxis } = useTimelineGeometry({
    sectionRef,
    timelineListRef,
    timelinePointRefs,
    checklistItemRefs,
    assignments,
    entries,
  });

  const setTimelinePointRef = useCallback((entryId: string, element: HTMLSpanElement | null) => {
    if (element) {
      timelinePointRefs.current.set(entryId, element);
      return;
    }

    timelinePointRefs.current.delete(entryId);
  }, []);

  return (
    <div ref={sectionRef} className="relative">
      {connectorLines.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden>
          {connectorLines.map((line) => {
            const controlOffset = Math.max(40, Math.abs(line.endX - line.startX) * 0.35);
            const path = `M ${line.startX} ${line.startY} C ${line.startX + controlOffset} ${line.startY}, ${line.endX - controlOffset} ${line.endY}, ${line.endX} ${line.endY}`;
            return <path key={line.assignmentId} d={path} fill="none" stroke="hsl(var(--primary) / 0.55)" strokeWidth={1.5} strokeDasharray="4 4" />;
          })}
        </svg>
      )}

      <Droppable droppableId="planning-timeline">
        {(provided, snapshot) => (
          <Card
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`bg-card shadow-card border-border transition-colors ${
              snapshot.isDraggingOver ? "bg-primary/5 ring-1 ring-primary/30" : ""
            }`}
          >
            <CardHeader>
              <CardTitle>Zeitstrahl</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Checklisten-Punkt auf diese Karte ziehen, um ihn mit einer Frist im Zeitstrahl zu planen.
                </p>

                <div ref={timelineListRef} className="relative pl-6">
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Noch keine Termine im Zeitstrahl.</p>
                  ) : (
                    <>
                      {timelineAxis && (
                        <span
                          className="absolute w-0.5 bg-border"
                          style={{
                            left: `${timelineAxis.left}px`,
                            top: `${timelineAxis.top}px`,
                            height: `${timelineAxis.height}px`,
                          }}
                        />
                      )}
                      {timelineProgress !== null && timelineAxis && (
                        <div
                          className="pointer-events-none absolute z-30"
                          style={{
                            left: `${timelineAxis.left}px`,
                            top: `${timelineAxis.top + (timelineAxis.height * timelineProgress) / 100}px`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <span className="block h-3 w-3 rounded-full border-2 border-background bg-primary shadow-sm" />
                          <span className="absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm">
                            Heute
                          </span>
                        </div>
                      )}
                      {entries.map((entry, index) => {
                        const assignment = entry.checklistItemId
                          ? assignments.find((a) => a.checklist_item_id === entry.checklistItemId)
                          : undefined;
                        const isPastEntry = entry.date.getTime() < now;
                        const pointColorClass = isPastEntry
                          ? "bg-muted text-muted-foreground"
                          : entry.type === "known"
                            ? "bg-blue-500 text-white"
                            : "bg-amber-500 text-white";
                        const Icon = entry.type === "known" ? CalendarClock : Flag;

                        return (
                          <div
                            key={entry.id}
                            className="group relative z-10"
                            style={index > 0 ? { marginTop: `${entrySpacings[index]}px` } : undefined}
                          >
                            <span
                              className={`absolute top-1.5 z-20 flex items-center justify-center rounded-full ${DOT_SIZE_CLASS} ${DOT_LEFT_CLASS} ${pointColorClass}`}
                              ref={(element) => setTimelinePointRef(entry.id, element)}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                            <div className="rounded border border-border bg-background p-2 pl-4">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">{formatTimelineDate(entry.date)}</p>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`text-sm font-medium leading-tight ${
                                    isPastEntry ? "text-muted-foreground" : "text-foreground"
                                  } ${entry.type === "checklist" && entry.isCompleted ? "line-through" : ""}`}
                                >
                                  {entry.title}
                                </p>
                                {entry.type === "checklist" && assignment && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                    onClick={() => onRemoveAssignment(assignment.checklist_item_id)}
                                    title="Vom Zeitstrahl entfernen"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
                {provided.placeholder}
            </CardContent>
          </Card>
        )}
      </Droppable>
    </div>
  );
}
