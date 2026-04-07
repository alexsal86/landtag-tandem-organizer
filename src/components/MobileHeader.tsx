import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Calendar, Home, LogOut, Plus, Search, Settings, User, Users, X, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AppNavigation } from "@/components/AppNavigation";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CORE_TABS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "mywork", label: "Meine Arbeit", icon: Briefcase },
  { id: "calendar", label: "Kalender", icon: Calendar },
  { id: "contacts", label: "Kontakte", icon: Users },
] as const;

export function MobileHeader() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentTenant } = useTenant();
  const { navigationCounts } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixUnread();

  const getActiveSectionFromPath = useCallback((pathname: string): string => {
    if (pathname === '/') return 'dashboard';
    const pathSection = pathname.slice(1).split('/')[0];
    if (pathSection === 'letters') return 'documents';
    return pathSection || 'dashboard';
  }, []);

  const activeSection = getActiveSectionFromPath(location.pathname);
  const isCoreTab = CORE_TABS.some(tab => tab.id === activeSection);

  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_logo_url: ""
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);

  const moreBadgeCount = useMemo(() => {
    const coreIds = new Set(CORE_TABS.map(tab => tab.id));
    const extraCount = Object.entries(navigationCounts)
      .filter(([id]) => !coreIds.has(id))
      .reduce((sum, [, count]) => sum + count, 0);
    return extraCount + matrixUnreadCount;
  }, [navigationCounts, matrixUnreadCount]);

  const trackMobileNavEvent = useCallback((eventName: string, payload: Record<string, unknown> = {}) => {
    const detail = {
      eventName,
      location: location.pathname,
      activeSection,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    window.dispatchEvent(new CustomEvent('mobileNavAnalytics', { detail }));
    (window as { analytics?: { track?: (name: string, attrs: Record<string, unknown>) => void } }).analytics?.track?.(eventName, detail);
  }, [activeSection, location.pathname]);

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

    void loadSettings();
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

    void loadProfile();
  }, [user, currentTenant]);

  if (!isMobile) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleCoreTabNavigation = (section: string) => {
    trackMobileNavEvent('mobile_nav_tab_click', { target: section, type: 'core-tab' });
    navigate(section === 'dashboard' ? '/' : `/${section}`);
  };

  const openQuickAction = () => {
    trackMobileNavEvent('mobile_nav_quick_action', { action: 'create-appointment' });
    const params = new URLSearchParams(location.search);
    params.set('action', 'create-appointment');
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))]">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 min-w-0">
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

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openQuickAction}
              className="text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]"
            >
              <Plus className="h-5 w-5" />
              <span className="sr-only">Schnellaktion</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                trackMobileNavEvent('mobile_nav_search_open');
                setShowMobileSearch(true);
              }}
              className="text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Suchen</span>
            </Button>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full p-0 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={userProfile?.avatar_url || undefined}
                      alt={userProfile?.display_name || 'Benutzer'}
                    />
                    <AvatarFallback className="text-xs bg-[hsl(var(--nav-hover))] text-[hsl(var(--nav-foreground))]">
                      {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Benutzermenü öffnen</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/profile/edit')}>
                  <User className="mr-2 h-4 w-4" />
                  Profil bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Einstellungen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="grid grid-cols-5 h-16 px-1">
          {CORE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            const badgeCount = navigationCounts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleCoreTabNavigation(tab.id)}
                className="flex flex-col items-center justify-center gap-0.5 text-[11px] relative"
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={isActive ? 'text-primary font-medium' : 'text-muted-foreground'}>{tab.label}</span>
                {badgeCount > 0 && (
                  <Badge className="absolute top-1 right-3 h-4 min-w-4 px-1 text-[10px]">{badgeCount}</Badge>
                )}
              </button>
            );
          })}

          <button
            onClick={() => {
              const nextOpen = !mobileNavOpen;
              setMobileNavOpen(nextOpen);
              trackMobileNavEvent(nextOpen ? 'mobile_nav_more_open' : 'mobile_nav_more_close', { target: 'more' });
            }}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] relative"
          >
            <Grid3X3 className={`h-4 w-4 ${!isCoreTab ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={!isCoreTab ? 'text-primary font-medium' : 'text-muted-foreground'}>Mehr</span>
            {moreBadgeCount > 0 && (
              <Badge className="absolute top-1 right-3 h-4 min-w-4 px-1 text-[10px]">{moreBadgeCount}</Badge>
            )}
          </button>
        </div>
      </nav>

      <Sheet open={mobileNavOpen} onOpenChange={(open) => {
        setMobileNavOpen(open);
        trackMobileNavEvent(open ? 'mobile_nav_more_open' : 'mobile_nav_more_close', { target: 'sheet' });
      }}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-[380px] bg-[hsl(var(--nav))] border-[hsl(var(--nav-foreground)/0.1)]">
          <AppNavigation
            activeSection={activeSection}
            onSectionChange={(section) => {
              trackMobileNavEvent('mobile_nav_sheet_select', { target: section, type: 'more-item' });
              navigate(section === 'dashboard' ? '/' : `/${section}`);
              setMobileNavOpen(false);
            }}
            isMobile={true}
          />
        </SheetContent>
      </Sheet>

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
              aria-label="Suche schließen"
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
