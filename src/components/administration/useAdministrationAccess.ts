import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { getAdministrationAccess } from "./access";

export function useAdministrationAccess(userId: string | undefined, tenantId: string | undefined, waiting: boolean) {
  const accessKey = `${userId ?? ""}:${tenantId ?? ""}`;
  const [access, setAccess] = useState({ key: "", isAdmin: false, isSuperAdmin: false, error: false });
  const checkingAdmin = waiting || access.key !== accessKey;
  useEffect(() => {
    if (waiting) return;
    let cancelled = false;
    const checkAccess = async () => {
      try {
        if (!userId) {
          if (!cancelled) setAccess({ key: accessKey, isAdmin: false, isSuperAdmin: false, error: false });
          return;
        }
        const [platform, membership] = await Promise.all([
          supabase.rpc("is_superadmin", { _user_id: userId }),
          tenantId
            ? supabase.from("user_tenant_memberships").select("role")
                .eq("user_id", userId).eq("tenant_id", tenantId).eq("is_active", true).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (platform.error) throw platform.error;
        if (membership.error) throw membership.error;
        if (!cancelled) setAccess({ key: accessKey, ...getAdministrationAccess(membership.data?.role ?? null, platform.data === true), error: false });
      } catch (error) {
        debugConsole.error("Error checking administration access:", error);
        if (!cancelled) setAccess({ key: accessKey, isAdmin: false, isSuperAdmin: false, error: true });
      }
    };
    void checkAccess();
    return () => { cancelled = true; };
  }, [waiting, userId, tenantId, accessKey]);

  return {
    checkingAdmin,
    isAdmin: !checkingAdmin && access.isAdmin,
    isSuperAdmin: !checkingAdmin && access.isSuperAdmin,
    error: !checkingAdmin && access.error,
  };
}
