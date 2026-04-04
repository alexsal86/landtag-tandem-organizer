import { useState, useEffect, useCallback, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  Shield,
  Users,
  HelpCircle,
  Bell,
  Briefcase,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Star,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  ListFilter,
  Upload,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useFavicon } from "@/hooks/useFavicon";
import { useQuickAccessPages, QuickAccessPage } from "@/hooks/useQuickAccessPages";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/hooks/useAuth";
import { useUserStatus } from "@/hooks/useUserStatus";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserStatusSelector } from "@/components/UserStatusSelector";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navigationGroups, getNavigationGroups, NavGroup } from "@/components/navigation/navigationConfig";
import { HelpDialog } from "@/components/navigation/HelpDialog";
import { formatDistanceToNow, format, isToday, isYesterday, isTomorrow, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useAppointmentRequest } from "@/hooks/useAppointmentRequest";
import { buildDeepLinkPath } from "@/utils/notificationDeepLinks";

// Re-export for backward compatibility
export { getNavigationGroups };

type ActivePanel = 'home' | 'notifications' | 'casefiles' | 'appointments';
type NotificationFilter = 'unread' | 'all';

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isMobile?: boolean;
}

// Available pages for quick access
const availableQuickPages: QuickAccessPage[] = [
  { id: "mywork", label: "Meine Arbeit", icon: "NotebookTabs", route: "/mywork" },
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
  const { pages: quickAccessPages, addPage, removePage, isInQuickAccess } = useQuickAccessPages();
  const { recentPages, trackVisit } = useRecentlyVisited();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { user, signOut } = useAuth();
  const { currentStatus, getStatusDisplay } = useUserStatus();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Appointment request hook
  const {
    requestTitle, setRequestTitle,
    requestDate, setRequestDate,
    requestTime, setRequestTime,
    requestLocation, setRequestLocation,
    requestRequester, setRequestRequester,
    isSubmittingRequest,
    resetForm: resetRequestForm,
    createRequest,
  } = useAppointmentRequest({
    onSuccess: (message, description) => toast({ title: message, description }),
    onError: (message, description) => toast({ title: message, description, variant: 'destructive' }),
  });
  const [isQuickRequestOpen, setIsQuickRequestOpen] = useState(false);
  
  // Panel state
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
  
  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [previousBadges, setPreviousBadges] = useState<Record<string, number>>({});
  const [newBadgeItems, setNewBadgeItems] = useState<Set<string>>(new Set());
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [quickAccessPopoverOpen, setQuickAccessPopoverOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('unread');
  
  // User profile
  const [userProfile, setUserProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (user && currentTenant?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();
        setUserProfile(profile ?? null);
      }
    };
    void loadProfile();
  }, [user, currentTenant?.id]);

  // Upcoming appointments query (for appointments panel)
  const endDate = addDays(new Date(), 5);
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['nav-upcoming-appointments', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id || !user?.id) return [];
      const { data } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, location, category, is_all_day')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(20);
      return data || [];
    },
    enabled: !!currentTenant?.id && !!user?.id && activePanel === 'appointments',
    staleTime: 2 * 60 * 1000,
  });

  // Appointment feedback query
  const { data: pendingFeedbacks = [] } = useQuery({
    queryKey: ['nav-pending-feedbacks', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id || !user?.id) return [];
      const { data } = await supabase
        .from('appointment_feedback')
        .select('id, event_type, created_at, appointment_id')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .eq('feedback_status', 'pending')
        .limit(10);
      return data || [];
    },
    enabled: !!currentTenant?.id && !!user?.id && activePanel === 'appointments',
    staleTime: 2 * 60 * 1000,
  });

  // Case files query (for casefiles panel)
  const { data: caseFiles = [] } = useQuery({
    queryKey: ['nav-casefiles', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id || !user?.id) return [];
      const { data } = await supabase
        .from('case_files')
        .select('id, title, status, priority, case_type, reference_number, updated_at')
        .eq('tenant_id', currentTenant.id)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!currentTenant?.id && !!user?.id && activePanel === 'casefiles',
    staleTime: 2 * 60 * 1000,
  });

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
  const showEmployeePage = isAbgeordneter || isBueroleitung;

  const handleNavigationClick = useCallback(async (sectionId: string) => {
    setClickedItem(sectionId);
    setTimeout(() => setClickedItem(null), 150);
    setPendingSection(sectionId);
    await markNavigationAsVisited(sectionId);
    onSectionChange(sectionId);
    setPendingSection(null);
    // Switch to home panel when navigating
    setActivePanel('home');
    // Track recently visited
    const allPages = [...availableQuickPages];
    navigationGroups.forEach(g => {
      if (g.subItems) {
        g.subItems.forEach(item => {
          if (!allPages.some(p => p.id === item.id)) {
            allPages.push({ id: item.id, label: item.label, icon: 'Circle', route: `/${item.id}` });
          }
        });
      }
    });
    const matched = allPages.find(p => p.id === sectionId);
    if (matched) {
      trackVisit(sectionId, matched.label, matched.icon, matched.route);
    }
  }, [markNavigationAsVisited, onSectionChange, trackVisit]);

  const handleLogoClick = () => {
    setClickedItem('dashboard');
    setTimeout(() => setClickedItem(null), 150);
    onSectionChange('dashboard');
    setActivePanel('home');
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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: 'Erfolgreich abgemeldet', description: 'Sie wurden erfolgreich abgemeldet.' });
      navigate('/auth');
    } catch {
      toast({ title: 'Fehler beim Abmelden', description: 'Ein Fehler ist beim Abmelden aufgetreten.', variant: 'destructive' });
    }
  };

  const statusDisplay = currentStatus ? getStatusDisplay(currentStatus) : null;

  // Skeleton loader
  if (isRoleLoading) {
    return (
      <nav className="flex flex-col h-full w-full bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-border shrink-0">
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
    Icon: ElementType,
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
          "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-sm transition-colors relative group",
          indent && "pl-8",
          "hover:bg-[hsl(var(--nav-hover))]",
          (isActive || isPending) && "bg-[hsl(var(--nav-active-bg))] font-medium",
          !isActive && "text-[hsl(var(--nav-foreground))]"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", clickedItem === id && "animate-nav-bounce")} />
        <span className="truncate text-sm">{label}</span>
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

    if (!hasSubItems) {
      const targetId = group.route 
        ? group.route.slice(1) 
        : (group.subItems?.[0]?.id || group.id);
      const Icon = group.subItems?.[0]?.icon || group.icon;
      const label = group.subItems?.[0]?.label || group.label;
      return renderNavItem(targetId, Icon, label, badge);
    }

    return (
      <div key={group.id}>
        <button
          onClick={() => {
            toggleGroup(group.id);
            if (!isActive && group.subItems) {
              handleNavigationClick(group.subItems[0].id);
            }
          }}
          className={cn(
            "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-sm transition-colors",
            "hover:bg-[hsl(var(--nav-hover))]",
            isActive && "font-medium"
          )}
        >
          <group.icon className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{group.label}</span>
          {badge > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className={cn("h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]", badge > 0 ? "" : "ml-auto")} />
          ) : (
            <ChevronRight className={cn("h-3 w-3 shrink-0 text-[hsl(var(--nav-muted))]", badge > 0 ? "" : "ml-auto")} />
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

  // ─── Panel renderers ───

  const renderHomePanel = () => (
    <>
      {/* Main Navigation */}
      <div className="flex-1 flex flex-col py-2 px-2 gap-0.5 overflow-y-auto">
        {navigationGroups.map(group => renderNavGroup(group))}
      </div>

      {/* Recently Visited */}
      {recentPages.length > 0 && (
        <div className="px-2 py-2 border-t border-border">
          <div className="flex items-center px-2 mb-1">
            <span className="text-[11px] font-medium text-[hsl(var(--nav-muted))] uppercase tracking-wider">
              Kürzlich besucht
            </span>
          </div>
          {recentPages.slice(0, 5).map(page => (
            <button
              key={page.id}
              onClick={() => handleNavigationClick(page.id)}
              className={cn(
                "flex items-center gap-2 w-full py-1 px-2 rounded-md text-[12px] transition-colors truncate",
                "hover:bg-[hsl(var(--nav-hover))]",
                activeSection === page.id && "bg-[hsl(var(--nav-active-bg))] font-medium"
              )}
            >
              <Clock className="h-3 w-3 text-[hsl(var(--nav-muted))] shrink-0" />
              <span className="truncate">{page.label}</span>
            </button>
          ))}
        </div>
      )}

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
              onClick={() => handleNavigationClick(page.route?.slice(1) || page.id)}
              className={cn(
                "flex-1 flex items-center gap-2 py-1 px-2 rounded-md text-sm transition-colors truncate",
                "hover:bg-[hsl(var(--nav-hover))]",
                activeSection === page.id && "bg-[hsl(var(--nav-active-bg))] font-medium"
              )}
            >
              {page.type === 'item' ? (
                <Briefcase className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))] shrink-0" />
              ) : (
                <Star className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))] shrink-0" />
              )}
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

    </>
  );

  const renderNotificationsPanel = () => {
    const filteredNotifications = notifications.filter((notification) => (
      notificationFilter === 'all' ? true : !notification.is_read
    ));
    const showAllReadState = notificationFilter === 'unread' && notifications.length > 0 && filteredNotifications.length === 0;

    return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[hsl(var(--nav-foreground))]">
            Benachrichtigungen {unreadCount > 0 && `(${unreadCount})`}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
                aria-label="Benachrichtigungen filtern"
              >
                <ListFilter className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNotificationFilter('all')}>
                <span className="flex-1">Ungelesen und gelesen</span>
                {notificationFilter === 'all' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNotificationFilter('unread')}>
                <span className="flex-1">Ungelesen</span>
                {notificationFilter === 'unread' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-[11px] text-[hsl(var(--nav-muted))] hover:text-[hsl(var(--nav-foreground))] transition-colors"
          >
            Alle gelesen
          </button>
        )}
      </div>
      <ScrollArea className="flex-1">
        {showAllReadState ? (
          <div className="px-4 py-12 h-full flex flex-col items-center justify-center text-center">
            <CheckCheck className="h-12 w-12 mb-4 text-[hsl(var(--nav-muted))]" />
            <p className="text-2xl mb-4 text-[hsl(var(--nav-foreground))]">Du bist auf dem neuesten Stand</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Filter bearbeiten</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setNotificationFilter('all')}>
                  <span className="flex-1">Ungelesen und gelesen</span>
                  {(notificationFilter as NotificationFilter) === 'all' && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNotificationFilter('unread')}>
                  <span className="flex-1">Ungelesen</span>
                  {notificationFilter === 'unread' && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--nav-muted))]" />
            <p className="text-sm text-[hsl(var(--nav-muted))]">Keine Benachrichtigungen</p>
          </div>
        ) : (() => {
          // Group notifications by date
          const groups: { label: string; items: typeof filteredNotifications }[] = [];
          const todayItems = filteredNotifications.filter(n => isToday(new Date(n.created_at)));
          const yesterdayItems = filteredNotifications.filter(n => isYesterday(new Date(n.created_at)));
          const olderItems = filteredNotifications.filter(n => {
            const d = new Date(n.created_at);
            return !isToday(d) && !isYesterday(d);
          });
          if (todayItems.length > 0) groups.push({ label: 'Heute', items: todayItems });
          if (yesterdayItems.length > 0) groups.push({ label: 'Gestern', items: yesterdayItems });
          if (olderItems.length > 0) groups.push({ label: 'Älter', items: olderItems });

          const renderNotificationItem = (n: typeof filteredNotifications[0]) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-2 px-2 py-2 rounded-md text-[12px] group cursor-pointer transition-colors",
                  "hover:bg-[hsl(var(--nav-hover))]",
                  !n.is_read && "bg-[hsl(var(--nav-active-bg))]"
                )}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id);
                  const path = buildDeepLinkPath(n);
                  if (/^https?:\/\//i.test(path)) {
                    window.location.href = path;
                  } else {
                    navigate(path);
                  }
                  if (isMobile) onSectionChange(activeSection);
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12px]", !n.is_read && "font-medium")}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-[11px] text-[hsl(var(--nav-muted))] line-clamp-2 mt-0.5">{n.message}</p>
                  )}
                  <p className="text-[10px] text-[hsl(var(--nav-muted))] mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      className="h-5 w-5 rounded flex items-center justify-center hover:bg-[hsl(var(--nav-active-bg))]"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="h-5 w-5 rounded flex items-center justify-center hover:bg-[hsl(var(--nav-active-bg))]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
          );

          return (
            <div className="p-2 space-y-3">
              {groups.map(group => (
                <div key={group.label}>
                  <p className="text-[11px] font-semibold text-[hsl(var(--nav-muted))] uppercase tracking-wider px-2 mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(renderNotificationItem)}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
        )}
      </ScrollArea>
    </div>
  )};

  const renderAppointmentsPanel = () => {
    // Group appointments by day
    const grouped: Record<string, typeof upcomingAppointments> = {};
    upcomingAppointments.forEach(apt => {
      const date = new Date(apt.start_time);
      const key = format(date, 'yyyy-MM-dd');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(apt);
    });

    const getDayLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isToday(d)) return 'Heute';
      if (isTomorrow(d)) return 'Morgen';
      return format(d, 'EEEE, d. MMM', { locale: de });
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-[hsl(var(--nav-foreground))]">Termine</span>
          <button
            onClick={() => handleNavigationClick('calendar')}
            className="text-[11px] text-[hsl(var(--nav-muted))] hover:text-[hsl(var(--nav-foreground))] transition-colors"
          >
            Kalender →
          </button>
        </div>

        {/* Pending feedbacks banner */}
        {pendingFeedbacks.length > 0 && (
          <div className="mx-2 mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
              ⚠ {pendingFeedbacks.length} offene Termin-Rückmeldung{pendingFeedbacks.length > 1 ? 'en' : ''}
            </p>
            <button
              onClick={() => handleNavigationClick('mywork')}
              className="text-[11px] text-amber-600 dark:text-amber-500 hover:underline mt-0.5"
            >
              Zur Übersicht
            </button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {upcomingAppointments.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--nav-muted))]" />
              <p className="text-sm text-[hsl(var(--nav-muted))]">Keine anstehenden Termine</p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {Object.entries(grouped).map(([dateKey, apts]) => (
                <div key={dateKey}>
                  <p className="text-[11px] font-semibold text-[hsl(var(--nav-muted))] uppercase tracking-wider px-2 mb-1">
                    {getDayLabel(dateKey)}
                  </p>
                  <div className="space-y-0.5">
                    {apts.map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => handleNavigationClick('calendar')}
                        className="flex items-start gap-2 w-full px-2 py-1.5 rounded-md text-left hover:bg-[hsl(var(--nav-hover))] transition-colors"
                      >
                        <div className="w-1 h-full min-h-[24px] rounded-full bg-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{apt.title}</p>
                          <p className="text-[11px] text-[hsl(var(--nav-muted))]">
                            {apt.is_all_day
                              ? 'Ganztägig'
                              : `${format(new Date(apt.start_time), 'HH:mm')} – ${format(new Date(apt.end_time), 'HH:mm')}`}
                          </p>
                          {apt.location && (
                            <p className="text-[10px] text-[hsl(var(--nav-muted))] truncate">{apt.location}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Quick Appointment Request */}
        <div className="border-t border-border p-2">
          <Collapsible open={isQuickRequestOpen} onOpenChange={(open) => {
            setIsQuickRequestOpen(open);
            if (open) resetRequestForm();
          }}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-[12px] hover:bg-[hsl(var(--nav-hover))] transition-colors">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="font-medium">Terminanfrage</span>
                </span>
                <ChevronDown className={cn("h-3 w-3 text-[hsl(var(--nav-muted))] transition-transform", isQuickRequestOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2 px-1">
              <div>
                <Label htmlFor="nav-req-title" className="text-[11px]">Titel</Label>
                <Input id="nav-req-title" value={requestTitle} onChange={e => setRequestTitle(e.target.value)} placeholder="z. B. Gespräch mit Verband" className="h-7 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label htmlFor="nav-req-date" className="text-[11px]">Datum</Label>
                  <Input id="nav-req-date" type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label htmlFor="nav-req-time" className="text-[11px]">Uhrzeit</Label>
                  <Input id="nav-req-time" type="time" value={requestTime} onChange={e => setRequestTime(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
              <div>
                <Label htmlFor="nav-req-location" className="text-[11px]">Ort / Format</Label>
                <Input id="nav-req-location" value={requestLocation} onChange={e => setRequestLocation(e.target.value)} placeholder="Landtag / Digital" className="h-7 text-xs" />
              </div>
              <div>
                <Label htmlFor="nav-req-requester" className="text-[11px]">Anfragende Stelle</Label>
                <Input id="nav-req-requester" value={requestRequester} onChange={e => setRequestRequester(e.target.value)} placeholder="Name / Organisation" className="h-7 text-xs" />
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={createRequest} disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Erstelle…' : 'Terminanfrage anlegen'}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    );
  };

  const renderCasefilesPanel = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-[hsl(var(--nav-foreground))]">Fallakten</span>
        <button
          onClick={() => handleNavigationClick('casefiles')}
          className="text-[11px] text-[hsl(var(--nav-muted))] hover:text-[hsl(var(--nav-foreground))] transition-colors"
        >
          Alle anzeigen →
        </button>
      </div>

      {/* Dossier Upload Area */}
      <div className="mx-2 mt-2 p-3 rounded-md border-2 border-dashed border-[hsl(var(--nav-muted))]/30 hover:border-primary/50 transition-colors cursor-pointer text-center"
        onClick={() => handleNavigationClick('casefiles')}
      >
        <Upload className="h-5 w-5 mx-auto mb-1 text-[hsl(var(--nav-muted))]" />
        <p className="text-[11px] text-[hsl(var(--nav-muted))]">Dossier hochladen</p>
      </div>

      <ScrollArea className="flex-1 mt-2">
        {caseFiles.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Briefcase className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--nav-muted))]" />
            <p className="text-sm text-[hsl(var(--nav-muted))]">Keine Fallakten</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {caseFiles.map(cf => (
              <button
                key={cf.id}
                onClick={() => handleNavigationClick('casefiles')}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left hover:bg-[hsl(var(--nav-hover))] transition-colors"
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--nav-muted))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">{cf.title}</p>
                  <p className="text-[10px] text-[hsl(var(--nav-muted))]">
                    {cf.reference_number || cf.status}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <nav className={cn(
        "flex flex-col w-full bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] border-r border-border shrink-0 select-none",
        isMobile ? "h-full" : "h-screen"
      )}>
        {/* Logo + Workspace Name + Subtitle */}
        <div className="flex items-center gap-2.5 px-4 py-3 shrink-0">
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
          <div className="min-w-0">
            <span className="text-sm font-semibold truncate block text-[hsl(var(--nav-foreground))]">
              {appSettings.app_name || 'Workspace'}
            </span>
            {appSettings.app_subtitle && (
              <span className="text-[11px] text-[hsl(var(--nav-muted))] truncate block">
                {appSettings.app_subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons (Panel Switchers) */}
        <div className="flex items-center gap-1 px-3 py-3">
          {/* Home */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePanel('home')}
                className={cn(
                  "h-7 rounded-md flex items-center gap-1.5 px-2 transition-colors",
                  activePanel === 'home' ? "bg-[hsl(var(--nav-active-bg))] font-medium" : "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <Home className="h-4 w-4 shrink-0" />
                {activePanel === 'home' && <span className="text-xs">Home</span>}
              </button>
            </TooltipTrigger>
            {activePanel !== 'home' && <TooltipContent side="bottom" className="text-xs">Navigation</TooltipContent>}
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePanel(activePanel === 'notifications' ? 'home' : 'notifications')}
                className={cn(
                  "h-7 rounded-md flex items-center gap-1.5 px-2 transition-colors relative",
                  activePanel === 'notifications' ? "bg-[hsl(var(--nav-active-bg))] font-medium" : "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <Bell className="h-4 w-4 shrink-0" />
                {activePanel === 'notifications' && <span className="text-xs">Inbox</span>}
                {activePanel !== 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-[8px] text-white flex items-center justify-center font-bold px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {activePanel !== 'notifications' && <TooltipContent side="bottom" className="text-xs">Benachrichtigungen</TooltipContent>}
          </Tooltip>

          {/* Appointments */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePanel(activePanel === 'appointments' ? 'home' : 'appointments')}
                className={cn(
                  "h-7 rounded-md flex items-center gap-1.5 px-2 transition-colors",
                  activePanel === 'appointments' ? "bg-[hsl(var(--nav-active-bg))] font-medium" : "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <Calendar className="h-4 w-4 shrink-0" />
                {activePanel === 'appointments' && <span className="text-xs">Termine</span>}
              </button>
            </TooltipTrigger>
            {activePanel !== 'appointments' && <TooltipContent side="bottom" className="text-xs">Termine</TooltipContent>}
          </Tooltip>

          {/* Case Files */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePanel(activePanel === 'casefiles' ? 'home' : 'casefiles')}
                className={cn(
                  "h-7 rounded-md flex items-center gap-1.5 px-2 transition-colors",
                  activePanel === 'casefiles' ? "bg-[hsl(var(--nav-active-bg))] font-medium" : "hover:bg-[hsl(var(--nav-hover))]"
                )}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                {activePanel === 'casefiles' && <span className="text-xs">Akten</span>}
              </button>
            </TooltipTrigger>
            {activePanel !== 'casefiles' && <TooltipContent side="bottom" className="text-xs">Fallakten</TooltipContent>}
          </Tooltip>

          {/* Search (dialog trigger, not a panel) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openGlobalSearch', { detail: { query: '' } }));
                }}
                className="h-7 rounded-md flex items-center gap-1.5 px-2 hover:bg-[hsl(var(--nav-hover))] transition-colors ml-auto"
              >
                <Search className="h-4 w-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Suche (⌘K)</TooltipContent>
          </Tooltip>
        </div>

        {/* Panel Content */}
        {activePanel === 'home' && renderHomePanel()}
        {activePanel === 'notifications' && renderNotificationsPanel()}
        {activePanel === 'appointments' && renderAppointmentsPanel()}
        {activePanel === 'casefiles' && renderCasefilesPanel()}

        {/* User Avatar + Quick Actions (bottom-left on Home) */}
        <div className="border-t border-border px-2 py-2 shrink-0">
          <div className="flex items-center gap-2 px-1">
            <UserStatusSelector showOnlineUsers>
              <button className="relative shrink-0 rounded-full hover:ring-2 hover:ring-primary/30 transition-all">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={userProfile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {statusDisplay && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">
                    {statusDisplay.emoji}
                  </span>
                )}
              </button>
            </UserStatusSelector>

            <span className="h-5 w-px bg-border" aria-hidden="true" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setHelpDialogOpen(true)}
                    className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
                    aria-label="Hilfe"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Hilfe</TooltipContent>
              </Tooltip>

              {showEmployeePage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavigationClick('employee')}
                      className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
                      aria-label="Mitarbeiter"
                    >
                      <Users className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Mitarbeiter</TooltipContent>
                </Tooltip>
              )}

              {hasAdminAccess && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavigationClick('administration')}
                      className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors"
                      aria-label="Admin"
                    >
                      <Shield className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Admin</TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[hsl(var(--nav-hover))] transition-colors" aria-label="Einstellungen">
                    <Settings className="h-3.5 w-3.5 text-[hsl(var(--nav-muted))]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" side="right" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{userProfile?.display_name || 'Benutzer'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { onSectionChange('profile-edit'); setActivePanel('home'); }}>
                    <User className="mr-2 h-4 w-4" />
                    Profil bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onSectionChange('settings'); setActivePanel('home'); }}>
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </TooltipProvider>
  );
}
