import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export type ContactViewMode = "grid" | "list";
export type ContactsTab = "contacts" | "stakeholders" | "stakeholder-network" | "distribution-lists" | "archive";

const CONTACTS_VIEW_MODE_STORAGE_KEY = "contacts-view-mode";
const STAKEHOLDERS_VIEW_MODE_STORAGE_KEY = "stakeholders-view-mode";
const DISTRIBUTION_VIEW_MODE_STORAGE_KEY = "distribution-view-mode";

const getStoredValue = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
};

const getInitialViewMode = (key: string): ContactViewMode => {
  const value = getStoredValue(key);
  return value === "list" ? "list" : "grid";
};

export interface UseContactsViewPreferencesResult {
  activeTab: ContactsTab;
  setActiveTab: Dispatch<SetStateAction<ContactsTab>>;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  showScrollTop: boolean;
  viewMode: ContactViewMode;
  stakeholderViewMode: ContactViewMode;
  distributionViewMode: ContactViewMode;
  setViewModeAndPersist: (mode: ContactViewMode, tab: string) => void;
  scrollToTop: () => void;
}

export function useContactsViewPreferences(subId?: string): UseContactsViewPreferencesResult {
  const [viewMode, setViewMode] = useState<ContactViewMode>(() => getInitialViewMode(CONTACTS_VIEW_MODE_STORAGE_KEY));
  const [stakeholderViewMode, setStakeholderViewMode] = useState<ContactViewMode>(() =>
    getInitialViewMode(STAKEHOLDERS_VIEW_MODE_STORAGE_KEY),
  );
  const [distributionViewMode, setDistributionViewMode] = useState<ContactViewMode>(() =>
    getInitialViewMode(DISTRIBUTION_VIEW_MODE_STORAGE_KEY),
  );
  const [activeTab, setActiveTab] = useState<ContactsTab>("contacts");
  const [showFilters, setShowFilters] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (subId === "netzwerk") {
      setActiveTab("stakeholder-network");
      return;
    }

    if (subId === "stakeholder") {
      setActiveTab("stakeholders");
    }
  }, [subId]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const setViewModeAndPersist = (mode: ContactViewMode, tab: string) => {
    if (tab === "contacts") {
      setViewMode(mode);
      localStorage.setItem(CONTACTS_VIEW_MODE_STORAGE_KEY, mode);
      return;
    }

    if (tab === "stakeholders") {
      setStakeholderViewMode(mode);
      localStorage.setItem(STAKEHOLDERS_VIEW_MODE_STORAGE_KEY, mode);
      return;
    }

    setDistributionViewMode(mode);
    localStorage.setItem(DISTRIBUTION_VIEW_MODE_STORAGE_KEY, mode);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    showScrollTop,
    viewMode,
    stakeholderViewMode,
    distributionViewMode,
    setViewModeAndPersist,
    scrollToTop,
  };
}
