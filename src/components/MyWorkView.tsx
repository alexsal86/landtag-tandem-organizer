import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckSquare, Vote, Briefcase, CalendarPlus, Users, StickyNote, Calendar, Clock, Plus, Home, CheckCircle2, MessageSquare, Lightbulb } from "lucide-react";
import { PageHelpButton } from "@/components/shared/PageHelpButton";
import { debugConsole } from "@/utils/debugConsole";
import { MYWORK_HELP_CONTENT } from "@/config/helpContent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useMyWorkNewCounts } from "@/hooks/useMyWorkNewCounts";
import { useAppSettings } from "@/hooks/useAppSettings";
const MyWorkQuickCapture = lazyWithRetry(() => import("./my-work/MyWorkQuickCapture").then(m => ({ default: m.MyWorkQuickCapture })));
const MyWorkNotesList = lazyWithRetry(() => import("./my-work/MyWorkNotesList").then(m => ({ default: m.MyWorkNotesList })));
const MyWorkTasksTab = lazyWithRetry(() => import("./my-work/MyWorkTasksTab").then(m => ({ default: m.MyWorkTasksTab })));
const MyWorkDecisionsTab = lazyWithRetry(() => import("./my-work/MyWorkDecisionsTab").then(m => ({ default: m.MyWorkDecisionsTab })));
const MyWorkCasesWorkspace = lazyWithRetry(() => import("./my-work/MyWorkCasesWorkspace").then(m => ({ default: m.MyWorkCasesWorkspace })));
const MyWorkPlanningsTab = lazyWithRetry(() => import("./my-work/MyWorkPlanningsTab").then(m => ({ default: m.MyWorkPlanningsTab })));
const MyWorkTeamTab = lazyWithRetry(() => import("./my-work/MyWorkTeamTab").then(m => ({ default: m.MyWorkTeamTab })));
const MyWorkJourFixeTab = lazyWithRetry(() => import("./my-work/MyWorkJourFixeTab").then(m => ({ default: m.MyWorkJourFixeTab })));
const MyWorkRedaktionTab = lazyWithRetry(() => import("./my-work/MyWorkRedaktionTab").then(m => ({ default: m.MyWorkRedaktionTab })));
const MyWorkTerminePlanungTab = lazyWithRetry(() => import("./my-work/MyWorkTerminePlanungTab").then(m => ({ default: m.MyWorkTerminePlanungTab })));
const MyWorkTimeTrackingTab = lazyWithRetry(() => import("./my-work/MyWorkTimeTrackingTab").then(m => ({ default: m.MyWorkTimeTrackingTab })));
const MyWorkAppointmentFeedbackTab = lazyWithRetry(() => import("./my-work/MyWorkAppointmentFeedbackTab").then(m => ({ default: m.MyWorkAppointmentFeedbackTab })));
const MyWorkFeedbackFeedTab = lazyWithRetry(() => import("./my-work/MyWorkFeedbackFeedTab").then(m => ({ default: m.MyWorkFeedbackFeedTab })));
const MyWorkDashboardTab = lazyWithRetry(() => import("./my-work/MyWorkDashboardTab").then(m => ({ default: m.MyWorkDashboardTab })));
import { canViewTab, getRoleFlags, type UserRole } from "@/components/my-work/tabVisibility";
import { MyWorkTabErrorState } from "@/components/my-work/MyWorkTabErrorState";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface TabCounts {
  tasks: number;
  decisions: number;
  cases: number;
  plannings: number;
  team: number;
  jourFixe: number;
  feedbackFeed: number;
}

type TabValue = "dashboard" | "capture" | "tasks" | "decisions" | "jourFixe" | "cases" | "plannings" | "redaktion" | "team" | "time" | "feedbackfeed";

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ElementType;
  countKey?: keyof TabCounts;
  badgeVariant?: "secondary" | "destructive";
  adminOnly?: boolean;
  employeeOnly?: boolean;
  abgeordneterOrBueroOnly?: boolean;
  abgeordneterOnly?: boolean;
  feedbackFeedCoreRolesOnly?: boolean;
  isLogo?: boolean;
}

const BASE_TABS: TabConfig[] = [
  { value: "dashboard", label: "", icon: Home, isLogo: true },
  { value: "capture", label: "Quick Notes", icon: StickyNote },
  { value: "cases", label: "Vorgänge", icon: Briefcase, countKey: "cases" },
  { value: "tasks", label: "Aufgaben", icon: CheckSquare, countKey: "tasks" },
  { value: "decisions", label: "Entscheidungen", icon: Vote, countKey: "decisions" },
  { value: "jourFixe", label: "Jour fixe & Planungen", icon: Calendar, countKey: "jourFixe" },
  { value: "redaktion", label: "Redaktion", icon: Lightbulb },
  { value: "time", label: "Meine Zeit", icon: Clock, employeeOnly: true },
  { value: "feedbackfeed", label: "Rückmeldungen", icon: MessageSquare, countKey: "feedbackFeed" },
  { value: "team", label: "Team", icon: Users, countKey: "team", badgeVariant: "destructive", abgeordneterOrBueroOnly: true },
];

const LEGACY_TAB_MAP: Record<string, TabValue> = {
  caseitems: "cases",
  casefiles: "cases",
  appointmentfeedback: "feedbackfeed",
  plannings: "jourFixe",
};

const ALLOWED_TABS = new Set<TabValue>(BASE_TABS.map((tab) => tab.value));

export function MyWorkView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { app_logo_url } = useAppSettings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isAbgeordneter, setIsAbgeordneter] = useState(false);
  const [isBueroleitung, setIsBueroleitung] = useState(false);
  const [isTabLogoError, setIsTabLogoError] = useState(false);
  const [totalCounts, setTotalCounts] = useState<TabCounts>({
    tasks: 0,
    decisions: 0,
    cases: 0,
    plannings: 0,
    team: 0,
    jourFixe: 0,
    feedbackFeed: 0,
  });
  const loadCountsRequestRef = useRef(0);
  const shouldIncludeTeamCountRef = useRef(false);
  const [countLoadError, setCountLoadError] = useState<string | null>(null);
  const [isCountsLoading, setIsCountsLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "degraded">("connecting");
  const [feedbackFeedCoreRolesOnly, setFeedbackFeedCoreRolesOnly] = useState(false);
  
  // Badge display mode setting and new counts
  const { badgeDisplayMode } = useMyWorkSettings();
  const { newCounts, markTabAsVisited, refreshCounts } = useMyWorkNewCounts();
  
  const role: UserRole = isAbgeordneter
    ? "abgeordneter"
    : isBueroleitung
      ? "bueroleitung"
      : isEmployee
        ? "mitarbeiter"
        : null;

  const visibleTabs = BASE_TABS.filter((tab) => {
    const visibilityFlags = tab.value === "feedbackfeed"
      ? { ...tab, feedbackFeedCoreRolesOnly }
      : tab;
    return canViewTab(visibilityFlags, role);
  });

  const fallbackTab = (visibleTabs[0]?.value ?? "dashboard") as TabValue;

  // Get active tab from URL with whitelist validation and legacy mapping
  const rawTab = searchParams.get("tab");
  const normalizedFromRaw = rawTab ? (LEGACY_TAB_MAP[rawTab] ?? rawTab) : null;
  const isAllowedTab = normalizedFromRaw ? ALLOWED_TABS.has(normalizedFromRaw as TabValue) : false;
  const normalizedTab = isAllowedTab ? (normalizedFromRaw as TabValue) : fallbackTab;
  const isVisibleTab = visibleTabs.some((tab) => tab.value === normalizedTab);
  const activeTab = isVisibleTab ? normalizedTab : fallbackTab;

  useEffect(() => {
    const action = searchParams.get("action");
    const highlight = searchParams.get("highlight");
    const hasRawTab = typeof rawTab === "string";
    const needsNormalization = !hasRawTab || rawTab !== activeTab;

    if (!needsNormalization) return;

    const nextParams: Record<string, string> = { tab: activeTab };
    if (action) {
      nextParams.action = action;
    }
    if (highlight) {
      nextParams.highlight = highlight;
    }

    setSearchParams(nextParams, { replace: true });
  }, [rawTab, activeTab, searchParams, setSearchParams]);
  
  const setActiveTab = (tab: TabValue) => {
    setSearchParams({ tab });
    
    // Mark tab as visited when switching
    const tabToContexts: Record<string, string[]> = {
      dashboard: [],
      capture: [],
      tasks: ['mywork_tasks'],
      decisions: ['mywork_decisions'],
      jourFixe: ['mywork_jourFixe'],
      cases: ['mywork_caseitems', 'mywork_casefiles'],
      plannings: ['mywork_plannings'],
      redaktion: [],
      time: [],
      team: ['mywork_team'],
      feedbackfeed: ['mywork_feedbackfeed'],
    };

    const contexts = tabToContexts[tab] || [];
    if (contexts.length > 0) {
      contexts.forEach((context) => {
        markTabAsVisited(context as Parameters<typeof markTabAsVisited>[0]);
      });
      refreshCounts(contexts as Parameters<typeof refreshCounts>[0]);
    }
  };

  // Handle QuickAction URL parameter
  useEffect(() => {
    const action = searchParams.get("action");
    if (action) {
      // Map actions to their corresponding tabs
      const actionToTab: Record<string, TabValue> = {
        "create-task": "tasks",
        "create-decision": "decisions",
        "create-meeting": "jourFixe",
        "create-caseitem": "cases",
        "create-casefile": "cases",
        "create-eventplanning": "jourFixe",
      };
      
      const targetTab = actionToTab[action];
      if (targetTab && activeTab !== targetTab) {
        // Navigate to the correct tab first
        setSearchParams({ tab: targetTab, action });
      }
    }
  }, [searchParams, activeTab, setSearchParams]);


  useEffect(() => {
    setIsTabLogoError(false);
  }, [app_logo_url]);

  // Memoized loadCounts for realtime updates
  const loadCounts = useCallback(async (includeTeamCount = false) => {
    if (!user) return;

    const requestId = ++loadCountsRequestRef.current;
    setIsCountsLoading(true);
    setCountLoadError(null);

    try {
      const { data, error } = await supabase.rpc("get_my_work_counts", {
        p_user_id: user.id,
        p_include_team: includeTeamCount,
      });

      if (error) throw error;

      const counts = (data || {}) as Record<string, number>;

      if (requestId !== loadCountsRequestRef.current) return;

      setTotalCounts({
        tasks: Number(counts.tasks || 0),
        decisions: Number(counts.decisions || 0),
        cases: Number(counts.caseItems || 0) + Number(counts.caseFiles || 0),
        plannings: Number(counts.plannings || 0),
        team: Number(counts.team || 0),
        jourFixe: Number(counts.jourFixe || 0),
        feedbackFeed: Number(counts.feedbackFeed || 0),
      });
      setRealtimeStatus("connected");
    } catch (error) {
      debugConsole.error("Error loading counts:", error);
      setCountLoadError("Counts konnten nicht aktualisiert werden.");
      setRealtimeStatus("degraded");
    } finally {
      if (requestId === loadCountsRequestRef.current) {
        setIsCountsLoading(false);
      }
    }
  }, [user]);

  const loadUserRoleAndCounts = useCallback(async () => {
    if (!user) return;

    if (!currentTenant?.id) {
      setIsAdmin(false);
      setIsEmployee(false);
      setIsAbgeordneter(false);
      setIsBueroleitung(false);
      shouldIncludeTeamCountRef.current = false;
      await loadCounts(false);
      return;
    }

    const [membershipData, feedbackFeedVisibilitySetting] = await Promise.all([
      supabase
        .from("user_tenant_memberships")
        .select("role")
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "mywork_feedbackfeed_core_roles_only")
        .maybeSingle(),
    ]);

    if (membershipData.error) {
      debugConsole.error("Error loading tenant membership role:", membershipData.error);
    }

    let resolvedRole = (membershipData.data?.role || null) as UserRole;

    if (!resolvedRole) {
      const { data: fallbackRoleData, error: fallbackRoleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fallbackRoleError) {
        debugConsole.error("Error loading fallback user role:", fallbackRoleError);
      }

      resolvedRole = (fallbackRoleData?.role || null) as UserRole;
    }

    const roleFlags = getRoleFlags(resolvedRole);

    setIsAdmin(roleFlags.isAdmin);
    setIsEmployee(roleFlags.isEmployee);
    setIsAbgeordneter(roleFlags.isAbgeordneter);
    setIsBueroleitung(roleFlags.isBueroleitung);
    setFeedbackFeedCoreRolesOnly(Boolean(feedbackFeedVisibilitySetting.data?.setting_value));

    shouldIncludeTeamCountRef.current = roleFlags.isAbgeordneter || roleFlags.isBueroleitung;
    await loadCounts(shouldIncludeTeamCountRef.current);
  }, [user, currentTenant?.id, loadCounts]);

  useEffect(() => {
    void loadUserRoleAndCounts();
  }, [loadUserRoleAndCounts]);

  // Note: Realtime subscriptions are handled by individual data hooks
  // (useMyWorkTasksData, useMyWorkDecisionsData, etc.)
  // No duplicate channel needed here - just set status to connected.
  useEffect(() => {
    setRealtimeStatus("connected");
  }, []);

  const handleNoteSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabFallback = (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      {isCountsLoading ? "Bereich wird geladen…" : "Lade Daten…"}
    </div>
  );


  const tabError = (label: string) => (
    <MyWorkTabErrorState
      title={`${label} konnte nicht geladen werden`}
      description="Bitte erneut versuchen oder die Seite neu laden."
      onRetry={() => window.location.reload()}
    />
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6">
      {countLoadError && (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{countLoadError}</span>
            <Button size="sm" variant="outline" onClick={() => loadCounts(shouldIncludeTeamCountRef.current)}>
              Erneut laden
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation + Actions */}
      <div className="mb-6 flex items-center justify-between gap-3 border-b">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;

            // Get display count based on badge display mode
            const getDisplayCount = () => {
              if (tab.value === 'feedbackfeed') {
                return newCounts.feedbackFeed || 0;
              }

              if (!tab.countKey) return 0;

              // Team tab shows unread notifications count
              if (tab.countKey === 'team') {
                return newCounts.team || 0;
              }

              if (badgeDisplayMode === 'new') {
                // Map countKey to newCounts keys
                const newCountsMap: Record<string, keyof typeof newCounts> = {
                  tasks: 'tasks',
                  decisions: 'decisions',
                  jourFixe: 'jourFixe',
                  cases: 'cases',
                  plannings: 'plannings',
                };
                const key = newCountsMap[tab.countKey];
                return key ? newCounts[key] : 0;
              }

              return totalCounts[tab.countKey];
            };

            const count = getDisplayCount();
            const isActiveTab = activeTab === tab.value;

            // Badge variant: "new" mode uses destructive for new items, total uses secondary
            const badgeVariant = tab.badgeVariant || (badgeDisplayMode === 'new' ? 'destructive' : 'secondary');

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 ${tab.isLogo ? 'px-2' : 'px-4'} py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActiveTab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.isLogo && app_logo_url && !isTabLogoError ? (
                  <img
                    src={app_logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-contain rounded flex-shrink-0"
                    crossOrigin="anonymous"
                    onError={() => setIsTabLogoError(true)}
                  />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {tab.label}
                {count > 0 && (
                  <Badge
                    variant={badgeVariant}
                    className="ml-1 h-5 min-w-5 text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 pb-2">
          <Badge variant={realtimeStatus === "connected" ? "secondary" : "destructive"} className="hidden md:inline-flex">
            Realtime: {realtimeStatus === "connected" ? "online" : realtimeStatus === "connecting" ? "verbinde…" : "degradiert"}
          </Badge>
          {/* Schnellaktionen-Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Neu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setActiveTab("capture")}>
                <StickyNote className="h-4 w-4 mr-2" />
                Quick Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/tasks?action=create")}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Aufgabe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams({ tab: "decisions", action: "create-decision" })}>
                <Vote className="h-4 w-4 mr-2" />
                Entscheidung
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/meetings?action=create-meeting")}>
                <Calendar className="h-4 w-4 mr-2" />
                Jour Fixe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams({ tab: "cases", action: "create-caseitem" })}>
                <Briefcase className="h-4 w-4 mr-2" />
                Anliegen erstellen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams({ tab: "cases", action: "create-casefile" })}>
                <Briefcase className="h-4 w-4 mr-2" />
                Akte erstellen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hilfe-Button - zeigt Inhalt basierend auf aktivem Tab */}
          {MYWORK_HELP_CONTENT[activeTab] && (
            <PageHelpButton
              title={MYWORK_HELP_CONTENT[activeTab].title}
              description={MYWORK_HELP_CONTENT[activeTab].description}
              features={MYWORK_HELP_CONTENT[activeTab].features}
            />
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <ErrorBoundary fallback={tabError("Dashboard")}>
          <Suspense fallback={tabFallback}>
            <MyWorkDashboardTab />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "capture" && (
        <Suspense fallback={tabFallback}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MyWorkQuickCapture onNoteSaved={handleNoteSaved} />
            <MyWorkNotesList refreshTrigger={refreshTrigger} />
          </div>
        </Suspense>
      )}
      
      {activeTab === "tasks" && <ErrorBoundary fallback={tabError("Aufgaben")}><Suspense fallback={tabFallback}><MyWorkTasksTab /></Suspense></ErrorBoundary>}
      {activeTab === "decisions" && <ErrorBoundary fallback={tabError("Entscheidungen")}><Suspense fallback={tabFallback}><MyWorkDecisionsTab /></Suspense></ErrorBoundary>}
      {activeTab === "jourFixe" && <ErrorBoundary fallback={tabError("Jour fixe & Planungen")}><Suspense fallback={tabFallback}><MyWorkTerminePlanungTab /></Suspense></ErrorBoundary>}
      {activeTab === "cases" && <ErrorBoundary fallback={tabError("Vorgänge")}><Suspense fallback={tabFallback}><MyWorkCasesWorkspace /></Suspense></ErrorBoundary>}
      {activeTab === "redaktion" && <ErrorBoundary fallback={tabError("Redaktion")}><Suspense fallback={tabFallback}><MyWorkRedaktionTab /></Suspense></ErrorBoundary>}
      {activeTab === "time" && <ErrorBoundary fallback={tabError("Meine Zeit")}><Suspense fallback={tabFallback}><MyWorkTimeTrackingTab /></Suspense></ErrorBoundary>}
      {activeTab === "team" && <ErrorBoundary fallback={tabError("Team")}><Suspense fallback={tabFallback}><MyWorkTeamTab /></Suspense></ErrorBoundary>}
      {activeTab === "feedbackfeed" && (
        <Suspense fallback={tabFallback}>
          {isAbgeordneter ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MyWorkAppointmentFeedbackTab />
              <MyWorkFeedbackFeedTab />
            </div>
          ) : (
            <MyWorkFeedbackFeedTab />
          )}
        </Suspense>
      )}
    </div>
  );
}
