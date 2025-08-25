import { Calendar, Users, CheckSquare, Home, FileText, Settings, LogOut, Circle, MessageSquare, Contact, Database, Clock, CalendarPlus, Shield } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
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
  const { onlineUsers, getStatusDisplay } = useUserStatus();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { state } = useSidebar();
  const [userProfile, setUserProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>("Benutzer");
  const [appSettings, setAppSettings] = useState({
    app_name: "LandtagsOS",
    app_subtitle: "Koordinationssystem",
    app_logo_url: ""
  });
  const navigate = useNavigate();
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
    { id: "meetings", label: "Jour fixe", icon: MessageSquare },
    { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    { id: "documents", label: "Dokumente", icon: FileText },
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

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between p-2">
          <SidebarTrigger />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onSectionChange("dashboard")}
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {appSettings.app_logo_url ? (
                  <img 
                    src={appSettings.app_logo_url} 
                    alt="App Logo" 
                    className="size-4 object-contain"
                  />
                ) : (
                  <FileText className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{appSettings.app_name}</span>
                <span className="truncate text-xs">{appSettings.app_subtitle}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.filter(item => 
                item.id !== "time" || !isAdmin
              ).map((item) => {
                console.log('Navigation item:', item.label, 'id:', item.id);
                return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={(e) => {
                      console.log('Button clicked for:', item.label, 'id:', item.id);
                      // Visuelles Feedback mit Toast
                      toast({
                        title: `Navigation geklickt: ${item.label}`,
                        description: `Wechsle zu: ${item.id}`,
                      });
                      console.log('Calling onSectionChange with:', item.id);
                      onSectionChange(item.id);
                      console.log('onSectionChange called successfully');
                    }}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}

              {hasAdminAccess && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => {
                      onSectionChange("administration");
                    }}
                    isActive={activeSection === "administration"}
                    tooltip="Administration"
                  >
                    <Shield />
                    <span>Administration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Online Users Section */}
        <div className="border-t border-border mt-4 pt-4">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
              Online ({onlineUsers.length})
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {onlineUsers.slice(0, 8).map((onlineUser) => {
                  const statusDisplay = getStatusDisplay(onlineUser.status);
                  return (
                    <div
                      key={onlineUser.user_id}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-sm hover:bg-accent/50 transition-colors"
                    >
                      <span className="text-sm">{statusDisplay.emoji}</span>
                      <span className="text-muted-foreground truncate flex-1">
                        {onlineUser.display_name || 'Unbekannt'}
                      </span>
                      {onlineUser.status?.custom_message && (
                        <Badge variant="outline" className="text-xs px-1 py-0 max-w-[60px] truncate">
                          {onlineUser.status.custom_message}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {onlineUsers.length > 8 && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{onlineUsers.length - 8} weitere
                  </div>
                )}
                {onlineUsers.length === 0 && (
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
