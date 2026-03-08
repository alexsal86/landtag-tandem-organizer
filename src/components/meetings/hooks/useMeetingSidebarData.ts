import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { startOfDay, endOfDay, addDays } from "date-fns";
import type {
  LinkedQuickNote,
  LinkedTask,
  LinkedCaseItem,
  RelevantDecision,
  MeetingUpcomingAppointment,
} from "@/components/meetings/types";

interface UseMeetingSidebarDataDeps {
  userId?: string;
  tenantId?: string;
  activeMeetingId: string | null;
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

export function useMeetingSidebarData(deps: UseMeetingSidebarDataDeps) {
  const { userId, tenantId, toast } = deps;

  const [linkedQuickNotes, setLinkedQuickNotes] = useState<LinkedQuickNote[]>([]);
  const [meetingLinkedTasks, setMeetingLinkedTasks] = useState<LinkedTask[]>([]);
  const [meetingRelevantDecisions, setMeetingRelevantDecisions] = useState<RelevantDecision[]>([]);
  const [meetingLinkedCaseItems, setMeetingLinkedCaseItems] = useState<LinkedCaseItem[]>([]);
  const [meetingUpcomingAppointments, setMeetingUpcomingAppointments] = useState<MeetingUpcomingAppointment[]>([]);
  const [starredAppointmentIds, setStarredAppointmentIds] = useState<Set<string>>(new Set());
  const [expandedApptNotes, setExpandedApptNotes] = useState<Set<string>>(new Set());
  const updateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const loadLinkedQuickNotes = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });
      if (error) {
        debugConsole.error("Error loading linked quick notes:", error);
        return;
      }
      setLinkedQuickNotes(data || []);
    } catch (error) {
      debugConsole.error("Error loading linked quick notes:", error);
    }
  };

  const loadMeetingLinkedTasks = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, priority, status, user_id")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMeetingLinkedTasks(data || []);
    } catch (error) {
      debugConsole.error("Error loading meeting linked tasks:", error);
      setMeetingLinkedTasks([]);
    }
  };

  const loadMeetingLinkedCaseItems = async (meetingId: string) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from("case_items")
        .select("id, subject, status, priority, due_at, owner_user_id, pending_for_jour_fixe")
        .eq("tenant_id", tenantId)
        .neq("status", "erledigt")
        .or(`meeting_id.eq.${meetingId},pending_for_jour_fixe.eq.true`);
      if (error) throw error;
      setMeetingLinkedCaseItems(data || []);
    } catch (error) {
      debugConsole.error("Error loading meeting linked case items:", error);
      setMeetingLinkedCaseItems([]);
    }
  };

  const loadMeetingRelevantDecisions = async () => {
    if (!tenantId || !userId) return;
    try {
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const in7Days = addDays(nowDate, 7).toISOString();
      const { data, error } = await supabase
        .from("task_decisions")
        .select("id, title, description, response_deadline, priority, created_by, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .or(
          `priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`
        )
        .order("priority", { ascending: false, nullsFirst: false })
        .order("response_deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;

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

      const relevant = (data || []).filter(
        (decision) =>
          decision.created_by === userId ||
          participantRows.some((p) => p.decision_id === decision.id && p.user_id === userId)
      );
      setMeetingRelevantDecisions(relevant);
    } catch (error) {
      debugConsole.error("Error loading meeting relevant decisions:", error);
      setMeetingRelevantDecisions([]);
    }
  };

  const loadMeetingUpcomingAppointments = async (meetingId: string, meetingDate: string | Date) => {
    if (!tenantId) return;
    try {
      const baseDate = typeof meetingDate === "string" ? new Date(meetingDate) : meetingDate;
      const start = startOfDay(baseDate);
      const end = endOfDay(addDays(baseDate, 14));

      const { data: internalData } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time, location, category, status")
        .eq("tenant_id", tenantId)
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString())
        .order("start_time", { ascending: true });

      const { data: externalData } = await supabase
        .from("external_events")
        .select(
          "id, title, start_time, end_time, location, external_calendars!inner(name, color, tenant_id)"
        )
        .eq("external_calendars.tenant_id", tenantId)
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString());

      const all: MeetingUpcomingAppointment[] = [
        ...(internalData || []).map((a) => ({ ...a, isExternal: false as const })),
        ...(externalData || []).map(
          (e: {
            id: string;
            title: string;
            start_time: string;
            end_time: string;
            location?: string | null;
            external_calendars?: { name?: string; color?: string };
          }) => ({
            id: e.id,
            title: e.title,
            start_time: e.start_time,
            end_time: e.end_time,
            location: e.location,
            isExternal: true as const,
            calendarName: e.external_calendars?.name,
            calendarColor: e.external_calendars?.color,
          })
        ),
      ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setMeetingUpcomingAppointments(all);
    } catch (error) {
      console.error("Error loading upcoming appointments:", error);
      setMeetingUpcomingAppointments([]);
    }
  };

  const loadStarredAppointments = async (meetingId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("starred_appointments")
        .select("id, appointment_id, external_event_id")
        .eq("meeting_id", meetingId)
        .eq("user_id", userId);
      if (error) throw error;
      const ids = new Set<string>();
      data?.forEach((item) => {
        if (item.appointment_id) ids.add(item.appointment_id);
        if (item.external_event_id) ids.add(item.external_event_id);
      });
      setStarredAppointmentIds(ids);
    } catch (error) {
      console.error("Error loading starred appointments:", error);
    }
  };

  const toggleStarAppointment = async (appt: MeetingUpcomingAppointment, activeMeetingId: string | null) => {
    if (!activeMeetingId || !userId || !tenantId) return;
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
          .eq("user_id", userId)
          .or(`appointment_id.eq.${appt.id},external_event_id.eq.${appt.id}`);
      } else {
        const insertData: {
          meeting_id: string;
          user_id: string;
          tenant_id: string;
          appointment_id?: string;
          external_event_id?: string;
        } = { meeting_id: activeMeetingId, user_id: userId, tenant_id: tenantId };
        if (appt.isExternal) insertData.external_event_id = appt.id;
        else insertData.appointment_id = appt.id;
        await supabase.from("starred_appointments").insert(insertData);
      }
    } catch (error) {
      console.error("Error toggling star:", error);
      setStarredAppointmentIds((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) newSet.add(appt.id);
        else newSet.delete(appt.id);
        return newSet;
      });
    }
  };

  const updateQuickNoteResult = async (noteId: string, result: string) => {
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
        console.error("Error updating quick note result:", error);
        toast({
          title: "Fehler",
          description: "Das Ergebnis konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }, 500);
  };

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
    // Functions
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
