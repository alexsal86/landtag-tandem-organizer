import { Calendar, Users, CheckSquare, Home, FileText, Settings, LogOut, Circle, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  const { toast } = useToast();
  const { state } = useSidebar();
  const [onlineUsers, setOnlineUsers] = useState<Array<{ user_id: string; email: string; display_name?: string; online_at: string }>>([]);

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
    { id: "contacts", label: "Kontakte", icon: Users },
    { id: "tasks", label: "Aufgaben", icon: CheckSquare },
    { id: "meetings", label: "Meetings", icon: MessageSquare },
    { id: "documents", label: "Dokumente", icon: FileText },
    { id: "settings", label: "Einstellungen", icon: Settings },
  ];

  // Online users presence tracking
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const allUsers = Object.keys(newState).flatMap(key => newState[key]);
        
        // Deduplicate users by user_id to show each user only once
        const uniqueUsers = allUsers.reduce((acc, user) => {
          const userData = user as any;
          if (userData.user_id && !acc.find(u => u.user_id === userData.user_id)) {
            acc.push({
              user_id: userData.user_id,
              email: userData.email,
              display_name: userData.display_name,
              online_at: userData.online_at
            });
          }
          return acc;
        }, [] as Array<{ user_id: string; email: string; display_name?: string; online_at: string }>);
        
        setOnlineUsers(uniqueUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('user joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('user left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch user profile to get display_name
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();

          // Track current user presence
          await channel.track({
            user_id: user.id,
            email: user.email,
            display_name: profile?.display_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <SidebarTrigger className="ml-auto" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onSectionChange("dashboard")}
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileText className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">LandtagsOS</span>
                <span className="truncate text-xs">Koordinationssystem</span>
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
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
              <div className="space-y-2">
                {onlineUsers.slice(0, 5).map((onlineUser, index) => (
                  <div
                    key={`${onlineUser.user_id}-${index}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-md text-sm"
                  >
                    <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                    <span className="text-muted-foreground truncate">
                      {onlineUser.display_name || onlineUser.email || 'Unbekannt'}
                    </span>
                  </div>
                ))}
                {onlineUsers.length > 5 && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{onlineUsers.length - 5} weitere
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
            <SidebarMenuButton
              onClick={() => onSectionChange("profile")}
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user?.email || "Unbekannter Benutzer"}
                </span>
                <span className="truncate text-xs">Benutzer</span>
              </div>
            </SidebarMenuButton>
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