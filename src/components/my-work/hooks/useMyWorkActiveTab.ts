import { useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  getVisibleMyWorkTabs,
  LEGACY_TAB_MAP,
  MY_WORK_ACTION_TAB_MAP,
  MY_WORK_ALLOWED_TABS,
  shouldNormalizeMyWorkTab,
  type MyWorkTabConfig,
  type TabValue,
} from "@/components/my-work/myWorkTabs";
import type { UserRole } from "@/components/my-work/tabVisibility";
import { useTenantModuleGate } from "@/hooks/useTenantFeatureFlag";

const preserveKnownParams = (searchParams: URLSearchParams, tab: TabValue) => {
  const nextParams = new URLSearchParams();
  nextParams.set("tab", tab);

  const knownGlobalParams = ["action", "highlight", "scope", "period", "withAttachments", "withTasks", "caseItemId", "caseFileId"];

  if (tab === "tasks") knownGlobalParams.push("task");

  knownGlobalParams.forEach((param) => {
    const value = searchParams.get(param);

    if (value) {
      nextParams.set(param, value);
    }
  });

  return nextParams;
};

export const useMyWorkActiveTab = ({
  role,
  feedbackFeedCoreRolesOnly,
}: {
  role: UserRole;
  feedbackFeedCoreRolesOnly: boolean;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const isMyWorkRoute = pathname === "/mywork";

  // Reiter mit Modulschalter (z. B. Redaktion) hängen am selben Gate wie Karte und Zähler.
  const isModuleEnabled = useTenantModuleGate();
  const visibleTabs = useMemo<MyWorkTabConfig[]>(
    () => getVisibleMyWorkTabs({ role, feedbackFeedCoreRolesOnly, isModuleEnabled }),
    [role, feedbackFeedCoreRolesOnly, isModuleEnabled],
  );
  const fallbackTab = visibleTabs[0]?.value ?? "dashboard";

  const rawTab = searchParams.get("tab");
  const normalizedFromRaw = rawTab ? (LEGACY_TAB_MAP[rawTab] ?? rawTab) : null;
  const normalizedTab = normalizedFromRaw && MY_WORK_ALLOWED_TABS.has(normalizedFromRaw as TabValue)
    ? (normalizedFromRaw as TabValue)
    : fallbackTab;
  const activeTab = visibleTabs.some((tab) => tab.value === normalizedTab) ? normalizedTab : fallbackTab;

  useEffect(() => {
    const action = searchParams.get("action");
    const targetTab = action ? MY_WORK_ACTION_TAB_MAP[action] : null;

    if (!isMyWorkRoute || !targetTab || activeTab === targetTab) return;

    const normalizedTargetTab = visibleTabs.some((tab) => tab.value === targetTab) ? targetTab : fallbackTab;
    setSearchParams(preserveKnownParams(searchParams, normalizedTargetTab), { replace: true });
  }, [activeTab, fallbackTab, isMyWorkRoute, searchParams, setSearchParams, visibleTabs]);

  useEffect(() => {
    if (!shouldNormalizeMyWorkTab(pathname, rawTab, activeTab)) return;

    setSearchParams(preserveKnownParams(searchParams, activeTab), { replace: true });
  }, [activeTab, pathname, rawTab, searchParams, setSearchParams]);

  const setActiveTab = (tab: TabValue) => {
    setSearchParams(preserveKnownParams(searchParams, tab));
  };

  return {
    activeTab,
    fallbackTab,
    searchParams,
    setActiveTab,
    setSearchParams,
    visibleTabs,
  };
};
