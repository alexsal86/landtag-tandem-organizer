import { useState, useEffect, useRef } from "react";
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

// Main navigation groups - Jour fixe unter Aufgaben
const navigationGroups: NavGroup[] = [
  {
    id: "mywork",
    label: "Meine Arbeit",
    icon: Home,
    route: "/mywork"
  },
  {
    id: "communication",
    label: "Chat",
    icon: MessageSquare,
    subItems: [
      { id: "chat", label: "Chat", icon: MessageSquare },
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
      { id: "meetings", label: "Jour fixe", icon: Calendar },
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

export function AppNavigation({ 
  activeSection, 
  onSectionChange, 
  isMobile
}: NavigationProps) {
  const { user } = useAuth();
  const { navigationCounts, markNavigationAsVisited } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixClient();
  
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState({
    app_logo_url: ""
  });
  
  // Animation states
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [previousBadges, setPreviousBadges] = useState<Record<string, number>>({});
  const [newBadgeItems, setNewBadgeItems] = useState<Set<string>>(new Set());

  // Load app settings
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
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
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  // Check admin role and user role
  useEffect(() => {
    if (!user) return;
    
    const checkRoles = async () => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserRole(roleData?.role || null);
      
      const [{ data: isSuperAdmin }, { data: isBueroleitung }] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: user.id }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'bueroleitung' })
      ]);
      
      setHasAdminAccess(!!(isSuperAdmin || isBueroleitung));
    };
    
    checkRoles();
  }, [user]);

  // Track badge changes for animations
  useEffect(() => {
    const newItems = new Set<string>();
    
    Object.entries(navigationCounts).forEach(([key, count]) => {
      const prevCount = previousBadges[key] || 0;
      if (count > prevCount) {
        newItems.add(key);
        // Remove from newItems after animation
        setTimeout(() => {
          setNewBadgeItems(prev => {
            const updated = new Set(prev);
            updated.delete(key);
            return updated;
          });
        }, 3000);
      }
    });
    
    if (newItems.size > 0) {
      setNewBadgeItems(prev => new Set([...prev, ...newItems]));
    }
    
    setPreviousBadges(navigationCounts);
  }, [navigationCounts]);

  const isAbgeordneter = userRole === 'abgeordneter';
  const isBueroleitung = userRole === 'bueroleitung';
  const showTimeTracking = !isAbgeordneter && userRole !== null;
  const showEmployeePage = isAbgeordneter || isBueroleitung;

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
    // Bounce animation
    setClickedItem(sectionId);
    setTimeout(() => setClickedItem(null), 150);
    
    // Optimistic UI - immediate visual feedback
    setPendingSection(sectionId);
    
    // Background operations
    await markNavigationAsVisited(sectionId);
    
    // Navigate
    onSectionChange(sectionId);
    setPendingSection(null);
  };

  const handleLogoClick = () => {
    setClickedItem('dashboard');
    setTimeout(() => setClickedItem(null), 150);
    onSectionChange('dashboard');
  };

  const getGroupBadge = (group: NavGroup): number => {
    if (!group.subItems) {
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

  const hasNewBadge = (group: NavGroup): boolean => {
    if (!group.subItems) {
      const directId = group.route ? group.route.slice(1) : group.id;
      return newBadgeItems.has(directId);
    }
    return group.subItems.some(item => newBadgeItems.has(item.id));
  };

  // Skeleton loader
  if (isLoading) {
    return (
      <TooltipProvider delayDuration={300}>
        <nav className="flex flex-col h-screen bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-[hsl(var(--nav-foreground)/0.1)] shrink-0 w-[200px]">
          {/* Logo Skeleton */}
          <div className="h-14 flex items-center justify-center border-b border-[hsl(var(--nav-foreground)/0.1)]">
            <div className="h-8 w-8 rounded-lg animate-skeleton" />
          </div>
          
          {/* Navigation Items Skeleton */}
          <div className="flex-1 flex flex-col py-2 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex items-center gap-3 py-3 px-4">
                <div className="h-5 w-5 rounded animate-skeleton" />
                <div className="h-4 w-24 rounded animate-skeleton" />
              </div>
            ))}
          </div>
          
          {/* Bottom Skeleton */}
          <div className="mt-auto border-t border-[hsl(var(--nav-foreground)/0.1)] py-2">
            <div className="flex items-center gap-3 py-3 px-4">
              <div className="h-5 w-5 rounded animate-skeleton" />
              <div className="h-4 w-16 rounded animate-skeleton" />
            </div>
          </div>
        </nav>
      </TooltipProvider>
    );
  }

  const renderNavGroup = (group: NavGroup) => {
    const badge = getGroupBadge(group);
    const isActive = isGroupActive(group);
    const isNewBadge = hasNewBadge(group);
    
    const targetId = group.route 
      ? group.route.slice(1) 
      : (group.subItems && group.subItems.length > 0 
          ? group.subItems[0].id 
          : group.id);
    
    const isPending = pendingSection === targetId;
    
    return (
      <Tooltip key={group.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleNavigationClick(targetId)}
            className={cn(
              "flex items-center w-full py-3 gap-3 transition-all duration-200 relative group px-4",
              "hover:bg-[hsl(var(--nav-hover))]",
              (isActive || isPending) && "bg-[hsl(var(--nav-active-bg))]"
            )}
          >
            <div className="relative">
              <group.icon 
                className={cn(
                  "h-5 w-5 text-[hsl(var(--nav-foreground))]",
                  clickedItem === targetId && "animate-nav-bounce"
                )} 
              />
              {badge > 0 && (
                <span 
                  className={cn(
                    "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-bold px-1",
                    "animate-badge-appear",
                    isNewBadge && "animate-badge-pulse"
                  )}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className="text-sm font-medium truncate text-[hsl(var(--nav-foreground))] flex-1 text-left">
              {group.label}
            </span>
          </button>
        </TooltipTrigger>
      </Tooltip>
    );
  };

  const renderTeamGroup = () => {
    if (!showTeamGroup) return null;
    
    const firstItem = teamSubItems[0];
    const isActive = teamSubItems.some(item => item.id === activeSection);
    const isPending = pendingSection === firstItem.id;
    
    return (
      <Tooltip key="team">
        <TooltipTrigger asChild>
          <button
            onClick={() => handleNavigationClick(firstItem.id)}
            className={cn(
              "flex items-center w-full py-3 gap-3 transition-all duration-200 relative group px-4",
              "hover:bg-[hsl(var(--nav-hover))]",
              (isActive || isPending) && "bg-[hsl(var(--nav-active-bg))]"
            )}
          >
            <div className="relative">
              <UserCog 
                className={cn(
                  "h-5 w-5 text-[hsl(var(--nav-foreground))]",
                  clickedItem === firstItem.id && "animate-nav-bounce"
                )} 
              />
            </div>
            <span className="text-sm font-medium truncate text-[hsl(var(--nav-foreground))] flex-1 text-left">
              Team
            </span>
          </button>
        </TooltipTrigger>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex flex-col h-screen bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-[hsl(var(--nav-foreground)/0.1)] shrink-0 w-[200px]">
        {/* Logo Area */}
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
                    className={cn(
                      "h-8 w-8 object-contain",
                      clickedItem === 'dashboard' && "animate-nav-bounce"
                    )}
                  />
                ) : (
                  <div 
                    className={cn(
                      "h-8 w-8 rounded-lg bg-[hsl(var(--nav-accent))] flex items-center justify-center",
                      clickedItem === 'dashboard' && "animate-nav-bounce"
                    )}
                  >
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
        <div className="flex-1 flex flex-col py-2 overflow-y-auto">
          {navigationGroups.map((group) => renderNavGroup(group))}
        </div>

        {/* Bottom Section: Team + Admin */}
        <div className="mt-auto border-t border-[hsl(var(--nav-foreground)/0.1)] py-2">
          {renderTeamGroup()}

          {hasAdminAccess && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigationClick("administration")}
                  className={cn(
                    "flex items-center w-full py-3 gap-3 transition-all duration-200 relative group px-4",
                    "hover:bg-[hsl(var(--nav-hover))]",
                    (activeSection === "administration" || pendingSection === "administration") && "bg-[hsl(var(--nav-active-bg))]"
                  )}
                >
                  <div className="relative">
                    <Shield 
                      className={cn(
                        "h-5 w-5 text-[hsl(var(--nav-foreground))]",
                        clickedItem === "administration" && "animate-nav-bounce"
                      )} 
                    />
                    {(navigationCounts['administration'] || 0) > 0 && (
                      <span 
                        className={cn(
                          "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-bold px-1",
                          "animate-badge-appear",
                          newBadgeItems.has('administration') && "animate-badge-pulse"
                        )}
                      >
                        {navigationCounts['administration'] > 99 ? '99+' : navigationCounts['administration']}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate text-[hsl(var(--nav-foreground))] flex-1 text-left">
                    Admin
                  </span>
                </button>
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
