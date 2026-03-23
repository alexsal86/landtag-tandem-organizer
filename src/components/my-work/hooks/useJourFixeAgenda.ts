import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { AgendaItem } from "@/hooks/useMyWorkJourFixeSystemData";
import { useMyWorkJourFixeSystemData } from "@/hooks/useMyWorkJourFixeSystemData";
import type { JourFixeAgendaData, JourFixeSystemDataMaps } from "@/components/my-work/jour-fixe/types";

export function useJourFixeAgenda(userId?: string, tenantId?: string) {
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<Record<string, AgendaItem[]>>({});
  const [loadingAgenda, setLoadingAgenda] = useState<string | null>(null);
  const agendaItemsRef = useRef<Record<string, AgendaItem[]>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  const systemData = useMyWorkJourFixeSystemData(userId, tenantId);
  const { loadMeetingSystemData, setMounted } = systemData;

  useEffect(() => {
    isMountedRef.current = true;
    setMounted(true);
    return () => {
      isMountedRef.current = false;
      setMounted(false);
    };
  }, [setMounted]);

  const loadAgendaForMeeting = useCallback(
    async (meetingId: string, meetingDate?: string) => {
      if (agendaItemsRef.current[meetingId] || inFlightRef.current.has(meetingId)) return;

      inFlightRef.current.add(meetingId);
      if (isMountedRef.current) setLoadingAgenda(meetingId);

      try {
        const { data, error } = await supabase
          .from("meeting_agenda_items")
          .select("id, title, parent_id, order_index, system_type")
          .eq("meeting_id", meetingId)
          .order("order_index");

        if (error) throw error;

        const items = data || [];
        agendaItemsRef.current[meetingId] = items;
        if (isMountedRef.current) {
          setAgendaItems((prev) => ({ ...prev, [meetingId]: items }));
        }

        await loadMeetingSystemData({ meetingId, items, meetingDate });
      } catch (error) {
        debugConsole.error("Error loading agenda:", error);
      } finally {
        inFlightRef.current.delete(meetingId);
        if (isMountedRef.current) setLoadingAgenda(null);
      }
    },
    [loadMeetingSystemData],
  );

  const toggleMeeting = useCallback(
    async (meetingId: string, meetingDate?: string) => {
      if (expandedMeetingId === meetingId) {
        setExpandedMeetingId(null);
        return;
      }

      setExpandedMeetingId(meetingId);
      await loadAgendaForMeeting(meetingId, meetingDate);
    },
    [expandedMeetingId, loadAgendaForMeeting],
  );

  const getAgendaData = useCallback(
    (meetingId: string): JourFixeAgendaData => ({
      items: agendaItems[meetingId] || [],
      loading: loadingAgenda === meetingId,
      notes: systemData.meetingQuickNotes[meetingId] || [],
      tasks: systemData.meetingTasks[meetingId] || [],
      decisions: systemData.meetingDecisions[meetingId] || [],
      birthdays: systemData.meetingBirthdays[meetingId] || [],
      caseItems: systemData.meetingCaseItems[meetingId] || [],
    }),
    [agendaItems, loadingAgenda, systemData.meetingBirthdays, systemData.meetingCaseItems, systemData.meetingDecisions, systemData.meetingQuickNotes, systemData.meetingTasks],
  );

  const systemDataMaps: JourFixeSystemDataMaps = {
    meetingQuickNotes: systemData.meetingQuickNotes,
    meetingTasks: systemData.meetingTasks,
    meetingDecisions: systemData.meetingDecisions,
    meetingBirthdays: systemData.meetingBirthdays,
    meetingCaseItems: systemData.meetingCaseItems,
    userProfiles: systemData.userProfiles,
  };

  return {
    expandedMeetingId,
    toggleMeeting,
    getAgendaData,
    systemDataMaps,
  };
}
