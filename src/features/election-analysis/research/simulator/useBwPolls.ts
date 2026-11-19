import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useBwPolls(admin = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bw-polls", user?.id, admin],
    enabled: !!user,
    retry: false,
    queryFn: async ({ signal }) => {
      const query = supabase.from("election_analysis_bw_polls").select("*");
      if (!admin) query.eq("is_published", true);
      const { data, error } = await query
        .order("published_on", { ascending: false })
        .order("id")
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
}
