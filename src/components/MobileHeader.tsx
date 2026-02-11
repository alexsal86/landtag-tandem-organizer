import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppNavigation } from "@/components/AppNavigation";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Input } from "@/components/ui/input";

export function MobileHeader() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  // Derive active section from URL path (same logic as Index.tsx)
  const activeSection = (() => {
    const path = location.pathname.split('/')[1] || 'dashboard';
    return path || 'dashboard';
  })();
  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_logo_url: ""
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);

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

  useEffect(() => {
    const loadProfile = async () => {
      if (user && currentTenant?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();
        
        setUserProfile(profile);
      }
    };

    loadProfile();
  }, [user, currentTenant]);

  if (!isMobile) return null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))]">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Navigation öffnen</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] bg-[hsl(var(--nav))] border-[hsl(var(--nav-foreground)/0.1)]">
                <AppNavigation 
                  activeSection={activeSection} 
                  onSectionChange={(section) => {
                    navigate(section === 'dashboard' ? '/' : `/${section}`);
                    setMobileNavOpen(false);
                  }}
                  isMobile={true}
                />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              {appSettings.app_logo_url && (
                <img 
                  src={appSettings.app_logo_url} 
                  alt="App Logo" 
                  crossOrigin="anonymous"
                  className="h-8 w-8 object-contain"
                />
              )}
              <span className="font-semibold text-sm truncate max-w-[120px]">
                {appSettings.app_name}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {/* Search Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowMobileSearch(true)}
              className="text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Suchen</span>
            </Button>

            {/* Notifications */}
            <NotificationBell />

            {/* User Avatar */}
            <Avatar className="h-8 w-8">
              <AvatarImage 
                src={userProfile?.avatar_url || undefined} 
                alt={userProfile?.display_name || 'Benutzer'} 
              />
              <AvatarFallback className="text-xs bg-[hsl(var(--nav-hover))] text-[hsl(var(--nav-foreground))]">
                {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-[60] bg-background">
          <div className="flex items-center gap-2 p-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="flex-1 border-0 focus-visible:ring-0 px-0"
            />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery("");
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="p-4">
            {searchQuery ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Suche nach "{searchQuery}"...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Geben Sie einen Suchbegriff ein
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
