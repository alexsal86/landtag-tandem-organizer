import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckSquare, Vote, Briefcase, CalendarPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MyWorkQuickCapture } from "./my-work/MyWorkQuickCapture";
import { MyWorkNotesList } from "./my-work/MyWorkNotesList";
import { MyWorkTasksTab } from "./my-work/MyWorkTasksTab";
import { MyWorkDecisionsTab } from "./my-work/MyWorkDecisionsTab";
import { MyWorkCaseFilesTab } from "./my-work/MyWorkCaseFilesTab";
import { MyWorkPlanningsTab } from "./my-work/MyWorkPlanningsTab";
import { MyWorkTeamTab } from "./my-work/MyWorkTeamTab";

interface TabCounts {
  tasks: number;
  decisions: number;
  caseFiles: number;
  plannings: number;
  team: number;
}

export function MyWorkView() {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [counts, setCounts] = useState<TabCounts>({
    tasks: 0,
    decisions: 0,
    caseFiles: 0,
    plannings: 0,
    team: 0,
  });
  const [activeTab, setActiveTab] = useState("tasks");

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
      });
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  };

  const handleNoteSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          Meine Arbeit
        </h1>
        <p className="text-muted-foreground mt-1">
          Alle Aufgaben, Entscheidungen und Projekte auf einen Blick
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Quick Capture + Notes */}
        <div className="flex flex-col gap-4">
          <MyWorkQuickCapture onNoteSaved={handleNoteSaved} />
          <MyWorkNotesList refreshTrigger={refreshTrigger} />
        </div>

        {/* Right Side: Tabs */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 flex-wrap">
                <TabsTrigger
                  value="tasks"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                >
                  <CheckSquare className="h-4 w-4 mr-1.5" />
                  Aufgaben
                  {counts.tasks > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                      {counts.tasks}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="decisions"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                >
                  <Vote className="h-4 w-4 mr-1.5" />
                  Entscheidungen
                  {counts.decisions > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                      {counts.decisions}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="casefiles"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                >
                  <Briefcase className="h-4 w-4 mr-1.5" />
                  FallAkten
                  {counts.caseFiles > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                      {counts.caseFiles}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="plannings"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                >
                  <CalendarPlus className="h-4 w-4 mr-1.5" />
                  Planungen
                  {counts.plannings > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                      {counts.plannings}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="team"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Team
                  {counts.team > 0 && (
                    <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 text-xs">
                      {counts.team}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="m-0">
                <MyWorkTasksTab />
              </TabsContent>
              <TabsContent value="decisions" className="m-0">
                <MyWorkDecisionsTab />
              </TabsContent>
              <TabsContent value="casefiles" className="m-0">
                <MyWorkCaseFilesTab />
              </TabsContent>
              <TabsContent value="plannings" className="m-0">
                <MyWorkPlanningsTab />
              </TabsContent>
              <TabsContent value="team" className="m-0">
                <MyWorkTeamTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
