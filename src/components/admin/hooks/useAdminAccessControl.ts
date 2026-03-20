import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

export function useAdminAccessControl(user: User | null) {
  const [roleLoading, setRoleLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const resolveRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        debugConsole.error("Error resolving admin role", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(roleData?.role === "abgeordneter");
      }

      setRoleLoading(false);
    };

    resolveRole();
  }, [user]);

  return { isAdmin, roleLoading };
}
