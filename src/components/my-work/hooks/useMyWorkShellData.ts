import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import { getRoleFlags, type UserRole } from "@/components/my-work/tabVisibility";
import type { TabCounts } from "@/components/my-work/myWorkTabs";

const EMPTY_COUNTS: TabCounts = {
  tasks: 0,
  decisions: 0,
  cases: 0,
  plannings: 0,
  team: 0,
  jourFixe: 0,
  feedbackFeed: 0,
};

export const useMyWorkShellData = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const loadCountsRequestRef = useRef(0);
  const shouldIncludeTeamCountRef = useRef(false);
  const [role, setRole] = useState<UserRole>(null);
  const [feedbackFeedCoreRolesOnly, setFeedbackFeedCoreRolesOnly] = useState(false);
  const [totalCounts, setTotalCounts] = useState<TabCounts>(EMPTY_COUNTS);
  const [countLoadError, setCountLoadError] = useState<string | null>(null);
  const [isCountsLoading, setIsCountsLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "degraded">("connecting");

  const loadCounts = useCallback(async (includeTeamCount = false) => {
    if (!user) return;

    const requestId = ++loadCountsRequestRef.current;
    setIsCountsLoading(true);
    setCountLoadError(null);

    try {
      const { data, error } = await supabase.rpc("get_my_work_counts", {
        p_user_id: user.id,
        p_include_team: includeTeamCount,
      });

      if (error) throw error;

      const counts = (data || {}) as Record<string, number>;
      if (requestId !== loadCountsRequestRef.current) return;

      setTotalCounts({
        tasks: Number(counts.tasks || 0),
        decisions: Number(counts.decisions || 0),
        cases: Number(counts.caseItems || 0) + Number(counts.caseFiles || 0),
        plannings: Number(counts.plannings || 0),
        team: Number(counts.team || 0),
        jourFixe: Number(counts.jourFixe || 0),
        feedbackFeed: Number(counts.feedbackFeed || 0),
      });
      setRealtimeStatus("connected");
    } catch (error) {
      debugConsole.error("Error loading counts:", error);
      setCountLoadError("Counts konnten nicht aktualisiert werden.");
      setRealtimeStatus("degraded");
    } finally {
      if (requestId === loadCountsRequestRef.current) {
        setIsCountsLoading(false);
      }
    }
  }, [user]);

  const loadUserRoleAndCounts = useCallback(async () => {
    if (!user) return;

    if (!currentTenant?.id) {
      setRole(null);
      shouldIncludeTeamCountRef.current = false;
      await loadCounts(false);
      return;
    }

    const [membershipData, feedbackFeedVisibilitySetting] = await Promise.all([
      supabase
        .from("user_tenant_memberships")
        .select("role")
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "mywork_feedbackfeed_core_roles_only")
        .maybeSingle(),
    ]);

    if (membershipData.error) {
      debugConsole.error("Error loading tenant membership role:", membershipData.error);
    }

    let resolvedRole = (membershipData.data?.role || null) as UserRole;

    if (!resolvedRole) {
      const { data: fallbackRoleData, error: fallbackRoleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fallbackRoleError) {
        debugConsole.error("Error loading fallback user role:", fallbackRoleError);
      }

      resolvedRole = (fallbackRoleData?.role || null) as UserRole;
    }

    const roleFlags = getRoleFlags(resolvedRole);
    setRole(resolvedRole);
    setFeedbackFeedCoreRolesOnly(Boolean(feedbackFeedVisibilitySetting.data?.setting_value));

    shouldIncludeTeamCountRef.current = roleFlags.isAbgeordneter || roleFlags.isBueroleitung;
    await loadCounts(shouldIncludeTeamCountRef.current);
  }, [currentTenant?.id, loadCounts, user]);

  useEffect(() => {
    void loadUserRoleAndCounts();
  }, [loadUserRoleAndCounts]);

  useEffect(() => {
    setRealtimeStatus("connected");
  }, []);

  const roleFlags = useMemo(() => getRoleFlags(role), [role]);

  return {
    countLoadError,
    feedbackFeedCoreRolesOnly,
    isCountsLoading,
    loadCounts,
    realtimeStatus,
    role,
    roleFlags,
    shouldIncludeTeamCountRef,
    totalCounts,
  };
};
