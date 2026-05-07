import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import { STALE_TIME } from "@/lib/query-cache";
import { notify } from "@/lib/notify";

export interface TeamAnnouncement {
  id: string;
  tenant_id: string;
  author_id: string;
  title: string;
  message: string;
  priority: 'critical' | 'warning' | 'info' | 'success';
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  dismissal_count?: number;
  team_member_count?: number;
  is_dismissed?: boolean;
}

export interface CreateAnnouncementData {
  title: string;
  message: string;
  priority: 'critical' | 'warning' | 'info' | 'success';
  starts_at?: string | null;
  expires_at?: string | null;
}

const PRIORITY_ORDER: Record<TeamAnnouncement['priority'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

function computeActive(list: TeamAnnouncement[]): TeamAnnouncement[] {
  const now = new Date();
  const active = list.filter((a) => {
    if (!a.is_active) return false;
    if (a.is_dismissed) return false;
    if (a.starts_at && new Date(a.starts_at) > now) return false;
    if (a.expires_at && new Date(a.expires_at) < now) return false;
    return true;
  });
  active.sort((a, b) => {
    const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return active;
}

async function fetchAnnouncementsList(tenantId: string, userId: string): Promise<TeamAnnouncement[]> {
  const { data: announcementsData, error: announcementsError } = await supabase
    .from("team_announcements")
    .select("id, tenant_id, author_id, title, message, priority, starts_at, expires_at, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (announcementsError) throw announcementsError;

  const { data: dismissalsData, error: dismissalsError } = await supabase
    .from("team_announcement_dismissals")
    .select("announcement_id")
    .eq("user_id", userId);
  if (dismissalsError) throw dismissalsError;

  const dismissedIds = new Set((dismissalsData ?? []).map((d: { announcement_id: string }) => d.announcement_id));
  const authorIds = [...new Set((announcementsData ?? []).map((a: { author_id: string }) => a.author_id))];

  const { data: profilesData } = authorIds.length
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", authorIds)
    : { data: [] as Array<{ user_id: string; display_name: string | null }> };
  const profileMap = new Map((profilesData ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]));

  return (announcementsData ?? []).map((a) => ({
    ...a,
    priority: a.priority as TeamAnnouncement['priority'],
    author_name: profileMap.get(a.author_id) || "Unbekannt",
    is_dismissed: dismissedIds.has(a.id),
  }));
}

export function useTeamAnnouncements() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const userId = user?.id;
  const queryKey = ["team-announcements", tenantId, userId] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!tenantId && !!userId,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    queryFn: () => fetchAnnouncementsList(tenantId as string, userId as string),
  });

  const announcements = data ?? [];
  const activeAnnouncements = computeActive(announcements);

  // Realtime: invalidate on changes
  useEffect(() => {
    if (!tenantId || !userId) return;
    const channelName = `team-announcements-${tenantId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_announcements', filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_announcement_dismissals', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, userId, queryClient, queryKey]);

  // Tick: re-evaluate expiry every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render through cache touch only when something actually expired
      const list = queryClient.getQueryData<TeamAnnouncement[]>(queryKey);
      if (!list) return;
      const stillActive = computeActive(list);
      const before = computeActive(list).length;
      if (stillActive.length !== before) {
        queryClient.setQueryData<TeamAnnouncement[]>(queryKey, [...list]);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [queryClient, queryKey]);

  const patchCache = (patcher: (prev: TeamAnnouncement[]) => TeamAnnouncement[]) => {
    queryClient.setQueryData<TeamAnnouncement[]>(queryKey, (prev) => patcher(prev ?? []));
  };

  const createAnnouncement = async (input: CreateAnnouncementData) => {
    if (!userId || !tenantId) {
      notify.error("Nicht angemeldet");
      return null;
    }
    try {
      const { data: newAnnouncement, error } = await supabase
        .from("team_announcements")
        .insert([{
          tenant_id: tenantId,
          author_id: userId,
          title: input.title,
          message: input.message,
          priority: input.priority,
          starts_at: input.starts_at || null,
          expires_at: input.expires_at || null,
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw error;

      try {
        const { data: members } = await supabase
          .from("user_tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .neq("user_id", userId);
        if (members && members.length > 0) {
          const notifications = members.map((m: { user_id: string }) =>
            supabase.rpc("create_notification", {
              user_id_param: m.user_id,
              type_name: "team_news",
              title_param: `Team-Mitteilung: ${input.title}`,
              message_param: input.message.substring(0, 200),
              priority_param: input.priority === "critical" ? "high" : "medium",
              data_param: JSON.stringify({ announcement_id: newAnnouncement.id }),
            })
          );
          await Promise.allSettled(notifications);
        }
      } catch (pushErr) {
        debugConsole.error("Error sending announcement notifications:", pushErr);
      }

      notify.success("Mitteilung erstellt");
      await refetch();
      return newAnnouncement;
    } catch (error) {
      debugConsole.error("Error creating announcement:", error);
      notify.error("Fehler beim Erstellen der Mitteilung");
      return null;
    }
  };

  const updateAnnouncement = async (id: string, patch: Partial<CreateAnnouncementData & { is_active: boolean }>) => {
    const previous = queryClient.getQueryData<TeamAnnouncement[]>(queryKey);
    patchCache((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    try {
      const { data: updateData, error } = await supabase
        .from("team_announcements")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (updateData) {
        patchCache((prev) => prev.map((a) => (a.id === id ? { ...a, ...updateData, priority: updateData.priority as TeamAnnouncement['priority'] } : a)));
      }
      notify.success("Mitteilung aktualisiert");
      await refetch();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      debugConsole.error("Error updating announcement:", error);
      if (previous) queryClient.setQueryData(queryKey, previous);
      notify.error(`Fehler: ${msg}`);
      return false;
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase.from("team_announcements").delete().eq("id", id);
      if (error) throw error;
      notify.success("Mitteilung gelöscht");
      await refetch();
      return true;
    } catch (error) {
      debugConsole.error("Error deleting announcement:", error);
      notify.error("Fehler beim Löschen");
      return false;
    }
  };

  const dismissAnnouncement = async (announcementId: string) => {
    if (!userId) {
      notify.error("Nicht angemeldet");
      return false;
    }
    try {
      const { error } = await supabase
        .from("team_announcement_dismissals")
        .insert([{ announcement_id: announcementId, user_id: userId }]);
      if (error) throw error;
      patchCache((prev) => prev.map((a) => (a.id === announcementId ? { ...a, is_dismissed: true } : a)));
      notify.success("Als erledigt markiert");
      return true;
    } catch (error) {
      debugConsole.error("Error dismissing announcement:", error);
      notify.error("Fehler beim Markieren");
      return false;
    }
  };

  const undoDismissal = async (announcementId: string) => {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from("team_announcement_dismissals")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", userId);
      if (error) throw error;
      await refetch();
      notify.success("Erledigt-Markierung aufgehoben");
      return true;
    } catch (error) {
      debugConsole.error("Error undoing dismissal:", error);
      return false;
    }
  };

  return {
    announcements,
    activeAnnouncements,
    loading: isLoading,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    dismissAnnouncement,
    undoDismissal,
    refetch,
  };
}

interface AnnouncementProgress {
  dismissedCount: number;
  totalCount: number;
  dismissals: Array<{ user_id: string; display_name: string; dismissed_at: string }>;
}

export function useAnnouncementProgress(announcementId: string) {
  const { currentTenant } = useTenant();

  const query = useQuery<AnnouncementProgress>({
    queryKey: ["team-announcement-progress", announcementId, currentTenant?.id],
    enabled: !!announcementId && !!currentTenant?.id,
    staleTime: STALE_TIME.LIST,
    queryFn: async () => {
      const { data: dismissalsData, error: dismissalsError } = await supabase
        .from("team_announcement_dismissals")
        .select("user_id, dismissed_at")
        .eq("announcement_id", announcementId);
      if (dismissalsError) throw dismissalsError;

      const { data: membersData, error: membersError } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true);
      if (membersError) throw membersError;

      const dismissedUserIds = (dismissalsData ?? []).map((d: { user_id: string }) => d.user_id);
      const { data: profilesData } = dismissedUserIds.length
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", dismissedUserIds)
        : { data: [] as Array<{ user_id: string; display_name: string | null }> };
      const profileMap = new Map((profilesData ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]));

      const dismissals = (dismissalsData ?? []).map((d: { user_id: string; dismissed_at: string }) => ({
        user_id: d.user_id,
        display_name: profileMap.get(d.user_id) || "Unbekannt",
        dismissed_at: d.dismissed_at,
      }));

      return {
        dismissedCount: dismissalsData?.length || 0,
        totalCount: membersData?.length || 0,
        dismissals,
      };
    },
  });

  return {
    progress: query.data ?? { dismissedCount: 0, totalCount: 0, dismissals: [] },
    loading: query.isLoading,
  };
}
