import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { Database } from "@/integrations/supabase/types";
import type { Employee } from "../types";

interface UseAdminEmployeesOptions {
  currentTenant: { id: string } | null;
  isAdmin: boolean;
  roleLoading: boolean;
}

export function useAdminEmployees({ currentTenant, isAdmin, roleLoading }: UseAdminEmployeesOptions) {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    if (!isAdmin || roleLoading) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    loadEmployees();
  }, [currentTenant, isAdmin, roleLoading]);

  const loadEmployees = async () => {
    if (!currentTenant) return;

    try {
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (!memberships?.length) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const userIds = memberships.map((m: Record<string, any>) => m.user_id);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const employeeIds = (roles || [])
        .filter((r: Record<string, any>) => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
        .map((r: Record<string, any>) => r.user_id);

      if (employeeIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const [profilesRes, settingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", employeeIds),
        supabase
          .from("employee_settings")
          .select("user_id, hours_per_week, days_per_week")
          .in("user_id", employeeIds),
      ]);

      type EmployeeProfileRow = Pick<
        Database["public"]["Tables"]["profiles"]["Row"],
        "user_id" | "display_name" | "avatar_url"
      >;
      type EmployeeSettingRow = Pick<
        Database["public"]["Tables"]["employee_settings"]["Row"],
        "user_id" | "hours_per_week" | "days_per_week"
      >;

      const profileRows = (profilesRes.data ?? []) as EmployeeProfileRow[];
      const settingRows = (settingsRes.data ?? []) as EmployeeSettingRow[];
      const profileMap = new Map(profileRows.map((p) => [p.user_id, p]));
      const settingsMap = new Map(settingRows.map((s) => [s.user_id, s]));

      const emps: Employee[] = employeeIds.map((uid: Record<string, any>) => ({
        user_id: uid,
        display_name: profileMap.get(uid)?.display_name || "Unbekannt",
        avatar_url: profileMap.get(uid)?.avatar_url || null,
        hours_per_week: settingsMap.get(uid)?.hours_per_week || 39.5,
        days_per_week: settingsMap.get(uid)?.days_per_week || 5,
      }));

      setEmployees(emps);
      if (emps.length > 0 && !selectedUserId) {
        setSelectedUserId(emps[0].user_id);
      }
    } catch (error) {
      debugConsole.error("Error loading employees:", error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, employees, selectedUserId, setSelectedUserId };
}
