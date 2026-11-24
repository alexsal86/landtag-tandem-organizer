import { berlinDay } from "@/utils/dashboard/daySummary";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { canReadDailyBriefing } from "../utils";
import type { DailyBriefingWithAuthor } from "../types";

export const todayBriefingsQueryKey = (tenantId?: string, userId?: string) =>
  ["daily-briefings", "today", tenantId ?? null, userId ?? null] as const;

export function useTodayBriefings() {
  return useDatedBriefings(false);
}

export function useUpcomingBriefings() {
  return useDatedBriefings(true);
}

function useDatedBriefings(upcoming: boolean) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const userId = user?.id;
  const today = berlinDay(new Date());

  return useQuery({
    queryKey: upcoming ? ["daily-briefings", "upcoming", tenantId, userId, today]
      : [...todayBriefingsQueryKey(tenantId, userId), today],
    enabled: Boolean(tenantId && userId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<DailyBriefingWithAuthor[]> => {
      if (!tenantId || !userId) return [];

      const query = supabase.from("daily_briefings")
        .select("id, tenant_id, author_id, briefing_date, title, content, created_at, updated_at")
        .eq("tenant_id", tenantId);
      const { data: briefings, error } = upcoming
        ? await query.gt("briefing_date", today).order("briefing_date").order("created_at", { ascending: false }).limit(20)
        : await query.eq("briefing_date", today).order("created_at", { ascending: false });

      if (error) throw error;
      if (!briefings || briefings.length === 0) return [];

      // Preserve the creation-ahead rule without blocking early reading.
      const eligible = briefings.filter(b => canReadDailyBriefing(b.briefing_date, b.created_at, today));
      if (eligible.length === 0) return [];

      const authorIds = Array.from(new Set(eligible.map((b: Record<string, any>) => b.author_id)));
      const briefingIds = eligible.map((b: Record<string, any>) => b.id);

      const [profilesRes, readsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", authorIds).eq("tenant_id", tenantId),
        supabase
          .from("daily_briefing_reads")
          .select("briefing_id, read_at")
          .in("briefing_id", briefingIds)
          .eq("user_id", userId),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (readsRes.error) throw readsRes.error;

      type ProfileLite = { user_id: string; display_name: string | null; avatar_url: string | null };
      const profileMap = new Map<string, ProfileLite>(
        ((profilesRes.data ?? []) as ProfileLite[]).map((p) => [p.user_id, p]),
      );
      const reads = new Map((readsRes.data ?? []).map(row => [row.briefing_id, row.read_at]));

      return eligible.map((b: Record<string, any>) => {
        const profile = profileMap.get(b.author_id);
        return {
          ...b,
          author_display_name: profile?.display_name ?? null,
          author_avatar_url: profile?.avatar_url ?? null,
          is_read: reads.has(b.id),
          read_at: reads.get(b.id) ?? null,
        };
      });
    },
  });
}
