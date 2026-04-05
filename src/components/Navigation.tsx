import { Calendar, Users, CheckSquare, Home, FileText, MessageSquare, MessageSquareText, Contact, Database, Clock, CalendarPlus, Shield, Vote, MapPin, Archive, Briefcase } from "lucide-react";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import { NavigationBadge } from "./NavigationBadge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useNotifications } from "@/contexts/NotificationContext";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useFavicon } from "@/hooks/useFavicon";
import { cn } from "@/lib/utils";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
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
  const { navigationCounts, hasNewSinceLastVisit, markNavigationAsVisited } = useNavigationNotifications();
  const { notifications } = useNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixUnread();
  const appSettings = useAppSettings();
  const { isAdminClaim, hasAdminAccess } = useResolvedUserRole();
  
  const handleNavigationClick = async (sectionId: string) => {
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
  };

  // Get notifications for a specific context (first 3)
  const getContextNotifications = (context: string) => {
    return notifications
      .filter(notification => 'navigation_context' in notification && (notification as { navigation_context?: string }).navigation_context === context && !notification.is_read)
      .slice(0, 3);
  };


  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "mywork", label: "Meine Arbeit", icon: CheckSquare },
    { id: "calendar", label: "Terminkalender", icon: Calendar },
    { id: "contacts", label: "Kontakte", icon: Contact },
    { id: "tasks", label: "Aufgaben", icon: CheckSquare },
    { id: "decisions", label: "Entscheidungen", icon: Vote },
    { id: "casefiles", label: "Fallakten", icon: Briefcase },
    { id: "dossiers", label: "Dossiers", icon: Briefcase },
    { id: "meetings", label: "Jour fixe", icon: MessageSquare },
    { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    { id: "karten", label: "Karten", icon: MapPin },
    { id: "documents", label: "Dokumente", icon: FileText },
    ...(isAdminClaim ? [{ id: "drucksachen", label: "Drucksachen", icon: Archive }] : []),
    { id: "time", label: "Zeiterfassung", icon: Clock, adminOnly: false },
    { id: "employee", label: "Mitarbeiter", icon: Users },
    { id: "chat", label: "Chat", icon: MessageSquareText },
  ];

  useFavicon(appSettings.app_logo_url);

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
    <Sidebar collapsible="icon" className="border-r text-sm">
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
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold">{appSettings.app_name}</span>
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
                <SidebarGroupLabel className="text-sm">Navigation</SidebarGroupLabel>
                <SidebarTrigger />
              </>
            ) : (
              <SidebarTrigger className="mx-auto" />
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.filter(item => 
                item.id !== "time" || !isAdminClaim
              ).map((item) => {
                return (
                <SidebarMenuItem key={item.id}>
                  <HoverCard openDelay={500} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <SidebarMenuButton
                        onClick={(e) => {
                          handleNavigationClick(item.id);
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
                          {!isCollapsed && <span className="text-sm">{item.label}</span>}
                        </div>
                        {/* Matrix unread badge for expanded sidebar */}
                        {!isCollapsed && item.id === 'chat' && matrixUnreadCount > 0 && (
                          <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
                        )}
                        {!isCollapsed && item.id !== 'chat' && navigationCounts[item.id] > 0 && (
                          <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
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
                                  <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                                  <p className="text-sm text-muted-foreground mt-1">
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
                          {!isCollapsed && <span className="text-sm">Administration</span>}
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
                                  <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                                  <p className="text-sm text-muted-foreground mt-1">
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
