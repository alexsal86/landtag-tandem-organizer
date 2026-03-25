import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { normalizeSupabaseResult } from "@/utils/typeSafety";

export interface TenantUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export function useTenantUsers() {
  const { currentTenant } = useTenant();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const membershipResponse = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);
      const membershipsResult = normalizeSupabaseResult(membershipResponse);

      const memberships = membershipsResult.data as Array<{ user_id: string }> | null;
      if (cancelled || !memberships?.length) {
        if (!cancelled) { setUsers([]); setLoading(false); }
        return;
      }

      const userIds = memberships.map((m) => m.user_id);

      const profilesResponse = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const profilesResult = normalizeSupabaseResult(profilesResponse);

      if (cancelled) return;

      const profiles = profilesResult.data as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> | null;
      const mapped: TenantUser[] = (profiles || [])
        .map((p) => ({
          id: p.user_id,
          display_name: p.display_name || "Unbekannt",
          avatar_url: p.avatar_url,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));

      setUsers(mapped);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  return { users, loading };
}
