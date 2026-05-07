import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STALE_TIME } from "@/lib/query-cache";

interface FieldPermission {
  table_name: string;
  column_name: string;
  role: string;
  can_read: boolean;
  can_write: boolean;
}

function useFieldPermissionsMap() {
  const { user, profile } = useAuth();
  const tenantId = profile?.tenant_id;

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
 * Prüft ob der aktuelle User ein Feld lesen/schreiben darf.
 * Default: erlaubt, wenn keine deny-Regel für eine Rolle des Users vorliegt.
 */
export function useFieldPermission(
  table: string,
  column: string,
): { canRead: boolean; canWrite: boolean; isLoading: boolean } {
  const { roles } = useAuth();
  const { data, isLoading } = useFieldPermissionsMap();

  if (isLoading || !data) return { canRead: true, canWrite: true, isLoading };

  const userRoles = (roles ?? []) as string[];
  const matching = data.filter(
    (p) => p.table_name === table && p.column_name === column && userRoles.includes(p.role),
  );

  const canRead = !matching.some((p) => p.can_read === false);
  const canWrite = canRead && !matching.some((p) => p.can_write === false);

  return { canRead, canWrite, isLoading: false };
}
