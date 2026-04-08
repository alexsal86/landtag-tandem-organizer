import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, User, Plus, Calendar, Users, FileText, CheckSquare, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { OnlineUsersWidget } from '@/components/OnlineUsersWidget';
import { UserStatusSelector } from '@/components/UserStatusSelector';

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
  const { currentStatus, getStatusDisplay } = useUserStatus();
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
  const [visibleQuickAction, setVisibleQuickAction] = useState(quickAction);
  const [quickActionPhase, setQuickActionPhase] = useState<'idle' | 'closing' | 'opening'>('idle');
  const quickActionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const previousActionKey = visibleQuickAction?.action ?? null;
    const nextActionKey = quickAction?.action ?? null;

    if (previousActionKey === nextActionKey) {
      return;
    }

    if (quickActionTimerRef.current !== null) {
      window.clearTimeout(quickActionTimerRef.current);
      quickActionTimerRef.current = null;
    }

    if (!visibleQuickAction || !quickAction) {
      setVisibleQuickAction(quickAction);
      setQuickActionPhase(quickAction ? 'opening' : 'closing');
      quickActionTimerRef.current = window.setTimeout(() => {
        setQuickActionPhase('idle');
        quickActionTimerRef.current = null;
      }, 260);
      return;
    }

    setQuickActionPhase('closing');
    quickActionTimerRef.current = window.setTimeout(() => {
      setVisibleQuickAction(quickAction);
      setQuickActionPhase('opening');
      quickActionTimerRef.current = window.setTimeout(() => {
        setQuickActionPhase('idle');
        quickActionTimerRef.current = null;
      }, 260);
    }, 260);
  }, [quickAction, visibleQuickAction]);

  useEffect(() => {
    return () => {
      if (quickActionTimerRef.current !== null) {
        window.clearTimeout(quickActionTimerRef.current);
      }
    };
  }, []);

  const handleQuickAction = (): void => {
    if (visibleQuickAction) {
      const urlParams = new URLSearchParams(location.search);
      urlParams.set('action', visibleQuickAction.action);
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
        'h-14 bg-background text-foreground flex items-center justify-between px-4 sticky top-0 z-40',
        !isLetterManagement && 'border-b border-border',
      )}
    >
      {/* Left: Quick Action + Search */}
      <div className="hidden md:flex items-center gap-4">
        {/* Quick Action Button */}
        {visibleQuickAction && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleQuickAction}
            className={cn(
              'h-7 px-2 text-xs bg-muted hover:bg-accent text-foreground overflow-hidden transition-all duration-300 ease-out',
              quickActionPhase === 'closing' && 'max-w-0 opacity-0 -translate-x-2 px-0',
              quickActionPhase === 'opening' && 'max-w-44 opacity-100 translate-x-0',
              quickActionPhase === 'idle' && 'max-w-44 opacity-100 translate-x-0',
            )}
          >
            <Plus className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span className="whitespace-nowrap">{visibleQuickAction.label}</span>
          </Button>
        )}

        {visibleQuickAction && (
          <Separator orientation="vertical" className="h-5 bg-border" />
        )}
      </div>

      {/* Right: Actions with Office Info */}
      <div className="flex items-center gap-3 ml-auto">
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
          <DropdownMenuContent className="w-[22rem]" align="end">
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

            <div className="px-2 pb-2">
              <p className="text-xs text-muted-foreground mb-2">Anwesenheit</p>
              <OnlineUsersWidget />
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
        <Separator orientation="vertical" className="h-6 bg-border" />
        
        {/* Office Title rechts neben Avatar */}
        <div className="text-right hidden lg:block">
          <p className="text-sm font-medium leading-none text-foreground">{appSettings.app_name}</p>
          <p className="text-xs text-muted-foreground">{appSettings.app_subtitle}</p>
        </div>
      </div>
    </header>
  );
};
