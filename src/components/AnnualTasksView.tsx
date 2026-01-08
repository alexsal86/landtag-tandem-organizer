import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCcw, 
  Zap, 
  Users, 
  Info,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AnnualTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  due_month: number;
  due_day: number | null;
  is_system_task: boolean;
  auto_execute: boolean;
  execute_function: string | null;
}

interface AnnualTaskCompletion {
  id: string;
  annual_task_id: string;
  year: number;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

interface AnnualTaskWithStatus extends AnnualTask {
  completion?: AnnualTaskCompletion;
  status: 'completed' | 'due' | 'upcoming' | 'overdue';
}

interface ExecutionResult {
  success: boolean;
  affected_employees?: number;
  archived_year?: number;
  new_year?: number;
  message?: string;
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const CATEGORY_LABELS: Record<string, string> = {
  employee: "Mitarbeiter",
  admin: "Administration",
  calendar: "Kalender",
  system: "System",
};

const CATEGORY_COLORS: Record<string, string> = {
  employee: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  calendar: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  system: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const FUNCTION_DESCRIPTIONS: Record<string, { title: string; actions: string[] }> = {
  execute_reset_vacation_days: {
    title: "Urlaubstage zurücksetzen",
    actions: [
      "Archiviert Urlaubsstatistik des Vorjahres",
      "Berechnet Resturlaub für alle Mitarbeiter",
      "Überträgt Resturlaub ins neue Jahr (verfällt am 31. März)",
    ],
  },
  execute_archive_sick_days: {
    title: "Krankentage archivieren",
    actions: [
      "Speichert Krankentage-Statistik des Vorjahres",
      "Erstellt Jahresübersicht für jeden Mitarbeiter",
    ],
  },
  execute_expire_carry_over: {
    title: "Resturlaub verfallen lassen",
    actions: [
      "Setzt alle übertragenen Urlaubstage auf 0",
      "Dokumentiert verfallene Tage",
    ],
  },
  generate_current_year_stats: {
    title: "Jahresstatistik erstellen",
    actions: [
      "Erstellt Statistik für das aktuelle Jahr",
      "Berechnet genommene Urlaubstage",
      "Erfasst Krankentage",
    ],
  },
};

export function AnnualTasksView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AnnualTaskWithStatus[]>([]);
  const [selectedTask, setSelectedTask] = useState<AnnualTaskWithStatus | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completing, setCompleting] = useState(false);
  const [enableAutoExecute, setEnableAutoExecute] = useState(false);
  const [affectedCount, setAffectedCount] = useState<number | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [generatingStats, setGeneratingStats] = useState(false);
  const [generatingPreviousStats, setGeneratingPreviousStats] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    loadTasks();
  }, [currentTenant]);

  useEffect(() => {
    if (selectedTask) {
      setEnableAutoExecute(selectedTask.auto_execute || false);
      // Load affected employee count if task has execute function
      if (selectedTask.execute_function) {
        loadAffectedCount();
      }
    }
  }, [selectedTask]);

  const loadTasks = async () => {
    if (!currentTenant) return;
    setLoading(true);

    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from("annual_tasks" as any)
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("due_month", { ascending: true }) as { data: AnnualTask[] | null; error: any };

      if (tasksError) throw tasksError;

      const taskIds = (tasksData || []).map(t => t.id);
      if (taskIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data: completionsData, error: completionsError } = await supabase
        .from("annual_task_completions" as any)
        .select("*")
        .in("annual_task_id", taskIds)
        .eq("year", currentYear) as { data: AnnualTaskCompletion[] | null; error: any };

      if (completionsError) throw completionsError;

      const completionMap = new Map(
        (completionsData || []).map(c => [c.annual_task_id, c])
      );

      const tasksWithStatus: AnnualTaskWithStatus[] = (tasksData || []).map(task => {
        const completion = completionMap.get(task.id);
        let status: AnnualTaskWithStatus['status'] = 'upcoming';

        if (completion?.completed_at) {
          status = 'completed';
        } else if (task.due_month < currentMonth) {
          status = 'overdue';
        } else if (task.due_month === currentMonth) {
          status = 'due';
        }

        return { ...task, completion, status };
      });

      setTasks(tasksWithStatus);
    } catch (error) {
      console.error("Error loading annual tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAffectedCount = async () => {
    if (!currentTenant) return;
    
    try {
      // Get tenant user IDs first
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);
      
      if (!memberships || memberships.length === 0) {
        setAffectedCount(0);
        return;
      }
      
      const userIds = memberships.map(m => m.user_id);
      
      // Count employees managed by these users
      const { count } = await supabase
        .from("employee_settings")
        .select("id", { count: 'exact', head: true })
        .in("admin_id", userIds);
      
      setAffectedCount(count || 0);
    } catch (error) {
      console.error("Error loading affected count:", error);
      setAffectedCount(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTask || !user || !currentTenant) return;
    setCompleting(true);
    setExecutionResult(null);

    try {
      let result: ExecutionResult | null = null;

      // Execute the function if available
      if (selectedTask.execute_function) {
        const { data, error } = await supabase.rpc(
          selectedTask.execute_function as any,
          { p_tenant_id: currentTenant.id }
        );

        if (error) {
          console.error("Function execution error:", error);
          toast({ 
            title: "Fehler bei der Ausführung", 
            description: error.message,
            variant: "destructive" 
          });
          setCompleting(false);
          return;
        }

        result = data as ExecutionResult;
        setExecutionResult(result);
      }

      // Update auto_execute setting if changed
      if (selectedTask.is_system_task && enableAutoExecute !== selectedTask.auto_execute) {
        await supabase
          .from("annual_tasks" as any)
          .update({ auto_execute: enableAutoExecute })
          .eq("id", selectedTask.id);
      }

      // Mark task as completed
      const { error } = await supabase
        .from("annual_task_completions" as any)
        .upsert({
          annual_task_id: selectedTask.id,
          year: currentYear,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: completionNotes || (result ? JSON.stringify(result) : null),
        }, {
          onConflict: 'annual_task_id,year'
        });

      if (error) throw error;

      const successMessage = result 
        ? `${result.message || 'Aufgabe erledigt'} (${result.affected_employees || 0} Mitarbeiter betroffen)`
        : "Aufgabe als erledigt markiert";

      toast({ title: "Erfolgreich", description: successMessage });
      
      // Close dialog after short delay to show result
      setTimeout(() => {
        setSelectedTask(null);
        setCompletionNotes("");
        setExecutionResult(null);
        loadTasks();
      }, result ? 2000 : 500);

    } catch (error: any) {
      console.error("Error completing task:", error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const getStatusIcon = (status: AnnualTaskWithStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'due':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: AnnualTaskWithStatus['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Erledigt</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Überfällig</Badge>;
      case 'due':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Fällig</Badge>;
      default:
        return <Badge variant="outline">Anstehend</Badge>;
    }
  };

  const getFunctionInfo = (functionName: string | null) => {
    if (!functionName) return null;
    return FUNCTION_DESCRIPTIONS[functionName] || null;
  };

  const handleGenerateStats = async () => {
    if (!currentTenant) return;
    setGeneratingStats(true);
    
    try {
      const { data, error } = await supabase.rpc(
        'generate_current_year_stats' as any,
        { p_tenant_id: currentTenant.id }
      );

      if (error) throw error;

      const result = data as ExecutionResult;
      toast({ 
        title: "Jahresstatistik erstellt", 
        description: `${result.affected_employees || 0} Mitarbeiter wurden aktualisiert.`
      });
    } catch (error: any) {
      console.error("Error generating stats:", error);
      toast({ 
        title: "Fehler", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setGeneratingStats(false);
    }
  };

  const handleGeneratePreviousYearStats = async () => {
    if (!currentTenant) return;
    setGeneratingPreviousStats(true);
    
    try {
      const { data, error } = await supabase.rpc(
        'generate_yearly_stats_for_year' as any,
        { p_tenant_id: currentTenant.id, p_year: currentYear - 1 }
      );

      if (error) throw error;

      const result = data as { success: boolean; year: number; affected_employees: number };
      toast({ 
        title: `Jahresstatistik ${currentYear - 1} erstellt`, 
        description: `${result.affected_employees || 0} Mitarbeiter wurden archiviert.`
      });
    } catch (error: any) {
      console.error("Error generating previous year stats:", error);
      toast({ 
        title: "Fehler", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setGeneratingPreviousStats(false);
    }
  };

  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const dueCount = tasks.filter(t => t.status === 'due').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Jährliche Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Jährliche Aufgaben {currentYear}
          </CardTitle>
          <CardDescription>
            Wiederkehrende Aufgaben die jedes Jahr anfallen
          </CardDescription>
          <div className="flex gap-2 mt-2 flex-wrap">
            {overdueCount > 0 && (
              <Badge variant="destructive">{overdueCount} überfällig</Badge>
            )}
            {dueCount > 0 && (
              <Badge variant="secondary">{dueCount} fällig</Badge>
            )}
            <Badge variant="outline">{completedCount}/{tasks.length} erledigt</Badge>
            <div className="flex gap-2 ml-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGeneratePreviousYearStats}
                disabled={generatingPreviousStats}
              >
                {generatingPreviousStats ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-3 w-3 mr-1" />
                    Statistik {currentYear - 1} erstellen
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateStats}
                disabled={generatingStats}
              >
                {generatingStats ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-3 w-3 mr-1" />
                    Statistik {currentYear} erstellen
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Keine jährlichen Aufgaben definiert
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
                      task.status === 'overdue' && "border-l-4 border-l-red-500",
                      task.status === 'due' && "border-l-4 border-l-orange-500",
                      task.status === 'completed' && "border-l-4 border-l-green-500"
                    )}
                  >
                    <div className="mt-0.5">
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-medium text-sm",
                          task.status === 'completed' && "line-through text-muted-foreground"
                        )}>
                          {task.title}
                        </span>
                        <Badge className={CATEGORY_COLORS[task.category] || ""}>
                          {CATEGORY_LABELS[task.category] || task.category}
                        </Badge>
                        {getStatusBadge(task.status)}
                        {task.auto_execute && (
                          <Badge variant="outline" className="gap-1">
                            <Zap className="h-3 w-3" />
                            Auto
                          </Badge>
                        )}
                        {task.execute_function && (
                          <Badge variant="outline" className="gap-1 text-blue-600">
                            <Zap className="h-3 w-3" />
                            Aktion
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Fällig: {MONTH_NAMES[task.due_month - 1]}
                        {task.due_day && `, ${task.due_day}.`}
                      </p>
                      {task.completion?.completed_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Erledigt am {format(new Date(task.completion.completed_at), "dd.MM.yyyy", { locale: de })}
                        </p>
                      )}
                    </div>
                    {task.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTask(task)}
                      >
                        {task.execute_function ? "Ausführen" : "Erledigen"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Completion Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null);
          setCompletionNotes("");
          setExecutionResult(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.execute_function ? (
                <>
                  <Zap className="h-5 w-5 text-blue-500" />
                  Aufgabe ausführen
                </>
              ) : (
                "Aufgabe als erledigt markieren"
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Task Description */}
            {selectedTask?.description && (
              <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
            )}

            {/* Function Actions Preview */}
            {selectedTask?.execute_function && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Info className="h-4 w-4" />
                  <span className="font-medium text-sm">Diese Aufgabe führt folgende Aktionen aus:</span>
                </div>
                <ul className="space-y-1.5 text-sm text-blue-600 dark:text-blue-400">
                  {getFunctionInfo(selectedTask.execute_function)?.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
                {affectedCount !== null && (
                  <div className="flex items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Betroffene Mitarbeiter: <strong>{affectedCount}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Execution Result */}
            {executionResult && (
              <div className={cn(
                "rounded-lg p-4",
                executionResult.success 
                  ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                  : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
              )}>
                <div className="flex items-center gap-2">
                  {executionResult.success ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                  <span className="font-medium">{executionResult.message}</span>
                </div>
                {executionResult.affected_employees !== undefined && (
                  <p className="text-sm mt-1">
                    {executionResult.affected_employees} Mitarbeiter betroffen
                  </p>
                )}
              </div>
            )}

            {/* Auto Execute Toggle */}
            {selectedTask?.is_system_task && selectedTask?.execute_function && !executionResult && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-execute" className="text-sm font-medium">
                      Automatisch ausführen
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Aufgabe wird automatisch zum Fälligkeitsdatum ausgeführt
                    </p>
                  </div>
                  <Switch
                    id="auto-execute"
                    checked={enableAutoExecute}
                    onCheckedChange={setEnableAutoExecute}
                  />
                </div>
              </>
            )}

            {/* Notes */}
            {!executionResult && (
              <div>
                <Label className="text-sm font-medium">Notizen (optional)</Label>
                <Textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Anmerkungen zur Erledigung..."
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            {!executionResult && (
              <>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  Abbrechen
                </Button>
                <Button onClick={handleMarkComplete} disabled={completing}>
                  {completing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird ausgeführt...
                    </>
                  ) : selectedTask?.execute_function ? (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Jetzt ausführen
                    </>
                  ) : (
                    "Als erledigt markieren"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
