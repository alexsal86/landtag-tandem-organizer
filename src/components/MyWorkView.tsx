import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardList, CheckSquare, Vote, Briefcase, CalendarPlus, Users, StickyNote, Calendar, Clock, Plus, Home } from "lucide-react";
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
import { DashboardGreetingSection } from "./dashboard/DashboardGreetingSection";
import { NewsWidget } from "./widgets/NewsWidget";

interface TabCounts {
  tasks: number;
  decisions: number;
  caseFiles: number;
  plannings: number;
  team: number;
  jourFixe: number;
}

type TabValue = "dashboard" | "capture" | "tasks" | "decisions" | "jourFixe" | "casefiles" | "plannings" | "team" | "time";

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ElementType;
  countKey?: keyof TabCounts;
  badgeVariant?: "secondary" | "destructive";
  adminOnly?: boolean;
  employeeOnly?: boolean;
  abgeordneterOrBueroOnly?: boolean;
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
  const loadCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Count tasks
      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq("status", "completed");

      // Count decisions (participant)
      const { count: decisionCount } = await supabase
        .from("task_decision_participants")
        .select("*, task_decisions!inner(*)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("task_decisions.status", ["active", "open"]);

      // Count case files
      const { count: caseFileCount } = await supabase
        .from("case_files")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["active", "pending"]);

      // Count plannings (owned + collaborating)
      const { count: ownedPlanningCount } = await supabase
        .from("event_plannings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: collabPlanningCount } = await supabase
        .from("event_planning_collaborators")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const planningCount = (ownedPlanningCount || 0) + (collabPlanningCount || 0);

      // Count upcoming Jour Fixe meetings
      const { count: jourFixeCount } = await supabase
        .from("meetings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "archived")
        .gte("meeting_date", new Date().toISOString());

      // Check if admin for team count (meeting requests + time entry warnings)
      const { data: adminData } = await supabase.rpc("is_admin", { _user_id: user.id });
      let teamCount = 0;
      if (adminData) {
        const { count: requestCount } = await supabase
          .from("employee_meeting_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        // Count employees with missing time entries (>3 business days)
        let warningCount = 0;
        try {
          // Get employee IDs
          const { data: memberships } = await supabase
            .from("user_tenant_memberships")
            .select("user_id")
            .eq("is_active", true);

          if (memberships?.length) {
            const userIds = memberships.map(m => m.user_id);
            
            const { data: roles } = await supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", userIds);

            const employeeIds = (roles || [])
              .filter(r => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
              .map(r => r.user_id);

            if (employeeIds.length > 0) {
              const { data: lastEntries } = await supabase
                .from("time_entries")
                .select("user_id, work_date")
                .in("user_id", employeeIds)
                .order("work_date", { ascending: false });

              const lastEntryByUser: Record<string, string> = {};
              (lastEntries || []).forEach((entry: any) => {
                if (!lastEntryByUser[entry.user_id]) {
                  lastEntryByUser[entry.user_id] = entry.work_date;
                }
              });

              // Calculate business days for each employee
              const today = new Date();
              employeeIds.forEach(uid => {
                const lastDate = lastEntryByUser[uid];
                if (!lastDate) {
                  warningCount++;
                  return;
                }
                const last = new Date(lastDate);
                let count = 0;
                let current = new Date(last);
                current.setDate(current.getDate() + 1);
                while (current <= today) {
                  const day = current.getDay();
                  if (day !== 0 && day !== 6) count++;
                  current.setDate(current.getDate() + 1);
                }
                if (count > 3) warningCount++;
              });
            }
          }
        } catch (e) {
          console.error("Error calculating time entry warnings:", e);
        }

        teamCount = (requestCount || 0) + warningCount;
      }

      setTotalCounts({
        tasks: taskCount || 0,
        decisions: decisionCount || 0,
        caseFiles: caseFileCount || 0,
        plannings: planningCount || 0,
        team: teamCount,
        jourFixe: jourFixeCount || 0,
      });
    } catch (error) {
      console.error("Error loading counts:", error);
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
      loadCounts();
      refreshCounts();
    }, 2000);
  }, [loadCounts, refreshCounts]);

  // Supabase Realtime subscriptions for live updates
  useEffect(() => {
    if (!user) return;

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
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedUpdate]);

  const loadUserRoleAndCounts = async () => {
    if (!user) return;
    
    // Check user role
    const [adminCheck, roleData] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: user.id }),
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    ]);
    
    setIsAdmin(!!adminCheck.data);
    
    const employeeRoles = ["mitarbeiter", "praktikant", "bueroleitung"];
    setIsEmployee(roleData.data ? employeeRoles.includes(roleData.data.role) : false);
    setIsAbgeordneter(roleData.data?.role === "abgeordneter");
    setIsBueroleitung(roleData.data?.role === "bueroleitung");
    
    loadCounts();
  };

  const handleNoteSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabFallback = (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Bereich wird geladen…
    </div>
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

      {/* Tab Navigation (horizontal, oben) */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {BASE_TABS
          .filter((tab) => {
            // Filter based on role
            if (tab.adminOnly && !isAdmin) return false;
            if (tab.employeeOnly && !isEmployee) return false;
            if (tab.abgeordneterOrBueroOnly && !isAbgeordneter && !isBueroleitung) return false;
            return true;
          })
          .map((tab) => {
            const Icon = tab.icon;
            
            // Get display count based on badge display mode
            const getDisplayCount = () => {
              if (!tab.countKey) return 0;
              
              // Team tab always shows total (no "new" logic for team)
              if (tab.countKey === 'team') {
                return totalCounts.team;
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
      
      {activeTab === "tasks" && <Suspense fallback={tabFallback}><MyWorkTasksTab /></Suspense>}
      {activeTab === "decisions" && <Suspense fallback={tabFallback}><MyWorkDecisionsTab /></Suspense>}
      {activeTab === "jourFixe" && <Suspense fallback={tabFallback}><MyWorkJourFixeTab /></Suspense>}
      {activeTab === "casefiles" && <Suspense fallback={tabFallback}><MyWorkCaseFilesTab /></Suspense>}
      {activeTab === "plannings" && <Suspense fallback={tabFallback}><MyWorkPlanningsTab /></Suspense>}
      {activeTab === "time" && <Suspense fallback={tabFallback}><MyWorkTimeTrackingTab /></Suspense>}
      {activeTab === "team" && <Suspense fallback={tabFallback}><MyWorkTeamTab /></Suspense>}
    </div>
  );
}
