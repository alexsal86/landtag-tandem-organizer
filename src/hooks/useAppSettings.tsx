import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  app_name: string;
  app_subtitle: string;
  app_logo_url: string;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  app_name: 'LandtagsOS',
  app_subtitle: 'Koordinationssystem',
  app_logo_url: '',
  isLoading: true,
};

const AppSettingsContext = createContext<AppSettings>(defaultSettings);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

      if (data) {
        const settingsMap = data.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || '';
          return acc;
        }, {} as Record<string, string>);

        setSettings({
          app_name: settingsMap.app_name || 'LandtagsOS',
          app_subtitle: settingsMap.app_subtitle || 'Koordinationssystem',
          app_logo_url: settingsMap.app_logo_url || '',
          isLoading: false,
        });
      } else {
        setSettings(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSettings();
  }, []);

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
