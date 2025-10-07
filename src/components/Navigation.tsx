import { Calendar, Users, CheckSquare, Home, FileText, Settings, LogOut, Circle, MessageSquare, Contact, Database, Clock, CalendarPlus, Shield, Edit3, Vote, MapPin, Archive } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { NavigationBadge } from "./NavigationBadge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useNotifications } from "@/hooks/useNotifications";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CompactStatusSelector } from "./CompactStatusSelector";
import { UserStatusSelector } from "./UserStatusSelector";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserStatus } from "@/hooks/useUserStatus";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const { signOut, user } = useAuth();
  const { onlineUsers, getStatusDisplay, currentStatus } = useUserStatus();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { navigationCounts, hasNewSinceLastVisit, markNavigationAsVisited } = useNavigationNotifications();
  const { notifications } = useNotifications();
  
  const [userProfile, setUserProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>("Benutzer");
  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_subtitle: "Koordinationssystem",
    app_logo_url: ""
  });
  const handleNavigationClick = async (sectionId: string) => {
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
  };

  // Get notifications for a specific context (first 3)
  const getContextNotifications = (context: string) => {
    return notifications
      .filter(notification => (notification as any).navigation_context === context && !notification.is_read)
      .slice(0, 3);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Erfolgreich abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Abmelden",
        description: "Ein Fehler ist beim Abmelden aufgetreten.",
        variant: "destructive",
      });
    }
  };

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "calendar", label: "Terminkalender", icon: Calendar },
    { id: "contacts", label: "Kontakte", icon: Contact },
    { id: "tasks", label: "Aufgaben", icon: CheckSquare },
    { id: "decisions", label: "Entscheidungen", icon: Vote },
    { id: "meetings", label: "Jour fixe", icon: MessageSquare },
    { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    { id: "wahlkreise", label: "Wahlkreise", icon: MapPin },
    { id: "documents", label: "Dokumente", icon: FileText },
    ...(isAdmin ? [{ id: "drucksachen", label: "Drucksachen", icon: Archive }] : []),
    { id: "knowledge", label: "Wissen", icon: Database },
    { id: "settings", label: "Einstellungen", icon: Settings },
    { id: "time", label: "Zeiterfassung", icon: Clock, adminOnly: false },
    { id: "employee", label: "Mitarbeiter", icon: Users },
  ];

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

      // Load app settings
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
          app_name: settingsMap.app_name || "LandtagsOS",
          app_subtitle: settingsMap.app_subtitle || "Koordinationssystem",
          app_logo_url: settingsMap.app_logo_url || ""
        });
      }
    };
    
    loadData();
  }, [user, currentTenant]);

  // Update favicon when app logo changes
  useEffect(() => {
    if (!appSettings.app_logo_url) return;

    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());

    // Create new favicon link
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.href = appSettings.app_logo_url;
    
    // Set appropriate type based on file extension
    const url = appSettings.app_logo_url.toLowerCase();
    if (url.includes('.svg')) {
      faviconLink.type = 'image/svg+xml';
    } else if (url.includes('.png')) {
      faviconLink.type = 'image/png';
    } else {
      // Default to png for other formats
      faviconLink.type = 'image/png';
    }

    // Add the new favicon to the document head
    document.head.appendChild(faviconLink);
  }, [appSettings.app_logo_url]);

  // Check admin role and load user role
  useEffect(() => {
    if (!user) return;
    
    const checkAdminAccess = async () => {
      const [{ data: isSuperAdmin }, { data: isBueroleitung }, { data: roles }] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'bueroleitung' }),
        supabase.from('user_roles').select('role').eq('user_id', user.id)
      ]);
      
      setIsAdmin(!!isSuperAdmin);
      setHasAdminAccess(!!(isSuperAdmin || isBueroleitung));
      
      // Set user role display name
      if (roles && roles.length > 0) {
        const roleMap = {
          'abgeordneter': 'Abgeordneter',
          'bueroleitung': 'Büroleitung',
          'sachbearbeiter': 'Sachbearbeiter'
        };
        setUserRole(roleMap[roles[0].role as keyof typeof roleMap] || 'Benutzer');
      } else {
        setUserRole('Benutzer');
      }
    };
    
    checkAdminAccess();
  }, [user]);

  // Real-time presence tracking is now handled in useUserStatus hook

  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Status-Ring Farbe basierend auf Status-Typ
  const getStatusRingColor = (statusType: string) => {
    switch (statusType) {
      case 'available':
        return 'ring-green-500';
      case 'busy':
        return 'ring-red-500';
      case 'away':
        return 'ring-yellow-500';
      case 'in_meeting':
        return 'ring-blue-500';
      default:
        return 'ring-gray-500';
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onSectionChange("dashboard")}
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full justify-center"
            >
              {appSettings.app_logo_url ? (
                <img 
                  src={appSettings.app_logo_url} 
                  alt="App Logo" 
                  className="size-8 object-contain"
                />
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="size-4" />
                </div>
              )}
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{appSettings.app_name}</span>
                  <span className="truncate text-xs">{appSettings.app_subtitle}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-2">
            {!isCollapsed ? (
              <>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarTrigger />
              </>
            ) : (
              <SidebarTrigger className="mx-auto" />
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.filter(item => 
                item.id !== "time" || !isAdmin
              ).map((item) => {
                console.log('Navigation item:', item.label, 'id:', item.id);
                return (
                <SidebarMenuItem key={item.id}>
                  <HoverCard openDelay={500} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <SidebarMenuButton
                        onClick={(e) => {
                          console.log('Button clicked for:', item.label, 'id:', item.id);
                          // Visuelles Feedback mit Toast
                          toast({
                            title: `Navigation geklickt: ${item.label}`,
                            description: `Wechsle zu: ${item.id}`,
                          });
                          console.log('Calling handleNavigationClick with:', item.id);
                          handleNavigationClick(item.id);
                          console.log('handleNavigationClick called successfully');
                        }}
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        className={cn(
                          "nav-item transition-all w-full group",
                          activeSection === item.id && "nav-item-active",
                          isCollapsed ? "justify-center" : "justify-between"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-2",
                          isCollapsed && "justify-center"
                        )}>
                          <item.icon className="nav-icon transition-all duration-200" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </div>
                        {!isCollapsed && navigationCounts[item.id] > 0 && (
                          <NavigationBadge 
                            count={navigationCounts[item.id]}
                            size="sm"
                            className={cn(
                              "nav-badge",
                              hasNewSinceLastVisit(item.id) && "has-new"
                            )}
                          />
                        )}
                      </SidebarMenuButton>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{item.label}</h4>
                        {(() => {
                          const contextNotifications = getContextNotifications(item.id);
                          if (contextNotifications.length === 0) {
                            return <p className="text-sm text-muted-foreground">Keine neuen Benachrichtigungen</p>;
                          }
                          return (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                {contextNotifications.length} neue Benachrichtigung{contextNotifications.length !== 1 ? 'en' : ''}
                              </p>
                              {contextNotifications.map(notification => (
                                <div key={notification.id} className="p-2 rounded border-l-2 border-l-primary bg-muted/50">
                                  <p className="text-sm font-medium">{notification.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(notification.created_at).toLocaleString('de-DE')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </SidebarMenuItem>
                );
              })}

              {hasAdminAccess && (
                <SidebarMenuItem>
                  <HoverCard openDelay={500} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <SidebarMenuButton 
                        onClick={() => {
                          handleNavigationClick("administration");
                        }}
                        isActive={activeSection === "administration"}
                        tooltip="Administration"
                        className={cn(
                          "w-full",
                          isCollapsed ? "justify-center" : "justify-between"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-2",
                          isCollapsed && "justify-center"
                        )}>
                          <Shield />
                          {!isCollapsed && <span>Administration</span>}
                        </div>
                        {!isCollapsed && navigationCounts['administration'] > 0 && (
                          <NavigationBadge 
                            count={navigationCounts['administration']}
                            size="sm"
                          />
                        )}
                      </SidebarMenuButton>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Administration</h4>
                        {(() => {
                          const contextNotifications = getContextNotifications('administration');
                          if (contextNotifications.length === 0) {
                            return <p className="text-sm text-muted-foreground">Keine neuen Benachrichtigungen</p>;
                          }
                          return (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                {contextNotifications.length} neue Benachrichtigung{contextNotifications.length !== 1 ? 'en' : ''}
                              </p>
                              {contextNotifications.map(notification => (
                                <div key={notification.id} className="p-2 rounded border-l-2 border-l-primary bg-muted/50">
                                  <p className="text-sm font-medium">{notification.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(notification.created_at).toLocaleString('de-DE')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Online Users Section */}
        <div className="border-t border-border mt-4 pt-4">
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
                Online ({onlineUsers.length})
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {onlineUsers.slice(0, 8).map((onlineUser) => {
                  return (
                    <div
                      key={onlineUser.user_id}
                      className={cn(
                        "flex items-center rounded-md text-sm hover:bg-accent/50 transition-colors",
                        isCollapsed ? "justify-center px-1 py-1" : "gap-3 px-2 py-1.5"
                      )}
                    >
                      <div className="relative">
                        <Avatar className={cn(
                          "ring-4 ring-offset-2 ring-offset-background",
                          isCollapsed ? "h-6 w-6" : "h-8 w-8"
                        )}>
                          <AvatarImage src={onlineUser.avatar_url || ""} alt={onlineUser.display_name || 'User'} />
                          <AvatarFallback className="text-xs">
                            {onlineUser.display_name?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Status Ring Overlay */}
                        <div className={cn(
                          "absolute inset-0 rounded-full ring-4 ring-offset-2 ring-offset-background pointer-events-none",
                          (onlineUser.status?.status_type === 'online' || onlineUser.status?.status_type === 'custom') && 'ring-green-500',
                          onlineUser.status?.status_type === 'meeting' && 'ring-blue-500',
                          onlineUser.status?.status_type === 'away' && 'ring-yellow-500',
                          onlineUser.status?.status_type === 'break' && 'ring-orange-500',
                          onlineUser.status?.status_type === 'offline' && 'ring-gray-500',
                          !onlineUser.status?.status_type && 'ring-gray-500'
                        )} />
                      </div>
                      {!isCollapsed && (
                        <span className="text-muted-foreground truncate flex-1">
                          {onlineUser.display_name || 'Unbekannt'}
                        </span>
                      )}
                    </div>
                  );
                })}
                {onlineUsers.length > 8 && !isCollapsed && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{onlineUsers.length - 8} weitere
                  </div>
                )}
                {onlineUsers.length === 0 && !isCollapsed && (
                  <div className="text-xs text-muted-foreground px-2">
                    Niemand online
                  </div>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <UserStatusSelector>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer flex-1"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile?.avatar_url || ""} alt="Profilbild" />
                    <AvatarFallback>
                      {(userProfile?.display_name || user?.email)?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {userProfile?.display_name || user?.email || "Unbekannter Benutzer"}
                    </span>
                    <span className="truncate text-xs">{userRole}</span>
                  </div>
                </SidebarMenuButton>
              </UserStatusSelector>
              <span className="text-muted-foreground">|</span>
              <CompactStatusSelector />
              <NotificationBell />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Abmelden">
              <LogOut />
              <span>Abmelden</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
