import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
export function useCandidateCoverage(periodId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-history", user?.id, "candidate-coverage", periodId],
    enabled: !!user && !!periodId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_candidate_coverage")
        .select("*")
        .eq("period_id", periodId)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    gcTime: 120_000,
    retry: false,
  });
}
export function useCandidatePartyReference(year: number, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "candidate-party-reference",
      year,
    ],
    enabled: !!user && enabled && year >= 2026,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_districts")
        .select("*")
        .eq("year", year)
        .eq("ballot", "second")
        .order("district_number")
        .limit(350)
        .abortSignal(signal);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
