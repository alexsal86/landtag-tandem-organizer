import { useState, useCallback, useEffect } from 'react';

export interface RecentlyVisitedPage {
  id: string;
  label: string;
  icon: string;
  route: string;
  visitedAt: number;
}

const STORAGE_KEY = 'nav-recently-visited';
const MAX_ITEMS = 8;
const SYNC_EVENT = 'recently-visited-updated';

function loadPages(): RecentlyVisitedPage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as RecentlyVisitedPage[];
      return parsed.sort((a, b) => b.visitedAt - a.visitedAt);
    }
  } catch {}
  return [];
}

function savePages(pages: RecentlyVisitedPage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {}
}

/**
 * Standalone function to track a page visit without needing the hook.
 * Useful for detail pages (case files, dossiers, documents, plannings).
 */
export function trackPageVisit(id: string, label: string, icon: string, route: string) {
  const pages = loadPages();
  const filtered = pages.filter(p => p.id !== id);
  const next = [{ id, label, icon, route, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
  savePages(next);
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function useRecentlyVisited() {
  const [recentPages, setRecentPages] = useState<RecentlyVisitedPage[]>(loadPages);

  useEffect(() => {
    const handler = () => setRecentPages(loadPages());
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const trackVisit = useCallback((id: string, label: string, icon: string, route: string) => {
    setRecentPages(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const next = [{ id, label, icon, route, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      savePages(next);
      return next;
    });
  }, []);

  return { recentPages, trackVisit };
}
