import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { NavPreviewGroup, QuickAccessAddCategory, UpcomingAppointmentItem } from "./types";

const STALE = 2 * 60 * 1000;

interface UseNavPanelDataParams {
  previewGroup: NavPreviewGroup | null;
  quickAccessPopoverOpen: boolean;
  quickAccessAddCategory: QuickAccessAddCategory | null;
}

interface QuickAccessItem {
  id: string;
  label: string;
  preferred: boolean;
  updatedAt: string;
}

const sortByPreferredThenDate = (a: QuickAccessItem, b: QuickAccessItem) => {
  if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
};

export function useSidebarProfile() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ["nav-profile", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("display_name, avatar_url").eq("user_id", user!.id).eq("tenant_id", tenantId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useNavPanelData({ previewGroup, quickAccessPopoverOpen, quickAccessAddCategory }: UseNavPanelDataParams) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data: userProfile } = useSidebarProfile();

  // Upcoming appointments
  const { data: upcomingAppointments = [], isLoading: appointmentsLoading, isError: appointmentsError } = useQuery({
    queryKey: ["nav-upcoming-appointments", tenantId, user?.id],
    queryFn: async (): Promise<UpcomingAppointmentItem[]> => {
      if (!tenantId || !user?.id) return [];
      const now = new Date();
      const nowIso = now.toISOString();
      const [appointmentsResult, externalEventsResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, title, start_time, end_time, location, is_all_day, briefing_status")
          .eq("tenant_id", tenantId)
          .eq("user_id", user.id)
          .or("category.is.null,category.not.in.(birthday,blocked)")
          .or("status.is.null,status.not.in.(cancelled,canceled)")
          .or(`start_time.gte.${nowIso},and(start_time.lt.${nowIso},end_time.gt.${nowIso})`)
          .order("start_time", { ascending: true })
          .limit(20),
        supabase
          .from("external_events")
          .select(
            "id, title, start_time, end_time, location, all_day, external_calendars!inner(user_id, tenant_id)"
          )
          .eq("external_calendars.tenant_id", tenantId)
          .eq("external_calendars.user_id", user.id)
          .or(`start_time.gte.${nowIso},and(start_time.lt.${nowIso},end_time.gt.${nowIso})`)
          .order("start_time", { ascending: true })
          .limit(20),
      ]);

      if (appointmentsResult.error && externalEventsResult.error) throw appointmentsResult.error;

      const internal: UpcomingAppointmentItem[] = (appointmentsResult.data || []).map(
        (a) => ({
          id: a.id,
          title: a.title,
          start_time: a.start_time,
          end_time: a.end_time,
          location: a.location,
          is_all_day: a.is_all_day ?? false,
          briefingStatus: a.briefing_status ?? undefined,
        })
      );
      const external: UpcomingAppointmentItem[] = (externalEventsResult.data || []).map(
        (e) => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time,
          end_time: e.end_time,
          location: e.location,
          is_all_day: e.all_day ?? false,
          isExternal: true,
        })
      );
      return [...internal, ...external]
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 20);
    },
    enabled: !!tenantId && !!user?.id,
    refetchInterval: 60_000,
    staleTime: STALE,
  });

  const nextAppointment = upcomingAppointments.find((appointment) => Date.parse(appointment.start_time) >= Date.now())
    ?? upcomingAppointments.find((appointment) => appointment.is_all_day && Date.parse(appointment.end_time ?? "") > Date.now());
  const briefingAppointmentId = nextAppointment?.briefingStatus && nextAppointment.briefingStatus !== "none"
    ? nextAppointment.id
    : undefined;
  const { data: briefing } = useQuery({
    queryKey: ["nav-appointment-briefing", tenantId, user?.id, briefingAppointmentId],
    enabled: previewGroup === "calendar" && !!tenantId && !!user?.id && !!briefingAppointmentId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_preparations")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("appointment_id", briefingAppointmentId!)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: previewTask, isLoading: taskLoading, isError: taskError } = useQuery({
    queryKey: ["nav-preview-task", tenantId, user?.id],
    enabled: previewGroup === "tasks" && !!tenantId && !!user?.id,
    staleTime: STALE,
    queryFn: async () => {
      const openTasks = () => supabase
        .from("tasks")
        .select("id, title, due_date, next_action_due, next_action, ball_owner, ball_assignee_id, ball_external_label")
        .eq("tenant_id", tenantId!)
        .is("parent_task_id", null)
        .neq("status", "completed")
        .not("category", "in", "(call_follow_up,call_followup)");

      const [nextStep, regular] = await Promise.all([
        openTasks().not("next_action_due", "is", null)
          .order("next_action_due").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        openTasks().is("next_action_due", null)
          .order("due_date", { nullsFirst: false }).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (nextStep.error) throw nextStep.error;
      if (regular.error) throw regular.error;

      const stepDue = nextStep.data?.next_action_due;
      const taskDue = regular.data?.due_date;
      return stepDue && (!taskDue || stepDue <= taskDue) ? nextStep.data : regular.data;
    },
  });

  // Pending feedbacks
  const { data: pendingFeedbacks = [] } = useQuery({
    queryKey: ["nav-pending-feedbacks", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];
      const { data } = await supabase
        .from("appointment_feedback")
        .select("id, event_type, created_at, appointment_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("feedback_status", "pending")
        .limit(10);
      return data || [];
    },
    enabled: !!tenantId && !!user?.id && previewGroup === "calendar",
    staleTime: STALE,
  });

  // Case files
  const { data: caseFiles = [], isLoading: caseFilesLoading, isError: caseFilesError } = useQuery({
    queryKey: ["nav-casefiles", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];
      const { data, error } = await supabase
        .from("case_files")
        .select("id, title, status, priority, case_type, reference_number, updated_at, current_status_note")
        .eq("tenant_id", tenantId)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!user?.id && (previewGroup === "files" || previewGroup === "people"),
    staleTime: STALE,
  });

  const contactAppointment = nextAppointment?.isExternal ? undefined : nextAppointment;
  const contactCase = caseFiles[0];
  const { data: previewContact, isLoading: contactLoading, isError: contactError } = useQuery({
    queryKey: ["nav-contact-preview", tenantId, user?.id, contactAppointment?.id, contactCase?.id],
    enabled: previewGroup === "people" && !!tenantId && !!user?.id && !appointmentsLoading && !caseFilesLoading,
    staleTime: STALE,
    queryFn: async () => {
      const columns = "contacts!inner(id, name, organization, position), role";
      if (contactAppointment) {
        const { data, error } = await supabase.from("appointment_contacts").select(columns)
          .eq("appointment_id", contactAppointment.id)
          .eq("contacts.tenant_id", tenantId!)
          .order("created_at").limit(1).maybeSingle();
        if (error) throw error;
        if (data?.contacts) {
          return { contact: data.contacts, role: data.role, context: `Zum Termin „${contactAppointment.title}“` };
        }
      }
      if (contactCase) {
        const { data, error } = await supabase.from("case_file_contacts").select(columns)
          .eq("case_file_id", contactCase.id)
          .eq("contacts.tenant_id", tenantId!)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (data?.contacts) {
          return { contact: data.contacts, role: data.role, context: `Aus der Fallakte „${contactCase.title}“` };
        }
      }
      const { data, error } = await supabase.from("contacts").select("id, name, organization, position")
        .eq("tenant_id", tenantId!).eq("user_id", user!.id).eq("is_favorite", true)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? { contact: data, role: null, context: "Favorit" } : null;
    },
  });

  // Quick access: case items
  const { data: quickAccessCaseItems = [], isLoading: isCaseItemsLoading } = useQuery({
    queryKey: ["quick-access-case-items", tenantId, user?.id],
    queryFn: async (): Promise<QuickAccessItem[]> => {
      if (!tenantId || !user?.id) return [];
      const { data, error } = await supabase
        .from("case_items")
        .select("id, subject, updated_at, user_id, owner_user_id, status")
        .eq("tenant_id", tenantId)
        .neq("status", "archiviert")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data || [])
        .map((item) => ({
          id: item.id,
          label: item.subject?.trim() || "Vorgang ohne Betreff",
          preferred: item.owner_user_id === user.id || item.user_id === user.id,
          updatedAt: item.updated_at,
        }))
        .sort(sortByPreferredThenDate);
    },
    enabled:
      !!quickAccessPopoverOpen &&
      quickAccessAddCategory === "case-items" &&
      !!tenantId &&
      !!user?.id,
    staleTime: STALE,
  });

  // Quick access: documents
  const { data: quickAccessDocuments = [], isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["quick-access-documents", tenantId, user?.id],
    queryFn: async (): Promise<QuickAccessItem[]> => {
      if (!tenantId || !user?.id) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, updated_at, user_id")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data || [])
        .map((item) => ({
          id: item.id,
          label: item.title?.trim() || "Dokument ohne Titel",
          preferred: item.user_id === user.id,
          updatedAt: item.updated_at,
        }))
        .sort(sortByPreferredThenDate);
    },
    enabled:
      !!quickAccessPopoverOpen &&
      quickAccessAddCategory === "documents" &&
      !!tenantId &&
      !!user?.id,
    staleTime: STALE,
  });

  // Quick access: event plannings
  const { data: quickAccessEventPlannings = [], isLoading: isEventPlanningsLoading } = useQuery({
    queryKey: ["quick-access-event-plannings", tenantId, user?.id],
    queryFn: async (): Promise<QuickAccessItem[]> => {
      if (!tenantId || !user?.id) return [];
      const [planningsResult, collaboratorsResult] = await Promise.all([
        supabase
          .from("event_plannings")
          .select("id, title, updated_at, user_id, is_archived")
          .eq("tenant_id", tenantId)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("event_planning_collaborators")
          .select("event_planning_id")
          .eq("user_id", user.id),
      ]);
      if (planningsResult.error) throw planningsResult.error;
      if (collaboratorsResult.error) throw collaboratorsResult.error;
      const collaboratorIds = new Set(
        (collaboratorsResult.data || []).map(
          (entry) => entry.event_planning_id
        )
      );
      return (planningsResult.data || [])
        .map((p) => ({
          id: p.id,
          label: p.title?.trim() || "Planung ohne Titel",
          preferred: p.user_id === user.id || collaboratorIds.has(p.id),
          updatedAt: p.updated_at,
        }))
        .sort(sortByPreferredThenDate);
    },
    enabled:
      !!quickAccessPopoverOpen &&
      quickAccessAddCategory === "event-plannings" &&
      !!tenantId &&
      !!user?.id,
    staleTime: STALE,
  });

  return {
    userProfile,
    upcomingAppointments: upcomingAppointments.filter(appointment => Date.parse(appointment.start_time) <= addDays(new Date(), 5).getTime()),
    nextAppointment,
    appointmentsLoading,
    appointmentsError,
    briefing,
    previewTask,
    taskLoading,
    taskError,
    caseFilesLoading,
    caseFilesError,
    previewContact,
    contactLoading: contactLoading || appointmentsLoading || caseFilesLoading,
    contactError,
    pendingFeedbacks,
    caseFiles,
    quickAccessCaseItems,
    isCaseItemsLoading,
    quickAccessDocuments,
    isDocumentsLoading,
    quickAccessEventPlannings,
    isEventPlanningsLoading,
  };
}
