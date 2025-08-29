import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NewItemIndicators {
  [itemId: string]: {
    isNew: boolean;
    newSince: Date;
  };
}

export interface NewItemIndicatorsHook {
  indicators: NewItemIndicators;
  markItemAsViewed: (itemId: string) => void;
  isItemNew: (itemId: string, createdAt: string | Date) => boolean;
  clearAllIndicators: () => void;
}

export const useNewItemIndicators = (context: string): NewItemIndicatorsHook => {
  const { user } = useAuth();
  const [indicators, setIndicators] = useState<NewItemIndicators>({});
  const [lastVisited, setLastVisited] = useState<Date | null>(null);

  // Load last visited time for this context
  useEffect(() => {
    if (!user) return;

    const loadLastVisited = async () => {
      try {
        const { data, error } = await supabase
          .from('user_navigation_visits')
          .select('last_visited_at')
          .eq('user_id', user.id)
          .eq('navigation_context', context)
          .maybeSingle();

        if (error) {
          console.error('Error loading last visited:', error);
          return;
        }

        setLastVisited(data ? new Date(data.last_visited_at) : null);
      } catch (error) {
        console.error('Error in loadLastVisited:', error);
      }
    };

    loadLastVisited();
  }, [user, context]);

  // Mark item as viewed
  const markItemAsViewed = (itemId: string) => {
    setIndicators(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  // Check if item is new based on creation date
  const isItemNew = (itemId: string, createdAt: string | Date): boolean => {
    if (!lastVisited) {
      console.log(`🔍 isItemNew(${itemId}): No lastVisited, treating as new`);
      return true; // If never visited, everything is new
    }
    
    const itemCreatedAt = new Date(createdAt);
    const isNew = itemCreatedAt > lastVisited;
    console.log(`🔍 isItemNew(${itemId}): created=${itemCreatedAt.toISOString()}, lastVisited=${lastVisited.toISOString()}, isNew=${isNew}`);
    return isNew;
  };

  // Clear all indicators (called when leaving page)
  const clearAllIndicators = () => {
    setIndicators({});
  };

  // Listen for storage events to sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'navigation_visit_sync' && e.newValue && user) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userId === user.id && data.context === context) {
            setLastVisited(new Date(data.timestamp));
            clearAllIndicators();
          }
        } catch (error) {
          console.error('Error parsing navigation visit sync data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, context]);

  return {
    indicators,
    markItemAsViewed,
    isItemNew,
    clearAllIndicators,
  };
};