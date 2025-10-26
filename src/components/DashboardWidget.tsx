import { useState, useEffect } from "react";
import { WidgetOverlayMenu } from './dashboard/WidgetOverlayMenu';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, CheckSquare, Clock, FileText, Phone, AlertCircle, Circle, GripVertical, MessageCircle, AlarmClock, Edit2 } from "lucide-react";
import { DashboardWidget as WidgetType } from '@/hooks/useDashboardLayout';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MessageSystem } from './MessageSystem';
import { BlackBoard } from './BlackBoard';
import { CombinedMessagesWidget } from './CombinedMessagesWidget';
import { NewsWidget } from '@/components/widgets/NewsWidget';
import { QuickNotesWidget } from '@/components/widgets/QuickNotesWidget';
import { PomodoroWidget } from '@/components/widgets/PomodoroWidget';
import { HabitsWidget } from '@/components/widgets/HabitsWidget';
import { CallLogWidget } from '@/components/widgets/CallLogWidget';
import { QuickActionsWidget } from '@/components/widgets/QuickActionsWidget';
import { AppointmentFeedbackWidget } from '@/components/dashboard/AppointmentFeedbackWidget';

interface WidgetProps {
  widget: WidgetType;
  isDragging?: boolean;
  isEditMode: boolean;
  onResize?: (widgetId: string, newSize: string) => void;
  onDelete?: (widgetId: string) => void;
}

interface QuickStats {
  todayMeetings: number;
  pendingTasks: number;
  newContacts: number;
  upcomingDeadlines: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  time: string;
  type: "meeting" | "appointment" | "deadline";
  location?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  due_date?: string;
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assigned_to?: string;
  progress?: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  call_log_id?: string;
}

interface Subtask {
  id: string;
  task_id: string;
  title?: string;
  description: string;
  is_completed: boolean;
  due_date?: string;
  assigned_to?: string;
  assigned_to_names?: string;
}

interface PendingTask {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  daysUntilDue: number;
  category: "deadline" | "meeting" | "follow-up" | "review";
}

// Sample data - in a real app this would come from props or context
const sampleStats: QuickStats = {
  todayMeetings: 4,
  pendingTasks: 12,
  newContacts: 3,
  upcomingDeadlines: 2,
};

const sampleEvents: UpcomingEvent[] = [
  {
    id: "1",
    title: "Ausschusssitzung Bildung",
    time: "10:00",
    type: "meeting",
    location: "Raum 204",
  },
  {
    id: "2",
    title: "Bürgersprechstunde",
    time: "14:30",
    type: "appointment",
    location: "Wahlkreisbüro",
  },
  {
    id: "3",
    title: "Stellungnahme Verkehrspolitik",
    time: "18:00",
    type: "deadline",
  },
];

const sampleTasks: PendingTask[] = [
  {
    id: "1",
    title: "Stellungnahme Verkehrspolitik",
    description: "Überarbeitung der Verkehrskonzepte für den Wahlkreis",
    priority: "high" as const,
    dueDate: "Heute",
    daysUntilDue: 0,
    category: "deadline" as const,
  },
  {
    id: "2", 
    title: "Nachfassgespräch Bürgerinitiative",
    description: "Follow-up mit Dr. Maria Schmidt bezüglich Verkehrsberuhigung",
    priority: "high" as const,
    daysUntilDue: 1,
    dueDate: "Morgen",
    category: "follow-up" as const,
  },
  {
    id: "3",
    title: "Vorbereitung Ausschusssitzung",
    description: "Unterlagen für Bildungsausschuss durchgehen",
    priority: "medium" as const,
    dueDate: "Fr, 24.01",
    daysUntilDue: 3,
    category: "meeting" as const,
  },
].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

const quickActions = [
  { label: "Neuer Termin", icon: Calendar, variant: "default" as const },
  { label: "Kontakt hinzufügen", icon: Users, variant: "secondary" as const },
  { label: "Aufgabe erstellen", icon: CheckSquare, variant: "secondary" as const },
];

const getPriorityColor = (priority: PendingTask["priority"]) => {
  switch (priority) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "medium": return "bg-government-gold text-foreground";
    case "low": return "bg-muted text-muted-foreground";
  }
};

const getCategoryIcon = (category: PendingTask["category"]) => {
  switch (category) {
    case "deadline": return AlertCircle;
    case "meeting": return Users;
    case "follow-up": return Phone;
    case "review": return FileText;
  }
};

export function DashboardWidget({ widget, isDragging, isEditMode, onResize, onDelete }: WidgetProps) {
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [assignedSubtasks, setAssignedSubtasks] = useState<Subtask[]>([]);
  const [taskSnoozes, setTaskSnoozes] = useState<{[key: string]: string}>({});
  const [subtaskSnoozes, setSubtaskSnoozes] = useState<{[key: string]: string}>({});
  const [users, setUsers] = useState<{[key: string]: string}>({});
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Helper function to check if a date is overdue
  const isOverdue = (dueDate: string) => {
    if (!dueDate || dueDate === '1970-01-01T00:00:00.000Z' || dueDate === '1970-01-01') {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Helper function to resolve user names
  const resolveUserNames = (assignedTo: string) => {
    if (!assignedTo) return '';
    const assignees = assignedTo.split(',').map(id => id.trim());
    return assignees.map(id => users[id] || id).join(', ');
  };

  // Load assigned tasks and subtasks
  const loadAssignedTasksAndSubtasks = async () => {
    if (!user) return;

    try {
      // Load users for name resolution
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, display_name');
      
      if (usersData) {
        const userMap: {[key: string]: string} = {};
        usersData.forEach(profile => {
          userMap[profile.user_id] = profile.display_name || profile.user_id;
        });
        setUsers(userMap);
      }

      // Load tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'completed')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (tasksData) {
        const userAssignedTasks = tasksData.filter(task => {
          if (!task.assigned_to) return false;
          const assignees = task.assigned_to.split(',').map((id: string) => id.trim());
          return assignees.includes(user.id) || 
                 assignees.includes(user.email) ||
                 assignees.includes(user.email?.toLowerCase());
        });
        setAssignedTasks(userAssignedTasks as Task[]);
      }

      // Load subtasks
      const { data: subtasksData } = await supabase
        .from('subtasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (subtasksData) {
        setAssignedSubtasks(subtasksData as Subtask[]);
      }

      // Load snoozes
      const { data: snoozesData } = await supabase
        .from('task_snoozes')
        .select('*')
        .eq('user_id', user.id)
        .gte('snoozed_until', new Date().toISOString());

      if (snoozesData) {
        const taskSnoozesMap: {[key: string]: string} = {};
        const subtaskSnoozesMap: {[key: string]: string} = {};
        
        snoozesData.forEach(snooze => {
          if (snooze.task_id) {
            taskSnoozesMap[snooze.task_id] = snooze.snoozed_until;
          }
          if (snooze.subtask_id) {
            subtaskSnoozesMap[snooze.subtask_id] = snooze.snoozed_until;
          }
        });
        
        setTaskSnoozes(taskSnoozesMap);
        setSubtaskSnoozes(subtaskSnoozesMap);
      }
    } catch (error) {
      console.error('Error loading assigned tasks and subtasks:', error);
    }
  };

  useEffect(() => {
    const fetchTodayAppointments = async () => {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('appointments')
        .select('id')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      if (!error && data) {
        setTodayAppointmentsCount(data.length);
      }
    };

    const fetchOpenTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id')
        .in('status', ['todo', 'in-progress']);

      if (!error && data) {
        setOpenTasksCount(data.length);
      }
    };

    fetchTodayAppointments();
    fetchOpenTasks();
    loadAssignedTasksAndSubtasks();
  }, [user]);

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'quicknotes':
        return <QuickNotesWidget configuration={widget.configuration} />;
      case 'pomodoro':
        return <PomodoroWidget configuration={widget.configuration} />;
      case 'habits':
        return <HabitsWidget configuration={widget.configuration} />;
      case 'calllog':
        return <CallLogWidget configuration={widget.configuration} />;
      case 'quickactions':
        return (
          <QuickActionsWidget 
            className="h-full" 
            widgetSize={widget.widgetSize}
            configuration={widget.configuration}
            onConfigurationChange={(config) => {
              // Update widget configuration if we have an update function
              console.log('Configuration changed for quickactions widget:', config);
            }}
          />
        );
      case 'stats':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Termine heute</CardTitle>
                <Calendar className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl font-bold text-primary">{todayAppointmentsCount}</div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Offene Aufgaben</CardTitle>
                <CheckSquare className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl font-bold text-primary">{openTasksCount}</div>
              </CardContent>
            </Card>
          </div>
        );

      case 'tasks':
        // Filter out snoozed tasks and subtasks
        const filteredAssignedTasks = assignedTasks.filter(task => {
          return !taskSnoozes[task.id] || new Date(taskSnoozes[task.id]) <= new Date();
        });
        
        const filteredAssignedSubtasks = assignedSubtasks.filter(subtask => {
          return !subtaskSnoozes[subtask.id] || new Date(subtaskSnoozes[subtask.id]) <= new Date();
        });

        const allItems = [
          ...filteredAssignedTasks.map(task => ({ ...task, type: 'task' })),
          ...filteredAssignedSubtasks.map(subtask => ({ ...subtask, type: 'subtask' }))
        ].slice(0, 6);

        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Keine ausstehenden Aufgaben
              </div>
            ) : (
              allItems.map((item) => {
                const isTask = item.type === 'task';
                const isSnoozed = isTask ? 
                  (taskSnoozes[item.id] && new Date(taskSnoozes[item.id]) > new Date()) :
                  (subtaskSnoozes[item.id] && new Date(subtaskSnoozes[item.id]) > new Date());

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors group ${isSnoozed ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isTask ? (item as any).status === "completed" : (item as any).is_completed}
                        onCheckedChange={async (checked) => {
                          if (checked) {
                            if (isTask) {
                              await supabase
                                .from('tasks')
                                .update({ status: 'completed' })
                                .eq('id', item.id);
                            } else {
                              await supabase
                                .from('subtasks')
                                .update({ is_completed: true })
                                .eq('id', item.id);
                            }
                            loadAssignedTasksAndSubtasks();
                          }
                        }}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-accent-foreground truncate">
                            {item.title || item.description}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={isTask ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"}
                          >
                            {isTask ? "Aufgabe" : "Unteraufgabe"}
                          </Badge>
                        </div>
                        {item.description && item.title && (
                          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                        )}
                        {!isTask && ((item as any).assigned_to_names || (item as any).assigned_to) && (
                          <div className="text-sm text-muted-foreground truncate">
                            Zuständig: {(item as any).assigned_to_names || resolveUserNames((item as any).assigned_to)}
                          </div>
                        )}
                        {isSnoozed && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Wiedervorlage: {new Date(isTask ? taskSnoozes[item.id] : subtaskSnoozes[item.id]).toLocaleDateString('de-DE')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        {item.due_date && (item.due_date !== '1970-01-01T00:00:00.000Z') && (item.due_date !== '1970-01-01') ? (
                          <div className={`text-sm font-medium ${
                            isOverdue(item.due_date) ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {new Date(item.due_date).toLocaleDateString('de-DE')}
                            {isOverdue(item.due_date) && (
                              <Circle className="inline-block ml-1 h-2 w-2 fill-destructive text-destructive" />
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">unbefristet</div>
                        )}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const snoozeDate = prompt('Wiedervorlage bis (YYYY-MM-DD):');
                              if (snoozeDate) {
                                try {
                                  await supabase
                                    .from('task_snoozes')
                                    .upsert({
                                      user_id: user?.id,
                                      [isTask ? 'task_id' : 'subtask_id']: item.id,
                                      snoozed_until: snoozeDate + 'T00:00:00.000Z'
                                    });
                                  loadAssignedTasksAndSubtasks();
                                  toast({
                                    title: "Wiedervorlage gesetzt",
                                    description: `${isTask ? 'Aufgabe' : 'Unteraufgabe'} wird bis ${new Date(snoozeDate).toLocaleDateString('de-DE')} ausgeblendet.`
                                  });
                                } catch (error) {
                                  console.error('Error setting snooze:', error);
                                }
                              }
                            }}
                            className="h-6 w-6 p-0"
                            title="Auf Wiedervorlage setzen"
                          >
                            <AlarmClock className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (isTask) {
                                window.location.href = `/tasks`;
                              } else {
                                window.location.href = `/tasks`;
                              }
                            }}
                            className="h-6 w-6 p-0"
                            title={isTask ? "Aufgabe bearbeiten" : "Übergeordnete Aufgabe bearbeiten"}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {allItems.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <Button 
                  variant="outline" 
                  className="w-full text-sm"
                  onClick={() => window.location.href = '/tasks'}
                >
                  Alle Aufgaben anzeigen
                </Button>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-4">
            {sampleEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-accent-foreground">{event.title}</span>
                    {event.location && (
                      <span className="text-sm text-muted-foreground">{event.location}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-accent-foreground">{event.time}</span>
                  {event.type === "meeting" && <Users className="h-4 w-4 text-primary" />}
                  {event.type === "appointment" && <Phone className="h-4 w-4 text-primary" />}
                  {event.type === "deadline" && <FileText className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        );

      case 'actions':
        return (
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                className="w-full justify-start gap-2 h-12"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        );

      case 'blackboard':
        return <BlackBoard />;
      case 'messages':
        return <MessageSystem />;
      case 'combined-messages':
        return <CombinedMessagesWidget configuration={widget.configuration} />;
      case 'news':
        return <NewsWidget widgetId={widget.id} />;
      case 'appointmentfeedback':
        return <AppointmentFeedbackWidget widgetSize={widget.widgetSize} isEditMode={isEditMode} />;

      default:
        return <div>Unbekanntes Widget</div>;
    }
  };

  // For new widget types that handle their own layout, render them directly
  if (['quicknotes', 'pomodoro', 'habits', 'calllog', 'combined-messages', 'quickactions', 'news', 'appointmentfeedback'].includes(widget.type)) {
    return (
      <div 
        className={`relative h-full w-full max-w-full overflow-hidden ${isDragging ? 'opacity-50 rotate-1' : ''} ${isEditMode ? 'cursor-move' : ''}`}
        draggable={isEditMode}
        style={{ 
          width: '100%', 
          height: '100%', 
          boxSizing: 'border-box'
        }}
      >
        {/* Edit Icon - nur im Edit-Modus sichtbar */}
        {isEditMode && !showOverlayMenu && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-50 h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-md hover:bg-accent"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setShowOverlayMenu(true);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            style={{ pointerEvents: 'all' }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}

        {/* Widget Overlay Menu */}
        {isEditMode && showOverlayMenu && (
          <WidgetOverlayMenu
            widget={widget}
            widgetSize={typeof widget.widgetSize === 'string' ? widget.widgetSize : typeof widget.size === 'string' ? widget.size : '2x2'}
            isVisible={showOverlayMenu}
            onClose={() => setShowOverlayMenu(false)}
            onResize={(widgetId, newSize) => {
              console.log('Overlay menu resize called:', widgetId, newSize);
              if (onResize) {
                onResize(widgetId, newSize);
                setShowOverlayMenu(false);
              } else {
                console.warn('No onResize function provided to DashboardWidget');
              }
            }}
            onMinimize={() => {}}
            onHide={() => {}}
            onDelete={onDelete || (() => console.log('Delete function not provided'))}
            onConfigure={() => {}}
          />
        )}

        
        <div className="w-full h-full overflow-hidden">
          {renderWidgetContent()}
        </div>
      </div>
    );
  }

  return (
    <Card 
      className={`relative bg-card shadow-card border-border h-full w-full max-w-full overflow-hidden ${
        isDragging ? 'rotate-3 shadow-lg' : 'hover:shadow-elegant'
      } transition-all duration-300 ${isEditMode ? 'cursor-move' : ''}`}
      draggable={isEditMode}
      
      style={{ 
        width: '100%', 
        height: '100%', 
        boxSizing: 'border-box'
      }}
    >
      {/* Edit Icon - nur im Edit-Modus sichtbar */}
      {isEditMode && !showOverlayMenu && (
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 z-50 h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-md hover:bg-accent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setShowOverlayMenu(true);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          style={{ pointerEvents: 'all' }}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}

      {/* Widget Overlay Menu */}
      {isEditMode && showOverlayMenu && (
        <WidgetOverlayMenu
          widget={widget}
          widgetSize={typeof widget.widgetSize === 'string' ? widget.widgetSize : typeof widget.size === 'string' ? widget.size : '2x2'}
          isVisible={showOverlayMenu}
          onClose={() => setShowOverlayMenu(false)}
          onResize={(widgetId, newSize) => {
            console.log('Card overlay menu resize called:', widgetId, newSize);
            if (onResize) {
              onResize(widgetId, newSize);
              setShowOverlayMenu(false);
            } else {
              console.warn('No onResize function provided to DashboardWidget');
            }
          }}
          onMinimize={() => {}}
          onHide={() => {}}
          onDelete={onDelete || (() => console.log('Delete function not provided'))}
          onConfigure={() => {}}
        />
      )}

      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 truncate">
            {isEditMode && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <span className="truncate">{widget.title}</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="w-full h-full overflow-hidden">
          {renderWidgetContent()}
        </div>
      </CardContent>
    </Card>
  );
}