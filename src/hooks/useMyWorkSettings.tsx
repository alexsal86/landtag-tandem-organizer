import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type BadgeDisplayMode = 'new' | 'total';

interface MyWorkSettingsResult {
  badgeDisplayMode: BadgeDisplayMode;
  updateBadgeDisplayMode: (mode: BadgeDisplayMode) => Promise<boolean>;
  isLoading: boolean;
}

export function useMyWorkSettings(): MyWorkSettingsResult {
  const { user } = useAuth();
  const [badgeDisplayMode, setBadgeDisplayMode] = useState<BadgeDisplayMode>('new');
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_mywork_settings')
        .select('badge_display_mode')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading mywork settings:', error);
      } else if (data) {
        setBadgeDisplayMode(data.badge_display_mode as BadgeDisplayMode);
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateBadgeDisplayMode = useCallback(async (mode: BadgeDisplayMode): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('user_mywork_settings')
        .upsert({
          user_id: user.id,
          badge_display_mode: mode,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
        console.error('Error updating badge display mode:', error);
        return false;
      }
      
      setBadgeDisplayMode(mode);
      return true;
    } catch (error) {
      console.error('Error in updateBadgeDisplayMode:', error);
      return false;
    }
  }, [user]);

  return {
    badgeDisplayMode,
    updateBadgeDisplayMode,
    isLoading
  };
}
