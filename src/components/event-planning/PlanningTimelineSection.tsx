import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Flag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Droppable } from "@hello-pangea/dnd";
import type { ChecklistItem, EventPlanningDate } from "./types";

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const DOT_SIZE_CLASS = "h-5 w-5";
const DOT_LEFT_CLASS = "-left-[20px]";

type TimelineAssignment = {
  checklistItemId: string;
  title: string;
  dueDate: string;
};

interface PlanningTimelineSectionProps {
  planningCreatedAt?: string | null;
  planningDates: EventPlanningDate[];
  checklistItems: ChecklistItem[];
  assignments: TimelineAssignment[];
  onRemoveAssignment: (checklistItemId: string) => void;
  checklistItemRefs?: Record<string, RefObject<HTMLDivElement | null>>;
}

type TimelineEntry = {
  id: string;
  date: Date;
  title: string;
  type: "known" | "checklist";
  isConfirmed?: boolean;
};

type ConnectorLine = {
  assignmentId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type TimelineAxis = {
  left: number;
  top: number;
  height: number;
};

export function PlanningTimelineSection({
  planningCreatedAt,
  planningDates,
  checklistItems,
  assignments,
  onRemoveAssignment,
  checklistItemRefs,
}: PlanningTimelineSectionProps) {
  const [isDropActive, setIsDropActive] = useState(false);
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const [timelineAxis, setTimelineAxis] = useState<TimelineAxis | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const timelineListRef = useRef<HTMLDivElement | null>(null);
  const timelinePointRefs = useRef<Record<string, HTMLSpanElement | null>>({});

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
        const checklistItem = checklistItems.find((item) => item.id === assignment.checklistItemId);
        if (!checklistItem) return null;

        return {
          id: `item-${assignment.checklistItemId}`,
          date: new Date(assignment.dueDate),
          title: checklistItem.title || assignment.title,
          type: "checklist" as const,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null) as TimelineEntry[];

    return [...planningStartEntry, ...knownEntries, ...assignmentEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assignments, checklistItems, planningCreatedAt, planningDates]);

  const timelineProgress = useMemo(() => {
    if (entries.length < 2) return null;
    const now = Date.now();
    const start = entries[0].date.getTime();
    const end = entries[entries.length - 1].date.getTime();
    if (end <= start) return null;
    const raw = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [entries]);

  const entrySpacings = useMemo(() => {
    if (entries.length < 2) {
      return entries.map(() => 0);
    }

    const firstDate = entries[0].date.getTime();
    const lastDate = entries[entries.length - 1].date.getTime();
    const totalDays = Math.max(1, (lastDate - firstDate) / DAY_IN_MS);
    const pixelsPerDay = Math.max(2, Math.min(8, 560 / totalDays));

    return entries.map((entry, index) => {
      if (index === 0) return 0;
      const previousEntry = entries[index - 1];
      const diffInDays = Math.max(0, (entry.date.getTime() - previousEntry.date.getTime()) / DAY_IN_MS);
      const scaledSpacing = Math.round(diffInDays * pixelsPerDay);
      return diffInDays > 0 && scaledSpacing < 14 ? 14 : scaledSpacing;
    });
  }, [entries]);

  useEffect(() => {
    const updateGeometry = () => {
      const sectionRect = sectionRef.current?.getBoundingClientRect();
      const listRect = timelineListRef.current?.getBoundingClientRect();

      if (!sectionRect || !listRect) {
        setConnectorLines([]);
        setTimelineAxis(null);
        return;
      }

      const firstEntry = entries[0];
      const lastEntry = entries[entries.length - 1];
      const firstPoint = firstEntry ? timelinePointRefs.current[firstEntry.id] : null;
      const lastPoint = lastEntry ? timelinePointRefs.current[lastEntry.id] : null;

      if (firstPoint && lastPoint) {
        const firstRect = firstPoint.getBoundingClientRect();
        const lastRect = lastPoint.getBoundingClientRect();
        setTimelineAxis({
          left: firstRect.left + firstRect.width / 2 - listRect.left,
          top: firstRect.top + firstRect.height / 2 - listRect.top,
          height: Math.max(0, lastRect.top + lastRect.height / 2 - (firstRect.top + firstRect.height / 2)),
        });
      } else {
        setTimelineAxis(null);
      }

      if (!checklistItemRefs) {
        setConnectorLines([]);
        return;
      }

      const nextLines = assignments
        .map((assignment) => {
          const checklistElement = checklistItemRefs[assignment.checklistItemId]?.current;
          const timelinePoint = timelinePointRefs.current[`item-${assignment.checklistItemId}`];

          if (!checklistElement || !timelinePoint) {
            return null;
          }

          const checklistRect = checklistElement.getBoundingClientRect();
          const pointRect = timelinePoint.getBoundingClientRect();

          return {
            assignmentId: assignment.checklistItemId,
            startX: checklistRect.right - sectionRect.left,
            startY: checklistRect.top + checklistRect.height / 2 - sectionRect.top,
            endX: pointRect.left + pointRect.width / 2 - sectionRect.left,
            endY: pointRect.top + pointRect.height / 2 - sectionRect.top,
          };
        })
        .filter((line): line is ConnectorLine => line !== null);

      setConnectorLines(nextLines);
    };

    updateGeometry();
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);

    return () => {
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
    };
  }, [assignments, checklistItemRefs, entries, entrySpacings]);

  return (
    <div ref={sectionRef} className="relative">
      {connectorLines.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
          {connectorLines.map((line) => {
            const controlOffset = Math.max(40, Math.abs(line.endX - line.startX) * 0.35);
            const path = `M ${line.startX} ${line.startY} C ${line.startX + controlOffset} ${line.startY}, ${line.endX - controlOffset} ${line.endY}, ${line.endX} ${line.endY}`;
            return <path key={line.assignmentId} d={path} fill="none" stroke="hsl(var(--primary) / 0.55)" strokeWidth={1.5} strokeDasharray="4 4" />;
          })}
        </svg>
      )}

      <Card className="bg-card shadow-card border-border">
        <CardHeader>
          <CardTitle>Zeitstrahl</CardTitle>
        </CardHeader>
        <CardContent>
          <Droppable droppableId="planning-timeline">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`mb-4 rounded-md border-2 border-dashed p-3 text-sm transition-colors ${snapshot.isDraggingOver || isDropActive ? "border-primary bg-primary/5" : "border-border"}`}
                onDragEnter={() => setIsDropActive(true)}
                onDragLeave={() => setIsDropActive(false)}
                onDrop={() => setIsDropActive(false)}
              >
                Checklisten-Punkt hier fallen lassen, um ihn mit einer Frist im Zeitstrahl zu planen.
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {timelineProgress !== null && (
            <div className="mb-4 space-y-1">
              <div className="relative h-2 rounded bg-muted">
                <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${timelineProgress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Heute-Marker</p>
            </div>
          )}

          <div ref={timelineListRef} className="relative pl-10">
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
                {entries.map((entry, index) => {
                  const assignment = assignments.find((a) => a.checklistItemId === entry.id.replace("item-", ""));

                  return (
                    <div
                      key={entry.id}
                      className="relative"
                      style={index > 0 ? { marginTop: `${entrySpacings[index]}px` } : undefined}
                    >
                      <span
                        className={`absolute top-1.5 rounded-full ${DOT_SIZE_CLASS} ${DOT_LEFT_CLASS} ${entry.type === "known" ? "bg-blue-500" : "bg-amber-500"}`}
                        ref={(element) => {
                          timelinePointRefs.current[entry.id] = element;
                        }}
                      />
                      <div className="rounded border border-border bg-background p-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{format(entry.date, "dd.MM.yyyy", { locale: de })}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.type === "known" ? <CalendarClock className="mr-1 h-3 w-3" /> : <Flag className="mr-1 h-3 w-3" />}
                            {entry.type === "known" ? "Termin" : "Checkliste"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{entry.title}</p>
                          {entry.type === "checklist" && assignment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => onRemoveAssignment(assignment.checklistItemId)}
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
        </CardContent>
      </Card>
    </div>
  );
}
