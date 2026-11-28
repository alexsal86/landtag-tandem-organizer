import { useCallback, useMemo, useSyncExternalStore } from "react";
import { targetsSamePage } from "@/lib/quickAccessTargets";
import { useAuth } from "./useAuth";
import { useTenant } from "./useTenant";

export interface QuickAccessPage {
  id: string;
  label: string;
  icon: string;
  route: string;
  type?: "page" | "item";
  tenantId?: string;
  userId?: string;
}

const STORAGE_KEY = "nav-quick-access-pages";
const CHANGE_EVENT = "quick-access-pages-changed";

function getSnapshot() {
  try { return localStorage.getItem(STORAGE_KEY) ?? "[]"; } catch { return "[]"; }
}

function parsePages(snapshot: string): QuickAccessPage[] {
  try {
    const pages: unknown = JSON.parse(snapshot);
    return Array.isArray(pages) ? pages : [];
  } catch { return []; }
}

function savePages(pages: QuickAccessPage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pages)); } catch { return; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function visibleTo(page: QuickAccessPage, userId?: string, tenantId?: string) {
  return (!page.userId || page.userId === userId) && (!page.tenantId || page.tenantId === tenantId);
}

export function useQuickAccessPages() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const pages = useMemo(() => parsePages(snapshot).filter(page => visibleTo(page, userId, tenantId)), [snapshot, userId, tenantId]);

  const addPage = useCallback((page: QuickAccessPage) => {
    const stored = parsePages(getSnapshot());
    if (stored.some(p => visibleTo(p, userId, tenantId) && targetsSamePage(p, page))) return;
    savePages([...stored, { ...page, userId, tenantId }]);
  }, [userId, tenantId]);

  const removePage = useCallback((id: string) => {
    savePages(parsePages(getSnapshot()).filter(page => page.id !== id || !visibleTo(page, userId, tenantId)));
  }, [userId, tenantId]);

  const reorderPages = useCallback((newPages: QuickAccessPage[]) => {
    const stored = parsePages(getSnapshot());
    savePages([...stored.filter(page => !visibleTo(page, userId, tenantId)), ...newPages]);
  }, [userId, tenantId]);

  const isInQuickAccess = useCallback((id: string) => pages.some(page => page.id === id), [pages]);
  return { pages, addPage, removePage, reorderPages, isInQuickAccess };
}
