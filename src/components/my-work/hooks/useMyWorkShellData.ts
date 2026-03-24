import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import type { TabCounts } from "@/components/my-work/myWorkTabs";

const EMPTY_COUNTS: TabCounts = {
  tasks: 0,
  decisions: 0,
  cases: 0,
  plannings: 0,
  team: 0,
  jourFixe: 0,
  feedbackFeed: 0,
  redaktion: 0,
};

export const useMyWorkShellData = () => {
  const { user } = useAuth();
  const loadCountsRequestRef = useRef(0);
  const shouldIncludeTeamCountRef = useRef(false);
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
      const [{ data, error }, { data: profileData }] = await Promise.all([
        supabase.rpc("get_my_work_counts", {
          p_user_id: user.id,
          p_include_team: includeTeamCount,
        }),
        supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (error) throw error;

      const counts = (data || {}) as Record<string, number>;
      if (requestId !== loadCountsRequestRef.current) return;

      let redaktionCount = 0;
      if (profileData?.id) {
        const { count } = await supabase
          .from("social_content_items")
          .select("id", { count: "exact", head: true })
          .eq("responsible_user_id", profileData.id)
          .not("workflow_status", "eq", "published");
        redaktionCount = count ?? 0;
      }

      if (requestId !== loadCountsRequestRef.current) return;

      setTotalCounts({
        tasks: Number(counts.tasks || 0),
        decisions: Number(counts.decisions || 0),
        cases: Number(counts.caseItems || 0) + Number(counts.caseFiles || 0),
        plannings: Number(counts.plannings || 0),
        team: Number(counts.team || 0),
        jourFixe: Number(counts.jourFixe || 0),
        feedbackFeed: Number(counts.feedbackFeed || 0),
        redaktion: redaktionCount,
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

  const { role, ...roleFlags } = useResolvedUserRole();

  const loadUserRoleAndCounts = useCallback(async () => {
    if (!user) return;

    const { data: feedbackFeedVisibilitySetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "mywork_feedbackfeed_core_roles_only")
      .maybeSingle();

    setFeedbackFeedCoreRolesOnly(Boolean(feedbackFeedVisibilitySetting?.setting_value));

    shouldIncludeTeamCountRef.current = roleFlags.isAbgeordneter || roleFlags.isBueroleitung;
    await loadCounts(shouldIncludeTeamCountRef.current);
  }, [loadCounts, roleFlags.isAbgeordneter, roleFlags.isBueroleitung, user]);

  useEffect(() => {
    void loadUserRoleAndCounts();
  }, [loadUserRoleAndCounts]);

  useEffect(() => {
    setRealtimeStatus("connected");
  }, []);

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
