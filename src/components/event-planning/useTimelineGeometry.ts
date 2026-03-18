import { useEffect, useState, type RefObject } from "react";

type TimelineEntryGeometry = {
  id: string;
};

type TimelineAssignment = {
  checklist_item_id: string;
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

interface UseTimelineGeometryParams {
  sectionRef: RefObject<HTMLDivElement | null>;
  timelineListRef: RefObject<HTMLDivElement | null>;
  timelinePointRefs: RefObject<Map<string, HTMLSpanElement>>;
  checklistItemRefs?: Record<string, RefObject<HTMLDivElement | null>>;
  assignments: TimelineAssignment[];
  entries: TimelineEntryGeometry[];
}

export function useTimelineGeometry({
  sectionRef,
  timelineListRef,
  timelinePointRefs,
  checklistItemRefs,
  assignments,
  entries,
}: UseTimelineGeometryParams) {
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const [timelineAxis, setTimelineAxis] = useState<TimelineAxis | null>(null);

  useEffect(() => {
    const observedElements = new Set<Element>();
    let animationFrameId: number | null = null;

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
      const firstPoint = firstEntry ? timelinePointRefs.current.get(firstEntry.id) ?? null : null;
      const lastPoint = lastEntry ? timelinePointRefs.current.get(lastEntry.id) ?? null : null;

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
          const checklistElement = checklistItemRefs[assignment.checklist_item_id]?.current;
          const timelinePoint = timelinePointRefs.current.get(`item-${assignment.checklist_item_id}`) ?? null;

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

    const scheduleGeometryUpdate = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        updateGeometry();
        animationFrameId = null;
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleGeometryUpdate();
    });

    const observeElement = (element: Element | null | undefined) => {
      if (!element || observedElements.has(element)) return;
      observedElements.add(element);
      resizeObserver.observe(element);
    };

    observeElement(sectionRef.current);
    observeElement(timelineListRef.current);

    for (const entry of entries) {
      observeElement(timelinePointRefs.current.get(entry.id));
    }

    if (checklistItemRefs) {
      for (const assignment of assignments) {
        observeElement(checklistItemRefs[assignment.checklistItemId]?.current);
      }
    }

    scheduleGeometryUpdate();

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      observedElements.clear();
    };
  }, [assignments, checklistItemRefs, entries, sectionRef, timelineListRef, timelinePointRefs]);

  return {
    connectorLines,
    timelineAxis,
  };
}
