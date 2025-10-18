import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, Pin, Tag, Palette, Search, CheckSquare, Settings, ListTodo, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { TaskDetailSidebar } from '@/components/TaskDetailSidebar';

interface QuickNote {
  id: string;
  title?: string;
  content: string;
  category: string;
  color: string;
  is_pinned: boolean;
  tags: string[];
  task_id?: string;
  created_at: string;
  updated_at: string;
}

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
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout>();
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

  const { autoSave = true, compact = false } = configuration;

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
      loadNotes();
      loadTasks();
      
      // Load settings from localStorage
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
    if (autoSave && editingNote) {
      // Clear existing timeout
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
      
      // Set new timeout for auto-save
      autoSaveRef.current = setTimeout(() => {
        handleSaveEdit();
      }, 2000);
    }

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [newNote, newTitle, editingNote, autoSave]);

  const loadNotes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Fehler beim Laden der Notizen');
    } finally {
      setLoading(false);
    }
  };

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
    if (!user || !newNote.trim()) return;

    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .insert({
          user_id: user.id,
          title: newTitle.trim() || undefined,
          content: newNote.trim(),
          color: selectedColor,
          category: 'general'
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      setNewNote('');
      setNewTitle('');
      toast.success('Notiz erstellt');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Fehler beim Erstellen der Notiz');
    }
  };

  const updateNote = async (id: string, updates: Partial<QuickNote>) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, ...updates } : note
      ));
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Fehler beim Aktualisieren der Notiz');
    }
  };

  const handleDeleteClick = (id: string) => {
    if (showDeleteConfirmation) {
      setNoteToDelete(id);
      setDeleteDialogOpen(true);
    } else {
      confirmDelete(id);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== id));
      toast.success('Notiz gelöscht');
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Fehler beim Löschen der Notiz');
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

  const togglePin = (id: string, currentPinned: boolean) => {
    updateNote(id, { is_pinned: !currentPinned });
  };

  const handleSaveEdit = () => {
    if (editingNote && newNote.trim()) {
      updateNote(editingNote, { 
        content: newNote.trim(),
        title: newTitle.trim() || undefined
      });
      setEditingNote(null);
      setNewNote('');
      setNewTitle('');
    }
  };

  const startEdit = (note: QuickNote) => {
    setEditingNote(note.id);
    setNewNote(note.content);
    setNewTitle(note.title || '');
    setSelectedColor(note.color);
  };

  const createTaskFromNote = async (note: QuickNote) => {
    if (!user) {
      toast.error('Nicht angemeldet');
      return;
    }

    if (!currentTenant) {
      toast.error('Kein Tenant ausgewählt');
      return;
    }

    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: note.title || note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
          description: note.content,
          category: 'personal',
          priority: 'medium',
          status: 'todo',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assigned_to: user.id,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Link the note to the task
      await updateNote(note.id, { task_id: task.id });

      toast.success('Aufgabe erstellt und dir zugewiesen', {
        description: 'Die Notiz ist jetzt als Aufgabe verfügbar'
      });
    } catch (error) {
      console.error('Error creating task from note:', error);
      toast.error('Fehler beim Erstellen der Aufgabe');
    }
  };

  const filteredNotes = notes
    .filter(note => !note.task_id)
    .filter(note =>
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.title && note.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const renderCompactTasks = () => {
    if (tasks.length === 0) return null;

    return (
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <ListTodo className="h-3 w-3" />
          Aufgaben ({tasks.length})
        </h4>
        
        <div className="space-y-1">
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
      </div>
    );
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Quick Notes</CardTitle>
          <div className="flex items-center gap-2">
            {!compact && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 w-24 pl-7 text-xs"
                />
              </div>
            )}
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
              onClick={() => editingNote ? handleSaveEdit() : createNote()}
              disabled={!newNote.trim()}
              className="h-7 w-7 p-0"
            >
              {editingNote ? <Save className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto pb-4 min-h-[500px]">
        {/* Create/Edit Form */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          {!compact && (
            <Input
              placeholder="Titel (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-xs"
            />
          )}
          <Textarea
            placeholder="Neue Notiz..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[140px] text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                editingNote ? handleSaveEdit() : createNote();
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
              
              {editingNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingNote(null);
                    setNewNote('');
                    setNewTitle('');
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Abbrechen
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Laden...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              {searchTerm ? 'Keine Notizen gefunden' : 'Noch keine Notizen vorhanden'}
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                style={{ borderLeftColor: note.color, borderLeftWidth: '3px' }}
                onClick={() => !editingNote && startEdit(note)}
              >
                <div className="flex items-start justify-between gap-2 min-h-[120px]">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex-1">
                      {note.title && (
                        <h4 className="font-medium text-sm truncate mb-1">
                          {note.title}
                        </h4>
                      )}
                      <p className={`text-xs text-muted-foreground ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
                        {note.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/40">
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                      {note.task_id && (
                        <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600">
                          Mit Aufgabe verknüpft
                        </Badge>
                      )}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1">
                          {note.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    {!note.task_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          createTaskFromNote(note);
                        }}
                        className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600"
                        title="Als Aufgabe erstellen"
                      >
                        <CheckSquare className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(note.id, note.is_pinned);
                      }}
                      className={`h-6 w-6 p-0 ${note.is_pinned ? 'text-amber-500' : ''}`}
                    >
                      <Pin className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(note.id);
                      }}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Notiz wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => noteToDelete && confirmDelete(noteToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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