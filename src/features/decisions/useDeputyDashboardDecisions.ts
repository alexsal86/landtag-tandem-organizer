import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { Database } from "@/integrations/supabase/types";

export type DeputyDashboardDecision = Database["public"]["Functions"]["get_deputy_dashboard_decisions"]["Returns"][number];

export function useDeputyDashboardDecisions(decisionIds?: string[]) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const subscriptionId = useId();
  const enabled = !!user?.id && !!tenantId && (!decisionIds || decisionIds.length > 0);
  const query = useQuery<DeputyDashboardDecision[]>({
    queryKey: ["deputy-dashboard-decisions", tenantId, user?.id, decisionIds ?? null],
    enabled,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_deputy_dashboard_decisions", {
        _tenant_id: tenantId!, _decision_ids: decisionIds,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!enabled || !tenantId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["deputy-dashboard-decisions", tenantId] });
      }, 200);
    };
    const channel = supabase.channel("deputy-dashboard-nudges-" + subscriptionId)
      .on("postgres_changes", { event: "*", schema: "public", table: "dashboard_decision_nudges", filter: `tenant_id=eq.${tenantId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decision_responses" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions", filter: `tenant_id=eq.${tenantId}` }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, tenantId, subscriptionId, qc]);
  return query;
}
