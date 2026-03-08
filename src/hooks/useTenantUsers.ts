import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

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
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (cancelled || !memberships?.length) {
        if (!cancelled) { setUsers([]); setLoading(false); }
        return;
      }

      const userIds = memberships.map((m) => m.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      if (cancelled) return;

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
