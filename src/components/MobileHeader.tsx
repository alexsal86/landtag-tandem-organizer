import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function MobileHeader() {
  const isMobile = useIsMobile();
  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_logo_url: ""
  });

  useEffect(() => {
    const loadSettings = async () => {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_name', 'app_logo_url']);

      if (settings) {
        const settingsMap = settings.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || '';
          return acc;
        }, {} as Record<string, string>);

        setAppSettings({
          app_name: settingsMap.app_name || "LandtagsOS",
          app_logo_url: settingsMap.app_logo_url || ""
        });
      }
    };
    
    loadSettings();
  }, []);

  if (!isMobile) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <SidebarTrigger className="-ml-2" />
        
        <div className="flex items-center gap-2 ml-3">
          {appSettings.app_logo_url && (
            <img 
              src={appSettings.app_logo_url} 
              alt="App Logo" 
              className="h-8 w-8 object-contain"
            />
          )}
          <span className="font-semibold text-sm truncate">
            {appSettings.app_name}
          </span>
        </div>
      </div>
    </header>
  );
}
