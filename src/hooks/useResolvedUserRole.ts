import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import type { Database } from "@/integrations/supabase/types";

export type ResolvedUserRole = Database["public"]["Enums"]["app_role"] | null;

export interface ResolvedUserRoleResult {
  role: ResolvedUserRole;
  isAdmin: boolean;
  isEmployee: boolean;
  isAbgeordneter: boolean;
  isBueroleitung: boolean;
  loading: boolean;
}

const EMPLOYEE_ROLES = new Set<NonNullable<ResolvedUserRole>>(["mitarbeiter", "praktikant", "bueroleitung"]);

const getRoleFlags = (role: ResolvedUserRole) => ({
  role,
  isAdmin: role === "abgeordneter" || role === "bueroleitung",
  isEmployee: role ? EMPLOYEE_ROLES.has(role) : false,
  isAbgeordneter: role === "abgeordneter",
  isBueroleitung: role === "bueroleitung",
});

const EMPTY_ROLE_FLAGS: Omit<ResolvedUserRoleResult, "loading"> = getRoleFlags(null);

export function useResolvedUserRole(): ResolvedUserRoleResult {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [role, setRole] = useState<ResolvedUserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadRole = async () => {
      try {
        let resolvedRole: ResolvedUserRole = null;

        if (currentTenant?.id) {
          const { data: membershipData, error: membershipError } = await supabase
            .from("user_tenant_memberships")
            .select("role")
            .eq("tenant_id", currentTenant.id)
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();

          if (membershipError) {
            debugConsole.error("Error loading active tenant membership role:", membershipError);
          }

          resolvedRole = (membershipData?.role ?? null) as ResolvedUserRole;
        }

        if (!resolvedRole) {
          const { data: fallbackRoleData, error: fallbackRoleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle();

          if (fallbackRoleError) {
            debugConsole.error("Error loading fallback user role:", fallbackRoleError);
          }

          resolvedRole = (fallbackRoleData?.role ?? null) as ResolvedUserRole;
        }

        if (!cancelled) {
          setRole(resolvedRole);
        }
      } catch (error) {
        debugConsole.error("Error resolving user role:", error);
        if (!cancelled) {
          setRole(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRole();

    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id, user?.id]);

  return useMemo(
    () => ({
      ...EMPTY_ROLE_FLAGS,
      ...getRoleFlags(role),
      loading,
    }),
    [loading, role],
  );
}
