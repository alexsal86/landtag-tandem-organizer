import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isRecord } from "@/utils/typeSafety";
import type { Ballot, DistrictResult, Turnout, StateResult } from "../types";
import type {
  DistrictSeries,
  DistrictHistoryRow,
  DistrictVersion,
  Geography,
  VerifiedCandidate,
} from "./types";
const numeric = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));
const nullableText = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
function baseRow(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Number.isInteger(value.year) &&
    ["single", "first", "second"].includes(String(value.ballot)) &&
    nullableText(value.notes) &&
    (value.data_release === undefined || nullableText(value.data_release))
  );
}
function districtResult(value: unknown): value is DistrictResult {
  return (
    baseRow(value) &&
    Number.isInteger(value.district_number) &&
    typeof value.district_name === "string" &&
    typeof value.party === "string" &&
    numeric(value.votes) &&
    numeric(value.share) &&
    typeof value.preliminary === "boolean"
  );
}
function turnoutRow(value: unknown): value is Turnout {
  return (
    baseRow(value) &&
    Number.isInteger(value.district_number) &&
    typeof value.district_name === "string" &&
    ["eligible", "voters", "valid_votes", "turnout"].every((key) =>
      numeric(value[key]),
    ) &&
    typeof value.preliminary === "boolean"
  );
}
function stateRow(value: unknown): value is StateResult {
  return (
    baseRow(value) &&
    typeof value.party === "string" &&
    ["votes", "share", "seats", "valid_votes"].every((key) =>
      numeric(value[key]),
    )
  );
}
function districtVersion(value: unknown): value is DistrictVersion {
  return (
    isRecord(value) &&
    Number.isInteger(value.year) &&
    Number.isInteger(value.district_number) &&
    typeof value.district_name === "string" &&
    ["geography_id", "identity_key", "historical_district_id", "notes"].every(
      (key) => nullableText(value[key]),
    ) &&
    typeof value.history_link_verified === "boolean"
  );
}
function series(value: unknown): DistrictSeries {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results) ||
    !value.results.every(districtResult) ||
    !Array.isArray(value.turnout) ||
    !value.turnout.every(turnoutRow) ||
    !Array.isArray(value.state) ||
    !value.state.every(stateRow) ||
    !Array.isArray(value.versions) ||
    !value.versions.every(districtVersion)
  )
    throw new Error("Ungültige Analysedaten");
  return {
    results: value.results,
    turnout: value.turnout,
    state: value.state,
    versions: value.versions,
  };
}
function historyRow(value: unknown): value is DistrictHistoryRow {
  return (
    isRecord(value) &&
    [
      "period_id",
      "period_name",
      "district_id",
      "district_name",
      "mandate_id",
      "person_name",
      "party",
      "mandate_type",
      "entry_type",
    ].every((key) => typeof value[key] === "string") &&
    Number.isInteger(value.period_number) &&
    ["person_id", "original_mandate", "starts_on", "ends_on", "notes"].every(
      (key) => nullableText(value[key]),
    ) &&
    ["start_from_period", "end_from_period", "end_is_expected"].every(
      (key) => typeof value[key] === "boolean",
    )
  );
}
export function useDistrictSeries(
  district: number,
  years: number[],
): UseQueryResult<DistrictSeries, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "district", district, years],
    enabled: !!user && years.length > 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("get_analysis_district_series", {
          district,
          selected_years: years,
        })
        .abortSignal(signal);
      if (error) throw error;
      return series(data);
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
export function useDistrictVersions(
  year: number,
): UseQueryResult<DistrictVersion[], Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "versions", year],
    enabled: !!user && !!year,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_versions")
        .select("*")
        .eq("year", year)
        .order("district_number")
        .limit(100)
        .abortSignal(signal);
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
    gcTime: 300_000,
    retry: false,
  });
}
export function useDistrictHistory(
  district: number,
  year: number,
  enabled: boolean,
): UseQueryResult<DistrictHistoryRow[], Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "history", district, year],
    enabled: !!user && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("get_analysis_district_history", { district, selected_year: year })
        .abortSignal(signal);
      if (error) throw error;
      const value: unknown = data;
      if (!Array.isArray(value) || !value.every(historyRow))
        throw new Error("Ungültige Mandatshistorie");
      return value;
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
export function useComparison(
  beforeYear: number,
  afterYear: number,
  beforeBallot: Ballot,
  afterBallot: Ballot,
  selectedParties: string[],
): UseQueryResult<DistrictSeries, Error> {
  const { user } = useAuth();
  const parties = [...selectedParties].sort();
  return useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "comparison",
      beforeYear,
      afterYear,
      beforeBallot,
      afterBallot,
      parties,
    ],
    enabled: !!user && parties.length > 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("get_analysis_comparison", {
          before_year: beforeYear,
          after_year: afterYear,
          before_ballot: beforeBallot,
          after_ballot: afterBallot,
          selected_parties: parties,
        })
        .abortSignal(signal);
      if (error) throw error;
      return series(data);
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
export function useGeography(
  id: string | undefined,
): UseQueryResult<Geography | null, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "geography", id],
    enabled: !!user && !!id,
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("election_analysis_geographies")
        .select("*")
        .eq("id", id)
        .eq("verified", true)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 300_000,
    gcTime: 300_000,
    retry: false,
  });
}
export function useVerifiedCandidates(
  year: number,
  parties: string[],
): UseQueryResult<VerifiedCandidate[], Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "candidates",
      year,
      [...parties].sort(),
    ],
    enabled: !!user && parties.length > 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_candidates")
        .select("*")
        .eq("year", year)
        .eq("verified", true)
        .in("party", parties)
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
export interface QualityData {
  results: DistrictResult[];
  turnout: Turnout[];
  state: StateResult[];
  versions: DistrictVersion[];
}
export function useQualityData(
  year: number,
): UseQueryResult<QualityData, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "quality", year],
    enabled: !!user && !!year,
    queryFn: async ({ signal }) => {
      const replies = await Promise.all([
        supabase
          .from("election_analysis_districts")
          .select("*")
          .eq("year", year)
          .limit(1000)
          .abortSignal(signal),
        supabase
          .from("election_analysis_turnout")
          .select("*")
          .eq("year", year)
          .limit(200)
          .abortSignal(signal),
        supabase
          .from("election_analysis_state")
          .select("*")
          .eq("year", year)
          .limit(100)
          .abortSignal(signal),
        supabase
          .from("election_analysis_versions")
          .select("*")
          .eq("year", year)
          .limit(100)
          .abortSignal(signal),
      ]);
      for (const reply of replies) if (reply.error) throw reply.error;
      return {
        results: replies[0].data || [],
        turnout: replies[1].data || [],
        state: replies[2].data || [],
        versions: replies[3].data || [],
      };
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
