import { useState, useEffect } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { normalizeTaskAssigneeIds, serializeLegacyTaskAssignees, syncTaskAssignees } from "@/lib/taskAssignees";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { Plus, Filter, Archive, AlarmClock, Calendar, User, ChevronDown, ChevronRight, ListTodo, Paperclip, StickyNote, MessageCircle, Edit2, Trash2, Check, X, Send, Download } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { AssignedItemsSection } from "./tasks/AssignedItemsSection";
import { LetterSourceLink } from "@/components/letters/LetterSourceLink";
import { extractLetterSourceId, stripLetterSourceMarker } from "@/utils/letterSource";
import { buildFeedbackBackLink } from "@/types/feedbackContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TaskDetailSidebar } from "./TaskDetailSidebar";
import { TaskDecisionCreator } from "./task-decisions/TaskDecisionCreator";
import { TaskDecisionStatus } from "./task-decisions/TaskDecisionStatus";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { NewItemIndicator } from "./NewItemIndicator";

import { useTasksData } from "./tasks/hooks/useTasksData";
import { useTaskOperations } from "./tasks/hooks/useTaskOperations";
import { TaskDialogs } from "./tasks/TaskDialogs";
import type { Task } from "./tasks/types";

export function TasksView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isHighlighted, highlightRef, highlightId } = useNotificationHighlight();
  const { toast } = useToast();
  const { isItemNew } = useNewItemIndicators('tasks');

  const data = useTasksData();
  const ops = useTaskOperations({
    tasks: data.tasks, setTasks: data.setTasks,
    user: data.user, currentTenant: data.currentTenant,
    loadTasks: data.loadTasks, loadTaskComments: data.loadTaskComments,
    loadTaskSnoozes: data.loadTaskSnoozes, loadAssignedSubtasks: data.loadAssignedSubtasks,
    loadTodos: data.loadTodos, loadAllSnoozes: data.loadAllSnoozes,
    assignedSubtasks: data.assignedSubtasks,
  });

  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [showSubtasksFor, setShowSubtasksFor] = useState<string | null>(null);
  const [showDocumentsFor, setShowDocumentsFor] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<{ [taskId: string]: string }>({});
  const [commentEditorKeys, setCommentEditorKeys] = useState<{ [taskId: string]: number }>({});
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState<{ type: 'task' | 'subtask'; id: string } | null>(null);
  const [snoozeManagementOpen, setSnoozeManagementOpen] = useState(false);
  const [todoCreateOpen, setTodoCreateOpen] = useState(false);
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [quickNoteDialog, setQuickNoteDialog] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [hideSnoozeSubtasks, setHideSnoozeSubtasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hideSnoozeSubtasks') || 'false'); } catch { return false; }
  });

  useEffect(() => {
    if (snoozeManagementOpen) data.loadAllSnoozes();
  }, [snoozeManagementOpen]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-task') {
      setTodoCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  // Auto-open archive or show not-found toast when highlight ID isn't in active tasks
  useEffect(() => {
    if (!highlightId || data.tasks.length === 0) return;
    const found = data.tasks.some(t => t.id === highlightId);
    if (found) return;

    // Check archived_tasks
    supabase.from("archived_tasks").select("id").eq("task_id", highlightId).maybeSingle().then(({ data: archived }) => {
      if (archived) {
        setArchiveModalOpen(true);
      } else {
        toast({
          title: "Element nicht gefunden",
          description: "Diese Aufgabe existiert nicht mehr oder wurde gelöscht.",
          variant: "destructive",
        });
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("highlight");
          return next;
        }, { replace: true });
      }
    });
  }, [highlightId, data.tasks]);

  const handleTaskClick = (task: Task) => { setSelectedTask(task); setSidebarOpen(true); };
  const handleToggleHideSnoozeSubtasks = (hide: boolean) => {
    setHideSnoozeSubtasks(hide);
    try { localStorage.setItem('hideSnoozeSubtasks', JSON.stringify(hide)); } catch {}
  };

  const feedbackFilterId = searchParams.get('feedback_id');
  const filteredTasks = data.tasks
    .filter(task => { if (feedbackFilterId && !(task.source_type === 'appointment_feedback' && task.source_id === feedbackFilterId)) return false; if (filter === "all") return true; if (filter === "pending") return task.status === "todo" || task.status === "in-progress"; if (filter === "overdue") return task.dueDate ? isOverdue(task.dueDate) : false; return task.status === filter; })
    .filter(task => categoryFilter === "all" || task.category === categoryFilter)
    .filter(task => priorityFilter === "all" || task.priority === priorityFilter)
    .filter(task => task.category !== 'call_follow_up' && task.category !== 'call_followup');

  const assignedTasks = data.tasks.filter(task => {
    if (!task.assignedTo || !data.user) return false;
    const assignees = task.assignedTo.split(',').map(id => id.trim());
    return (assignees.includes(data.user.id) || assignees.includes(data.user.email || '')) && task.status !== 'completed';
  });

  const filteredTasksWithSnooze = filteredTasks.filter(task => !data.taskSnoozes[task.id] || new Date(data.taskSnoozes[task.id]) <= new Date());

  return (
    <>
      <div className="min-h-screen bg-gradient-subtle p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Aufgaben</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Verwalten Sie Ihre Aufgaben und To-Dos effizient</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button className="gap-2 min-h-[44px] flex-1 sm:flex-none" onClick={() => window.location.href = '/tasks/new'}>
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">Neue Aufgabe</span><span className="sm:hidden">Aufgabe</span>
                </Button>
                <Button className="gap-2 min-h-[44px] flex-1 sm:flex-none" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTodoCreateOpen(true); }}>
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">Neues ToDo</span><span className="sm:hidden">ToDo</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2 min-h-[44px] flex-1 sm:flex-none" onClick={() => setArchiveModalOpen(true)}>
                  <Archive className="h-4 w-4" /><span className="hidden sm:inline">Aufgaben-Archiv</span><span className="sm:hidden">Archiv</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 min-h-[44px] flex-1 sm:flex-none" onClick={() => setSnoozeManagementOpen(true)}>
                  <AlarmClock className="h-4 w-4" /><span className="hidden sm:inline">Wiedervorlagen</span><span className="sm:hidden">WV</span>
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 whitespace-nowrap"><Filter className="h-4 w-4" /><span className="text-sm font-medium">Filter:</span></div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] min-h-[44px]"><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="legislation">Gesetzgebung</SelectItem>
                <SelectItem value="committee">Ausschuss</SelectItem>
                <SelectItem value="constituency">Wahlkreis</SelectItem>
                <SelectItem value="personal">Persönlich</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px] min-h-[44px]"><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assigned Items Section */}
        <AssignedItemsSection
          tasks={assignedTasks}
          subtasks={data.assignedSubtasks}
          todos={data.todos}
          taskSnoozes={data.taskSnoozes}
          subtaskSnoozes={data.subtaskSnoozes}
          hideSnoozeSubtasks={hideSnoozeSubtasks}
          onToggleHideSnoozeSubtasks={handleToggleHideSnoozeSubtasks}
          onTaskToggleComplete={ops.toggleTaskStatus}
          onSubtaskToggleComplete={(subtaskId, completed) => { if (completed) { setCompletingSubtask(subtaskId); } else { ops.handleSubtaskComplete(subtaskId, false); } }}
          onTodoToggleComplete={(todoId, completed) => { if (completed) ops.completeTodo(todoId); }}
          onTaskSnooze={(taskId) => { setSnoozeDialogOpen({ type: 'task', id: taskId }); }}
          onSubtaskSnooze={(subtaskId) => { setSnoozeDialogOpen({ type: 'subtask', id: subtaskId }); }}
          onTaskEdit={(task) => handleTaskClick(task)}
          onSubtaskEdit={(subtask) => { const parentTask = data.tasks.find(t => t.id === subtask.task_id); if (parentTask) handleTaskClick(parentTask); }}
          resolveUserNames={data.resolveUserNames}
        />

        {/* Main Tasks List */}
        <div className="space-y-4">
          {data.loading ? (
            <div className="text-center py-8"><div className="text-muted-foreground">Lade Aufgaben...</div></div>
          ) : filteredTasksWithSnooze.length === 0 ? (
            <Card><CardContent className="text-center py-12"><div className="text-muted-foreground mb-4">Keine Aufgaben vorhanden</div><Button><Plus className="h-4 w-4 mr-2" />Erste Aufgabe hinzufügen</Button></CardContent></Card>
          ) : (
            filteredTasksWithSnooze.map((task) => {
              const taskSourceLetterId = extractLetterSourceId(task.description) || extractLetterSourceId(task.title);
              const cleanTaskTitle = stripLetterSourceMarker(task.title);
              const cleanTaskDescription = stripLetterSourceMarker(task.description);
              return (
                <Card key={task.id} ref={highlightRef(task.id)} className={`hover:shadow-md transition-shadow cursor-pointer relative ${isHighlighted(task.id) ? 'notification-highlight' : ''}`} onClick={() => handleTaskClick(task)}>
                  <NewItemIndicator isVisible={isItemNew(task.id, task.created_at || '')} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={task.status === "completed"} onCheckedChange={() => ops.toggleTaskStatus(task.id)} onClick={(e) => e.stopPropagation()} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground text-lg">{cleanTaskTitle || task.title}</h3>
                            {cleanTaskDescription && <RichTextDisplay content={cleanTaskDescription} className="mt-1 leading-relaxed" />}
                            {taskSourceLetterId && <div className="mt-2"><LetterSourceLink letterId={taskSourceLetterId} /></div>}
                            {task.source_type === 'appointment_feedback' && task.source_id && (
                              <div className="mt-2"><Button variant="link" className="h-auto px-0 text-xs" onClick={(e) => { e.stopPropagation(); window.location.href = buildFeedbackBackLink(task.source_id!); }}>aus Rückmeldung erstellt</Button></div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setQuickNoteDialog({ open: true, taskId: task.id }); }} title="Quick Note erstellen"><StickyNote className="h-4 w-4" /></Button>
                            <TaskDecisionCreator taskId={task.id} onDecisionCreated={() => { data.loadTasks(); window.location.reload(); }} />
                            <Badge variant="secondary">{task.category === "legislation" ? "Gesetzgebung" : task.category === "committee" ? "Ausschuss" : task.category === "constituency" ? "Wahlkreis" : task.category === "call_followup" ? "Call Follow-up" : "Persönlich"}</Badge>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><div className={`w-3 h-3 rounded-full ${task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} /></TooltipTrigger><TooltipContent><p>{task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}</p></TooltipContent></Tooltip></TooltipProvider>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('de-DE') : 'unbefristet'}</span></div>
                          {(data.subtaskCounts[task.id] || 0) > 0 && (
                            <div className="flex items-center gap-1 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); if (showSubtasksFor === task.id) { setShowSubtasksFor(null); } else { data.loadSubtasksForTask(task.id); setShowSubtasksFor(task.id); } }}>
                              {showSubtasksFor === task.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<ListTodo className="h-4 w-4" /><span>{data.subtaskCounts[task.id]} Unteraufgaben</span>
                            </div>
                          )}
                          {(data.taskDocuments[task.id] || 0) > 0 && (
                            <div className="flex items-center gap-1 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); if (showDocumentsFor === task.id) setShowDocumentsFor(null); else { data.loadTaskDocuments(); setShowDocumentsFor(task.id); } }}>
                              {showDocumentsFor === task.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<Paperclip className="h-4 w-4" /><span>{data.taskDocuments[task.id]} Dokumente</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); setSnoozeDialogOpen({ type: 'task', id: task.id }); }} title="Auf Wiedervorlage setzen"><AlarmClock className="h-4 w-4" /><span>Wiedervorlage</span></div>
                          {task.assignedTo && task.assignedTo.trim() && (
                            <div className="flex items-center gap-1"><User className="h-4 w-4" /><span>{task.assignedTo.split(',').map(userId => data.users.find(u => u.user_id === userId.trim())?.display_name || userId.trim()).join(', ')}</span></div>
                          )}
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); setShowCommentsFor(showCommentsFor === task.id ? null : task.id); }}>
                            {showCommentsFor === task.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<MessageCircle className="h-4 w-4" /><span>Kommentare ({(data.taskComments[task.id] || []).length})</span>
                          </div>
                        </div>

                        {/* Expandable Subtasks */}
                        {showSubtasksFor === task.id && data.subtasks[task.id] && (
                          <div className="mt-4 space-y-3 animate-fade-in">
                            <div className="border border-dashed border-border rounded-lg p-3">
                              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={(e) => {
                                e.stopPropagation();
                                const title = prompt('Titel der Unteraufgabe:');
                                if (title && data.user) {
                                  (async () => {
                                    try {
                                      const tenantId = task.tenant_id || data.currentTenant?.id;
                                      if (!tenantId) throw new Error('Missing tenant_id');
                                      const { data: authData } = await supabase.auth.getUser(); const userId = authData.user!.id; const assigneeIds = normalizeTaskAssigneeIds(task.assignedTo || userId); const { data: createdSubtask, error } = await supabase.from('tasks').insert([{ title, description: null, status: 'todo', priority: task.priority || 'medium', category: task.category || 'personal', user_id: userId, tenant_id: tenantId, assigned_to: serializeLegacyTaskAssignees(assigneeIds) || userId, parent_task_id: task.id }]).select('id').single();
                                      if (error) throw error;
                                      await syncTaskAssignees({ taskId: createdSubtask.id, assigneeIds, assignedBy: userId });
                                      data.loadSubtasksForTask(task.id);
                                      data.loadSubtaskCounts();
                                      toast({ title: "Unteraufgabe hinzugefügt" });
                                    } catch (error) { debugConsole.error('Error adding subtask:', error); toast({ title: "Fehler", description: "Unteraufgabe konnte nicht hinzugefügt werden.", variant: "destructive" }); }
                                  })();
                                }
                              }}><Plus className="h-4 w-4" />Unteraufgabe hinzufügen</Button>
                            </div>
                            <div className="space-y-0">
                              {data.subtasks[task.id].map((subtask) => {
                                const subtaskSourceLetterId = extractLetterSourceId(subtask.title);
                                const cleanSubtaskTitle = stripLetterSourceMarker(subtask.title);
                                return (
                                  <div key={subtask.id} className="group/subtask ml-4 border border-border rounded-lg p-4 bg-muted/20">
                                    <div className="flex items-start gap-3">
                                      <Checkbox checked={subtask.is_completed} onCheckedChange={async (checked) => {
                                        const isChecked = checked === true;
                                        try {
                                          const { error } = await supabase.from('tasks').update({ status: isChecked ? 'completed' : 'todo' }).eq('id', subtask.id);
                                          if (error) throw error;
                                          data.loadSubtasksForTask(task.id);
                                          if (isChecked) ops.setShowCelebration(true);
                                          toast({ title: isChecked ? "Unteraufgabe erledigt" : "Unteraufgabe wieder geöffnet" });
                                        } catch (error) { debugConsole.error('Error:', error); toast({ title: "Fehler", variant: "destructive" }); }
                                      }} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-sm ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>{cleanSubtaskTitle || subtask.title}</span>
                                        {subtaskSourceLetterId && <LetterSourceLink letterId={subtaskSourceLetterId} className="ml-2 h-5 text-xs" />}
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                          {subtask.assigned_to && subtask.assigned_to.length > 0 && <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>{data.resolveUserNames(subtask.assigned_to)}</span></div>}
                                          {subtask.due_date && <div>Fällig: {new Date(subtask.due_date).toLocaleDateString('de-DE')}</div>}
                                        </div>
                                      </div>
                                      <div className="flex gap-1 opacity-0 pointer-events-none transition-opacity group-hover/subtask:opacity-100 group-hover/subtask:pointer-events-auto">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); const newTitle = prompt('Neuer Titel:', subtask.title); if (newTitle) { (async () => { try { await supabase.from('tasks').update({ title: newTitle }).eq('id', subtask.id); data.loadSubtasksForTask(task.id); toast({ title: "Unteraufgabe aktualisiert" }); } catch { toast({ title: "Fehler", variant: "destructive" }); } })(); } }} title="Bearbeiten"><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={async (e) => { e.stopPropagation(); if (confirm('Unteraufgabe wirklich löschen?')) { try { await supabase.from('tasks').delete().eq('id', subtask.id); data.loadSubtasksForTask(task.id); data.loadSubtaskCounts(); toast({ title: "Unteraufgabe gelöscht" }); } catch { toast({ title: "Fehler", variant: "destructive" }); } } }} title="Löschen"><Trash2 className="h-4 w-4" /></Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Expandable Documents */}
                        {showDocumentsFor === task.id && data.taskDocumentDetails[task.id] && (
                          <div className="mt-4 space-y-2 animate-fade-in">
                            <div className="border border-dashed border-border rounded-lg p-3 text-center">
                              <Button variant="outline" size="sm" className="gap-2" onClick={(e) => {
                                e.stopPropagation();
                                const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,.doc,.docx,.txt,.jpg,.png';
                                input.onchange = async (event) => {
                                  const file = (event.target as HTMLInputElement).files?.[0];
                                  if (file && data.user) {
                                    try { await supabase.from('task_documents').insert([{ task_id: task.id, user_id: data.user.id, file_name: file.name, file_path: `tasks/${task.id}/${file.name}`, file_type: file.type, file_size: file.size }]); data.loadTaskDocuments(); data.loadTaskDocumentCounts(); toast({ title: "Dokument hinzugefügt" }); } catch { toast({ title: "Fehler", variant: "destructive" }); }
                                  }
                                }; input.click();
                              }}><Plus className="h-4 w-4" />Dokument hinzufügen</Button>
                            </div>
                            {data.taskDocumentDetails[task.id].map((doc: any) => (
                              <div key={doc.id} className="flex items-center gap-2 text-sm border border-border rounded p-3">
                                <Paperclip className="h-4 w-4" /><span className="flex-1">{doc.file_name}</span>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} title="Herunterladen"><Download className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={async (e) => { e.stopPropagation(); try { await supabase.from('task_documents').delete().eq('id', doc.id); data.loadTaskDocuments(); data.loadTaskDocumentCounts(); toast({ title: "Dokument gelöscht" }); } catch { toast({ title: "Fehler", variant: "destructive" }); } }} title="Löschen"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Expandable Comments */}
                        {showCommentsFor === task.id && (
                          <div className="mt-4 space-y-3 animate-fade-in">
                            <div className="border border-border rounded-lg p-3 bg-muted/10">
                              <div className="space-y-2">
                                <SimpleRichTextEditor
                                  initialContent={newComment[task.id] || ""}
                                  contentVersion={`${task.id}-${commentEditorKeys[task.id] || 0}`}
                                  onChange={(value) => setNewComment(prev => ({ ...prev, [task.id]: value }))}
                                  placeholder="Kommentar hinzufügen..."
                                  minHeight="60px"
                                />
                                <div className="flex justify-end">
                                  <Button onClick={async () => { const success = await ops.addComment(task.id, newComment[task.id] || ''); if (success) { setNewComment(prev => ({ ...prev, [task.id]: "" })); setCommentEditorKeys(prev => ({ ...prev, [task.id]: (prev[task.id] || 0) + 1 })); } }} disabled={!newComment[task.id]?.trim()} size="sm"><Send className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            </div>
                            {data.taskComments[task.id]?.map((comment) => (
                              <div key={comment.id} className="border border-border rounded-lg p-3 bg-muted/20">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-medium text-sm">{comment.userName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {comment.userId === data.user?.id && (
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingComment(prev => ({ ...prev, [comment.id]: comment.content }))}><Edit2 className="h-3 w-3" /></Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={async () => { try { await supabase.from('task_comments').delete().eq('id', comment.id); data.loadTaskComments(); toast({ title: "Kommentar gelöscht" }); } catch { toast({ title: "Fehler", variant: "destructive" }); } }}><Trash2 className="h-3 w-3" /></Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingComment[comment.id] !== undefined ? (
                                  <div className="space-y-2">
                                    <SimpleRichTextEditor initialContent={editingComment[comment.id]} onChange={(value) => setEditingComment(prev => ({ ...prev, [comment.id]: value }))} minHeight="60px" />
                                    <div className="flex justify-end gap-1">
                                      <Button size="sm" className="h-8" onClick={async () => { try { await supabase.from('task_comments').update({ content: editingComment[comment.id] }).eq('id', comment.id); setEditingComment(prev => { const { [comment.id]: _, ...rest } = prev; return rest; }); data.loadTaskComments(); toast({ title: "Kommentar aktualisiert" }); } catch { toast({ title: "Fehler", variant: "destructive" }); } }}><Check className="h-3 w-3" /></Button>
                                      <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingComment(prev => { const { [comment.id]: _, ...rest } = prev; return rest; })}><X className="h-3 w-3" /></Button>
                                    </div>
                                  </div>
                                ) : (
                                  <RichTextDisplay content={comment.content} className="text-sm" />
                                )}
                              </div>
                            )) || <div className="text-sm text-muted-foreground text-center py-4">Keine Kommentare vorhanden</div>}
                          </div>
                        )}

                        <TaskDecisionStatus taskId={task.id} createdBy={task.user_id || ''} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <TaskDetailSidebar
        task={selectedTask}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onTaskUpdate={(updatedTask) => data.setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))}
        onTaskRestored={() => data.loadTasks()}
        taskCategories={data.taskCategories}
        taskStatuses={data.taskStatuses}
      />

      <TaskDialogs
        archiveModalOpen={archiveModalOpen}
        setArchiveModalOpen={setArchiveModalOpen}
        onTaskRestored={() => data.loadTasks()}
        snoozeDialogOpen={snoozeDialogOpen}
        setSnoozeDialogOpen={setSnoozeDialogOpen}
        onSnoozeSubmit={(type, id, snoozeUntil) => { if (type === 'task') ops.snoozeTask(id, snoozeUntil); else ops.snoozeSubtask(id, snoozeUntil); }}
        snoozeManagementOpen={snoozeManagementOpen}
        setSnoozeManagementOpen={setSnoozeManagementOpen}
        allSnoozes={data.allSnoozes}
        onUpdateSnooze={ops.updateSnooze}
        onDeleteSnooze={ops.deleteSnooze}
        hideSnoozeSubtasks={hideSnoozeSubtasks}
        onToggleHideSnoozeSubtasks={handleToggleHideSnoozeSubtasks}
        completingSubtask={completingSubtask}
        setCompletingSubtask={setCompletingSubtask}
        onSubtaskComplete={ops.handleSubtaskComplete}
        todoCreateOpen={todoCreateOpen}
        setTodoCreateOpen={setTodoCreateOpen}
        onTodoCreated={() => data.loadTodos()}
        quickNoteDialog={quickNoteDialog}
        setQuickNoteDialog={setQuickNoteDialog}
        onCreateQuickNote={ops.createQuickNoteFromTask}
        showCelebration={ops.showCelebration}
        onCelebrationComplete={() => ops.setShowCelebration(false)}
      />
    </>
  );
}
