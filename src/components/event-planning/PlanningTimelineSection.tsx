import { useCallback, useMemo, useRef, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Flag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import type { ChecklistItem, EventPlanningDate, EventPlanningTimelineAssignment } from "./types";
import { useTimelineGeometry } from "./useTimelineGeometry";

const MIN_GROUP_GAP_PX = 32;
const SAME_DAY_GAP_PX = 6;
const DOT_SIZE_CLASS = "h-5 w-5";
const DOT_LEFT_CLASS = "-left-[14px]";

interface PlanningTimelineSectionProps {
  planningCreatedAt?: string | null;
  planningDates: EventPlanningDate[];
  checklistItems: ChecklistItem[];
  assignments: EventPlanningTimelineAssignment[];
  onRemoveAssignment: (checklistItemId: string) => void;
  checklistItemRefs?: Record<string, RefObject<HTMLDivElement | null>>;
  highlightedChecklistItemId?: string | null;
}

type TimelineEntry = {
  id: string;
  checklistItemId?: string;
  date: Date;
  title: string;
  type: "known" | "checklist";
  isConfirmed?: boolean;
  isCompleted?: boolean;
  phase?: string | null;
};

type TimelineGroup = {
  dateKey: string;
  date: Date;
  entries: TimelineEntry[];
};

type MonthSection = {
  monthKey: string;
  monthLabel: string;
  groups: TimelineGroup[];
};

function groupEntriesByDate(entries: TimelineEntry[]): TimelineGroup[] {
  const groupMap = new Map<string, TimelineGroup>();
  for (const entry of entries) {
    const dateKey = format(entry.date, "yyyy-MM-dd");
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, { dateKey, date: entry.date, entries: [] });
    }
    groupMap.get(dateKey)!.entries.push(entry);
  }
  return Array.from(groupMap.values());
}

function groupByMonth(groups: TimelineGroup[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const group of groups) {
    const monthKey = format(group.date, "yyyy-MM");
    const last = sections[sections.length - 1];
    if (last && last.monthKey === monthKey) {
      last.groups.push(group);
    } else {
      sections.push({
        monthKey,
        monthLabel: format(group.date, "MMMM yyyy", { locale: de }),
        groups: [group],
      });
    }
  }
  return sections;
}

function getPhaseForEntry(entry: TimelineEntry, checklistItems: ChecklistItem[], assignments: EventPlanningTimelineAssignment[]): string | null {
  if (entry.type !== "checklist" || !entry.checklistItemId) return null;
  const sorted = [...checklistItems].sort((a, b) => a.order_index - b.order_index);
  let currentPhase: string | null = null;
  for (const item of sorted) {
    if (item.type === "phase_start") {
      currentPhase = item.title;
    }
    if (item.id === entry.checklistItemId) {
      return currentPhase;
    }
  }
  return null;
}

export function PlanningTimelineSection({
  planningCreatedAt,
  planningDates,
  checklistItems,
  assignments,
  onRemoveAssignment,
  checklistItemRefs,
  highlightedChecklistItemId,
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
          phase: getPhaseForEntry(
            { id: `item-${assignment.checklist_item_id}`, checklistItemId: assignment.checklist_item_id, date: new Date(assignment.due_date), title: checklistItem.title, type: "checklist" },
            checklistItems,
            assignments,
          ),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null) as TimelineEntry[];

    return [...planningStartEntry, ...knownEntries, ...assignmentEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assignments, checklistItems, planningCreatedAt, planningDates]);

  const now = Date.now();

  const dateGroups = useMemo(() => groupEntriesByDate(entries), [entries]);
  const monthSections = useMemo(() => groupByMonth(dateGroups), [dateGroups]);

  const timelineProgress = useMemo(() => {
    if (entries.length < 2) return null;
    const start = entries[0].date.getTime();
    const end = entries[entries.length - 1].date.getTime();
    if (end <= start) return null;
    const raw = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [entries, now]);

  const groupSpacings = useMemo(() => {
    if (dateGroups.length <= 1) return dateGroups.map(() => 0);

    const firstTimestamp = dateGroups[0].date.getTime();
    const lastTimestamp = dateGroups[dateGroups.length - 1].date.getTime();
    const totalDuration = Math.max(1, lastTimestamp - firstTimestamp);
    const targetHeight = Math.max(400, dateGroups.length * 60);

    const proportionalOffsets = dateGroups.map((group) => {
      const elapsed = Math.max(0, group.date.getTime() - firstTimestamp);
      return Math.round((elapsed / totalDuration) * targetHeight);
    });

    const resolvedOffsets = proportionalOffsets.reduce<number[]>((offsets, offset, index) => {
      if (index === 0) {
        offsets.push(0);
        return offsets;
      }
      offsets.push(Math.max(offset, offsets[index - 1] + MIN_GROUP_GAP_PX));
      return offsets;
    }, []);

    return resolvedOffsets.map((offset, index) => {
      if (index === 0) return 0;
      return offset - resolvedOffsets[index - 1];
    });
  }, [dateGroups]);

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

  let globalGroupIndex = 0;

  return (
    <div ref={sectionRef} className="relative">
      {connectorLines.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden>
          {connectorLines.map((line) => {
            const isHighlighted = highlightedChecklistItemId && line.assignmentId === highlightedChecklistItemId;
            const controlOffset = Math.max(40, Math.abs(line.endX - line.startX) * 0.35);
            const path = `M ${line.startX} ${line.startY} C ${line.startX + controlOffset} ${line.startY}, ${line.endX - controlOffset} ${line.endY}, ${line.endX} ${line.endY}`;
            return (
              <path
                key={line.assignmentId}
                d={path}
                fill="none"
                stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={isHighlighted ? undefined : "4 4"}
                className="transition-all duration-200"
              />
            );
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

              <div ref={timelineListRef} className="relative pl-5">
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
                    {monthSections.map((section) => (
                      <div key={section.monthKey}>
                        {/* Month header */}
                        <div className="mb-2 mt-3 first:mt-0">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {section.monthLabel}
                          </span>
                        </div>
                        {section.groups.map((group) => {
                          const currentGroupIndex = globalGroupIndex++;
                          const spacing = groupSpacings[currentGroupIndex] || 0;
                          const dayNumber = format(group.date, "d");

                          return (
                            <div
                              key={group.dateKey}
                              className="relative z-10"
                              style={currentGroupIndex > 0 ? { marginTop: `${spacing}px` } : undefined}
                            >
                              {group.entries.map((entry, entryIndex) => {
                                const assignment = entry.checklistItemId
                                  ? assignments.find((a) => a.checklist_item_id === entry.checklistItemId)
                                  : undefined;
                                const isPastEntry = entry.date.getTime() < now;
                                const isHighlighted = highlightedChecklistItemId && entry.checklistItemId === highlightedChecklistItemId;
                                const pointColorClass = isHighlighted
                                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                  : isPastEntry
                                    ? "bg-muted text-muted-foreground"
                                    : entry.type === "known"
                                      ? "bg-blue-500 text-white"
                                      : "bg-amber-500 text-white";
                                const Icon = entry.type === "known" ? CalendarClock : Flag;

                                return (
                                  <div
                                    key={entry.id}
                                    className={cn(
                                      "group relative flex items-center gap-3 py-1",
                                      isHighlighted && "bg-primary/5 -mx-2 px-2 rounded",
                                    )}
                                    style={entryIndex > 0 ? { marginTop: `${SAME_DAY_GAP_PX}px` } : undefined}
                                  >
                                    <span
                                      className={cn(
                                        "absolute z-20 flex items-center justify-center rounded-full transition-all duration-200",
                                        DOT_SIZE_CLASS,
                                        DOT_LEFT_CLASS,
                                        pointColorClass,
                                      )}
                                      ref={(element) => setTimelinePointRef(entry.id, element)}
                                    >
                                      <Icon className="h-3 w-3" />
                                    </span>
                                    <span className={cn(
                                      "text-sm font-mono tabular-nums w-6 text-right shrink-0",
                                      isPastEntry ? "text-muted-foreground" : "text-foreground",
                                    )}>
                                      {entryIndex === 0 ? dayNumber : ""}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-sm leading-tight flex-1 min-w-0 truncate",
                                        isPastEntry ? "text-muted-foreground" : "text-foreground",
                                        entry.type === "checklist" && entry.isCompleted && "line-through",
                                      )}
                                    >
                                      {entry.title}
                                    </span>
                                    {entry.phase && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/70">
                                        {entry.phase}
                                      </span>
                                    )}
                                    {entry.type === "checklist" && assignment && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 shrink-0"
                                        onClick={() => onRemoveAssignment(assignment.checklist_item_id)}
                                        title="Vom Zeitstrahl entfernen"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
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
