import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TeamsNavigation } from "@/components/TeamsNavigation";

export function MobileHeader() {
  const isMobile = useIsMobile();
  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_logo_url: ""
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    <header className="sticky top-0 z-50 w-full border-b bg-nav text-nav-foreground">
      <div className="flex h-14 items-center px-4">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 text-nav-foreground hover:bg-nav-hover">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Navigation öffnen</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] bg-nav border-nav-foreground/10">
            <TeamsNavigation 
              activeSection="" 
              onSectionChange={() => setMobileNavOpen(false)} 
            />
          </SheetContent>
        </Sheet>
        
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
