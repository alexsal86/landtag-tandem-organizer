import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { useAppointmentCategories } from '@/hooks/useAppointmentCategories';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CheckCircle2,
  FileText,
  Paperclip,
  CheckSquare,
  Clock,
  MapPin,
  Loader2,
  Users,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import SimpleRichTextEditor from '@/components/ui/SimpleRichTextEditor';
import { AppointmentFeedbackSettings } from './AppointmentFeedbackSettings';
import { createFeedbackContext } from '@/types/feedbackContext';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';

interface AppointmentFeedbackWidgetProps {
  widgetSize?: string;
  isEditMode?: boolean;
}

interface TenantUser {
  user_id: string;
  display_name: string;
  role?: string;
}

export const AppointmentFeedbackWidget = ({
  widgetSize = '2x2',
  isEditMode = false
}: AppointmentFeedbackWidgetProps) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { appointments, settings, updateFeedback, refetch } = useAppointmentFeedback();
  const { data: categories } = useAppointmentCategories();

  const [noteText, setNoteText] = useState('');
  const [noteDialogOpen, setNoteDialogOpen] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssignAll, setTaskAssignAll] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFileAppointment, setActiveFileAppointment] = useState<{appointmentId: string; feedbackId: string} | null>(null);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('appointment-feedback-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointment_feedback',
        filter: `user_id=eq.${user.id}`
      }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refetch]);

  // Lade Tenant-Mitarbeiter für Aufgaben-Zuweisung
  const loadTenantUsers = useCallback(async () => {
    if (!currentTenant?.id || tenantUsers.length > 0) return;
    setLoadingUsers(true);
    try {
      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);

      if (!memberships?.length) return;

      const userIds = memberships.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const merged: TenantUser[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name || p.user_id,
        role: memberships.find(m => m.user_id === p.user_id)?.role
      }));
      setTenantUsers(merged);
    } finally {
      setLoadingUsers(false);
    }
  }, [currentTenant?.id, tenantUsers.length]);

  const pendingFeedbackCount = useMemo(() => {
    return appointments?.filter(a => a.feedback?.feedback_status === 'pending').length || 0;
  }, [appointments]);

  const sortedAppointments = useMemo(() => {
    if (!appointments) return [];
    return [...appointments]
      .filter(apt => apt.feedback && apt.feedback.feedback_status === 'pending')
      .sort((a, b) => (b.feedback?.priority_score || 0) - (a.feedback?.priority_score || 0));
  }, [appointments]);

  const handleMarkCompleted = async (feedbackId: string) => {
    updateFeedback({
      feedbackId,
      updates: {
        feedback_status: 'completed',
        completed_at: new Date().toISOString()
      }
    });
  };

  // Notification-Type ID for appointment_feedback
  const FEEDBACK_NOTIFICATION_TYPE_ID = 'c51a3c97-a10d-40f9-9900-1931479a89c8';

  const handleSaveNote = async (feedbackId: string, userName: string, appointmentTitle: string) => {
    if (!noteText || noteText === '<p></p>' || noteText.trim() === '') {
      toast({ title: 'Fehler', description: 'Bitte geben Sie eine Notiz ein.', variant: 'destructive' });
      return;
    }
    // Wrap note with username prefix
    const noteWithAuthor = `<p><strong>Rückmeldung ${userName}:</strong></p>${noteText}`;
    await updateFeedback({
      feedbackId,
      updates: {
        notes: noteWithAuthor,
        feedback_status: 'completed',
        completed_at: new Date().toISOString()
      }
    });

    // Send notifications to all other tenant members
    try {
      await loadTenantUsers();
      const otherUsers = tenantUsers.filter(u => u.user_id !== user?.id);
      if (otherUsers.length > 0) {
        const plainText = noteWithAuthor.replace(/<[^>]*>/g, '').slice(0, 120);
        const feedbackContext = createFeedbackContext(feedbackId, { type: 'feedback', id: feedbackId });
        await Promise.all(
          otherUsers.map(u =>
            supabase.rpc('create_notification', {
              user_id_param: u.user_id,
              type_name: 'appointment_feedback',
              title_param: `Rückmeldung: ${appointmentTitle}`,
              message_param: plainText,
              priority_param: 'medium',
              data_param: JSON.stringify({
                navigation_context: `mywork?tab=feedbackfeed&highlight=${feedbackId}`,
                feedback_id: feedbackId,
                feedback_context: feedbackContext,
              }),
            })
          )
        );
      }
    } catch (err) {
      // Non-critical – don't block save if notifications fail
      debugConsole.error('Failed to send feedback notifications:', err);
    }

    setNoteText('');
    setNoteDialogOpen(null);
    toast({ title: 'Notiz gespeichert', description: 'Die Rückmeldung wurde am Termin gespeichert und alle Mitarbeiter wurden benachrichtigt.' });
  };

  const handleFileUpload = async (appointmentId: string, feedbackId: string, file: File) => {
    if (!user?.id || !currentTenant?.id) return;
    setIsUploading(true);
    try {
      const filePath = `${currentTenant.id}/${appointmentId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      await updateFeedback({
        feedbackId,
        updates: {
          has_documents: true,
          feedback_status: 'completed',
          completed_at: new Date().toISOString()
        }
      });
      toast({
        title: 'Anhang hochgeladen',
        description: `${file.name} wurde gespeichert. Sie finden ihn in Ihren Dokumenten.`
      });
    } catch (error) {
      toast({ title: 'Upload fehlgeschlagen', description: 'Das Dokument konnte nicht hochgeladen werden.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setActiveFileAppointment(null);
    }
  };

  const handleCreateTask = async (feedbackId: string, appointmentTitle: string) => {
    if (!taskTitle.trim()) {
      toast({ title: 'Fehler', description: 'Bitte geben Sie einen Aufgabentitel ein.', variant: 'destructive' });
      return;
    }
    if (!user?.id || !currentTenant?.id) return;

    try {
      // Sammle alle Mitarbeiter-IDs (außer dem aktuellen Benutzer, der sowieso erstellt)
      const mitarbeiterIds = tenantUsers.map(u => u.user_id);
      // assigned_to als komma-separierte Liste aller Mitarbeiter
      const assignedToValue = mitarbeiterIds.join(',');

      const { data: createdTask, error } = await supabase
        .from('tasks')
        .insert([{
          title: taskTitle,
          description: taskDescription || `Follow-up zu Termin: ${appointmentTitle}`,
          category: 'follow-up',
          user_id: user.id,
          tenant_id: currentTenant.id,
          assigned_to: assignedToValue,
          due_date: taskDueDate || null,
          status: 'todo',
          priority: taskPriority,
          source_type: 'appointment_feedback',
          source_id: feedbackId,
        }])
        .select('id')
        .single();

      if (error) throw error;

      await updateFeedback({
        feedbackId,
        updates: {
          has_tasks: true,
          feedback_status: 'completed',
          completed_at: new Date().toISOString()
        }
      });
      const createdTaskId = createdTask?.id;
      const feedbackContext = createFeedbackContext(feedbackId, {
        type: createdTaskId ? 'task' : 'feedback',
        id: createdTaskId || feedbackId,
      });

      await Promise.allSettled(
        tenantUsers
          .filter((member) => member.user_id !== user.id)
          .map((member) =>
            supabase.rpc('create_notification', {
              user_id_param: member.user_id,
              type_name: 'appointment_feedback',
              title_param: `Aufgabe aus Rückmeldung: ${appointmentTitle}`,
              message_param: taskTitle,
              priority_param: 'medium',
              data_param: JSON.stringify({
                navigation_context: createdTaskId
                  ? `tasks?highlight=${createdTaskId}&feedback_id=${feedbackId}`
                  : `mywork?tab=feedbackfeed&highlight=${feedbackId}`,
                feedback_id: feedbackId,
                task_id: createdTaskId,
                feedback_context: feedbackContext,
              }),
            }),
          ),
      );

      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setTaskPriority('medium');
      setTaskDialogOpen(null);

      toast({
        title: 'Aufgabe erstellt',
        description: `Die Aufgabe wurde erstellt und an alle ${mitarbeiterIds.length} Mitarbeiter zugewiesen.`
      });
    } catch (error) {
      toast({ title: 'Fehler', description: 'Die Aufgabe konnte nicht erstellt werden.', variant: 'destructive' });
    }
  };

  const getCategoryColor = (categoryName?: string) => {
    if (!categoryName) return '#3b82f6';
    const category = categories?.find(c => c.name === categoryName);
    return category?.color || '#3b82f6';
  };

  const getCategoryLabel = (categoryName?: string) => {
    if (!categoryName) return 'Externer Termin';
    const category = categories?.find(c => c.name === categoryName);
    return category?.label || categoryName;
  };

  // Benutzername für Notiz-Präfix
  const [displayName, setDisplayName] = useState('');
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || user.email?.split('@')[0] || 'Nutzer'));
  }, [user?.id]);

  if (sortedAppointments.length === 0) {
    const allAreCompleted = appointments?.every(apt =>
      apt.feedback?.feedback_status === 'completed' || apt.feedback?.feedback_status === 'skipped'
    );

    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="relative">
              <CheckCircle2 className="w-5 h-5" />
              {pendingFeedbackCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] rounded-full"
                >
                  {pendingFeedbackCount}
                </Badge>
              )}
            </div>
            Termin-Feedback
            <div className="ml-auto">
              <AppointmentFeedbackSettings />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
            {allAreCompleted && appointments && appointments.length > 0 ? (
              <>
                <p className="text-sm font-medium text-foreground">Alle Feedbacks erledigt! 🎉</p>
                <p className="text-xs mt-1">Erledigte Termine werden 24h angezeigt</p>
              </>
            ) : (
              <>
                <p className="text-sm">Keine offenen Termine für Feedback</p>
                <p className="text-xs mt-1">Neue Termine erscheinen hier automatisch</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Termin-Feedback
          <div className="ml-auto">
            <AppointmentFeedbackSettings />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-3">
            {sortedAppointments.map((appointment) => {
              const feedback = appointment.feedback;
              if (!feedback) return null;
              const isCompleted = feedback.feedback_status === 'completed';

              return (
                <div
                  key={appointment.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isCompleted
                      ? 'bg-muted/30 border-muted'
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base truncate mb-1">
                        {appointment.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(appointment.start_time), 'HH:mm', { locale: de })} –{' '}
                        {format(new Date(appointment.end_time), 'HH:mm', { locale: de })}
                        {appointment.location && (
                          <>
                            <MapPin className="w-3 h-3 ml-1" />
                            <span className="truncate">{appointment.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {appointment.event_type === 'external_event' ? (
                      <Badge variant="outline" className="text-xs shrink-0">📅 Externer Kalender</Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs shrink-0"
                        style={{
                          backgroundColor: `${getCategoryColor(appointment.category)}20`,
                          color: getCategoryColor(appointment.category)
                        }}
                      >
                        {getCategoryLabel(appointment.category)}
                      </Badge>
                    )}
                  </div>

                  {isCompleted ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Feedback abgeschlossen</span>
                      {feedback.notes && <span className="ml-2">• Notiz vorhanden</span>}
                      {feedback.has_documents && <span className="ml-2">• Anhang vorhanden</span>}
                      {feedback.has_tasks && <span className="ml-2">• Aufgabe erstellt</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      {/* Erledigt – links, abgetrennt */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkCompleted(feedback.id)}
                        className="h-8 text-primary hover:text-primary/80"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Erledigt
                      </Button>

                      <div className="h-5 w-px bg-border mx-1" />

                      {/* Notiz Dialog */}
                      <Dialog
                        open={noteDialogOpen === appointment.id}
                        onOpenChange={(open) => {
                          setNoteDialogOpen(open ? appointment.id : null);
                          if (!open) setNoteText('');
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8">
                            <FileText className="w-4 h-4 mr-1" />
                            Notiz
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Rückmeldung zu „{appointment.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Die Rückmeldung wird unter Ihrem Namen am Termin gespeichert und ist in den Termindetails einsehbar.
                            </p>
                            <div className="border rounded-md min-h-[150px]">
                              <SimpleRichTextEditor
                                initialContent={noteText}
                                onChange={setNoteText}
                                placeholder="Was möchten Sie festhalten? (@Erwähnung möglich)"
                                minHeight="150px"
                                showToolbar={true}
                              />
                            </div>
                            <Button
                              onClick={() => handleSaveNote(feedback.id, displayName, appointment.title)}
                              className="w-full"
                            >
                              Rückmeldung speichern
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Aufgabe Dialog */}
                      <Dialog
                        open={taskDialogOpen === appointment.id}
                        onOpenChange={(open) => {
                          if (open) {
                            loadTenantUsers();
                            setTaskTitle(`Follow-up: ${appointment.title}`);
                          }
                          setTaskDialogOpen(open ? appointment.id : null);
                          if (!open) {
                            setTaskTitle('');
                            setTaskDescription('');
                            setTaskDueDate('');
                            setTaskPriority('medium');
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8">
                            <CheckSquare className="w-4 h-4 mr-1" />
                            Aufgabe
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Aufgabe zu „{appointment.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="task-title">Titel</Label>
                              <Input
                                id="task-title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Aufgabentitel..."
                              />
                            </div>
                            <div>
                              <Label>Beschreibung</Label>
                              <div className="border rounded-md min-h-[120px] mt-1">
                                <SimpleRichTextEditor
                                  initialContent={taskDescription}
                                  onChange={setTaskDescription}
                                  placeholder="Was ist zu tun? (@Erwähnung möglich)"
                                  minHeight="120px"
                                  showToolbar={true}
                                />
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <Label htmlFor="task-priority">Priorität</Label>
                                <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}>
                                  <SelectTrigger id="task-priority" className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Niedrig</SelectItem>
                                    <SelectItem value="medium">Mittel</SelectItem>
                                    <SelectItem value="high">Hoch</SelectItem>
                                    <SelectItem value="urgent">Dringend</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Label htmlFor="task-due">Fällig am</Label>
                                <Input
                                  id="task-due"
                                  type="date"
                                  value={taskDueDate}
                                  onChange={(e) => setTaskDueDate(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <div className="bg-muted/50 rounded-md p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Zuweisung</span>
                              </div>
                              {loadingUsers ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Lade Mitarbeiter...
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Diese Aufgabe wird an alle {tenantUsers.length} Mitarbeiter des Teams zugewiesen.
                                </p>
                              )}
                            </div>

                            <Button
                              onClick={() => handleCreateTask(feedback.id, appointment.title)}
                              className="w-full"
                              disabled={loadingUsers}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              Aufgabe an alle erstellen
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Anhang */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && activeFileAppointment) {
                            handleFileUpload(activeFileAppointment.appointmentId, activeFileAppointment.feedbackId, file);
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveFileAppointment({ appointmentId: appointment.id, feedbackId: feedback.id });
                          fileInputRef.current?.click();
                        }}
                        disabled={isUploading}
                        title="Dokument anhängen – wird in Ihren Dokumenten gespeichert und dem Termin zugeordnet"
                        className="h-8"
                      >
                        {isUploading && activeFileAppointment?.feedbackId === feedback.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4 mr-1" />
                        )}
                        Anhang
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
