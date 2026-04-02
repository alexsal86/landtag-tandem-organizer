import { useState, useEffect, useCallback } from "react";
import { 
  Home, 
  Shield,
  Clock,
  Users,
  UserCog,
  HelpCircle,
  Bell,
  Briefcase,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Star,
} from "lucide-react";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useFavicon } from "@/hooks/useFavicon";
import { useQuickAccessPages, QuickAccessPage } from "@/hooks/useQuickAccessPages";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navigationGroups, getNavigationGroups, NavGroup, NavSubItem } from "@/components/navigation/navigationConfig";
import { HelpDialog } from "@/components/navigation/HelpDialog";

// Re-export for backward compatibility
export { getNavigationGroups };

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isMobile?: boolean;
}

// Available pages for quick access
const availableQuickPages: QuickAccessPage[] = [
  { id: "mywork", label: "Meine Arbeit", icon: "Home", route: "/mywork" },
  { id: "calendar", label: "Kalender", icon: "Calendar", route: "/calendar" },
  { id: "tasks", label: "Aufgaben", icon: "CheckSquare", route: "/tasks" },
  { id: "contacts", label: "Kontakte", icon: "Users", route: "/contacts" },
  { id: "casefiles", label: "Fallakten", icon: "Briefcase", route: "/casefiles" },
  { id: "documents", label: "Dokumente", icon: "FileText", route: "/documents" },
  { id: "decisions", label: "Entscheidungen", icon: "Vote", route: "/decisions" },
  { id: "meetings", label: "Jour fixe", icon: "Calendar", route: "/meetings" },
  { id: "chat", label: "Chat", icon: "MessageSquare", route: "/chat" },
  { id: "dossiers", label: "Wissen", icon: "Database", route: "/dossiers" },
];

export function AppNavigation({ 
  activeSection, 
  onSectionChange, 
  isMobile
}: NavigationProps) {
  const { navigationCounts, markNavigationAsVisited } = useNavigationNotifications();
  const { totalUnreadCount: matrixUnreadCount } = useMatrixUnread();
  const { role: userRole, hasAdminAccess, loading: isRoleLoading } = useResolvedUserRole();
  const appSettings = useAppSettings();
  useFavicon(appSettings.app_logo_url);
  const { pages: quickAccessPages, addPage, removePage } = useQuickAccessPages();
  
  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [previousBadges, setPreviousBadges] = useState<Record<string, number>>({});
  const [newBadgeItems, setNewBadgeItems] = useState<Set<string>>(new Set());
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [quickAccessPopoverOpen, setQuickAccessPopoverOpen] = useState(false);

  // Auto-expand the group containing the active section
  useEffect(() => {
    const group = navigationGroups.find(g =>
      g.subItems?.some(item => item.id === activeSection)
    );
    if (group) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.add(group.id);
        return next;
      });
    }
  }, [activeSection]);

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
    if (showTimeTracking) items.push({ id: "time", label: "Zeiterfassung", icon: Clock });
    if (showEmployeePage) items.push({ id: "employee", label: "Mitarbeiter", icon: Users });
    return items;
  };

  const teamSubItems = getTeamSubItems();
  const showTeamGroup = teamSubItems.length > 0;

  const handleNavigationClick = useCallback(async (sectionId: string) => {
    setClickedItem(sectionId);
    setTimeout(() => setClickedItem(null), 150);
    setPendingSection(sectionId);
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
    setPendingSection(null);
  }, [markNavigationAsVisited, onSectionChange]);

  const handleLogoClick = () => {
    setClickedItem('dashboard');
    setTimeout(() => setClickedItem(null), 150);
    onSectionChange('dashboard');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getGroupBadge = (group: NavGroup): number => {
    if (!group.subItems) {
      const directId = group.route ? group.route.slice(1) : group.id;
      return navigationCounts[directId] || 0;
    }
    if (group.id === "communication") return matrixUnreadCount;
    return group.subItems.reduce((total, item) => total + (navigationCounts[item.id] || 0), 0);
  };

  const isGroupActive = (group: NavGroup): boolean => {
    if (group.route) {
      const routeId = group.route.slice(1);
      return activeSection === routeId || activeSection === group.id;
    }
    if (group.subItems) return group.subItems.some(item => item.id === activeSection);
    return false;
  };

  // Skeleton loader
  if (isRoleLoading) {
    return (
      <nav className="flex flex-col h-full bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-border shrink-0">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <div className="h-7 w-7 rounded-lg animate-skeleton" />
          <div className="h-4 w-24 rounded animate-skeleton" />
        </div>
        <div className="flex-1 flex flex-col py-2 gap-0.5 px-2">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="flex items-center gap-2 py-1.5 px-2">
              <div className="h-4 w-4 rounded animate-skeleton" />
              <div className="h-3.5 w-20 rounded animate-skeleton" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  const renderNavItem = (
    id: string,
    Icon: React.ElementType,
    label: string,
    badge: number = 0,
    indent: boolean = false,
  ) => {
    const isActive = activeSection === id;
    const isPending = pendingSection === id;

    return (
      <button
        key={id}
        onClick={() => handleNavigationClick(id)}
        className={cn(
          "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-[13px] transition-colors relative group",
          indent && "pl-8",
          "hover:bg-[hsl(var(--nav-hover))]",
          (isActive || isPending) && "bg-[hsl(var(--nav-active-bg))] font-medium",
          !isActive && "text-[hsl(var(--nav-foreground))]"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", clickedItem === id && "animate-nav-bounce")} />
        <span className="truncate text-[13px]">{label}</span>
        {badge > 0 && (
          <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  };

  const renderNavGroup = (group: NavGroup) => {
    const badge = getGroupBadge(group);
    const isActive = isGroupActive(group);
    const isExpanded = expandedGroups.has(group.id);
    const hasSubItems = group.subItems && group.subItems.length > 1;

    // Single route group (no sub-items or only 1)
    if (!hasSubItems) {
      const targetId = group.route 
        ? group.route.slice(1) 
        : (group.subItems?.[0]?.id || group.id);
      const Icon = group.subItems?.[0]?.icon || group.icon;
      const label = group.subItems?.[0]?.label || group.label;
      return renderNavItem(targetId, Icon, label, badge);
    }

    // Collapsible group
    return (
      <div key={group.id}>
        <button
          onClick={() => {
            toggleGroup(group.id);
            // Navigate to first sub-item if not active
            if (!isActive && group.subItems) {
              handleNavigationClick(group.subItems[0].id);
            }
          }}
          className={cn(
            "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-[13px] transition-colors",
            "hover:bg-[hsl(var(--nav-hover))]",
            isActive && "font-medium"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]" />
          )}
          <group.icon className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px]">{group.label}</span>
          {badge > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
        {isExpanded && group.subItems && (
          <div className="mt-0.5">
            {group.subItems.map(item => 
              renderNavItem(item.id, item.icon, item.label, navigationCounts[item.id] || 0, true)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <nav className={cn(
        "flex flex-col bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-border shrink-0 select-none",
        isMobile ? "h-full" : "h-screen"
      )}>
        {/* Logo + Workspace Name */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <button onClick={handleLogoClick} className="transition-transform hover:scale-105 shrink-0">
            {appSettings.app_logo_url ? (
              <img 
                src={appSettings.app_logo_url} 
                alt="Logo" 
                crossOrigin="anonymous"
                className={cn("h-7 w-7 object-contain", clickedItem === 'dashboard' && "animate-nav-bounce")}
              />
            ) : (
              <div className={cn(
                "h-7 w-7 rounded-lg bg-primary flex items-center justify-center",
                clickedItem === 'dashboard' && "animate-nav-bounce"
              )}>
                <Home className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </button>
          <span className="text-sm font-semibold truncate text-[hsl(var(--nav-foreground))]">
            {appSettings.app_name || 'Workspace'}
          </span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNavigationClick('mywork')}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
              >
                <Home className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Meine Arbeit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNavigationClick('notifications')}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                {(navigationCounts['notifications'] || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-[8px] text-white flex items-center justify-center font-bold px-0.5">
                    {navigationCounts['notifications'] > 99 ? '99+' : navigationCounts['notifications']}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Benachrichtigungen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNavigationClick('casefiles')}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
              >
                <Briefcase className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Fallakten</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  // Trigger global search - dispatching custom event
                  window.dispatchEvent(new CustomEvent('open-global-search'));
                }}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Suche</TooltipContent>
          </Tooltip>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex flex-col py-2 px-2 gap-0.5 overflow-y-auto">
          {navigationGroups.map(group => renderNavGroup(group))}
        </div>

        {/* Quick Access / Favoriten */}
        <div className="px-2 py-2 border-t border-border">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-medium text-[hsl(var(--nav-muted))] uppercase tracking-wider">
              Schnellzugriff
            </span>
            <Popover open={quickAccessPopoverOpen} onOpenChange={setQuickAccessPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="h-5 w-5 rounded flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors">
                  <Plus className="h-3 w-3 text-[hsl(var(--nav-muted))]" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-48 p-1">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Seite hinzufügen</div>
                {availableQuickPages
                  .filter(p => !quickAccessPages.some(qp => qp.id === p.id))
                  .map(page => (
                    <button
                      key={page.id}
                      onClick={() => { addPage(page); setQuickAccessPopoverOpen(false); }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                    >
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      {page.label}
                    </button>
                  ))}
                {availableQuickPages.filter(p => !quickAccessPages.some(qp => qp.id === p.id)).length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Alle Seiten hinzugefügt</div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {quickAccessPages.map(page => (
            <div key={page.id} className="group flex items-center">
              <button
                onClick={() => handleNavigationClick(page.id)}
                className={cn(
                  "flex-1 flex items-center gap-2 py-1 px-2 rounded-md text-[13px] transition-colors truncate",
                  "hover:bg-[hsl(var(--nav-hover))]",
                  activeSection === page.id && "bg-[hsl(var(--nav-active-bg))] font-medium"
                )}
              >
                <Star className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))] shrink-0" />
                <span className="truncate">{page.label}</span>
              </button>
              <button
                onClick={() => removePage(page.id)}
                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--nav-hover))] transition-all shrink-0"
              >
                <X className="h-3 w-3 text-[hsl(var(--nav-muted))]" />
              </button>
            </div>
          ))}
          {quickAccessPages.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-[hsl(var(--nav-muted))]">
              Noch keine Favoriten
            </div>
          )}
        </div>

        {/* Bottom Section: Help + Team + Admin */}
        <div className="border-t border-border py-2 px-2 space-y-0.5">
          {/* Help */}
          <button
            onClick={() => setHelpDialogOpen(true)}
            className="flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-[13px] hover:bg-[hsl(var(--nav-hover))] transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Hilfe</span>
          </button>

          {/* Team */}
          {showTeamGroup && (
            <>
              {teamSubItems.length === 1 ? (
                renderNavItem(teamSubItems[0].id, teamSubItems[0].icon, teamSubItems[0].label)
              ) : (
                <div>
                  <button
                    onClick={() => {
                      toggleGroup('team');
                      if (!teamSubItems.some(i => i.id === activeSection)) {
                        handleNavigationClick(teamSubItems[0].id);
                      }
                    }}
                    className={cn(
                      "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-[13px] hover:bg-[hsl(var(--nav-hover))] transition-colors",
                      teamSubItems.some(i => i.id === activeSection) && "font-medium"
                    )}
                  >
                    {expandedGroups.has('team') ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]" />
                    )}
                    <UserCog className="h-4 w-4" />
                    <span>Team</span>
                  </button>
                  {expandedGroups.has('team') && (
                    <div className="mt-0.5">
                      {teamSubItems.map(item =>
                        renderNavItem(item.id, item.icon, item.label, 0, true)
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Admin */}
          {hasAdminAccess && renderNavItem(
            "administration", Shield, "Admin",
            navigationCounts['administration'] || 0
          )}
        </div>
      </nav>
      
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </TooltipProvider>
  );
}
