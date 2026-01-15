import { Calendar, Users, CheckSquare, Home, FileText, MessageSquare, MessageSquareText, Contact, Database, Clock, CalendarPlus, Shield, Vote, MapPin, Archive, Briefcase } from "lucide-react";
import { useMatrixClient } from "@/contexts/MatrixClientContext";
import { NavigationBadge } from "./NavigationBadge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useNotifications } from "@/contexts/NotificationContext";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { navigationCounts, hasNewSinceLastVisit, markNavigationAsVisited } = useNavigationNotifications();
  const { notifications } = useNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixClient();
  const appSettings = useAppSettings();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  
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


  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "mywork", label: "Meine Arbeit", icon: CheckSquare },
    { id: "calendar", label: "Terminkalender", icon: Calendar },
    { id: "contacts", label: "Kontakte", icon: Contact },
    { id: "tasks", label: "Aufgaben", icon: CheckSquare },
    { id: "decisions", label: "Entscheidungen", icon: Vote },
    { id: "casefiles", label: "FallAkten", icon: Briefcase },
    { id: "meetings", label: "Jour fixe", icon: MessageSquare },
    { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    { id: "karten", label: "Karten", icon: MapPin },
    { id: "documents", label: "Dokumente", icon: FileText },
    ...(isAdmin ? [{ id: "drucksachen", label: "Drucksachen", icon: Archive }] : []),
    { id: "knowledge", label: "Wissen", icon: Database },
    { id: "time", label: "Zeiterfassung", icon: Clock, adminOnly: false },
    { id: "employee", label: "Mitarbeiter", icon: Users },
    { id: "chat", label: "Chat", icon: MessageSquareText },
  ];

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

  // Check admin role
  useEffect(() => {
    if (!user) return;
    
    const checkAdminAccess = async () => {
      const [{ data: isSuperAdmin }, { data: isBueroleitung }] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'bueroleitung' })
      ]);
      
      setIsAdmin(!!isSuperAdmin);
      setHasAdminAccess(!!(isSuperAdmin || isBueroleitung));
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
      <SidebarHeader className="border-b h-12">
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
                          <div className="relative">
                            <item.icon className="nav-icon transition-all duration-200" />
                            {/* Matrix unread badge for collapsed sidebar */}
                            {item.id === 'chat' && matrixUnreadCount > 0 && isCollapsed && (
                              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                            )}
                          </div>
                          {!isCollapsed && <span>{item.label}</span>}
                        </div>
                        {/* Matrix unread badge for expanded sidebar */}
                        {!isCollapsed && item.id === 'chat' && matrixUnreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {matrixUnreadCount > 99 ? '99+' : matrixUnreadCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.id !== 'chat' && navigationCounts[item.id] > 0 && (
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

        {/* Online users now shown in AppHeader */}
      </SidebarContent>

    </Sidebar>
  );
}
