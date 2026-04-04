import { useState, useCallback } from 'react';

export interface RecentlyVisitedPage {
  id: string;
  label: string;
  icon: string;
  route: string;
  visitedAt: number;
}

const STORAGE_KEY = 'nav-recently-visited';
const MAX_ITEMS = 8;

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

export function useRecentlyVisited() {
  const [recentPages, setRecentPages] = useState<RecentlyVisitedPage[]>(loadPages);

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
