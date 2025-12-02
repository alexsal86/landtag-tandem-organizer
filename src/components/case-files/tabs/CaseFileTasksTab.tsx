import { useState, useEffect } from "react";
import { CaseFileTask } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckSquare, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CaseFileTasksTabProps {
  tasks: CaseFileTask[];
  onAdd: (taskId: string, notes?: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function CaseFileTasksTab({ tasks, onAdd, onRemove }: CaseFileTasksTabProps) {
  const { currentTenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (dialogOpen && currentTenant) {
      loadTasks();
    }
  }, [dialogOpen, currentTenant]);

  const loadTasks = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setAvailableTasks(data || []);
  };

  const handleAdd = async () => {
    if (!selectedTaskId) return;
    setIsSubmitting(true);
    const success = await onAdd(selectedTaskId, notes || undefined);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setSelectedTaskId(null);
      setNotes("");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'todo': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Erledigt';
      case 'in_progress': return 'In Bearbeitung';
      case 'todo': return 'Offen';
      default: return status;
    }
  };

  const filteredTasks = availableTasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedTaskIds = tasks.map(t => t.task_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Verknüpfte Aufgaben
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Aufgabe hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Aufgaben verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckSquare className={cn(
                    "h-5 w-5",
                    item.task?.status === 'completed' ? "text-green-500" : "text-muted-foreground"
                  )} />
                  <div>
                    <div className={cn(
                      "font-medium",
                      item.task?.status === 'completed' && "line-through text-muted-foreground"
                    )}>
                      {item.task?.title}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {item.task?.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.task.due_date), 'dd.MM.yyyy', { locale: de })}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-white", getStatusColor(item.task?.status || ''))}>
                    {getStatusLabel(item.task?.status || '')}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aufgabe verknüpfen</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Aufgabe aus, die mit dieser FallAkte verknüpft werden soll.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Aufgabe suchen</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredTasks
                    .filter(task => !linkedTaskIds.includes(task.id))
                    .map((task) => (
                      <div
                        key={task.id}
                        className={`p-2 rounded cursor-pointer hover:bg-muted ${selectedTaskId === task.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{task.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        {task.due_date && (
                          <div className="text-xs text-muted-foreground">
                            Fällig: {format(new Date(task.due_date), 'dd.MM.yyyy', { locale: de })}
                          </div>
                        )}
                      </div>
                    ))}
                  {filteredTasks.filter(task => !linkedTaskIds.includes(task.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine verfügbaren Aufgaben gefunden
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="grid gap-2">
              <Label>Notizen (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={!selectedTaskId || isSubmitting}>
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
