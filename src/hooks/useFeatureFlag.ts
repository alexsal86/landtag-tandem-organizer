import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STALE_TIME } from "@/lib/query-cache";

/**
 * Lädt alle Feature-Flags des aktuellen Tenants einmalig (15 min cache).
 * Default-Verhalten: ist kein Eintrag vorhanden, gilt das Feature als aktiv.
 */
function useTenantFeatureFlagsMap() {
  const { user, profile } = useAuth();
  const tenantId = profile?.tenant_id;

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

/** Liefert true wenn Feature aktiviert (oder kein Flag gesetzt = default true). */
export function useFeatureFlag(key: string): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useTenantFeatureFlagsMap();
  if (isLoading || !data) return { enabled: true, isLoading };
  const entry = data.get(key);
  return { enabled: entry ? entry.enabled : true, isLoading: false };
}

/** Variante mit Config-Payload. */
export function useFeatureFlagWithConfig<T = Record<string, unknown>>(key: string) {
  const { data, isLoading } = useTenantFeatureFlagsMap();
  if (isLoading || !data) return { enabled: true, config: {} as T, isLoading };
  const entry = data.get(key);
  return {
    enabled: entry ? entry.enabled : true,
    config: (entry?.config ?? {}) as T,
    isLoading: false,
  };
}
