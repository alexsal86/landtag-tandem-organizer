import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Ballot } from "../../types";
import type { QualityData } from "../hooks";
import type { DistrictVersion } from "../types";
/** The active lab needs one ballot, no state table and, for OLS, only one party. */
export function useLabDistrictData(
  year: number,
  ballot: Ballot,
  party?: string,
): UseQueryResult<QualityData, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "lab",
      year,
      ballot,
      party || "all",
    ],
    enabled: !!user && year > 0,
    queryFn: async ({ signal }) => {
      let results = supabase
        .from("election_analysis_districts")
        .select("*")
        .eq("year", year)
        .eq("ballot", ballot);
      if (party) results = results.eq("party", party);
      const replies = await Promise.all([
        results
          .order("district_number")
          .limit(party ? 70 : 350)
          .abortSignal(signal),
        supabase
          .from("election_analysis_turnout")
          .select("*")
          .eq("year", year)
          .eq("ballot", ballot)
          .order("district_number")
          .limit(70)
          .abortSignal(signal),
        party
          ? Promise.resolve({ data: [] as DistrictVersion[], error: null })
          : supabase
              .from("election_analysis_versions")
              .select("*")
              .eq("year", year)
              .order("district_number")
              .limit(70)
              .abortSignal(signal),
      ]);
      for (const reply of replies) if (reply.error) throw reply.error;
      return {
        results: replies[0].data || [],
        turnout: replies[1].data || [],
        versions: replies[2].data || [],
        state: [],
      };
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
