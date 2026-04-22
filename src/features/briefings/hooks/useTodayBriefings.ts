import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { todayString } from "../utils";
import type { DailyBriefingWithAuthor } from "../types";

export const todayBriefingsQueryKey = (tenantId?: string, userId?: string) =>
  ["daily-briefings", "today", tenantId ?? null, userId ?? null] as const;

export function useTodayBriefings() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const userId = user?.id;
  const today = todayString();

  return useQuery({
    queryKey: todayBriefingsQueryKey(tenantId, userId),
    enabled: Boolean(tenantId && userId),
    staleTime: 60_000,
    queryFn: async (): Promise<DailyBriefingWithAuthor[]> => {
      if (!tenantId || !userId) return [];

      const { data: briefings, error } = await supabase
        .from("daily_briefings")
        .select("id, tenant_id, author_id, briefing_date, title, content, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("briefing_date", today)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!briefings || briefings.length === 0) return [];

      // Vortag-Regel zusätzlich client-seitig anwenden (created_at < today)
      const eligible = briefings.filter((b) => b.created_at.slice(0, 10) < today);
      if (eligible.length === 0) return [];

      const authorIds = Array.from(new Set(eligible.map((b) => b.author_id)));
      const briefingIds = eligible.map((b) => b.id);

      const [profilesRes, readsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", authorIds),
        supabase
          .from("daily_briefing_reads")
          .select("briefing_id")
          .in("briefing_id", briefingIds)
          .eq("user_id", userId),
      ]);

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p]),
      );
      const readSet = new Set((readsRes.data ?? []).map((r) => r.briefing_id));

      return eligible.map((b) => {
        const profile = profileMap.get(b.author_id);
        return {
          ...b,
          author_display_name: profile?.display_name ?? null,
          author_avatar_url: profile?.avatar_url ?? null,
          is_read: readSet.has(b.id),
        };
      });
    },
  });
}
