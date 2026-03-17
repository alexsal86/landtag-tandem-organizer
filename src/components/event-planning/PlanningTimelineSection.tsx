import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Flag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Droppable } from "@hello-pangea/dnd";
import type { ChecklistItem, EventPlanningDate } from "./types";

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
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const timelineEntryRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

    const assignmentEntries: TimelineEntry[] = assignments
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
      .filter((entry): entry is TimelineEntry => entry !== null);

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

  useEffect(() => {
    const updateConnectors = () => {
      const sectionRect = sectionRef.current?.getBoundingClientRect();
      if (!sectionRect || !checklistItemRefs) {
        setConnectorLines([]);
        return;
      }

      const nextLines = assignments
        .map((assignment) => {
          const checklistElement = checklistItemRefs[assignment.checklistItemId]?.current;
          const timelineElement = timelineEntryRefs.current[`item-${assignment.checklistItemId}`];

          if (!checklistElement || !timelineElement) {
            return null;
          }

          const checklistRect = checklistElement.getBoundingClientRect();
          const timelineRect = timelineElement.getBoundingClientRect();

          return {
            assignmentId: assignment.checklistItemId,
            startX: checklistRect.right - sectionRect.left,
            startY: checklistRect.top + checklistRect.height / 2 - sectionRect.top,
            endX: timelineRect.left - sectionRect.left,
            endY: timelineRect.top + timelineRect.height / 2 - sectionRect.top,
          };
        })
        .filter((line): line is ConnectorLine => line !== null);

      setConnectorLines(nextLines);
    };

    updateConnectors();
    window.addEventListener("resize", updateConnectors);
    window.addEventListener("scroll", updateConnectors, true);

    return () => {
      window.removeEventListener("resize", updateConnectors);
      window.removeEventListener("scroll", updateConnectors, true);
    };
  }, [assignments, checklistItemRefs, entries]);

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

          <div className="relative space-y-3 pl-6">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Termine im Zeitstrahl.</p>
            ) : (
              entries.map((entry, index) => {
                const isLast = index === entries.length - 1;
                const assignment = assignments.find((a) => a.checklistItemId === entry.id.replace("item-", ""));

                return (
                  <div key={entry.id} className="relative" ref={(element) => {
                    timelineEntryRefs.current[entry.id] = element;
                  }}>
                    {!isLast && <span className="absolute -left-[13px] top-4 bottom-[-16px] w-0.5 bg-border" />}
                    <span className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ${entry.type === "known" ? "bg-blue-500" : "bg-amber-500"}`} />
                    <div className="rounded border border-border bg-background p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {format(entry.date, "dd.MM.yyyy", { locale: de })}
                        </p>
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
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
