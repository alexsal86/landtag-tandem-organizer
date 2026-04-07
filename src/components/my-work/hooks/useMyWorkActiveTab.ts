import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getVisibleMyWorkTabs,
  LEGACY_TAB_MAP,
  MY_WORK_ACTION_TAB_MAP,
  MY_WORK_ALLOWED_TABS,
  type MyWorkTabConfig,
  type TabValue,
} from "@/components/my-work/myWorkTabs";
import type { UserRole } from "@/components/my-work/tabVisibility";

const preserveKnownParams = (searchParams: URLSearchParams, tab: TabValue) => {
  const nextParams = new URLSearchParams();
  nextParams.set("tab", tab);

  const knownGlobalParams = ["action", "highlight", "scope", "period", "withAttachments", "withTasks"];

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

  const visibleTabs = useMemo<MyWorkTabConfig[]>(() => getVisibleMyWorkTabs({ role, feedbackFeedCoreRolesOnly }), [role, feedbackFeedCoreRolesOnly]);
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

    if (!targetTab || activeTab === targetTab) return;

    const normalizedTargetTab = visibleTabs.some((tab) => tab.value === targetTab) ? targetTab : fallbackTab;
    setSearchParams(preserveKnownParams(searchParams, normalizedTargetTab), { replace: true });
  }, [activeTab, fallbackTab, searchParams, setSearchParams, visibleTabs]);

  useEffect(() => {
    const needsNormalization = !rawTab || rawTab !== activeTab;

    if (!needsNormalization) return;

    setSearchParams(preserveKnownParams(searchParams, activeTab), { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

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
