import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Ballot } from "../../types";
import { withAnalysisBallot } from "../../rowTypes";
import type { LabDistrictData } from "./data";
/** The active lab needs one ballot, no state table and, for OLS, only one party. */
export function useLabDistrictData(
  year: number,
  ballot: Ballot,
  party?: string,
): UseQueryResult<LabDistrictData, Error> {
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
        .select("year, ballot, district_number, party, votes, preliminary, data_release, notes")
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
          .select("year, ballot, district_number, district_name, eligible, voters, valid_votes, preliminary, data_release, notes")
          .eq("year", year)
          .eq("ballot", ballot)
          .order("district_number")
          .limit(70)
          .abortSignal(signal),
        party
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("election_analysis_versions")
              .select("year, district_number, district_name, geography_id, identity_key, historical_district_id, history_link_verified, notes")
              .eq("year", year)
              .order("district_number")
              .limit(70)
              .abortSignal(signal),
      ]);
      for (const reply of replies) if (reply.error) throw reply.error;
      return {
        results: (replies[0].data || []).map(withAnalysisBallot),
        turnout: (replies[1].data || []).map(withAnalysisBallot),
        versions: replies[2].data || [],
      };
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
