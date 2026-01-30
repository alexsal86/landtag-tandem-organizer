import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

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
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    // Wait for tenant to be loaded before fetching settings
    if (tenantLoading) return;
    
    const loadSettings = async () => {
      try {
        // Try to load tenant-specific settings first
        if (currentTenant?.id) {
          const { data: tenantData } = await supabase
            .from('app_settings')
            .select('setting_key, setting_value')
            .eq('tenant_id', currentTenant.id)
            .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

          if (tenantData && tenantData.length > 0) {
            const settingsMap = tenantData.reduce((acc, item) => {
              acc[item.setting_key] = item.setting_value || '';
              return acc;
            }, {} as Record<string, string>);

            setSettings({
              app_name: settingsMap.app_name || 'LandtagsOS',
              app_subtitle: settingsMap.app_subtitle || 'Koordinationssystem',
              app_logo_url: settingsMap.app_logo_url || '',
              isLoading: false,
            });
            return;
          }
        }

        // Fallback: try global settings (tenant_id IS NULL)
        const { data: globalData } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .is('tenant_id', null)
          .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

        if (globalData && globalData.length > 0) {
          const settingsMap = globalData.reduce((acc, item) => {
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
          // No settings found - use defaults
          setSettings({
            app_name: 'LandtagsOS',
            app_subtitle: 'Koordinationssystem',
            app_logo_url: '',
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error loading app settings:', error);
        setSettings(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSettings();
  }, [currentTenant?.id, tenantLoading]);

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
