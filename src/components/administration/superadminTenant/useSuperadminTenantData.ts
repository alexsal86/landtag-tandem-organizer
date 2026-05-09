import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import type { TenantWithStats, UserWithTenants } from "./constants";
import { notify } from "@/lib/notify";

export function useSuperadminTenantData() {
  const { user } = useAuth();

  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
  const [roleCheckLoading, setRoleCheckLoading] = useState<boolean>(true);
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<UserWithTenants[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);

  // Platform role check
  useEffect((): void => {
    const checkPlatformRole = async (): Promise<void> => {
      if (!user?.id) {
        setIsPlatformAdmin(false);
        setRoleCheckLoading(false);
        return;
      }
      setRoleCheckLoading(true);
      const { data, error } = await supabase.rpc("is_superadmin", { _user_id: user.id });
      if (error) {
        debugConsole.error("Error checking platform role:", error);
        setIsPlatformAdmin(false);
      } else {
        setIsPlatformAdmin(Boolean(data));
      }
      setRoleCheckLoading(false);
    };
    void checkPlatformRole();
  }, [user?.id]);

  const loadTenants = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from("tenants")
        .select(`id, name, description, is_active, created_at, is_template`)
        .order("name");

      if (error && /column .*is_template.* does not exist/i.test(error.message ?? "")) {
        const fallback = await supabase
          .from("tenants")
          .select(`id, name, description, is_active, created_at`)
          .order("name");
        data = fallback.data as typeof data;
        error = fallback.error;
      }
      if (error) throw error;
      setTenants(data || []);
    } catch (error: unknown) {
      debugConsole.error("Error loading tenants:", error);
      notify.error("Fehler", {
        description: "Tenants konnten nicht geladen werden"
});
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAllUsers = useCallback(async (): Promise<void> => {
    try {
      setUsersLoading(true);
      const { data, error } = await supabase.functions.invoke("manage-tenant-user", {
        body: { action: "listAllUsers" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setAllUsers(data.users ?? []);
    } catch (error: unknown) {
      debugConsole.error("Error loading users:", error);
      notify.error("Fehler", {
        description:
          error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden"
});
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadTenants();
      void loadAllUsers();
    }
  }, [isPlatformAdmin, loadTenants, loadAllUsers]);

  return {
    isPlatformAdmin,
    roleCheckLoading,
    tenants,
    setTenants,
    loading,
    loadTenants,
    allUsers,
    setAllUsers,
    usersLoading,
    loadAllUsers,
  };
}
