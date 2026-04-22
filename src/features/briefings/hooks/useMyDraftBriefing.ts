import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { DailyBriefing } from "../types";

export const myBriefingQueryKey = (
  tenantId?: string,
  userId?: string,
  date?: string,
) => ["daily-briefings", "mine", tenantId ?? null, userId ?? null, date ?? null] as const;

export function useMyBriefingForDate(briefingDate: string) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const userId = user?.id;

  return useQuery({
    queryKey: myBriefingQueryKey(tenantId, userId, briefingDate),
    enabled: Boolean(tenantId && userId && briefingDate),
    staleTime: 30_000,
    queryFn: async (): Promise<DailyBriefing | null> => {
      if (!tenantId || !userId) return null;
      const { data, error } = await supabase
        .from("daily_briefings")
        .select("id, tenant_id, author_id, briefing_date, title, content, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("author_id", userId)
        .eq("briefing_date", briefingDate)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveBriefing() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      briefing_date: string;
      title: string | null;
      content: string;
    }) => {
      if (!user?.id || !currentTenant?.id) throw new Error("Nicht angemeldet");
      if (input.id) {
        const { data, error } = await supabase
          .from("daily_briefings")
          .update({
            briefing_date: input.briefing_date,
            title: input.title,
            content: input.content,
          })
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("daily_briefings")
        .insert({
          tenant_id: currentTenant.id,
          author_id: user.id,
          briefing_date: input.briefing_date,
          title: input.title,
          content: input.content,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-briefings"] });
    },
  });
}

export function useDeleteBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_briefings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-briefings"] });
    },
  });
}
