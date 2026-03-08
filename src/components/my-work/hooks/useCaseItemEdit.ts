import { useCallback, useState } from "react";

export type TimelineInteractionType = "anruf" | "mail" | "treffen" | "gespraech" | "notiz";

export type TimelineEvent = {
  id: string;
  type: "status" | "interaktion" | "entscheidung";
  title: string;
  note?: string;
  timestamp: string;
  statusValue?: string;
  interactionType?: TimelineInteractionType;
};

export type EditableCaseItem = {
  subject: string;
  summary: string;
  status: string;
  completionNote: string;
  completedAt: string;
  sourceReceivedAt: string;
  dueAt: string;
  category: string;
  priority: string;
  assigneeIds: string[];
  timelineEvents: TimelineEvent[];
  interactionType: TimelineInteractionType | "";
  interactionContact: string;
  interactionDateTime: string;
  interactionNote: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  selectedContactId: string | null;
};

export const useCaseItemEdit = () => {
  const [editableCaseItem, setEditableCaseItem] = useState<EditableCaseItem | null>(null);

  const updateEdit = useCallback((patch: Partial<EditableCaseItem>) => {
    setEditableCaseItem((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const updateTimelineEvents = useCallback((updater: (prev: TimelineEvent[]) => TimelineEvent[]) => {
    setEditableCaseItem((prev) => (prev ? { ...prev, timelineEvents: updater(prev.timelineEvents) } : prev));
  }, []);

  const appendTimelineEvent = useCallback((event: Omit<TimelineEvent, "id" | "timestamp"> & { timestamp?: string }) => {
    updateTimelineEvents((prev) => [...prev, {
      ...event,
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      timestamp: event.timestamp || new Date().toISOString(),
    }]);
  }, [updateTimelineEvents]);

  const deleteTimelineEvent = useCallback((id: string) => {
    updateTimelineEvents((prev) => prev.filter((event) => event.id !== id));
  }, [updateTimelineEvents]);

  return {
    editableCaseItem,
    setEditableCaseItem,
    updateEdit,
    appendTimelineEvent,
    deleteTimelineEvent,
  };
};
