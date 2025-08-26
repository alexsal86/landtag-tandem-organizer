import { useState, useEffect } from "react";
import { Archive, Trash2, Download, Settings, Calendar, Flag, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArchivedTask {
  id: string;
  task_id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  category: "legislation" | "constituency" | "committee" | "personal";
  assigned_to?: string;
  progress?: number;
  due_date: string;
  completed_at: string;
  archived_at: string;
  auto_delete_after_days?: number;
}

interface ArchiveSettings {
  auto_delete_after_days?: number;
}

export function TaskArchiveView() {
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([]);
  const [archiveSettings, setArchiveSettings] = useState<ArchiveSettings>({});
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadArchivedTasks();
    loadArchiveSettings();
  }, []);

  const loadArchivedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('archived_tasks')
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) throw error;
      // Convert database format to component format
      const formattedTasks: ArchivedTask[] = (data || []).map(task => ({
        id: task.id,
        task_id: task.task_id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as ArchivedTask['priority'],
        category: task.category as ArchivedTask['category'],
        assigned_to: task.assigned_to || undefined,
        progress: task.progress || undefined,
        due_date: task.due_date,
        completed_at: task.completed_at,
        archived_at: task.archived_at,
        auto_delete_after_days: task.auto_delete_after_days || undefined,
      }));
      
      setArchivedTasks(formattedTasks);
    } catch (error) {
      console.error('Error loading archived tasks:', error);
      toast({
        title: "Fehler",
        description: "Archivierte Aufgaben konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadArchiveSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('task_archive_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setArchiveSettings(data || {});
    } catch (error) {
      console.error('Error loading archive settings:', error);
    }
  };

  const handleArchiveSettingsChange = async (value: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newSettings = {
        auto_delete_after_days: value === "never" ? null : parseInt(value)
      };

      const { error } = await supabase
        .from('task_archive_settings')
        .upsert({
          user_id: user.id,
          auto_delete_after_days: newSettings.auto_delete_after_days,
        });

      if (error) throw error;

      setArchiveSettings(newSettings);
      toast({
        title: "Einstellungen gespeichert",
        description: "Archiv-Einstellungen wurden automatisch aktualisiert.",
      });
    } catch (error) {
      console.error('Error saving archive settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteArchivedTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('archived_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setArchivedTasks(prev => prev.filter(t => t.id !== taskId));
      toast({
        title: "Aufgabe gelöscht",
        description: "Die archivierte Aufgabe wurde endgültig gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting archived task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const exportArchivedTasks = () => {
    const csvContent = [
      ['Titel', 'Beschreibung', 'Priorität', 'Kategorie', 'Zugewiesen an', 'Fälligkeitsdatum', 'Abgeschlossen am', 'Archiviert am'].join(','),
      ...archivedTasks.map(task => [
        `"${task.title}"`,
        `"${task.description || ''}"`,
        task.priority,
        task.category,
        `"${task.assigned_to || ''}"`,
        task.due_date,
        task.completed_at,
        task.archived_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archived_tasks_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority: ArchivedTask["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-government-gold text-white";
      case "low":
        return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryColor = (category: ArchivedTask["category"]) => {
    switch (category) {
      case "legislation":
        return "bg-primary text-primary-foreground";
      case "committee":
        return "bg-government-blue text-white";
      case "constituency":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "personal":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTaskDeleteInfo = (task: ArchivedTask) => {
    if (!archiveSettings.auto_delete_after_days) {
      return `Archiviert: ${formatDate(task.archived_at)}`;
    }

    const archivedDate = new Date(task.archived_at);
    const deleteDate = new Date(archivedDate.getTime() + (archiveSettings.auto_delete_after_days * 24 * 60 * 60 * 1000));
    const now = new Date();
    const daysUntilDeletion = Math.max(0, Math.ceil((deleteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    if (daysUntilDeletion === 0) {
      return `Wird heute gelöscht`;
    } else if (daysUntilDeletion === 1) {
      return `Wird morgen gelöscht`;
    } else {
      return `Wird in ${daysUntilDeletion} Tagen gelöscht`;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Lade Archiv...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Archive className="h-8 w-8" />
              Aufgaben-Archiv
            </h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre abgeschlossenen und archivierten Aufgaben
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportArchivedTasks} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Select 
              value={archiveSettings.auto_delete_after_days?.toString() || "never"} 
              onValueChange={handleArchiveSettingsChange}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Automatisches Löschen nach..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Niemals löschen</SelectItem>
                <SelectItem value="30">30 Tage</SelectItem>
                <SelectItem value="90">90 Tage</SelectItem>
                <SelectItem value="180">180 Tage</SelectItem>
                <SelectItem value="365">1 Jahr</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{archivedTasks.length}</div>
            <div className="text-sm text-muted-foreground">Archivierte Aufgaben</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {archivedTasks.filter(t => t.priority === "high").length}
            </div>
            <div className="text-sm text-muted-foreground">Hohe Priorität</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {archivedTasks.filter(t => 
                archiveSettings.auto_delete_after_days && 
                new Date(t.archived_at).getTime() + (archiveSettings.auto_delete_after_days * 24 * 60 * 60 * 1000) < Date.now()
              ).length}
            </div>
            <div className="text-sm text-muted-foreground">Ablaufend</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {new Set(archivedTasks.map(t => t.category)).size}
            </div>
            <div className="text-sm text-muted-foreground">Kategorien</div>
          </CardContent>
        </Card>
      </div>

      {/* Archived Tasks List */}
      <div className="space-y-4">
        {archivedTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Keine archivierten Aufgaben</h3>
              <p className="text-muted-foreground">
                Abgeschlossene Aufgaben werden automatisch hier archiviert.
              </p>
            </CardContent>
          </Card>
        ) : (
          archivedTasks.map((task) => (
            <Card key={task.id} className="bg-card shadow-card border-border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-muted-foreground line-through">
                        {task.title}
                      </h3>
                      <Badge className={getPriorityColor(task.priority)} variant="secondary">
                        <Flag className="h-3 w-3 mr-1" />
                        {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
                      </Badge>
                      <Badge className={getCategoryColor(task.category)} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {task.category === "legislation" ? "Gesetzgebung" : 
                         task.category === "committee" ? "Ausschuss" :
                         task.category === "constituency" ? "Wahlkreis" : "Persönlich"}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-muted-foreground mb-3">{task.description}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Abgeschlossen: {formatDate(task.completed_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Archive className="h-4 w-4" />
                        {getTaskDeleteInfo(task)}
                      </div>
                      {task.assigned_to && (
                        <div>Zugewiesen an: {task.assigned_to}</div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteArchivedTask(task.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}