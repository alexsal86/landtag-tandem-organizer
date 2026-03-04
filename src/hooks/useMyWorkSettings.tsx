import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type BadgeDisplayMode = 'new' | 'total';
export type DecisionTabId = 'for-me' | 'answered' | 'my-decisions' | 'public';

export const DEFAULT_DECISION_TAB_ORDER: DecisionTabId[] = ['for-me', 'answered', 'my-decisions', 'public'];

interface MyWorkSettingsResult {
  badgeDisplayMode: BadgeDisplayMode;
  decisionTabOrder: DecisionTabId[];
  hiddenDecisionTabs: DecisionTabId[];
  updateBadgeDisplayMode: (mode: BadgeDisplayMode) => Promise<boolean>;
  updateDecisionTabSettings: (settings: { order: DecisionTabId[]; hiddenTabs: DecisionTabId[] }) => Promise<boolean>;
  isLoading: boolean;
}

export function useMyWorkSettings(): MyWorkSettingsResult {
  const { user } = useAuth();
  const [badgeDisplayMode, setBadgeDisplayMode] = useState<BadgeDisplayMode>('new');
  const [decisionTabOrder, setDecisionTabOrder] = useState<DecisionTabId[]>(DEFAULT_DECISION_TAB_ORDER);
  const [hiddenDecisionTabs, setHiddenDecisionTabs] = useState<DecisionTabId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const sanitizeDecisionTabSettings = useCallback((order?: unknown, hiddenTabs?: unknown) => {
    const normalizedOrder = Array.isArray(order)
      ? order.filter((tab): tab is DecisionTabId => DEFAULT_DECISION_TAB_ORDER.includes(tab as DecisionTabId))
      : [];

    const mergedOrder = [...normalizedOrder];
    DEFAULT_DECISION_TAB_ORDER.forEach((tab) => {
      if (!mergedOrder.includes(tab)) {
        mergedOrder.push(tab);
      }
    });

    const normalizedHiddenTabs = Array.isArray(hiddenTabs)
      ? hiddenTabs.filter((tab): tab is DecisionTabId => DEFAULT_DECISION_TAB_ORDER.includes(tab as DecisionTabId))
      : [];

    return {
      order: mergedOrder,
      hiddenTabs: Array.from(new Set(normalizedHiddenTabs)),
    };
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_mywork_settings')
        .select('badge_display_mode, decision_tabs_order, decision_tabs_hidden')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading mywork settings:', error);
      } else if (data) {
        setBadgeDisplayMode(data.badge_display_mode as BadgeDisplayMode);
        const tabSettings = sanitizeDecisionTabSettings(data.decision_tabs_order, data.decision_tabs_hidden);
        setDecisionTabOrder(tabSettings.order);
        setHiddenDecisionTabs(tabSettings.hiddenTabs);
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sanitizeDecisionTabSettings, user]);

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

  const updateDecisionTabSettings = useCallback(async (settings: { order: DecisionTabId[]; hiddenTabs: DecisionTabId[] }): Promise<boolean> => {
    if (!user) return false;

    const normalized = sanitizeDecisionTabSettings(settings.order, settings.hiddenTabs);

    try {
      const { error } = await supabase
        .from('user_mywork_settings')
        .upsert({
          user_id: user.id,
          decision_tabs_order: normalized.order,
          decision_tabs_hidden: normalized.hiddenTabs,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error updating decision tab settings:', error);
        return false;
      }

      setDecisionTabOrder(normalized.order);
      setHiddenDecisionTabs(normalized.hiddenTabs);
      return true;
    } catch (error) {
      console.error('Error in updateDecisionTabSettings:', error);
      return false;
    }
  }, [sanitizeDecisionTabSettings, user]);

  return {
    badgeDisplayMode,
    decisionTabOrder,
    hiddenDecisionTabs,
    updateBadgeDisplayMode,
    updateDecisionTabSettings,
    isLoading
  };
}
