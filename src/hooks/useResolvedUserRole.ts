import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import type { Database } from "@/integrations/supabase/types";

export type ResolvedUserRole = Database["public"]["Enums"]["app_role"] | null;

export interface ResolvedUserRoleResult {
  role: ResolvedUserRole;
  isAdmin: boolean;
  isAdminClaim: boolean;
  hasAdminAccess: boolean;
  isEmployee: boolean;
  isAbgeordneter: boolean;
  isBueroleitung: boolean;
  isBueroleitungClaim: boolean;
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

const EMPTY_ROLE_FLAGS: Omit<ResolvedUserRoleResult, "loading"> = {
  ...getRoleFlags(null),
  isAdminClaim: false,
  hasAdminAccess: false,
  isBueroleitungClaim: false,
};

interface ResolvedUserSessionProfile {
  role: ResolvedUserRole;
  isAdminClaim: boolean;
  isBueroleitungClaim: boolean;
}

export const resolvedUserRoleQueryKey = (userId?: string, tenantId?: string) =>
  ["resolved-user-role", userId ?? null, tenantId ?? null] as const;

const fetchResolvedUserSessionProfile = async (
  userId: string,
  tenantId?: string,
): Promise<ResolvedUserSessionProfile> => {
  let resolvedRole: ResolvedUserRole = null;

  if (tenantId) {
    const { data: membershipData, error: membershipError } = await supabase
      .from("user_tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
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

  const [{ data: isAdminClaim }, { data: isBueroleitungClaim }] = await Promise.all([
    supabase.rpc("is_admin", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "bueroleitung" }),
  ]);

  return {
    role: resolvedRole,
    isAdminClaim: Boolean(isAdminClaim),
    isBueroleitungClaim: Boolean(isBueroleitungClaim),
  };
};

export function useResolvedUserRole(): ResolvedUserRoleResult {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: resolvedUserRoleQueryKey(userId, tenantId),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!userId) {
        return {
          role: null as ResolvedUserRole,
          isAdminClaim: false,
          isBueroleitungClaim: false,
        };
      }

      try {
        return await fetchResolvedUserSessionProfile(userId, tenantId);
      } catch (error) {
        debugConsole.error("Error resolving user role:", error);
        return {
          role: null as ResolvedUserRole,
          isAdminClaim: false,
          isBueroleitungClaim: false,
        };
      }
    },
  });

  return useMemo(
    () => ({
      ...EMPTY_ROLE_FLAGS,
      ...getRoleFlags(query.data?.role ?? null),
      isAdminClaim: Boolean(query.data?.isAdminClaim),
      hasAdminAccess: Boolean(query.data?.isAdminClaim || query.data?.isBueroleitungClaim),
      isBueroleitungClaim: Boolean(query.data?.isBueroleitungClaim),
      loading: Boolean(userId) ? query.isLoading : false,
    }),
    [query.data?.isAdminClaim, query.data?.isBueroleitungClaim, query.data?.role, query.isLoading, userId],
  );
}
