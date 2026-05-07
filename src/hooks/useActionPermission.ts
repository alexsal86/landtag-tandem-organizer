import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { STALE_TIME } from "@/lib/query-cache";

/**
 * Server-Guard erfolgt zusätzlich über RPC `is_action_allowed`.
 * Default: erlaubt, wenn keine Regel gesetzt.
 */
export function useActionPermission(actionKey: string): { allowed: boolean; isLoading: boolean } {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { role, loading: roleLoading } = useResolvedUserRole();
  const tenantId = currentTenant?.id;

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

  if (isLoading || roleLoading || !data) return { allowed: true, isLoading: true };
  const allowedRoles = data.get(actionKey);
  if (!allowedRoles) return { allowed: true, isLoading: false };
  if (!role) return { allowed: false, isLoading: false };
  return { allowed: allowedRoles.includes(role), isLoading: false };
}
