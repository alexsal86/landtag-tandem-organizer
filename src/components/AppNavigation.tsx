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
  isMobile?: boolean;
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

// Main navigation groups - Dashboard entfernt (Logo übernimmt)
const navigationGroups: NavGroup[] = [
  {
    id: "mywork",
    label: "Meine Arbeit",
    icon: Home,
    route: "/mywork"
    // Keine subItems = direkter Link
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
    route: "/contacts"
    // Nur eine Seite = direkter Link
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

// Export für SubNavigation in Index.tsx
export function getNavigationGroups(): NavGroup[] {
  return navigationGroups;
}

export function AppNavigation({ activeSection, onSectionChange, isMobile }: NavigationProps) {
  const { user } = useAuth();
  const { navigationCounts, markNavigationAsVisited } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixClient();
  
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
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

  // Check admin role and user role
  useEffect(() => {
    if (!user) return;
    
    const checkRoles = async () => {
      // Lade User-Rolle
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserRole(roleData?.role || null);
      
      // Prüfe Admin-Zugang
      const [{ data: isSuperAdmin }, { data: isBueroleitung }] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'bueroleitung' })
      ]);
      
      setHasAdminAccess(!!(isSuperAdmin || isBueroleitung));
    };
    
    checkRoles();
  }, [user]);

  // Rollenbasierte Sichtbarkeit
  const isAbgeordneter = userRole === 'abgeordneter';
  const isBueroleitung = userRole === 'bueroleitung';
  
  // Zeiterfassung: Nur für Mitarbeiter, Büroleitung, Praktikant (NICHT Abgeordneter)
  const showTimeTracking = !isAbgeordneter && userRole !== null;
  
  // Mitarbeiter-Seite: Nur für Abgeordneter + Büroleitung
  const showEmployeePage = isAbgeordneter || isBueroleitung;

  // Dynamisches Team-Menü basierend auf Rollen
  const getTeamSubItems = (): NavSubItem[] => {
    const items: NavSubItem[] = [];
    if (showEmployeePage) {
      items.push({ id: "employee", label: "Mitarbeiter", icon: Users });
    }
    if (showTimeTracking) {
      items.push({ id: "time", label: "Zeiterfassung", icon: Clock });
    }
    return items;
  };

  const teamSubItems = getTeamSubItems();
  const showTeamGroup = teamSubItems.length > 0;

  const handleNavigationClick = async (sectionId: string) => {
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
  };

  const handleLogoClick = () => {
    onSectionChange('dashboard');
  };

  // Calculate group badge
  const getGroupBadge = (group: NavGroup): number => {
    if (!group.subItems) {
      // Direkter Link - Badge für diese ID
      const directId = group.route ? group.route.slice(1) : group.id;
      return navigationCounts[directId] || 0;
    }
    
    if (group.id === "communication") {
      return matrixUnreadCount;
    }
    
    return group.subItems.reduce((total, item) => {
      return total + (navigationCounts[item.id] || 0);
    }, 0);
  };

  // Check if group is active
  const isGroupActive = (group: NavGroup): boolean => {
    if (group.route) {
      const routeId = group.route.slice(1);
      return activeSection === routeId || activeSection === group.id;
    }
    if (group.subItems) {
      return group.subItems.some(item => item.id === activeSection);
    }
    return false;
  };

  // Render nav item - direkt oder mit Popover
  const renderNavGroup = (group: NavGroup, alignPopover: "start" | "end" = "start") => {
    const badge = getGroupBadge(group);
    const isActive = isGroupActive(group);
    const hasSubItems = group.subItems && group.subItems.length > 1;
    const hasSingleSubItem = group.subItems && group.subItems.length === 1;
    const isDirect = group.route || hasSingleSubItem;
    
    // Direkter Klick ohne Popover
    if (isDirect) {
      const targetId = group.route 
        ? group.route.slice(1) 
        : (hasSingleSubItem ? group.subItems![0].id : group.id);
      
      return (
        <Tooltip key={group.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigationClick(targetId)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                "transition-all duration-200 relative group",
                "hover:bg-[hsl(var(--nav-hover))]",
                isActive && "bg-[hsl(var(--nav-accent)/0.2)]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-[hsl(var(--nav-accent))]" />
              )}
              <div className="relative">
                <group.icon className={cn(
                  "h-6 w-6 transition-colors",
                  isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-foreground))] group-hover:text-[hsl(var(--nav-accent))]"
                )} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium truncate max-w-full transition-colors",
                isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-muted))] group-hover:text-[hsl(var(--nav-foreground))]"
              )}>
                {group.label}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
            {group.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    // Mit Popover für mehrere Unterseiten
    return (
      <Popover key={group.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                  "transition-all duration-200 relative group",
                  "hover:bg-[hsl(var(--nav-hover))]",
                  isActive && "bg-[hsl(var(--nav-accent)/0.2)]"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-[hsl(var(--nav-accent))]" />
                )}
                <div className="relative">
                  <group.icon className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-foreground))] group-hover:text-[hsl(var(--nav-accent))]"
                  )} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium truncate max-w-full transition-colors",
                  isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-muted))] group-hover:text-[hsl(var(--nav-foreground))]"
                )}>
                  {group.label}
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
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

  // Team-Gruppe rendern (dynamisch basierend auf Rollen)
  const renderTeamGroup = () => {
    if (!showTeamGroup) return null;
    
    const teamGroup: NavGroup = {
      id: "team",
      label: "Team",
      icon: UserCog,
      subItems: teamSubItems
    };
    
    // Wenn nur ein Item, direkt navigieren
    if (teamSubItems.length === 1) {
      const singleItem = teamSubItems[0];
      const isActive = activeSection === singleItem.id;
      
      return (
        <Tooltip key="team">
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigationClick(singleItem.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                "transition-all duration-200 relative group",
                "hover:bg-[hsl(var(--nav-hover))]",
                isActive && "bg-[hsl(var(--nav-accent)/0.2)]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-[hsl(var(--nav-accent))]" />
              )}
              <div className="relative">
                <singleItem.icon className={cn(
                  "h-6 w-6 transition-colors",
                  isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-foreground))] group-hover:text-[hsl(var(--nav-accent))]"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium truncate max-w-full transition-colors",
                isActive ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-muted))] group-hover:text-[hsl(var(--nav-foreground))]"
              )}>
                {singleItem.label}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
            {singleItem.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    // Mehrere Items: Popover anzeigen
    return renderNavGroup(teamGroup, "end");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex flex-col h-screen bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] w-[72px] border-r border-[hsl(var(--nav-foreground)/0.1)] shrink-0">
        {/* Logo Area - Klick führt zum Dashboard */}
        <div className="h-14 flex items-center justify-center border-b border-[hsl(var(--nav-foreground)/0.1)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleLogoClick}
                className="transition-transform hover:scale-105"
              >
                {appSettings.app_logo_url ? (
                  <img 
                    src={appSettings.app_logo_url} 
                    alt="Logo" 
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--nav-accent))] flex items-center justify-center">
                    <Home className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
              Dashboard
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex flex-col items-center py-2 overflow-y-auto">
          {navigationGroups.map((group) => renderNavGroup(group, "start"))}
        </div>

        {/* Bottom Section: Team + Admin */}
        <div className="mt-auto border-t border-[hsl(var(--nav-foreground)/0.1)] py-2">
          {/* Team Group (dynamisch basierend auf Rollen) */}
          {renderTeamGroup()}

          {/* Administration - nur für Admins */}
          {hasAdminAccess && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigationClick("administration")}
                  className={cn(
                    "flex flex-col items-center justify-center w-full py-3 px-2 gap-1",
                    "transition-all duration-200 relative group",
                    "hover:bg-[hsl(var(--nav-hover))]",
                    activeSection === "administration" && "bg-[hsl(var(--nav-accent)/0.2)]"
                  )}
                >
                  {activeSection === "administration" && (
                    <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-[hsl(var(--nav-accent))]" />
                  )}
                  <div className="relative">
                    <Shield className={cn(
                      "h-6 w-6 transition-colors",
                      activeSection === "administration" ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-foreground))] group-hover:text-[hsl(var(--nav-accent))]"
                    )} />
                    {(navigationCounts['administration'] || 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
                        {navigationCounts['administration'] > 99 ? '99+' : navigationCounts['administration']}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium truncate max-w-full transition-colors",
                    activeSection === "administration" ? "text-[hsl(var(--nav-accent))]" : "text-[hsl(var(--nav-muted))] group-hover:text-[hsl(var(--nav-foreground))]"
                  )}>
                    Admin
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
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
                  "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <Menu className="h-5 w-5 text-[hsl(var(--nav-muted))] group-hover:text-[hsl(var(--nav-foreground))] transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
              Menü
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
