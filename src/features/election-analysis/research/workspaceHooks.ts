import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { isRecord } from "@/utils/typeSafety";
import type { LocalResult } from "./workspaceTypes";
export function useSavedScenarios(page: number) {
  const { user } = useAuth(),
    { currentTenant } = useTenant();
  return useQuery({
    queryKey: [
      "analysis-scenarios",
      user?.id,
      currentTenant?.id,
      "index",
      page,
    ],
    enabled: !!user && !!currentTenant,
    queryFn: async ({ signal }) => {
      const { data, error, count } = await supabase
        .from("election_analysis_scenarios")
        .select(
          "id,tenant_id,owner_id,name,description,visibility,year,ballot,model_version,data_release,revision,created_at,updated_at",
          { count: "exact" },
        )
        .eq("tenant_id", currentTenant!.id)
        .order("updated_at", { ascending: false })
        .range(page * 20, page * 20 + 19)
        .abortSignal(signal);
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: false,
  });
}
export function useSavedScenario(id: string | null) {
  const { user } = useAuth(),
    { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["analysis-scenarios", user?.id, currentTenant?.id, "detail", id],
    enabled: !!user && !!currentTenant && !!id,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_scenarios")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", currentTenant!.id)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: false,
  });
}
export function useFullState(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["election-research", user?.id, "all-state-parties", year],
    enabled: !!user && !!year,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_state")
        .select("*")
        .eq("year", year)
        .eq("ballot", "second")
        .order("party")
        .limit(60)
        .abortSignal(signal);
      if (error) throw error;
      if (year === 2026) {
        const source = await supabase
          .from("election_analysis_source_reviews")
          .select("id,status,kind")
          .eq("id", "official-final-2026-state-20260327")
          .eq("status", "verified")
          .abortSignal(signal)
          .maybeSingle();
        if (source.error) throw source.error;
        if (source.data?.kind !== "official-state-results")
          throw new Error(
            "Amtliche Landesquelle ist noch nicht freigeprüft oder die Quellenmigration fehlt.",
          );
      }
      return data || [];
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
}
function localRow(v: unknown): v is LocalResult {
  return (
    isRecord(v) &&
    Number.isInteger(v.year) &&
    ["single", "first", "second"].includes(String(v.ballot)) &&
    Number.isInteger(v.district_number) &&
    ["municipality", "ward"].includes(String(v.unit_type)) &&
    [
      "unit_key",
      "name",
      "party",
      "boundary_key",
      "data_release",
      "source_url",
    ].every((k) => typeof v[k] === "string") &&
    ["eligible", "voters"].every(
      (k) =>
        v[k] === null ||
        (typeof v[k] === "number" && Number.isSafeInteger(v[k])),
    ) &&
    ["valid_votes", "votes"].every(
      (k) => typeof v[k] === "number" && Number.isSafeInteger(v[k]),
    ) &&
    typeof v.preliminary === "boolean" &&
    typeof v.is_verified === "boolean"
  );
}
export function useLocalPage(
  year: number,
  ballot: string,
  district: number,
  areaType: string,
  party: string,
  search: string,
  page: number,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "local-page",
      year,
      ballot,
      district,
      areaType,
      party,
      search,
      page,
    ],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("get_analysis_local_page", {
          selected_year: year,
          selected_ballot: ballot,
          district,
          area_type: areaType,
          selected_party: party,
          search_text: search,
          page_offset: page * 25,
        })
        .abortSignal(signal);
      if (error) throw error;
      const value: unknown = data;
      if (
        !isRecord(value) ||
        !Array.isArray(value.rows) ||
        !value.rows.every(localRow) ||
        typeof value.total !== "number" ||
        !Array.isArray(value.parties) ||
        !value.parties.every((p): p is string => typeof p === "string")
      )
        throw new Error("Ungültige Gemeindedaten.");
      return { rows: value.rows, total: value.total, parties: value.parties };
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: false,
  });
}

/** Comparison reads results only, never both full input datasets. */
export function useScenarioResult(id: string | null) {
  const { user } = useAuth(),
    { currentTenant } = useTenant();
  return useQuery({
    queryKey: [
      "analysis-scenarios",
      user?.id,
      currentTenant?.id,
      "compare",
      id,
    ],
    enabled: !!user && !!currentTenant && !!id,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_scenarios")
        .select(
          "id,name,year,ballot,model_version,data_release,revision,result_snapshot",
        )
        .eq("id", id!)
        .eq("tenant_id", currentTenant!.id)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: false,
  });
}
