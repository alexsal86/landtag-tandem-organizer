import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

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

export function useTeamAnnouncements() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setAnnouncements([]);
      setActiveAnnouncements([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch all announcements for this tenant
      const { data: announcementsData, error: announcementsError } = await supabase
        .from("team_announcements")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (announcementsError) throw announcementsError;

      // Fetch user's dismissals
      const { data: dismissalsData, error: dismissalsError } = await supabase
        .from("team_announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id);

      if (dismissalsError) throw dismissalsError;

      const dismissedIds = new Set(dismissalsData?.map(d => d.announcement_id) || []);

      // Fetch author profiles
      const authorIds = [...new Set(announcementsData?.map(a => a.author_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.display_name]) || []);

      // Enrich announcements with author names and dismissal status
      const enrichedAnnouncements = (announcementsData || []).map(announcement => ({
        ...announcement,
        priority: announcement.priority as TeamAnnouncement['priority'],
        author_name: profileMap.get(announcement.author_id) || "Unbekannt",
        is_dismissed: dismissedIds.has(announcement.id),
      }));

      setAnnouncements(enrichedAnnouncements);

      // Filter active announcements for banner display
      const now = new Date();
      const active = enrichedAnnouncements.filter(a => {
        if (!a.is_active) return false;
        if (a.is_dismissed) return false;
        if (a.starts_at && new Date(a.starts_at) > now) return false;
        if (a.expires_at && new Date(a.expires_at) < now) return false;
        return true;
      });

      // Sort by priority (critical > warning > info > success) then by date
      const priorityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
      active.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setActiveAnnouncements(active);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentTenant?.id]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Set up realtime subscription
  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('team-announcements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_announcements',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchAnnouncements();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_announcement_dismissals',
        },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, fetchAnnouncements]);

  // Check for expired announcements every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setActiveAnnouncements(prev => 
        prev.filter(a => !a.expires_at || new Date(a.expires_at) > now)
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const createAnnouncement = async (data: CreateAnnouncementData) => {
    if (!user?.id || !currentTenant?.id) {
      toast.error("Nicht angemeldet");
      return null;
    }

    try {
      const { data: newAnnouncement, error } = await supabase
        .from("team_announcements")
        .insert({
          tenant_id: currentTenant.id,
          author_id: user.id,
          title: data.title,
          message: data.message,
          priority: data.priority,
          starts_at: data.starts_at || null,
          expires_at: data.expires_at || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Mitteilung erstellt");
      await fetchAnnouncements();
      return newAnnouncement;
    } catch (error) {
      console.error("Error creating announcement:", error);
      toast.error("Fehler beim Erstellen der Mitteilung");
      return null;
    }
  };

  const updateAnnouncement = async (id: string, data: Partial<CreateAnnouncementData & { is_active: boolean }>) => {
    try {
      const { error } = await supabase
        .from("team_announcements")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      toast.success("Mitteilung aktualisiert");
      await fetchAnnouncements();
      return true;
    } catch (error) {
      console.error("Error updating announcement:", error);
      toast.error("Fehler beim Aktualisieren");
      return false;
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from("team_announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Mitteilung gelöscht");
      await fetchAnnouncements();
      return true;
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast.error("Fehler beim Löschen");
      return false;
    }
  };

  const dismissAnnouncement = async (announcementId: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return false;
    }

    try {
      const { error } = await supabase
        .from("team_announcement_dismissals")
        .insert({
          announcement_id: announcementId,
          user_id: user.id,
        });

      if (error) throw error;

      // Optimistic update
      setActiveAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      setAnnouncements(prev => 
        prev.map(a => a.id === announcementId ? { ...a, is_dismissed: true } : a)
      );

      toast.success("Als erledigt markiert");
      return true;
    } catch (error) {
      console.error("Error dismissing announcement:", error);
      toast.error("Fehler beim Markieren");
      return false;
    }
  };

  const undoDismissal = async (announcementId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from("team_announcement_dismissals")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchAnnouncements();
      toast.success("Erledigt-Markierung aufgehoben");
      return true;
    } catch (error) {
      console.error("Error undoing dismissal:", error);
      return false;
    }
  };

  return {
    announcements,
    activeAnnouncements,
    loading,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    dismissAnnouncement,
    undoDismissal,
    refetch: fetchAnnouncements,
  };
}

// Hook to get dismissal progress for admins
export function useAnnouncementProgress(announcementId: string) {
  const [progress, setProgress] = useState<{
    dismissedCount: number;
    totalCount: number;
    dismissals: Array<{ user_id: string; display_name: string; dismissed_at: string }>;
  }>({ dismissedCount: 0, totalCount: 0, dismissals: [] });
  const [loading, setLoading] = useState(true);
  const { currentTenant } = useTenant();

  useEffect(() => {
    const fetchProgress = async () => {
      if (!announcementId || !currentTenant?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch dismissals for this announcement
        const { data: dismissalsData, error: dismissalsError } = await supabase
          .from("team_announcement_dismissals")
          .select("user_id, dismissed_at")
          .eq("announcement_id", announcementId);

        if (dismissalsError) throw dismissalsError;

        // Fetch team member count
        const { data: membersData, error: membersError } = await supabase
          .from("user_tenant_memberships")
          .select("user_id")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true);

        if (membersError) throw membersError;

        // Fetch profiles for dismissed users
        const dismissedUserIds = dismissalsData?.map(d => d.user_id) || [];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", dismissedUserIds);

        const profileMap = new Map(profilesData?.map(p => [p.user_id, p.display_name]) || []);

        const dismissals = (dismissalsData || []).map(d => ({
          user_id: d.user_id,
          display_name: profileMap.get(d.user_id) || "Unbekannt",
          dismissed_at: d.dismissed_at,
        }));

        setProgress({
          dismissedCount: dismissalsData?.length || 0,
          totalCount: membersData?.length || 0,
          dismissals,
        });
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [announcementId, currentTenant?.id]);

  return { progress, loading };
}
