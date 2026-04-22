import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMarkBriefingRead() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (briefingId: string) => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("daily_briefing_reads")
        .upsert(
          { briefing_id: briefingId, user_id: user.id },
          { onConflict: "briefing_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-briefings", "today"] });
    },
  });
}
