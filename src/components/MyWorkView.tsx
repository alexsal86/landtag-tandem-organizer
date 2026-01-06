import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckSquare, Vote, Briefcase, CalendarPlus, Users, StickyNote, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MyWorkQuickCapture } from "./my-work/MyWorkQuickCapture";
import { MyWorkNotesList } from "./my-work/MyWorkNotesList";
import { MyWorkTasksTab } from "./my-work/MyWorkTasksTab";
import { MyWorkDecisionsTab } from "./my-work/MyWorkDecisionsTab";
import { MyWorkCaseFilesTab } from "./my-work/MyWorkCaseFilesTab";
import { MyWorkPlanningsTab } from "./my-work/MyWorkPlanningsTab";
import { MyWorkTeamTab } from "./my-work/MyWorkTeamTab";
import { MyWorkJourFixeTab } from "./my-work/MyWorkJourFixeTab";

interface TabCounts {
  tasks: number;
  decisions: number;
  caseFiles: number;
  plannings: number;
  team: number;
  jourFixe: number;
}

type TabValue = "capture" | "tasks" | "decisions" | "jourFixe" | "casefiles" | "plannings" | "team";

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ElementType;
  countKey?: keyof TabCounts;
  badgeVariant?: "secondary" | "destructive";
}

const TABS: TabConfig[] = [
  { value: "capture", label: "Quick Notes", icon: StickyNote },
  { value: "tasks", label: "Aufgaben", icon: CheckSquare, countKey: "tasks" },
  { value: "decisions", label: "Entscheidungen", icon: Vote, countKey: "decisions" },
  { value: "jourFixe", label: "Jour Fixe", icon: Calendar, countKey: "jourFixe" },
  { value: "casefiles", label: "FallAkten", icon: Briefcase, countKey: "caseFiles" },
  { value: "plannings", label: "Planungen", icon: CalendarPlus, countKey: "plannings" },
  { value: "team", label: "Team", icon: Users, countKey: "team", badgeVariant: "destructive" },
];

export function MyWorkView() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [counts, setCounts] = useState<TabCounts>({
    tasks: 0,
    decisions: 0,
    caseFiles: 0,
    plannings: 0,
    team: 0,
    jourFixe: 0,
  });
  
  // Get active tab from URL or default to "capture"
  const activeTab = (searchParams.get("tab") as TabValue) || "capture";
  
  const setActiveTab = (tab: TabValue) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  const loadCounts = async () => {
    if (!user) return;

    try {
      // Count tasks
      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .or(`assigned_to.cs.{${user.id}},assigned_to.like.%${user.id}%,user_id.eq.${user.id}`)
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

      // Count plannings
      const { count: planningCount } = await supabase
        .from("event_plannings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Count upcoming Jour Fixe meetings
      const { count: jourFixeCount } = await supabase
        .from("meetings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "archived")
        .gte("meeting_date", new Date().toISOString());

      // Check if admin for team count
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
      let teamCount = 0;
      if (isAdmin) {
        const { count } = await supabase
          .from("employee_meeting_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        teamCount = count || 0;
      }

      setCounts({
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
  };

  const handleNoteSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          Meine Arbeit
        </h1>
        <p className="text-muted-foreground mt-1">
          Alle Aufgaben, Entscheidungen und Projekte auf einen Blick
        </p>
      </div>

      {/* Tab Navigation (horizontal, oben) */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.countKey ? counts[tab.countKey] : 0;
          const isActive = activeTab === tab.value;
          
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <Badge 
                  variant={tab.badgeVariant || "secondary"} 
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
      {activeTab === "capture" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyWorkQuickCapture onNoteSaved={handleNoteSaved} />
          <MyWorkNotesList refreshTrigger={refreshTrigger} />
        </div>
      )}
      
      {activeTab === "tasks" && <MyWorkTasksTab />}
      {activeTab === "decisions" && <MyWorkDecisionsTab />}
      {activeTab === "jourFixe" && <MyWorkJourFixeTab />}
      {activeTab === "casefiles" && <MyWorkCaseFilesTab />}
      {activeTab === "plannings" && <MyWorkPlanningsTab />}
      {activeTab === "team" && <MyWorkTeamTab />}
    </div>
  );
}
