import { useState, useCallback } from 'react';

export interface QuickAccessPage {
  id: string;
  label: string;
  icon: string; // lucide icon name
  route: string;
  type?: 'page' | 'item';
}

const STORAGE_KEY = 'nav-quick-access-pages';

function loadPages(): QuickAccessPage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function savePages(pages: QuickAccessPage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {}
}

export function useQuickAccessPages() {
  const [pages, setPages] = useState<QuickAccessPage[]>(loadPages);

  const addPage = useCallback((page: QuickAccessPage) => {
    setPages(prev => {
      if (prev.some(p => p.id === page.id)) return prev;
      const next = [...prev, page];
      savePages(next);
      return next;
    });
  }, []);

  const removePage = useCallback((id: string) => {
    setPages(prev => {
      const next = prev.filter(p => p.id !== id);
      savePages(next);
      return next;
    });
  }, []);

  const reorderPages = useCallback((newPages: QuickAccessPage[]) => {
    setPages(newPages);
    savePages(newPages);
  }, []);

  const isInQuickAccess = useCallback((id: string) => {
    return pages.some(p => p.id === id);
  }, [pages]);

  return { pages, addPage, removePage, reorderPages, isInQuickAccess };
}
