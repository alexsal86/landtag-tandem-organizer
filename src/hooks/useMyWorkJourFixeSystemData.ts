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

      const nowDate = new Date();
      const now = nowDate.toISOString();
      const in7Days = addDays(nowDate, 7).toISOString();

      const [notesResult, tasksResult, decisionsResult, contactsResult] = await Promise.all([
        hasNotes
          ? supabase
              .from("quick_notes")
              .select("id, title, user_id")
              .eq("meeting_id", meetingId)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as SystemItemData[], error: null }),
        hasTasks
          ? supabase.from("tasks").select("id, title, user_id").eq("meeting_id", meetingId)
          : Promise.resolve({ data: [] as SystemItemData[], error: null }),
        hasDecisions && tenantId && userId
          ? supabase
              .from("task_decisions")
              .select("id, title, created_by, task_decision_participants(user_id)")
              .eq("tenant_id", tenantId)
              .eq("status", "active")
              .or(`priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`)
              .order("priority", { ascending: false, nullsFirst: false })
              .order("response_deadline", { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        hasBirthdays && tenantId
          ? supabase
              .from("contacts")
              .select("id, name, birthday")
              .eq("tenant_id", tenantId)
              .not("birthday", "is", null)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; birthday: string | null }>, error: null }),
      ]);

      if (!isCurrentRequest()) return;

      if (notesResult.error) {
        console.error("Error loading quick notes for meeting:", { meetingId, error: notesResult.error });
      } else {
        const notes = notesResult.data || [];
        notes.forEach((note) => note.user_id && encounteredUserIds.add(note.user_id));
        setMeetingQuickNotes((prev) => ({ ...prev, [meetingId]: notes }));
      }

      if (tasksResult.error) {
        console.error("Error loading tasks for meeting:", { meetingId, error: tasksResult.error });
      } else {
        const tasks = tasksResult.data || [];
        tasks.forEach((task) => task.user_id && encounteredUserIds.add(task.user_id));
        setMeetingTasks((prev) => ({ ...prev, [meetingId]: tasks }));
      }

      if (decisionsResult.error) {
        console.error("Error loading decisions for meeting:", { meetingId, error: decisionsResult.error });
        setMeetingDecisions((prev) => ({ ...prev, [meetingId]: [] }));
      } else {
        const decisions = decisionsResult.data || [];
        const relevantDecisions = decisions
          .filter((decision: any) => {
            const participants = decision.task_decision_participants || [];
            return decision.created_by === userId || participants.some((participant: any) => participant.user_id === userId);
          })
          .map((decision: any) => ({
            id: decision.id,
            title: decision.title,
            user_id: decision.created_by,
          }));

        relevantDecisions.forEach((decision) => decision.user_id && encounteredUserIds.add(decision.user_id));
        setMeetingDecisions((prev) => ({ ...prev, [meetingId]: relevantDecisions }));
      }

      if (contactsResult.error) {
        console.error("Error loading birthdays for meeting:", { meetingId, error: contactsResult.error });
        setMeetingBirthdays((prev) => ({ ...prev, [meetingId]: [] }));
      } else {
        const contacts = contactsResult.data || [];
        if (contacts.length === 0) {
          setMeetingBirthdays((prev) => ({ ...prev, [meetingId]: [] }));
        } else {
          const referenceDate = meetingDate ? new Date(meetingDate) : new Date();
          const endDate = addDays(referenceDate, 14);
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
