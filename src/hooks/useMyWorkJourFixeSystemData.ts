import { useCallback, useRef, useState } from "react";
import { addDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

export interface AgendaItem {
  id: string;
  title: string;
  parent_id: string | null;
  order_index: number;
  system_type?: string | null;
}

export interface CaseItemData {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  owner_user_id: string | null;
}

export interface SystemItemData {
  id: string;
  title: string | null;
  user_id?: string;
}

export interface UserProfileData {
  user_id: string;
  display_name: string | null;
}

interface TaskDecisionParticipantRow {
  user_id: string;
}

interface TaskDecisionRow {
  id: string;
  title: string;
  created_by: string;
  task_decision_participants: TaskDecisionParticipantRow[] | null;
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
  const [meetingCaseItems, setMeetingCaseItems] = useState<Record<string, CaseItemData[]>>({});
   const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileData>>({});
   const userProfilesRef = useRef<Record<string, UserProfileData>>({});
   const isMountedRef = useRef(true);
  const requestVersionsRef = useRef<Record<string, number>>({});

  const setMounted = useCallback((mounted: boolean) => {
    isMountedRef.current = mounted;
    if (!mounted) {
      requestVersionsRef.current = {};
    }
  }, []);

  const loadMeetingSystemData = useCallback(
    async ({ meetingId, items, meetingDate }: LoadSystemDataParams) => {
      const requestVersion = (requestVersionsRef.current[meetingId] || 0) + 1;
      requestVersionsRef.current[meetingId] = requestVersion;
      const isCurrentRequest =
        () => isMountedRef.current && requestVersionsRef.current[meetingId] === requestVersion;

      const hasNotes = items.some((i) => i.system_type === "quick_notes");
      const hasTasks = items.some((i) => i.system_type === "tasks");
      const hasDecisions = items.some((i) => i.system_type === "decisions");
      const hasBirthdays = items.some((i) => i.system_type === "birthdays");
      const hasCaseItems = items.some((i) => i.system_type === "case_items");
      const encounteredUserIds = new Set<string>();

      const nowDate = new Date();
      const now = nowDate.toISOString();
      const in7Days = addDays(nowDate, 7).toISOString();

      const [notesResult, tasksResult, decisionsResult, contactsResult, caseItemsResult] = await Promise.all([
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
          : Promise.resolve({ data: [] as TaskDecisionRow[], error: null }),
        hasBirthdays && tenantId
          ? supabase
              .from("contacts")
              .select("id, name, birthday")
              .eq("tenant_id", tenantId)
              .not("birthday", "is", null)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; birthday: string | null }>, error: null }),
        hasCaseItems && tenantId
          ? supabase
              .from("case_items")
              .select("id, subject, status, priority, due_at, owner_user_id")
              .eq("meeting_id", meetingId)
              .neq("status", "erledigt")
          : Promise.resolve({ data: [] as CaseItemData[], error: null }),
      ]);

      if (!isCurrentRequest()) return;

      if (notesResult.error) {
        debugConsole.error("Error loading quick notes for meeting:", { meetingId, error: notesResult.error });
      } else {
        const notes = notesResult.data || [];
        notes.forEach((note: Record<string, any>) => note.user_id && encounteredUserIds.add(note.user_id));
        setMeetingQuickNotes((prev) => ({ ...prev, [meetingId]: notes }));
      }

      if (tasksResult.error) {
        debugConsole.error("Error loading tasks for meeting:", { meetingId, error: tasksResult.error });
      } else {
        const tasks = tasksResult.data || [];
        tasks.forEach((task: Record<string, any>) => task.user_id && encounteredUserIds.add(task.user_id));
        setMeetingTasks((prev) => ({ ...prev, [meetingId]: tasks }));
      }

      if (decisionsResult.error) {
        debugConsole.error("Error loading decisions for meeting:", { meetingId, error: decisionsResult.error });
        // Don't reset to [] on error – keep existing data
      } else {
        const decisions = decisionsResult.data || [];
        const relevantDecisions = decisions
          .filter((decision: TaskDecisionRow) => {
            const participants = decision.task_decision_participants || [];
            return decision.created_by === userId || participants.some((participant) => participant.user_id === userId);
          })
          .map((decision: TaskDecisionRow) => ({
            id: decision.id,
            title: decision.title,
            user_id: decision.created_by,
          }));

        relevantDecisions.forEach((decision: Record<string, any>) => decision.user_id && encounteredUserIds.add(decision.user_id));
        setMeetingDecisions((prev) => ({ ...prev, [meetingId]: relevantDecisions }));
      }

      if (contactsResult.error) {
        debugConsole.error("Error loading birthdays for meeting:", { meetingId, error: contactsResult.error });
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

      if (caseItemsResult.error) {
        debugConsole.error("Error loading case items for meeting:", { meetingId, error: caseItemsResult.error });
        // Don't reset to [] on error – keep existing data
      } else {
        const items = (caseItemsResult.data || []) as CaseItemData[];
        items.forEach((ci) => ci.owner_user_id && encounteredUserIds.add(ci.owner_user_id));
        setMeetingCaseItems((prev) => ({ ...prev, [meetingId]: items }));
      }

      if (encounteredUserIds.size === 0) return;

      try {
        const currentProfiles = userProfilesRef.current;
        const missingUserIds = Array.from(encounteredUserIds).filter((id) => !currentProfiles[id]);
        if (missingUserIds.length === 0) return;

        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", missingUserIds);

        if (!isCurrentRequest() || !profiles || profiles.length === 0) return;

        setUserProfiles((prev) => {
          const next = { ...prev };
          profiles.forEach((profile: Record<string, any>) => {
            next[profile.user_id] = profile;
          });
          userProfilesRef.current = next;
          return next;
        });
      } catch (error) {
        if (isCurrentRequest()) {
          debugConsole.error("Error loading profiles for meeting system data:", { meetingId, error });
        }
      }
    },
    [tenantId, userId],
  );

  return {
    meetingQuickNotes,
    meetingTasks,
    meetingDecisions,
    meetingBirthdays,
    meetingCaseItems,
    userProfiles,
    loadMeetingSystemData,
    setMounted,
  };
}
