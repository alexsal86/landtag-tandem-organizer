import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardList, CheckSquare, Vote, Briefcase, CalendarPlus, Users, StickyNote, Calendar, Clock, Plus, Home, CheckCircle2, MessageSquare } from "lucide-react";
import { PageHelpButton } from "@/components/shared/PageHelpButton";
import { MYWORK_HELP_CONTENT } from "@/config/helpContent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useMyWorkNewCounts } from "@/hooks/useMyWorkNewCounts";
import { useAppSettings } from "@/hooks/useAppSettings";
const MyWorkQuickCapture = lazy(() => import("./my-work/MyWorkQuickCapture").then(m => ({ default: m.MyWorkQuickCapture })));
const MyWorkNotesList = lazy(() => import("./my-work/MyWorkNotesList").then(m => ({ default: m.MyWorkNotesList })));
const MyWorkTasksTab = lazy(() => import("./my-work/MyWorkTasksTab").then(m => ({ default: m.MyWorkTasksTab })));
const MyWorkDecisionsTab = lazy(() => import("./my-work/MyWorkDecisionsTab").then(m => ({ default: m.MyWorkDecisionsTab })));
const MyWorkCaseFilesTab = lazy(() => import("./my-work/MyWorkCaseFilesTab").then(m => ({ default: m.MyWorkCaseFilesTab })));
const MyWorkPlanningsTab = lazy(() => import("./my-work/MyWorkPlanningsTab").then(m => ({ default: m.MyWorkPlanningsTab })));
const MyWorkTeamTab = lazy(() => import("./my-work/MyWorkTeamTab").then(m => ({ default: m.MyWorkTeamTab })));
const MyWorkJourFixeTab = lazy(() => import("./my-work/MyWorkJourFixeTab").then(m => ({ default: m.MyWorkJourFixeTab })));
const MyWorkTimeTrackingTab = lazy(() => import("./my-work/MyWorkTimeTrackingTab").then(m => ({ default: m.MyWorkTimeTrackingTab })));
const MyWorkAppointmentFeedbackTab = lazy(() => import("./my-work/MyWorkAppointmentFeedbackTab").then(m => ({ default: m.MyWorkAppointmentFeedbackTab })));
const MyWorkFeedbackFeedTab = lazy(() => import("./my-work/MyWorkFeedbackFeedTab").then(m => ({ default: m.MyWorkFeedbackFeedTab })));
import { DashboardGreetingSection } from "./dashboard/DashboardGreetingSection";
import { canViewTab, getRoleFlags, type UserRole } from "@/components/my-work/tabVisibility";
import { MyWorkTabErrorState } from "@/components/my-work/MyWorkTabErrorState";
import { NewsWidget } from "./widgets/NewsWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface TabCounts {
  tasks: number;
  decisions: number;
  caseFiles: number;
  plannings: number;
  team: number;
  jourFixe: number;
}

type TabValue = "dashboard" | "capture" | "tasks" | "decisions" | "jourFixe" | "casefiles" | "plannings" | "team" | "time" | "feedbackfeed";

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
  isLogo?: boolean;
}

const BASE_TABS: TabConfig[] = [
  { value: "dashboard", label: "", icon: Home, isLogo: true },
  { value: "capture", label: "Quick Notes", icon: StickyNote },
  { value: "tasks", label: "Aufgaben", icon: CheckSquare, countKey: "tasks" },
  { value: "decisions", label: "Entscheidungen", icon: Vote, countKey: "decisions" },
  { value: "jourFixe", label: "Jour Fixe", icon: Calendar, countKey: "jourFixe" },
  { value: "casefiles", label: "FallAkten", icon: Briefcase, countKey: "caseFiles" },
  { value: "plannings", label: "Planungen", icon: CalendarPlus, countKey: "plannings" },
  { value: "time", label: "Meine Zeit", icon: Clock, employeeOnly: true },
  { value: "feedbackfeed", label: "Rückmeldungen", icon: MessageSquare },
  { value: "team", label: "Team", icon: Users, countKey: "team", badgeVariant: "destructive", abgeordneterOrBueroOnly: true },
];

export function MyWorkView() {
  const { user } = useAuth();
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
    caseFiles: 0,
    plannings: 0,
    team: 0,
    jourFixe: 0,
  });
  const loadCountsRequestRef = useRef(0);
  const shouldIncludeTeamCountRef = useRef(false);
  const [countLoadError, setCountLoadError] = useState<string | null>(null);
  const [isCountsLoading, setIsCountsLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "degraded">("connecting");
  
  // Badge display mode setting and new counts
  const { badgeDisplayMode } = useMyWorkSettings();
  const { newCounts, markTabAsVisited, refreshCounts } = useMyWorkNewCounts();
  
  // Get active tab from URL or default to "dashboard"
  const activeTab = (searchParams.get("tab") as TabValue) || "dashboard";
  
  const setActiveTab = (tab: TabValue) => {
    setSearchParams({ tab });
    
    // Mark tab as visited when switching
    const tabToContext: Record<TabValue, string> = {
      dashboard: '',
      capture: '',
      tasks: 'mywork_tasks',
      decisions: 'mywork_decisions',
      jourFixe: 'mywork_jourFixe',
      casefiles: 'mywork_casefiles',
      plannings: 'mywork_plannings',
      time: '',
      team: '',
      feedbackfeed: '',
    };
    
    const context = tabToContext[tab];
    if (context) {
      markTabAsVisited(context as any);
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
        "create-casefile": "casefiles",
        "create-eventplanning": "plannings",
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

      const counts = (data || {}) as Partial<TabCounts>;

      if (requestId !== loadCountsRequestRef.current) return;

      setTotalCounts({
        tasks: Number(counts.tasks || 0),
        decisions: Number(counts.decisions || 0),
        caseFiles: Number(counts.caseFiles || 0),
        plannings: Number(counts.plannings || 0),
        team: Number(counts.team || 0),
        jourFixe: Number(counts.jourFixe || 0),
      });
      setRealtimeStatus("connected");
    } catch (error) {
      console.error("Error loading counts:", error);
      setCountLoadError("Counts konnten nicht aktualisiert werden.");
      setRealtimeStatus("degraded");
    } finally {
      if (requestId === loadCountsRequestRef.current) {
        setIsCountsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserRoleAndCounts();
    }
  }, [user]);

  // Debounced realtime handler to prevent rapid-fire refetches
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      loadCounts(shouldIncludeTeamCountRef.current);
      refreshCounts();
    }, 2000);
  }, [loadCounts, refreshCounts]);

  // Supabase Realtime subscriptions for live updates
  useEffect(() => {
    if (!user) return;

    setRealtimeStatus("connecting");

    const channel = supabase
      .channel('my-work-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_decisions', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_decision_participants', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_decision_responses', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quick_notes', filter: `user_id=eq.${user.id}` },
        () => setRefreshTrigger(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'case_files', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_plannings', filter: `user_id=eq.${user.id}` },
        debouncedUpdate
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("degraded");
      });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedUpdate]);

  const loadUserRoleAndCounts = async () => {
    if (!user) return;

    const [adminCheck, roleData] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: user.id }),
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    ]);

    const admin = !!adminCheck.data;
    const role = (roleData.data?.role || null) as UserRole;
    const roleFlags = getRoleFlags(role);

    setIsAdmin(admin);
    setIsEmployee(roleFlags.isEmployee);
    setIsAbgeordneter(roleFlags.isAbgeordneter);
    setIsBueroleitung(roleFlags.isBueroleitung);

    shouldIncludeTeamCountRef.current = admin && (roleFlags.isAbgeordneter || roleFlags.isBueroleitung);
    loadCounts(shouldIncludeTeamCountRef.current);
  };

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
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            Meine Arbeit
          </h1>
          <p className="text-muted-foreground mt-1">
            Alle Aufgaben, Entscheidungen und Projekte auf einen Blick
          </p>
        </div>
        
        <div className="flex items-center gap-2">
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

      {/* Tab Navigation (horizontal, oben) */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {BASE_TABS
          .filter((tab) => {
            const role: UserRole = isAbgeordneter
              ? "abgeordneter"
              : isBueroleitung
                ? "bueroleitung"
                : isEmployee
                  ? "mitarbeiter"
                  : null;
            return canViewTab(tab, role);
          })
          .map((tab) => {
            const Icon = tab.icon;
            
            // Get display count based on badge display mode
            const getDisplayCount = () => {
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
                  caseFiles: 'caseFiles',
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

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardGreetingSection />
          <NewsWidget />
        </div>
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
      {activeTab === "jourFixe" && <ErrorBoundary fallback={tabError("Jour Fixe")}><Suspense fallback={tabFallback}><MyWorkJourFixeTab /></Suspense></ErrorBoundary>}
      {activeTab === "casefiles" && <ErrorBoundary fallback={tabError("FallAkten")}><Suspense fallback={tabFallback}><MyWorkCaseFilesTab /></Suspense></ErrorBoundary>}
      {activeTab === "plannings" && <ErrorBoundary fallback={tabError("Planungen")}><Suspense fallback={tabFallback}><MyWorkPlanningsTab /></Suspense></ErrorBoundary>}
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
