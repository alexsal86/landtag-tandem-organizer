import { useState, useEffect } from "react";
import { 
  Home, 
  Shield,
  Clock,
  Users,
  UserCog,
  HelpCircle
} from "lucide-react";
import { useMatrixClient } from "@/contexts/MatrixClientContext";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigationGroups, getNavigationGroups, NavGroup, NavSubItem } from "@/components/navigation/navigationConfig";
import { HelpDialog } from "@/components/navigation/HelpDialog";

// Re-export for backward compatibility
export { getNavigationGroups };

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isMobile?: boolean;
}

export function AppNavigation({ 
  activeSection, 
  onSectionChange, 
  isMobile
}: NavigationProps) {
  const { user } = useAuth();
  const { navigationCounts, markNavigationAsVisited } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixClient();
  const appSettings = useAppSettings();
  
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animation states
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [previousBadges, setPreviousBadges] = useState<Record<string, number>>({});
  const [newBadgeItems, setNewBadgeItems] = useState<Set<string>>(new Set());
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Check admin role and user role
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    const checkRoles = async () => {
      setIsLoading(true);
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
      setIsLoading(false);
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
    if (showTimeTracking) {
      items.push({ id: "time", label: "Zeiterfassung", icon: Clock });
    }
    if (showEmployeePage) {
      items.push({ id: "employee", label: "Mitarbeiter", icon: Users });
    }
    return items;
  };

  const teamSubItems = getTeamSubItems();
  const showTeamGroup = teamSubItems.length > 0;

  const handleNavigationClick = async (sectionId: string) => {
    setClickedItem(sectionId);
    setTimeout(() => setClickedItem(null), 150);
    setPendingSection(sectionId);
    await markNavigationAsVisited(sectionId);
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
        <nav className="flex flex-col h-screen bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-[hsl(var(--nav-foreground)/0.1)] shrink-0 w-[72px]">
          <div className="h-14 flex items-center justify-center border-b border-[hsl(var(--nav-foreground)/0.1)]">
            <div className="h-8 w-8 rounded-lg animate-skeleton" />
          </div>
          <div className="flex-1 flex flex-col py-2 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex flex-col items-center gap-1 py-2 px-2">
                <div className="h-5 w-5 rounded animate-skeleton" />
                <div className="h-3 w-10 rounded animate-skeleton" />
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-[hsl(var(--nav-foreground)/0.1)] py-2">
            <div className="flex flex-col items-center gap-1 py-2 px-2">
              <div className="h-5 w-5 rounded animate-skeleton" />
              <div className="h-3 w-8 rounded animate-skeleton" />
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
              "flex flex-col items-center w-full py-2 px-1 gap-1 transition-all duration-200 relative group",
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
            <span className="text-[10px] font-medium text-[hsl(var(--nav-foreground))] text-center leading-tight">
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
              "flex flex-col items-center w-full py-2 px-1 gap-1 transition-all duration-200 relative group",
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
            <span className="text-[10px] font-medium text-[hsl(var(--nav-foreground))] text-center leading-tight">
              Team
            </span>
          </button>
        </TooltipTrigger>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className={cn("flex flex-col bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-[hsl(var(--nav-foreground)/0.1)] shrink-0 w-[72px]", isMobile ? "h-full" : "h-screen")}>
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
                    crossOrigin="anonymous"
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

        {/* Bottom Section: Help + Team + Admin */}
        <div className="mt-auto border-t border-[hsl(var(--nav-foreground)/0.1)] py-2">
          {/* Help Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setHelpDialogOpen(true)}
                className={cn(
                  "flex flex-col items-center w-full py-2 px-1 gap-1 transition-all duration-200 relative group",
                  "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <HelpCircle className="h-5 w-5 text-[hsl(var(--nav-foreground))]" />
                <span className="text-[10px] font-medium text-[hsl(var(--nav-foreground))] text-center leading-tight">
                  Hilfe
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-[hsl(var(--nav-foreground)/0.2)]">
              Hilfe & Tastenkürzel
            </TooltipContent>
          </Tooltip>

          {renderTeamGroup()}

          {hasAdminAccess && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigationClick("administration")}
                  className={cn(
                    "flex flex-col items-center w-full py-2 px-1 gap-1 transition-all duration-200 relative group",
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
                  <span className="text-[10px] font-medium text-[hsl(var(--nav-foreground))] text-center leading-tight">
                    Admin
                  </span>
                </button>
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>
      </nav>
      
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </TooltipProvider>
  );
}
