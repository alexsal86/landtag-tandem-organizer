import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { Responsibility } from "./suggest";

export function useResponsibilities() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const client = useQueryClient();
  const queryKey = ["responsibilities", tenantId];
  const query = useQuery({
    queryKey,
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenantId) throw new Error("Kein Büro ausgewählt.");
      const [rows, topics, committees, regions, memberships] =
        await Promise.all([
          supabase
            .from("employee_responsibilities")
            .select(
              "user_id,kind,topic_id,committee_id,region_id,role_focus,level",
            )
            .eq("tenant_id", tenantId),
          supabase
            .from("topics")
            .select("id,name,label,is_active")
            .eq("tenant_id", tenantId)
            .order("order_index"),
          supabase
            .from("committees")
            .select("id,tenant_id,name,is_active,order_index")
            .eq("tenant_id", tenantId)
            .order("order_index"),
          supabase
            .from("regions")
            .select(
              "id,tenant_id,name,kind,election_district_id,is_active,order_index",
            )
            .eq("tenant_id", tenantId)
            .order("order_index"),
          supabase
            .from("user_tenant_memberships")
            .select("user_id")
            .eq("tenant_id", tenantId)
            .eq("is_active", true),
        ]);
      for (const result of [rows, topics, committees, regions, memberships])
        if (result.error) throw result.error;
      const ids = (memberships.data ?? []).map((m) => m.user_id);
      const profiles = ids.length
        ? await supabase
            .from("profiles")
            .select("user_id,display_name,badge_color,avatar_url")
            .in("user_id", ids)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const names = new Map<string, string | null>(
        (profiles.data ?? []).map((p) => [p.user_id, p.display_name] as const),
      );
      const appearances = new Map<string, { badge_color: string | null; avatar_url: string | null }>(
        (profiles.data ?? []).map((p) => [p.user_id, p] as const),
      );
      return {
        responsibilities: (rows.data ?? []).filter((r) =>
          ids.includes(r.user_id),
        ) as Responsibility[],
        topics: topics.data ?? [],
        committees: committees.data ?? [],
        regions: regions.data ?? [],
        people: ids
          .map((id) => ({
            id,
            name: names.get(id) || "Unbekannt",
            badgeColor: appearances.get(id)?.badge_color ?? null,
            avatarUrl: appearances.get(id)?.avatar_url ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
      };
    },
  });
  const change = useMutation({
    mutationFn: async (args: {
      userId: string;
      kind: string;
      reference: string;
      level: string | null;
    }) => {
      if (!tenantId) throw new Error("Kein Büro ausgewählt.");
      const { error } = await supabase.rpc("set_employee_responsibility", {
        p_tenant: tenantId,
        p_user: args.userId,
        p_kind: args.kind,
        p_reference: args.reference,
        p_level: args.level ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return {
    ...query,
    change,
    tenantId,
    refresh: () => client.invalidateQueries({ queryKey }),
  };
}
