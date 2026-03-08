import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';

interface LoginCustomization {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  background_image_url: string | null;
  background_position: string;
  primary_color: string;
  accent_color: string;
  tagline: string;
  welcome_text: string;
  footer_text: string;
  social_login_enabled: boolean;
  registration_enabled: boolean;
  password_reset_enabled: boolean;
  background_attribution: any;
}

const DEFAULT_CUSTOMIZATION: Partial<LoginCustomization> = {
  logo_url: null,
  background_image_url: 'https://images.unsplash.com/photo-1584974292709-5c2f0619971b?w=1920&q=80',
  background_position: 'center',
  primary_color: '#57ab27',
  accent_color: '#E6007E',
  tagline: 'Ihre politische Arbeit. Organisiert.',
  welcome_text: 'Willkommen bei LandtagsOS',
  footer_text: '© 2025 LandtagsOS',
  social_login_enabled: false,
  registration_enabled: true,
  password_reset_enabled: true,
  background_attribution: null
};

export const useLoginCustomization = () => {
  const [customization, setCustomization] = useState<Partial<LoginCustomization>>(DEFAULT_CUSTOMIZATION);
  const [logoFromSettings, setLogoFromSettings] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomization();
  }, []);

  const loadCustomization = async () => {
    try {
      setIsLoading(true);

      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'app_logo_url')
        .maybeSingle();

      if (settingsData?.setting_value) {
        setLogoFromSettings(settingsData.setting_value);
      }

      const { data: customData } = await supabase
        .from('login_customization')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (customData) {
        setCustomization({
          ...DEFAULT_CUSTOMIZATION,
          ...customData,
          logo_url: customData.logo_url || logoFromSettings
        });
      } else {
        setCustomization({
          ...DEFAULT_CUSTOMIZATION,
          logo_url: logoFromSettings
        });
      }
    } catch (error) {
      debugConsole.error('Error loading login customization:', error);
      setCustomization({
        ...DEFAULT_CUSTOMIZATION,
        logo_url: logoFromSettings
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    customization: {
      ...customization,
      logo_url: customization.logo_url || logoFromSettings
    }, 
    isLoading 
  };
};
