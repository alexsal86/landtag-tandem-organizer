import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { STALE_TIME } from "@/lib/query-cache";

interface FieldPermission {
  table_name: string;
  column_name: string;
  role: string;
  can_read: boolean;
  can_write: boolean;
}

function useFieldPermissionsMap() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["field-permissions", tenantId],
    enabled: !!user && !!tenantId,
    staleTime: STALE_TIME.LOOKUP,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_permissions")
        .select("table_name, column_name, role, can_read, can_write")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data ?? []) as FieldPermission[];
    },
  });
}

/**
 * Default: lesen/schreiben erlaubt, wenn keine deny-Regel für die Rolle des Users.
 */
export function useFieldPermission(
  table: string,
  column: string,
): { canRead: boolean; canWrite: boolean; isLoading: boolean } {
  const { role, loading: roleLoading } = useResolvedUserRole();
  const { data, isLoading } = useFieldPermissionsMap();

  if (isLoading || roleLoading || !data) {
    return { canRead: true, canWrite: true, isLoading: true };
  }
  if (!role) return { canRead: false, canWrite: false, isLoading: false };

  const matching = data.filter(
    (p) => p.table_name === table && p.column_name === column && p.role === role,
  );
  const canRead = !matching.some((p) => p.can_read === false);
  const canWrite = canRead && !matching.some((p) => p.can_write === false);

  return { canRead, canWrite, isLoading: false };
}
