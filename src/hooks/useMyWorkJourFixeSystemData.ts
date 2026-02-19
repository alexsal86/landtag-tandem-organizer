import { useCallback, useRef, useState } from "react";
import { addDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface AgendaItem {
  id: string;
  title: string;
  parent_id: string | null;
  order_index: number;
  system_type?: string | null;
}

export interface SystemItemData {
  id: string;
  title: string;
  user_id?: string;
}

export interface UserProfileData {
  user_id: string;
  display_name: string | null;
}

export interface BirthdayItemData {
  id: string;
  name: string;
  birthDate: Date;
  nextBirthday: Date;
  age: number;
}

interface LoadSystemDataParams {
  meetingId: string;
  items: AgendaItem[];
  meetingDate?: string;
}

export function useMyWorkJourFixeSystemData(userId?: string, tenantId?: string) {
  const [meetingQuickNotes, setMeetingQuickNotes] = useState<Record<string, SystemItemData[]>>({});
  const [meetingTasks, setMeetingTasks] = useState<Record<string, SystemItemData[]>>({});
  const [meetingDecisions, setMeetingDecisions] = useState<Record<string, SystemItemData[]>>({});
  const [meetingBirthdays, setMeetingBirthdays] = useState<Record<string, BirthdayItemData[]>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileData>>({});
  const isMountedRef = useRef(true);
  const requestVersionRef = useRef(0);

  const setMounted = useCallback((mounted: boolean) => {
    isMountedRef.current = mounted;
    if (!mounted) {
      requestVersionRef.current += 1;
    }
  }, []);

  const loadMeetingSystemData = useCallback(
    async ({ meetingId, items, meetingDate }: LoadSystemDataParams) => {
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      const isCurrentRequest = () => isMountedRef.current && requestVersionRef.current === requestVersion;

      const hasNotes = items.some((i) => i.system_type === "quick_notes");
      const hasTasks = items.some((i) => i.system_type === "tasks");
      const hasDecisions = items.some((i) => i.system_type === "decisions");
      const hasBirthdays = items.some((i) => i.system_type === "birthdays");
      const encounteredUserIds = new Set<string>();

      if (hasNotes) {
        try {
          const { data } = await supabase
            .from("quick_notes")
            .select("id, title, user_id")
            .eq("meeting_id", meetingId)
            .is("deleted_at", null);

          if (!isCurrentRequest()) return;

          (data || []).forEach((note) => note.user_id && encounteredUserIds.add(note.user_id));
          setMeetingQuickNotes((prev) => ({ ...prev, [meetingId]: data || [] }));
        } catch (error) {
          if (isCurrentRequest()) {
            console.error("Error loading quick notes for meeting:", { meetingId, error });
          }
        }
      }

      if (hasTasks) {
        try {
          const { data } = await supabase.from("tasks").select("id, title, user_id").eq("meeting_id", meetingId);

          if (!isCurrentRequest()) return;

          (data || []).forEach((task) => task.user_id && encounteredUserIds.add(task.user_id));
          setMeetingTasks((prev) => ({ ...prev, [meetingId]: data || [] }));
        } catch (error) {
          if (isCurrentRequest()) {
            console.error("Error loading tasks for meeting:", { meetingId, error });
          }
        }
      }

      if (hasDecisions && tenantId && userId) {
        try {
          const nowDate = new Date();
          const now = nowDate.toISOString();
          const in7Days = addDays(nowDate, 7).toISOString();
          const { data: decisions } = await supabase
            .from("task_decisions")
            .select("id, title, created_by, status, response_deadline, priority")
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .or(`priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`)
            .order("priority", { ascending: false, nullsFirst: false })
            .order("response_deadline", { ascending: true, nullsFirst: false });

          if (!isCurrentRequest()) return;

          const decisionIds = (decisions || []).map((decision) => decision.id);
          let participantRows: Array<{ decision_id: string; user_id: string }> = [];

          if (decisionIds.length > 0) {
            const { data: participants } = await supabase
              .from("task_decision_participants")
              .select("decision_id, user_id")
              .in("decision_id", decisionIds);

            if (!isCurrentRequest()) return;

            participantRows = participants || [];
          }

          const relevantDecisions = (decisions || [])
            .filter(
              (decision) =>
                decision.created_by === userId ||
                participantRows.some((participant) => participant.decision_id === decision.id && participant.user_id === userId),
            )
            .map((decision) => ({
              id: decision.id,
              title: decision.title,
              user_id: decision.created_by,
            }));

          relevantDecisions.forEach((decision) => decision.user_id && encounteredUserIds.add(decision.user_id));
          setMeetingDecisions((prev) => ({ ...prev, [meetingId]: relevantDecisions }));
        } catch (error) {
          if (isCurrentRequest()) {
            console.error("Error loading decisions for meeting:", { meetingId, error });
            setMeetingDecisions((prev) => ({ ...prev, [meetingId]: [] }));
          }
        }
      }

      if (hasBirthdays && tenantId) {
        try {
          const referenceDate = meetingDate ? new Date(meetingDate) : new Date();
          const endDate = addDays(referenceDate, 14);

          const { data: contacts } = await supabase
            .from("contacts")
            .select("id, name, birthday")
            .eq("tenant_id", tenantId)
            .not("birthday", "is", null);

          if (!isCurrentRequest()) return;

          if (!contacts || contacts.length === 0) {
            setMeetingBirthdays((prev) => ({ ...prev, [meetingId]: [] }));
            return;
          }

          const birthdays: BirthdayItemData[] = [];
          const referenceYear = referenceDate.getFullYear();

          for (const contact of contacts) {
            if (!contact.birthday) continue;

            const originalBirthday = parseISO(contact.birthday);
            if (Number.isNaN(originalBirthday.getTime())) continue;
            const month = originalBirthday.getMonth();
            const day = originalBirthday.getDate();

            for (const year of [referenceYear, referenceYear + 1]) {
              const nextBirthday = new Date(year, month, day);
              if (nextBirthday >= referenceDate && nextBirthday <= endDate) {
                birthdays.push({
                  id: contact.id,
                  name: contact.name,
                  birthDate: originalBirthday,
                  nextBirthday,
                  age: year - originalBirthday.getFullYear(),
                });
                break;
              }
            }
          }

          birthdays.sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());
          setMeetingBirthdays((prev) => ({ ...prev, [meetingId]: birthdays }));
        } catch (error) {
          if (isCurrentRequest()) {
            console.error("Error loading birthdays for meeting:", { meetingId, error });
            setMeetingBirthdays((prev) => ({ ...prev, [meetingId]: [] }));
          }
        }
      }

      if (encounteredUserIds.size === 0) return;

      try {
        const missingUserIds = Array.from(encounteredUserIds).filter((id) => !userProfiles[id]);
        if (missingUserIds.length === 0) return;

        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", missingUserIds);

        if (!isCurrentRequest() || !profiles || profiles.length === 0) return;

        setUserProfiles((prev) => {
          const next = { ...prev };
          profiles.forEach((profile) => {
            next[profile.user_id] = profile;
          });
          return next;
        });
      } catch (error) {
        if (isCurrentRequest()) {
          console.error("Error loading profiles for meeting system data:", { meetingId, error });
        }
      }
    },
    [tenantId, userId, userProfiles],
  );

  return {
    meetingQuickNotes,
    meetingTasks,
    meetingDecisions,
    meetingBirthdays,
    userProfiles,
    loadMeetingSystemData,
    setMounted,
  };
}
