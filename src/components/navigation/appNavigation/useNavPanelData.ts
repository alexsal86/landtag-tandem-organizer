import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { ActivePanel, QuickAccessAddCategory, UpcomingAppointmentItem } from "./types";

const STALE = 2 * 60 * 1000;

interface UseNavPanelDataParams {
  activePanel: ActivePanel;
  quickAccessPopoverOpen: boolean;
  quickAccessAddCategory: QuickAccessAddCategory | null;
}

interface UserProfile {
  display_name?: string | null;
  avatar_url?: string | null;
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

export function useNavPanelData({
  activePanel,
  quickAccessPopoverOpen,
  quickAccessAddCategory,
}: UseNavPanelDataParams) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // User profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    const loadProfile = async () => {
      if (user && tenantId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        setUserProfile(profile ?? null);
      }
    };
    void loadProfile();
  }, [user, tenantId]);

  // Upcoming appointments
  const endDate = addDays(new Date(), 5);
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["nav-upcoming-appointments", tenantId],
    queryFn: async (): Promise<UpcomingAppointmentItem[]> => {
      if (!tenantId || !user?.id) return [];
      const nowIso = new Date().toISOString();
      const [appointmentsResult, externalEventsResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, title, start_time, end_time, location, is_all_day")
          .eq("tenant_id", tenantId)
          .eq("user_id", user.id)
          .gte("start_time", nowIso)
          .lte("start_time", endDate.toISOString())
          .order("start_time", { ascending: true })
          .limit(20),
        supabase
          .from("external_events")
          .select(
            "id, title, start_time, end_time, location, all_day, external_calendars!inner(user_id, tenant_id)"
          )
          .eq("external_calendars.tenant_id", tenantId)
          .eq("external_calendars.user_id", user.id)
          .gte("start_time", nowIso)
          .lte("start_time", endDate.toISOString())
          .order("start_time", { ascending: true })
          .limit(20),
      ]);

      const internal: UpcomingAppointmentItem[] = (appointmentsResult.data || []).map(
        (a: Record<string, any>) => ({
          id: a.id,
          title: a.title,
          start_time: a.start_time,
          end_time: a.end_time,
          location: a.location,
          is_all_day: a.is_all_day ?? false,
        })
      );
      const external: UpcomingAppointmentItem[] = (externalEventsResult.data || []).map(
        (e: Record<string, any>) => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time,
          end_time: e.end_time,
          location: e.location,
          is_all_day: e.all_day ?? false,
        })
      );
      return [...internal, ...external]
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 20);
    },
    enabled: !!tenantId && !!user?.id && activePanel === "appointments",
    staleTime: STALE,
  });

  // Pending feedbacks
  const { data: pendingFeedbacks = [] } = useQuery({
    queryKey: ["nav-pending-feedbacks", tenantId],
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
    enabled: !!tenantId && !!user?.id && activePanel === "appointments",
    staleTime: STALE,
  });

  // Case files
  const { data: caseFiles = [] } = useQuery({
    queryKey: ["nav-casefiles", tenantId],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];
      const { data } = await supabase
        .from("case_files")
        .select("id, title, status, priority, case_type, reference_number, updated_at")
        .eq("tenant_id", tenantId)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!tenantId && !!user?.id && activePanel === "casefiles",
    staleTime: STALE,
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
        .map((item: Record<string, any>) => ({
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
        .map((item: Record<string, any>) => ({
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
          (entry: Record<string, any>) => entry.event_planning_id
        )
      );
      return (planningsResult.data || [])
        .map((p: Record<string, any>) => ({
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
    upcomingAppointments,
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
