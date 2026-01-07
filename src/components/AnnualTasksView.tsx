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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, CheckCircle2, Clock, AlertTriangle, RefreshCcw } from "lucide-react";
import { format, isPast, isSameMonth } from "date-fns";
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

export function AnnualTasksView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AnnualTaskWithStatus[]>([]);
  const [selectedTask, setSelectedTask] = useState<AnnualTaskWithStatus | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    loadTasks();
  }, [currentTenant]);

  const loadTasks = async () => {
    if (!currentTenant) return;
    setLoading(true);

    try {
      // Load annual tasks - use any type since table might not be in types yet
      const { data: tasksData, error: tasksError } = await supabase
        .from("annual_tasks" as any)
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("due_month", { ascending: true }) as { data: AnnualTask[] | null; error: any };

      if (tasksError) throw tasksError;

      // Load completions for current year
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

      // Calculate status for each task
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

      setTasks(tasksWithStatus);
    } catch (error) {
      console.error("Error loading annual tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTask || !user) return;
    setCompleting(true);

    try {
      const { error } = await supabase
        .from("annual_task_completions" as any)
        .upsert({
          annual_task_id: selectedTask.id,
          year: currentYear,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: completionNotes || null,
        }, {
          onConflict: 'annual_task_id,year'
        });

      if (error) throw error;

      toast({ title: "Aufgabe als erledigt markiert" });
      setSelectedTask(null);
      setCompletionNotes("");
      loadTasks();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ title: "Fehler", variant: "destructive" });
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
          <div className="flex gap-2 mt-2">
            {overdueCount > 0 && (
              <Badge variant="destructive">{overdueCount} überfällig</Badge>
            )}
            {dueCount > 0 && (
              <Badge variant="secondary">{dueCount} fällig</Badge>
            )}
            <Badge variant="outline">{completedCount}/{tasks.length} erledigt</Badge>
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
                        Erledigen
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Completion Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aufgabe als erledigt markieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-medium">{selectedTask?.title}</p>
              <p className="text-sm text-muted-foreground">{selectedTask?.description}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Notizen (optional)</label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Anmerkungen zur Erledigung..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleMarkComplete} disabled={completing}>
              {completing ? "Speichern..." : "Als erledigt markieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
