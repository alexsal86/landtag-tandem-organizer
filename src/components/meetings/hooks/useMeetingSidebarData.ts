import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { startOfDay, endOfDay, addDays } from "date-fns";
import type {
  LinkedQuickNote,
  LinkedTask,
  LinkedCaseItem,
  RelevantDecision,
  MeetingUpcomingAppointment,
  ExternalCalendarSummary,
} from "@/components/meetings/types";

interface UseMeetingSidebarDataDeps {
  userId?: string;
  tenantId?: string;
  activeMeetingId: string | null;
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

interface ExternalEventAppointmentRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  external_calendars: ExternalCalendarSummary | ExternalCalendarSummary[] | null;
}

const extractExternalCalendar = (
  value: ExternalEventAppointmentRow["external_calendars"],
): ExternalCalendarSummary | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export function useMeetingSidebarData(deps: UseMeetingSidebarDataDeps) {
  const { userId, tenantId, toast } = deps;

  const [linkedQuickNotes, setLinkedQuickNotes] = useState<LinkedQuickNote[]>([]);
  const [meetingLinkedTasks, setMeetingLinkedTasks] = useState<LinkedTask[]>([]);
  const [meetingRelevantDecisions, setMeetingRelevantDecisions] = useState<RelevantDecision[]>([]);
  const [meetingLinkedCaseItems, setMeetingLinkedCaseItems] = useState<LinkedCaseItem[]>([]);
  const [meetingUpcomingAppointments, setMeetingUpcomingAppointments] = useState<MeetingUpcomingAppointment[]>([]);
  const [starredAppointmentIds, setStarredAppointmentIds] = useState<Set<string>>(new Set());
  const [expandedApptNotes, setExpandedApptNotes] = useState<Set<string>>(new Set());
  const [loadingCounter, setLoadingCounter] = useState(0);
  const updateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Stable refs for deps used inside useCallbacks
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Request version guards to discard stale responses
  const requestVersions = useRef<Record<string, number>>({});

  const withLoading = async <T,>(loader: () => Promise<T>): Promise<T> => {
    setLoadingCounter((prev) => prev + 1);
    try {
      return await loader();
    } finally {
      setLoadingCounter((prev) => Math.max(0, prev - 1));
    }
  };

  const loadLinkedQuickNotes = useCallback(async (meetingId: string) => {
    const key = `notes-${meetingId}`;
    const version = (requestVersions.current[key] || 0) + 1;
    requestVersions.current[key] = version;

    await withLoading(async () => {
      try {
        const { data, error } = await supabase
          .from("quick_notes")
          .select("id, title, content, user_id, meeting_id, created_at, updated_at, is_pinned, color, color_full_card, category, tags, priority_level, follow_up_date, is_archived, decision_id, task_id, case_item_id, meeting_result, pending_for_jour_fixe")
          .eq("meeting_id", meetingId)
          .order("created_at", { ascending: false });
        if (error) {
          debugConsole.error("Error loading linked quick notes:", error);
          return;
        }
        if (requestVersions.current[key] !== version) return;
        setLinkedQuickNotes(data || []);
      } catch (error) {
        debugConsole.error("Error loading linked quick notes:", error);
      }
    });
  }, []);

  const loadMeetingLinkedTasks = useCallback(async (meetingId: string) => {
    const key = `tasks-${meetingId}`;
    const version = (requestVersions.current[key] || 0) + 1;
    requestVersions.current[key] = version;

    await withLoading(async () => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, description, due_date, priority, status, user_id")
          .eq("meeting_id", meetingId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (requestVersions.current[key] !== version) return;
        setMeetingLinkedTasks(data || []);
      } catch (error) {
        debugConsole.error("Error loading meeting linked tasks:", error);
        // Keep existing data on error
      }
    });
  }, []);

  const loadMeetingLinkedCaseItems = useCallback(async (meetingId: string) => {
    const tid = tenantIdRef.current;
    if (!tid) return;
    const key = `cases-${meetingId}`;
    const version = (requestVersions.current[key] || 0) + 1;
    requestVersions.current[key] = version;

    await withLoading(async () => {
      try {
        const { data, error } = await supabase
          .from("case_items")
          .select("id, subject, status, priority, due_at, owner_user_id, pending_for_jour_fixe")
          .eq("tenant_id", tid)
          .neq("status", "erledigt")
          .or(`meeting_id.eq.${meetingId},pending_for_jour_fixe.eq.true`);
        if (error) throw error;
        if (requestVersions.current[key] !== version) return;
        setMeetingLinkedCaseItems(data || []);
      } catch (error) {
        debugConsole.error("Error loading meeting linked case items:", error);
      }
    });
  }, []);

  const loadMeetingRelevantDecisions = useCallback(async () => {
    const tid = tenantIdRef.current;
    const uid = userIdRef.current;
    if (!tid || !uid) return;
    const key = "decisions";
    const version = (requestVersions.current[key] || 0) + 1;
    requestVersions.current[key] = version;

    await withLoading(async () => {
      try {
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const in7Days = addDays(nowDate, 7).toISOString();
        const { data, error } = await supabase
          .from("task_decisions")
          .select("id, title, description, response_deadline, priority, created_by, status")
          .eq("tenant_id", tid)
          .eq("status", "active")
          .or(
            `priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`
          )
          .order("priority", { ascending: false, nullsFirst: false })
          .order("response_deadline", { ascending: true, nullsFirst: false });
        if (error) throw error;

        if (requestVersions.current[key] !== version) return;

        const decisionIds = (data || []).map((d) => d.id);
        let participantRows: Array<{ decision_id: string; user_id: string }> = [];
        if (decisionIds.length > 0) {
          const { data: participants, error: participantError } = await supabase
            .from("task_decision_participants")
            .select("decision_id, user_id")
            .in("decision_id", decisionIds);
          if (participantError) throw participantError;
          participantRows = participants || [];
        }

        if (requestVersions.current[key] !== version) return;

        const relevant = (data || []).filter(
          (decision) =>
            decision.created_by === uid ||
            participantRows.some((p) => p.decision_id === decision.id && p.user_id === uid)
        );
        setMeetingRelevantDecisions(relevant);
      } catch (error) {
        debugConsole.error("Error loading meeting relevant decisions:", error);
        // Keep existing data on error – no destructive reset
      }
    });
  }, []);

  const loadMeetingUpcomingAppointments = useCallback(async (meetingId: string, meetingDate: string | Date) => {
    const tid = tenantIdRef.current;
    if (!tid) return;
    const key = `appts-${meetingId}`;
    const version = (requestVersions.current[key] || 0) + 1;
    requestVersions.current[key] = version;

    await withLoading(async () => {
      try {
        const baseDate = typeof meetingDate === "string" ? new Date(meetingDate) : meetingDate;
        const start = startOfDay(baseDate);
        const end = endOfDay(addDays(baseDate, 14));

        const { data: internalData } = await supabase
          .from("appointments")
          .select("id, title, start_time, end_time, location, category, status")
          .eq("tenant_id", tid)
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString())
          .order("start_time", { ascending: true });

        const { data: externalData } = await supabase
          .from("external_events")
          .select(
            "id, title, start_time, end_time, location, external_calendars!inner(name, color, tenant_id)"
          )
          .eq("external_calendars.tenant_id", tid)
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString());

        if (requestVersions.current[key] !== version) return;

        const all: MeetingUpcomingAppointment[] = [
          ...(internalData || []).map((a) => ({ ...a, isExternal: false as const })),
          ...((externalData || []) as ExternalEventAppointmentRow[]).map(
            (e) => {
              const calendar = extractExternalCalendar(e.external_calendars);
              return {
              id: e.id,
              title: e.title,
              start_time: e.start_time,
              end_time: e.end_time,
              location: e.location,
              isExternal: true as const,
              calendarName: calendar?.name ?? undefined,
              calendarColor: calendar?.color ?? undefined,
            };
            }
          ),
        ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        setMeetingUpcomingAppointments(all);
      } catch (error) {
        debugConsole.error("Error loading upcoming appointments:", error);
        // Keep existing data on error
      }
    });
  }, []);

  const loadStarredAppointments = useCallback(async (meetingId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from("starred_appointments")
        .select("id, appointment_id, external_event_id")
        .eq("meeting_id", meetingId)
        .eq("user_id", uid);
      if (error) throw error;
      const ids = new Set<string>();
      data?.forEach((item) => {
        if (item.appointment_id) ids.add(item.appointment_id);
        if (item.external_event_id) ids.add(item.external_event_id);
      });
      setStarredAppointmentIds(ids);
    } catch (error) {
      debugConsole.error("Error loading starred appointments:", error);
    }
  }, []);

  const toggleStarAppointment = useCallback(async (appt: MeetingUpcomingAppointment, activeMeetingId: string | null) => {
    const uid = userIdRef.current;
    const tid = tenantIdRef.current;
    if (!activeMeetingId || !uid || !tid) return;
    const isCurrentlyStarred = starredAppointmentIds.has(appt.id);
    setStarredAppointmentIds((prev) => {
      const newSet = new Set(prev);
      if (isCurrentlyStarred) newSet.delete(appt.id);
      else newSet.add(appt.id);
      return newSet;
    });
    try {
      if (isCurrentlyStarred) {
        await supabase
          .from("starred_appointments")
          .delete()
          .eq("meeting_id", activeMeetingId)
          .eq("user_id", uid)
          .or(`appointment_id.eq.${appt.id},external_event_id.eq.${appt.id}`);
      } else {
        const insertData: {
          meeting_id: string;
          user_id: string;
          tenant_id: string;
          appointment_id?: string;
          external_event_id?: string;
        } = { meeting_id: activeMeetingId, user_id: uid, tenant_id: tid };
        if (appt.isExternal) insertData.external_event_id = appt.id;
        else insertData.appointment_id = appt.id;
        await supabase.from("starred_appointments").insert(insertData);
      }
    } catch (error) {
      debugConsole.error("Error toggling star:", error);
      setStarredAppointmentIds((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) newSet.add(appt.id);
        else newSet.delete(appt.id);
        return newSet;
      });
    }
  }, [starredAppointmentIds]);

  const updateQuickNoteResult = useCallback(async (noteId: string, result: string) => {
    setLinkedQuickNotes((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, meeting_result: result } : note))
    );
    const timeoutKey = `quick-note-${noteId}-meeting_result`;
    if (updateTimeouts.current[timeoutKey]) clearTimeout(updateTimeouts.current[timeoutKey]);
    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("quick_notes")
          .update({ meeting_result: result })
          .eq("id", noteId);
        if (error) throw error;
      } catch (error) {
        debugConsole.error("Error updating quick note result:", error);
        toastRef.current({
          title: "Fehler",
          description: "Das Ergebnis konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }, 500);
  }, []);

  return {
    // State
    linkedQuickNotes,
    setLinkedQuickNotes,
    meetingLinkedTasks,
    meetingRelevantDecisions,
    meetingLinkedCaseItems,
    meetingUpcomingAppointments,
    starredAppointmentIds,
    expandedApptNotes,
    setExpandedApptNotes,
    isMeetingLinkedDataLoading: loadingCounter > 0,
    // Functions (all stable via useCallback)
    loadLinkedQuickNotes,
    loadMeetingLinkedTasks,
    loadMeetingLinkedCaseItems,
    loadMeetingRelevantDecisions,
    loadMeetingUpcomingAppointments,
    loadStarredAppointments,
    toggleStarAppointment,
    updateQuickNoteResult,
    updateTimeouts,
  };
}
