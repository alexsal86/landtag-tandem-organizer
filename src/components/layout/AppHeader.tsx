import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { OnlineUsersWidget } from '@/components/OnlineUsersWidget';
import { CompactStatusSelector } from '@/components/CompactStatusSelector';
import { useAuth } from '@/hooks/useAuth';
import { useUserStatus } from '@/hooks/useUserStatus';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onOpenSearch?: () => void;
}

// Map section IDs to readable labels
const sectionLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  calendar: 'Terminkalender',
  contacts: 'Kontakte',
  tasks: 'Aufgaben',
  decisions: 'Entscheidungen',
  casefiles: 'FallAkten',
  meetings: 'Jour fixe',
  eventplanning: 'Planungen',
  karten: 'Karten',
  documents: 'Dokumente',
  drucksachen: 'Drucksachen',
  knowledge: 'Wissen',
  settings: 'Einstellungen',
  time: 'Zeiterfassung',
  employee: 'Mitarbeiter',
  chat: 'Chat',
  administration: 'Administration',
  mywork: 'Meine Arbeit',
};

export const AppHeader = ({ onOpenSearch }: AppHeaderProps) => {
  const { user, signOut } = useAuth();
  const { currentStatus, getStatusDisplay } = useUserStatus();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [userProfile, setUserProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
  const [appSettings, setAppSettings] = useState({
    app_name: 'LandtagsOS',
    app_subtitle: 'Koordinationssystem',
    app_logo_url: ''
  });

  // Get current section from path
  const currentSection = location.pathname === '/' ? 'dashboard' : location.pathname.slice(1).split('/')[0];
  const breadcrumbLabel = sectionLabels[currentSection] || currentSection;

  // Load user profile and app settings
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant?.id || '')
          .maybeSingle();
        
        setUserProfile(profile);
      }

      const { data: settings } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

      if (settings) {
        const settingsMap = settings.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || '';
          return acc;
        }, {} as Record<string, string>);

        setAppSettings({
          app_name: settingsMap.app_name || 'LandtagsOS',
          app_subtitle: settingsMap.app_subtitle || 'Koordinationssystem',
          app_logo_url: settingsMap.app_logo_url || ''
        });
      }
    };
    
    loadData();
  }, [user, currentTenant]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Erfolgreich abgemeldet',
        description: 'Sie wurden erfolgreich abgemeldet.',
      });
    } catch (error) {
      toast({
        title: 'Fehler beim Abmelden',
        description: 'Ein Fehler ist beim Abmelden aufgetreten.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSearch = () => {
    // Trigger global search with Cmd+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
  };

  const statusDisplay = currentStatus ? getStatusDisplay(currentStatus) : null;

  const getStatusRingColor = (statusType: string) => {
    // Correct enum values: online, meeting, break, away, offline, custom
    switch (statusType) {
      case 'online':
        return 'ring-green-500';
      case 'meeting':
        return 'ring-red-500';
      case 'break':
        return 'ring-yellow-500';
      case 'away':
        return 'ring-orange-500';
      case 'offline':
        return 'ring-gray-400';
      case 'custom':
        // For custom, we'll use the color from statusDisplay
        return '';
      default:
        return 'ring-gray-300';
    }
  };

  return (
    <header className="h-14 border-b bg-header border-header-border flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{breadcrumbLabel}</span>
      </div>

      {/* Center: Search Button */}
      <Button
        variant="outline"
        className="hidden md:flex items-center gap-2 w-64 justify-start text-muted-foreground"
        onClick={handleOpenSearch}
      >
        <Search className="h-4 w-4" />
        <span>Suchen...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      {/* Right: Actions with Office Info */}
      <div className="flex items-center gap-3">
        {/* Online Users */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <div className="flex -space-x-2">
                <div className="h-5 w-5 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-green-600">●</span>
                </div>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <OnlineUsersWidget />
          </PopoverContent>
        </Popover>

        {/* Notifications */}
        <NotificationBell />
        
        {/* Vertical Separator */}
        <Separator orientation="vertical" className="h-6" />
        
        {/* Office Title and Subtitle */}
        <div className="text-right hidden lg:block">
          <p className="text-sm font-medium leading-none text-foreground">{appSettings.app_name}</p>
          <p className="text-xs text-muted-foreground">{appSettings.app_subtitle}</p>
        </div>

        {/* User Avatar with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
              <Avatar 
                className={cn(
                  "h-8 w-8 ring-2 ring-offset-2 ring-offset-background",
                  currentStatus?.status_type === 'custom' && statusDisplay?.color 
                    ? '' 
                    : (statusDisplay ? getStatusRingColor(currentStatus?.status_type || '') : 'ring-gray-300')
                )}
                style={
                  currentStatus?.status_type === 'custom' && statusDisplay?.color
                    ? { '--tw-ring-color': statusDisplay.color } as React.CSSProperties
                    : undefined
                }
              >
                <AvatarImage 
                  src={userProfile?.avatar_url || undefined} 
                  alt={userProfile?.display_name || 'Benutzer'} 
                />
                <AvatarFallback className="text-xs">
                  {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Status indicator */}
              {statusDisplay && (
                <span className="absolute -bottom-0.5 -right-0.5 text-sm">
                  {statusDisplay.emoji}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {userProfile?.display_name || 'Benutzer'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Status Selector */}
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2">Status</p>
              <CompactStatusSelector />
            </div>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => navigate('/profile/edit')}>
              <User className="mr-2 h-4 w-4" />
              Profil bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Einstellungen
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
