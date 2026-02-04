import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { CelebrationSettings } from '@/components/celebrations';

interface AnimationDefinition {
  id: string;
  name: string;
  type: string;
  animation_key: string;
  is_active: boolean;
  order_index: number;
}

const DEFAULT_SETTINGS: CelebrationSettings = {
  enabled: true,
  mode: 'random',
  selectedAnimation: 'unicorn',
  frequency: 'always',
  speed: 'normal',
  size: 'medium',
};

export function useCelebrationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<CelebrationSettings>(DEFAULT_SETTINGS);
  const [animations, setAnimations] = useState<AnimationDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load animations and settings in parallel
      const [animationsRes, settingsRes] = await Promise.all([
        supabase
          .from('celebration_animations')
          .select('*')
          .eq('is_active', true)
          .order('order_index'),
        supabase
          .from('celebration_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()
      ]);

      if (animationsRes.data) {
        setAnimations(animationsRes.data);
      }

      if (settingsRes.data) {
        setSettings({
          enabled: settingsRes.data.enabled ?? DEFAULT_SETTINGS.enabled,
          mode: (settingsRes.data.mode as CelebrationSettings['mode']) ?? DEFAULT_SETTINGS.mode,
          selectedAnimation: settingsRes.data.selected_animation ?? DEFAULT_SETTINGS.selectedAnimation,
          frequency: (settingsRes.data.frequency as CelebrationSettings['frequency']) ?? DEFAULT_SETTINGS.frequency,
          speed: (settingsRes.data.speed as CelebrationSettings['speed']) ?? DEFAULT_SETTINGS.speed,
          size: (settingsRes.data.size as CelebrationSettings['size']) ?? DEFAULT_SETTINGS.size,
        });
      }
    } catch (error) {
      console.error('Error loading celebration settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = useCallback(async (updates: Partial<CelebrationSettings>) => {
    if (!user) return;

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
      if (updates.mode !== undefined) dbUpdates.mode = updates.mode;
      if (updates.selectedAnimation !== undefined) dbUpdates.selected_animation = updates.selectedAnimation;
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
      if (updates.speed !== undefined) dbUpdates.speed = updates.speed;
      if (updates.size !== undefined) dbUpdates.size = updates.size;
      dbUpdates.updated_at = new Date().toISOString();

      // Upsert settings
      const { error } = await supabase
        .from('celebration_settings')
        .upsert({
          user_id: user.id,
          ...dbUpdates,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating celebration settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive"
      });
      // Revert on error
      loadData();
    }
  }, [user, settings, toast]);

  return {
    settings,
    animations,
    loading,
    updateSettings,
    refetch: loadData,
  };
}
