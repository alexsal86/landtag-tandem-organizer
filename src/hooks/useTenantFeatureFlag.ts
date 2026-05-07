import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { STALE_TIME } from "@/lib/query-cache";

/**
 * Lädt Feature-Flags des aktuellen Tenants. Default: aktiv, wenn kein Eintrag.
 * Hinweis: Hook-Name "useTenantFeatureFlag" um Konflikt mit existierendem
 * lokalen `useFeatureFlag` (Calendar-Toggle) zu vermeiden.
 */
function useTenantFeatureFlagsMap() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["tenant-feature-flags", tenantId],
    enabled: !!user && !!tenantId,
    staleTime: STALE_TIME.LOOKUP,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_feature_flags")
        .select("feature_key, enabled, config")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
      for (const row of data ?? []) {
        map.set(row.feature_key, {
          enabled: row.enabled,
          config: (row.config as Record<string, unknown>) ?? {},
        });
      }
      return map;
    },
  });
}

export function useTenantFeatureFlag(key: string): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useTenantFeatureFlagsMap();
  if (isLoading || !data) return { enabled: true, isLoading };
  const entry = data.get(key);
  return { enabled: entry ? entry.enabled : true, isLoading: false };
}

export function useTenantFeatureFlagWithConfig<T = Record<string, unknown>>(key: string) {
  const { data, isLoading } = useTenantFeatureFlagsMap();
  if (isLoading || !data) return { enabled: true, config: {} as T, isLoading };
  const entry = data.get(key);
  return {
    enabled: entry ? entry.enabled : true,
    config: (entry?.config ?? {}) as T,
    isLoading: false,
  };
}
