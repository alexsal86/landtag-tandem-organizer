import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Search, Settings, ListTodo, Square, ChevronDown, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { TaskDetailSidebar } from '@/components/TaskDetailSidebar';
import { QuickNotesList } from '@/components/shared/QuickNotesList';
import SimpleRichTextEditor from '@/components/ui/SimpleRichTextEditor';

interface QuickNotesWidgetProps {
  className?: string;
  configuration?: {
    autoSave?: boolean;
    compact?: boolean;
    theme?: string;
  };
}

export const QuickNotesWidget: React.FC<QuickNotesWidgetProps> = ({ 
  className, 
  configuration = {} 
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [newNote, setNewNote] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [titleEditorKey, setTitleEditorKey] = useState(0);
  
  // Tasks state
  const [tasks, setTasks] = useState<Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    due_date?: string;
  }>>([]);
  const [subtasks, setSubtasks] = useState<{[taskId: string]: Array<{
    id: string;
    task_id: string;
    description?: string;
    is_completed: boolean;
    due_date?: string;
  }>}>({});
  const [selectedTask, setSelectedTask] = useState<{
    id: string;
    title: string;
    priority: string;
    status: string;
    due_date?: string;
  } | null>(null);
  const [taskSidebarOpen, setTaskSidebarOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(() => {
    if (typeof window === 'undefined' || !user) return true;
    const saved = localStorage.getItem(`quicknotes_showTasks_${user?.id}`);
    return saved ? saved === 'true' : true;
  });

  const { compact = false } = configuration;


  const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();
  const toEditorHtml = (value: string | null | undefined) => {
    if (!value) return '';
    if (/<[^>]+>/.test(value)) return value;
    return `<p>${value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</p>`;
  };

  const taskCategories = [
    { name: 'personal', label: 'Persönlich' },
    { name: 'legislation', label: 'Gesetzgebung' },
    { name: 'constituency', label: 'Wahlkreis' },
    { name: 'committee', label: 'Ausschuss' }
  ];

  const taskStatuses = [
    { name: 'todo', label: 'Zu erledigen' },
    { name: 'in-progress', label: 'In Bearbeitung' },
    { name: 'completed', label: 'Abgeschlossen' }
  ];

  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ];

  useEffect(() => {
    if (user) {
      loadTasks();
      
      const saved = localStorage.getItem(`quicknotes_settings_${user.id}`);
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setShowDeleteConfirmation(settings.showDeleteConfirmation ?? true);
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`quicknotes_showTasks_${user.id}`, showTasks.toString());
    }
  }, [showTasks, user]);

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, priority, status, due_date, description, category, assigned_to, progress')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        
        const { data: subtasksData, error: subtasksError } = await supabase
          .from('subtasks')
          .select('id, task_id, description, is_completed, due_date, assigned_to')
          .in('task_id', taskIds)
          .eq('is_completed', false)
          .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
          .order('order_index', { ascending: true });

        if (subtasksError) throw subtasksError;

        const groupedSubtasks: {[taskId: string]: any[]} = {};
        (subtasksData || []).forEach(subtask => {
          if (!groupedSubtasks[subtask.task_id]) {
            groupedSubtasks[subtask.task_id] = [];
          }
          groupedSubtasks[subtask.task_id].push(subtask);
        });

        setSubtasks(groupedSubtasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const createNote = async () => {
    const plainTitle = stripHtml(newTitle);
    const plainContent = newNote.trim();

    if (!user || (!plainTitle && !plainContent)) return;

    try {
      const { error } = await supabase
        .from('quick_notes')
        .insert({
          user_id: user.id,
          title: newTitle.trim() || undefined,
          content: plainContent,
          color: selectedColor,
          category: 'general'
        });

      if (error) throw error;

      setNewNote('');
      setNewTitle('');
      setTitleEditorKey(prev => prev + 1);
      setRefreshTrigger(prev => prev + 1);
      toast.success('Notiz erstellt');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Fehler beim Erstellen der Notiz');
    }
  };

  const saveSettings = (newValue: boolean) => {
    setShowDeleteConfirmation(newValue);
    if (user) {
      localStorage.setItem(
        `quicknotes_settings_${user.id}`,
        JSON.stringify({ showDeleteConfirmation: newValue })
      );
      toast.success('Einstellung gespeichert');
    }
  };

  const renderCompactTasks = () => {
    if (tasks.length === 0) return null;

    return (
      <div className="mt-4 pt-4 border-t">
        <Collapsible open={showTasks} onOpenChange={setShowTasks}>
          <CollapsibleTrigger className="flex items-center gap-1 w-full hover:bg-accent/50 rounded px-1 py-0.5">
            <ChevronDown className={`h-3 w-3 transition-transform ${showTasks ? '' : '-rotate-90'}`} />
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              Aufgaben ({tasks.length})
            </h4>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="space-y-1 mt-2">
              {tasks.map(task => (
                <div key={task.id} className="space-y-0.5">
                  <div 
                    className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-accent/50 cursor-pointer"
                    onClick={() => {
                      setSelectedTask(task as any);
                      setTaskSidebarOpen(true);
                    }}
                  >
                    <CheckSquare className="h-3 w-3 flex-shrink-0" />
                    <span className="flex-1 truncate">{task.title}</span>
                    {task.priority === 'high' && (
                      <Badge variant="destructive" className="h-4 text-[10px] px-1">!</Badge>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(task.due_date).toLocaleDateString('de-DE', { 
                          day: '2-digit', 
                          month: '2-digit' 
                        })}
                      </span>
                    )}
                  </div>

                  {subtasks[task.id] && subtasks[task.id].length > 0 && (
                    <div className="ml-5 space-y-0.5">
                      {subtasks[task.id].map(subtask => (
                        <div 
                          key={subtask.id} 
                          className="flex items-center gap-2 text-[11px] py-0.5 px-1 rounded hover:bg-accent/30 cursor-pointer text-muted-foreground"
                        >
                          <Square className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="flex-1 truncate">
                            {subtask.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Quick Notes</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-7 w-7 p-0"
              title="Einstellungen"
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={createNote}
              disabled={!newNote.trim() && !stripHtml(newTitle)}
              className="h-7 w-7 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-hidden pb-4">
        {/* Create Form */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          {!compact && (
            <SimpleRichTextEditor
              key={titleEditorKey}
              initialContent={toEditorHtml(newTitle)}
              onChange={setNewTitle}
              placeholder="Titel (@ für Mentions)"
              minHeight="36px"
              showToolbar={false}
            />
          )}
          <Textarea
            placeholder="Neue Notiz..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[100px] text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                createNote();
              }
            }}
          />
          
          {!compact && (
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-4 h-4 rounded-full border-2 ${
                      selectedColor === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes List (shared component) */}
        <QuickNotesList 
          refreshTrigger={refreshTrigger} 
          showHeader={false}
          maxHeight="300px"
        />

        {/* Tasks Section */}
        {renderCompactTasks()}
      </CardContent>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Notes Einstellungen</DialogTitle>
            <DialogDescription>
              Passe das Verhalten der Quick Notes an deine Bedürfnisse an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="delete-confirmation">Bestätigung vor dem Löschen</Label>
                <p className="text-sm text-muted-foreground">
                  Zeigt einen Bestätigungsdialog an, bevor Notizen gelöscht werden
                </p>
              </div>
              <Switch
                id="delete-confirmation"
                checked={showDeleteConfirmation}
                onCheckedChange={saveSettings}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sidebar */}
      <TaskDetailSidebar
        task={selectedTask as any}
        isOpen={taskSidebarOpen}
        onClose={() => {
          setTaskSidebarOpen(false);
          setSelectedTask(null);
          loadTasks();
        }}
        onTaskUpdate={(updatedTask) => {
          loadTasks();
          setSelectedTask(null);
          setTaskSidebarOpen(false);
        }}
        onTaskRestored={(restoredTask) => {
          loadTasks();
        }}
        taskCategories={taskCategories}
        taskStatuses={taskStatuses}
      />
    </Card>
  );
};
