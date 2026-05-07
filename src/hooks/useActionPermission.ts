import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STALE_TIME } from "@/lib/query-cache";

/**
 * Lädt einmalig alle Action-Permissions des Tenants und prüft client-seitig
 * gegen die Rollen des Users. Server-Guard erfolgt zusätzlich über `is_action_allowed`.
 *
 * Default: ist keine Regel gesetzt, ist die Aktion erlaubt.
 */
export function useActionPermission(actionKey: string): { allowed: boolean; isLoading: boolean } {
  const { user, profile, roles } = useAuth();
  const tenantId = profile?.tenant_id;

  const { data, isLoading } = useQuery({
    queryKey: ["action-permissions", tenantId],
    enabled: !!user && !!tenantId,
    staleTime: STALE_TIME.LOOKUP,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_permissions")
        .select("action_key, allowed_roles")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of data ?? []) {
        map.set(row.action_key, (row.allowed_roles ?? []) as string[]);
      }
      return map;
    },
  });

  if (isLoading || !data) return { allowed: true, isLoading };
  const allowedRoles = data.get(actionKey);
  if (!allowedRoles) return { allowed: true, isLoading: false };

  const userRoles = (roles ?? []) as string[];
  const allowed = allowedRoles.some((r) => userRoles.includes(r));
  return { allowed, isLoading: false };
}
