import { useState, useEffect } from "react";
import { 
  Home, 
  MessageSquare, 
  Calendar, 
  CheckSquare, 
  Briefcase, 
  Users, 
  MoreHorizontal,
  MapPin,
  Database,
  Clock,
  Shield,
  Menu,
  CalendarPlus,
  Vote,
  FileText,
  Archive,
  UserCog,
  Phone
} from "lucide-react";
import { useMatrixClient } from "@/contexts/MatrixClientContext";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface NavSubItem {
  id: string;
  label: string;
  icon: typeof Home;
}

interface NavGroup {
  id: string;
  label: string;
  icon: typeof Home;
  subItems?: NavSubItem[];
  route?: string;
  adminOnly?: boolean;
}

// Main navigation groups
const navigationGroups: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    subItems: [
      { id: "dashboard", label: "Übersicht", icon: Home },
      { id: "mywork", label: "Meine Arbeit", icon: CheckSquare },
    ]
  },
  {
    id: "communication",
    label: "Chat",
    icon: MessageSquare,
    subItems: [
      { id: "chat", label: "Chat", icon: MessageSquare },
      { id: "meetings", label: "Jour fixe", icon: MessageSquare },
    ]
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: Calendar,
    subItems: [
      { id: "calendar", label: "Terminkalender", icon: Calendar },
      { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    ]
  },
  {
    id: "tasks",
    label: "Aufgaben",
    icon: CheckSquare,
    subItems: [
      { id: "tasks", label: "Aufgaben", icon: CheckSquare },
      { id: "decisions", label: "Entscheidungen", icon: Vote },
    ]
  },
  {
    id: "files",
    label: "Akten",
    icon: Briefcase,
    subItems: [
      { id: "casefiles", label: "FallAkten", icon: Briefcase },
      { id: "documents", label: "Dokumente", icon: FileText },
      { id: "drucksachen", label: "Drucksachen", icon: Archive },
    ]
  },
  {
    id: "people",
    label: "Kontakte",
    icon: Users,
    subItems: [
      { id: "contacts", label: "Kontakte", icon: Users },
    ]
  },
  {
    id: "more",
    label: "Mehr",
    icon: MoreHorizontal,
    subItems: [
      { id: "karten", label: "Karten", icon: MapPin },
      { id: "knowledge", label: "Wissen", icon: Database },
      { id: "calls", label: "Anrufe", icon: Phone },
    ]
  }
];

// Bottom navigation - Team section (Mitarbeiter + Zeiterfassung)
const bottomNavItems: NavGroup[] = [
  {
    id: "team",
    label: "Team",
    icon: UserCog,
    subItems: [
      { id: "employee", label: "Mitarbeiter", icon: Users },
      { id: "time", label: "Zeiterfassung", icon: Clock },
    ]
  }
];

export function TeamsNavigation({ activeSection, onSectionChange }: NavigationProps) {
  const { user } = useAuth();
  const { navigationCounts, markNavigationAsVisited } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixClient();
  
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [appSettings, setAppSettings] = useState({
    app_logo_url: ""
  });
  const [expandedNav, setExpandedNav] = useState(false);

  // Load app settings
  useEffect(() => {
    const loadData = async () => {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_logo_url']);

      if (settings) {
        const settingsMap = settings.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || '';
          return acc;
        }, {} as Record<string, string>);

        setAppSettings({
          app_logo_url: settingsMap.app_logo_url || ""
        });
      }
    };
    
    loadData();
  }, []);

  // Check admin role
  useEffect(() => {
    if (!user) return;
    
    const checkAdminAccess = async () => {
      const [{ data: isSuperAdmin }, { data: isBueroleitung }] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'bueroleitung' })
      ]);
      
      setHasAdminAccess(!!(isSuperAdmin || isBueroleitung));
    };
    
    checkAdminAccess();
  }, [user]);

  const handleNavigationClick = async (sectionId: string) => {
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
  };

  // Calculate group badge
  const getGroupBadge = (group: NavGroup): number => {
    if (!group.subItems) return 0;
    
    if (group.id === "communication") {
      return matrixUnreadCount;
    }
    
    return group.subItems.reduce((total, item) => {
      return total + (navigationCounts[item.id] || 0);
    }, 0);
  };

  // Check if group is active
  const isGroupActive = (group: NavGroup): boolean => {
    if (group.route && activeSection === group.id) return true;
    if (group.subItems) {
      return group.subItems.some(item => item.id === activeSection);
    }
    return false;
  };

  // Render nav item (reusable for main and bottom sections)
  const renderNavGroup = (group: NavGroup, alignPopover: "start" | "end" = "start") => {
    const badge = getGroupBadge(group);
    const isActive = isGroupActive(group);
    
    return (
      <Popover key={group.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                  "transition-all duration-200 relative group",
                  "hover:bg-nav-hover",
                  isActive && "bg-nav-accent/20"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-nav-accent" />
                )}
                <div className="relative">
                  <group.icon className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-nav-accent" : "text-nav-foreground group-hover:text-nav-accent"
                  )} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium truncate max-w-full transition-colors",
                  isActive ? "text-nav-accent" : "text-nav-muted group-hover:text-nav-foreground"
                )}>
                  {group.label}
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-nav text-nav-foreground border-nav-foreground/20">
            {group.label}
          </TooltipContent>
        </Tooltip>
        
        {group.subItems && group.subItems.length > 0 && (
          <PopoverContent 
            side="right" 
            align={alignPopover} 
            className="w-56 p-1 bg-popover border shadow-lg"
            sideOffset={8}
          >
            <div className="py-1">
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              {group.subItems.map((item) => {
                const itemBadge = item.id === 'chat' ? matrixUnreadCount : (navigationCounts[item.id] || 0);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigationClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                      "hover:bg-accent",
                      activeSection === item.id && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {itemBadge > 0 && (
                      <span className="min-w-[20px] h-5 rounded-full bg-destructive text-[11px] text-white flex items-center justify-center font-medium px-1.5">
                        {itemBadge > 99 ? '99+' : itemBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        )}
      </Popover>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex flex-col h-screen bg-nav text-nav-foreground w-[72px] border-r border-nav-foreground/10 shrink-0">
        {/* Logo Area */}
        <div className="h-14 flex items-center justify-center border-b border-nav-foreground/10">
          {appSettings.app_logo_url ? (
            <img 
              src={appSettings.app_logo_url} 
              alt="Logo" 
              className="h-8 w-8 object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-nav-accent flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex flex-col items-center py-2 overflow-y-auto">
          {navigationGroups.map((group) => renderNavGroup(group, "start"))}
        </div>

        {/* Bottom Section: Team + Admin */}
        <div className="mt-auto border-t border-nav-foreground/10 py-2">
          {/* Team Group (Mitarbeiter + Zeiterfassung) */}
          {bottomNavItems.map((group) => renderNavGroup(group, "end"))}

          {/* Administration - nur für Admins */}
          {hasAdminAccess && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigationClick("administration")}
                  className={cn(
                    "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                    "transition-all duration-200 relative group",
                    "hover:bg-nav-hover",
                    activeSection === "administration" && "bg-nav-accent/20"
                  )}
                >
                  {activeSection === "administration" && (
                    <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-nav-accent" />
                  )}
                  <div className="relative">
                    <Shield className={cn(
                      "h-6 w-6 transition-colors",
                      activeSection === "administration" ? "text-nav-accent" : "text-nav-foreground group-hover:text-nav-accent"
                    )} />
                    {(navigationCounts['administration'] || 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
                        {navigationCounts['administration'] > 99 ? '99+' : navigationCounts['administration']}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium truncate max-w-full transition-colors",
                    activeSection === "administration" ? "text-nav-accent" : "text-nav-muted group-hover:text-nav-foreground"
                  )}>
                    Admin
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-nav text-nav-foreground border-nav-foreground/20">
                Administration
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Hamburger Menu Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExpandedNav(!expandedNav)}
                className={cn(
                  "flex flex-col items-center justify-center w-full py-2 gap-1",
                  "transition-all duration-200 group",
                  "hover:bg-nav-hover"
                )}
              >
                <Menu className="h-5 w-5 text-nav-muted group-hover:text-nav-foreground transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-nav text-nav-foreground border-nav-foreground/20">
              Menü
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
