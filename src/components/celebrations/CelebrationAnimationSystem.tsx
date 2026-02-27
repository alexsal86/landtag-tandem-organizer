import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UnicornAnimation } from './UnicornAnimation';
import { ConfettiAnimation } from './ConfettiAnimation';
import { FireworksAnimation } from './FireworksAnimation';
import { StarsAnimation } from './StarsAnimation';
import { ThumbsUpAnimation } from './ThumbsUpAnimation';

export interface CelebrationSettings {
  enabled: boolean;
  mode: 'random' | 'sequential' | 'specific';
  selectedAnimation: string;
  frequency: 'always' | 'sometimes' | 'rarely';
  speed: 'slow' | 'normal' | 'fast';
  size: 'small' | 'medium' | 'large';
}

interface CelebrationAnimationSystemProps {
  isVisible: boolean;
  onAnimationComplete?: () => void;
  settingsOverride?: CelebrationSettings;
  forceAnimation?: boolean;
}

const AVAILABLE_ANIMATIONS = ['unicorn', 'confetti', 'fireworks', 'stars', 'thumbsup'];

let sequentialIndex = 0;

export function CelebrationAnimationSystem({
  isVisible,
  onAnimationComplete,
  settingsOverride,
  forceAnimation = false,
}: CelebrationAnimationSystemProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CelebrationSettings | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (settingsOverride) {
      setSettings(settingsOverride);
      return;
    }

    if (user) {
      loadSettings();
    } else {
      // Default settings for non-logged-in users
      setSettings({
        enabled: true,
        mode: 'random',
        selectedAnimation: 'unicorn',
        frequency: 'always',
        speed: 'normal',
        size: 'medium'
      });
    }
  }, [user, settingsOverride]);

  const loadSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('celebration_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading celebration settings:', error);
      }

      if (data) {
        setSettings({
          enabled: data.enabled ?? true,
          mode: (data.mode as CelebrationSettings['mode']) ?? 'random',
          selectedAnimation: data.selected_animation ?? 'unicorn',
          frequency: (data.frequency as CelebrationSettings['frequency']) ?? 'always',
          speed: (data.speed as CelebrationSettings['speed']) ?? 'normal',
          size: (data.size as CelebrationSettings['size']) ?? 'medium',
        });
      } else {
        // Use defaults
        setSettings({
          enabled: true,
          mode: 'random',
          selectedAnimation: 'unicorn',
          frequency: 'always',
          speed: 'normal',
          size: 'medium'
        });
      }
    } catch (error) {
      console.error('Error loading celebration settings:', error);
      setSettings({
        enabled: true,
        mode: 'random',
        selectedAnimation: 'unicorn',
        frequency: 'always',
        speed: 'normal',
        size: 'medium'
      });
    }
  };

  const shouldShowAnimation = useCallback((frequency: CelebrationSettings['frequency']): boolean => {
    switch (frequency) {
      case 'always':
        return true;
      case 'sometimes':
        return Math.random() < 0.5;
      case 'rarely':
        return Math.random() < 0.2;
      default:
        return true;
    }
  }, []);

  const selectAnimation = useCallback((settings: CelebrationSettings): string => {
    switch (settings.mode) {
      case 'specific':
        return settings.selectedAnimation;
      case 'sequential':
        const anim = AVAILABLE_ANIMATIONS[sequentialIndex % AVAILABLE_ANIMATIONS.length];
        sequentialIndex++;
        return anim;
      case 'random':
      default:
        return AVAILABLE_ANIMATIONS[Math.floor(Math.random() * AVAILABLE_ANIMATIONS.length)];
    }
  }, []);

  useEffect(() => {
    if (isVisible && settings?.enabled) {
      const shouldAnimate = forceAnimation || shouldShowAnimation(settings.frequency);
      if (shouldAnimate) {
        const animKey = selectAnimation(settings);
        setCurrentAnimation(animKey);
        setShouldRender(true);
      }
    }
  }, [isVisible, settings, forceAnimation, shouldShowAnimation, selectAnimation]);

  const handleComplete = useCallback(() => {
    setShouldRender(false);
    setCurrentAnimation(null);
    onAnimationComplete?.();
  }, [onAnimationComplete]);

  if (!shouldRender || !currentAnimation || !settings) return null;

  const animationProps = {
    speed: settings.speed,
    size: settings.size,
    onComplete: handleComplete,
  };

  switch (currentAnimation) {
    case 'unicorn':
      return <UnicornAnimation {...animationProps} />;
    case 'confetti':
      return <ConfettiAnimation {...animationProps} />;
    case 'fireworks':
      return <FireworksAnimation {...animationProps} />;
    case 'stars':
      return <StarsAnimation {...animationProps} />;
    case 'thumbsup':
      return <ThumbsUpAnimation {...animationProps} />;
    default:
      return <UnicornAnimation {...animationProps} />;
  }
}
