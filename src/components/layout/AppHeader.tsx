import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, User, Plus, Calendar, Users, FileText, CheckSquare, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { OnlineUsersWidget } from '@/components/OnlineUsersWidget';
import { UserStatusSelector } from '@/components/UserStatusSelector';
import { HeaderSearch } from '@/components/layout/HeaderSearch';
import { useAuth } from '@/hooks/useAuth';
import { useUserStatus } from '@/hooks/useUserStatus';
import { useTenant } from '@/hooks/useTenant';
import { useAppSettings } from '@/hooks/useAppSettings';
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

type OnOpenSearchCallback = () => void;

interface AppHeaderProps {
  onOpenSearch?: OnOpenSearchCallback;
}

// Map section IDs to readable labels and quick actions
const sectionConfig: Record<string, { label: string; quickAction?: { label: string; action: string } }> = {
  dashboard: { label: 'Dashboard' },
  mywork: { label: 'Meine Arbeit' },
  calendar: { label: 'Kalender', quickAction: { label: 'Neuer Termin', action: 'create-appointment' } },
  eventplanning: { label: 'Planungen', quickAction: { label: 'Neue Planung', action: 'create-eventplanning' } },
  contacts: { label: 'Kontakte', quickAction: { label: 'Neuer Kontakt', action: 'create-contact' } },
  tasks: { label: 'Aufgaben', quickAction: { label: 'Neue Aufgabe', action: 'create-task' } },
  decisions: { label: 'Entscheidungen', quickAction: { label: 'Neue Entscheidung', action: 'create-decision' } },
  meetings: { label: 'Jour fixe', quickAction: { label: 'Neues Meeting', action: 'create-meeting' } },
  casefiles: { label: 'Fallakten', quickAction: { label: 'Neue Akte', action: 'create-casefile' } },
  dossiers: { label: 'Dossiers', quickAction: { label: 'Neues Dossier', action: 'create-dossier' } },
  documents: { label: 'Dokumente', quickAction: { label: 'Neues Dokument', action: 'create-document' } },
  drucksachen: { label: 'Drucksachen', quickAction: { label: 'Neue Drucksache', action: 'create-drucksache' } },
  knowledge: { label: 'Wissen', quickAction: { label: 'Neuer Artikel', action: 'create-article' } },
  karten: { label: 'Karten' },
  chat: { label: 'Chat' },
  time: { label: 'Zeiterfassung', quickAction: { label: 'Zeit erfassen', action: 'create-timeentry' } },
  employee: { label: 'Mitarbeiter', quickAction: { label: 'Neuer Mitarbeiter', action: 'create-employee' } },
  settings: { label: 'Einstellungen' },
  administration: { label: 'Administration' },
};

// Quick Actions for mywork tabs
const myworkTabActions: Record<string, { label: string; action: string }> = {
  tasks: { label: 'Neue Aufgabe', action: 'create-task' },
  decisions: { label: 'Neue Entscheidung', action: 'create-decision' },
  jourFixe: { label: 'Neues Meeting', action: 'create-meeting' },
  casefiles: { label: 'Neue Akte', action: 'create-casefile' },
  plannings: { label: 'Neue Planung', action: 'create-eventplanning' },
};

export const AppHeader = ({ onOpenSearch }: AppHeaderProps): React.JSX.Element => {
  const { user, signOut } = useAuth();
  const { currentStatus, getStatusDisplay, onlineUsers } = useUserStatus();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const appSettings = useAppSettings();
  
  const [userProfile, setUserProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);

  // Get current section from path
  const currentSection = location.pathname === '/' ? 'dashboard' : location.pathname.slice(1).split('/')[0];
  const sectionInfo: { label: string; quickAction?: { label: string; action: string } } = sectionConfig[currentSection] ?? { label: currentSection };

  // Load user profile only - app settings now come from context
  useEffect((): void => {
    const loadProfile = async (): Promise<void> => {
      if (user && currentTenant?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();
        
        setUserProfile(profile ?? null);
      }
    };
    
    void loadProfile();
  }, [user, currentTenant]);

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      toast({
        title: 'Erfolgreich abgemeldet',
        description: 'Sie wurden erfolgreich abgemeldet.',
      });
      // Navigate to auth page after successful logout
      navigate('/auth');
    } catch (error: unknown) {
      toast({
        title: 'Fehler beim Abmelden',
        description: 'Ein Fehler ist beim Abmelden aufgetreten.',
        variant: 'destructive',
      });
    }
  };

  // Get mywork tab from URL
  const myworkTab = new URLSearchParams(location.search).get('tab');
  const isLetterManagement = currentSection === 'documents' && myworkTab === 'letters';
  
  // Determine quick action - check mywork tabs first
  const getQuickAction = (): { label: string; action: string } | undefined => {
    if (currentSection === 'mywork' && myworkTab && myworkTabActions[myworkTab]) {
      return myworkTabActions[myworkTab];
    }
    return sectionInfo.quickAction;
  };
  
  const quickAction = getQuickAction();

  const handleQuickAction = (): void => {
    if (quickAction) {
      const urlParams = new URLSearchParams(location.search);
      urlParams.set('action', quickAction.action);
      navigate(`${location.pathname}?${urlParams.toString()}`);
    }
  };

  const statusDisplay = currentStatus ? getStatusDisplay(currentStatus) : null;

  const getStatusRingColor = (statusType: string): string => {
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
        return '';
      default:
        return 'ring-gray-300';
    }
  };

  return (
    <header
      className={cn(
        'h-14 bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] flex items-center justify-between px-4 sticky top-0 z-40',
        !isLetterManagement && 'border-b border-[hsl(var(--nav-foreground)/0.1)]',
      )}
    >
      {/* Left: Quick Action + Search */}
      <div className="hidden md:flex items-center gap-4">
        {/* Quick Action Button */}
        {quickAction && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleQuickAction}
            className="h-7 px-2 text-xs bg-[hsl(var(--nav-hover))] hover:bg-[hsl(var(--nav-active-bg))] text-[hsl(var(--nav-foreground))]"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {quickAction.label}
          </Button>
        )}

        {quickAction && (
          <Separator orientation="vertical" className="h-5 bg-[hsl(var(--nav-foreground)/0.2)]" />
        )}

        {/* Search */}
        <HeaderSearch />
      </div>

      {/* Right: Actions with Office Info */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Online Users */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Online-Benutzer anzeigen">
              {onlineUsers.length === 0 ? (
                <div className="h-6 w-6 rounded-full bg-muted border-2 border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-muted-foreground text-[10px]">○</span>
                </div>
              ) : (
                <div className="flex -space-x-2">
                  {onlineUsers.slice(0, 3).map((onlineUser, index) => {
                    const userStatusDisplay = getStatusDisplay(onlineUser.status);
                    const statusColor = userStatusDisplay?.color || '#22c55e';
                    return (
                      <div key={onlineUser.user_id} style={{ zIndex: index + 1 }}>
                        <Avatar 
                          className="h-6 w-6 border-2 border-[hsl(var(--nav))] ring-2"
                          style={{ '--tw-ring-color': statusColor } as React.CSSProperties}
                        >
                          <AvatarImage src={onlineUser.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted text-foreground">
                            {onlineUser.display_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    );
                  })}
                  {/* Grüner Kreis IMMER VORNE */}
                  <div 
                    className="h-6 w-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center"
                    style={{ zIndex: onlineUsers.length + 1 }}
                  >
                    {onlineUsers.length > 3 ? (
                      <span className="text-[10px] font-medium text-white">
                        +{onlineUsers.length - 3}
                      </span>
                    ) : (
                      <span className="text-white text-[10px]">●</span>
                    )}
                  </div>
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <OnlineUsersWidget />
          </PopoverContent>
        </Popover>

        {/* Notifications */}
        <NotificationBell />

        {/* User Avatar with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0" aria-label="Benutzermenü öffnen">
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
                <span className="absolute -bottom-1 -right-1 text-sm">
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
            
            {/* Status Selector - öffnet den vollen UserStatusSelector Dialog */}
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2">Status</p>
              <UserStatusSelector>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span>{statusDisplay?.emoji || '🟢'}</span>
                    <span className="text-sm">{statusDisplay?.label || 'Online'}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </UserStatusSelector>
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
        
        {/* Separator zwischen Avatar und Büro-Info */}
        <Separator orientation="vertical" className="h-6 bg-[hsl(var(--nav-foreground)/0.2)]" />
        
        {/* Office Title rechts neben Avatar */}
        <div className="text-right hidden lg:block">
          <p className="text-sm font-medium leading-none text-[hsl(var(--nav-foreground))]">{appSettings.app_name}</p>
          <p className="text-xs text-[hsl(var(--nav-muted))]">{appSettings.app_subtitle}</p>
        </div>
      </div>
    </header>
  );
};
