import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import SimpleRichTextEditor from '@/components/ui/SimpleRichTextEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { createFeedbackContext } from '@/types/feedbackContext';
import { debugConsole } from '@/utils/debugConsole';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ArrowLeft,
  FileDown,
  StickyNote,
  ListTodo,
  CheckCircle2,
  Loader2,
  Clock,
  MapPin,
  Calendar,
  Plus,
  Check,
} from 'lucide-react';

interface CreatedTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
}

export default function BriefingLivePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const preparationId = searchParams.get('preparationId') || undefined;
  const appointmentId = searchParams.get('appointmentId') || undefined;

  const { preparation, loading: prepLoading } = useAppointmentPreparation(preparationId);

  // Fetch appointment info
  const { data: appointmentInfo } = useQuery({
    queryKey: ['briefing-live-appointment', appointmentId ?? preparation?.appointment_id],
    queryFn: async () => {
      const id = appointmentId ?? preparation?.appointment_id;
      if (!id) return null;
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, location, category')
        .eq('id', id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!(appointmentId || preparation?.appointment_id),
    staleTime: 5 * 60_000,
  });

  // Notes state
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [createdTasks, setCreatedTasks] = useState<CreatedTask[]>([]);
  const [taskSaving, setTaskSaving] = useState(false);

  // Feedback completed state
  const [feedbackCompleted, setFeedbackCompleted] = useState(false);
  const [completingSaving, setCompletingSaving] = useState(false);

  // Display name
  const { data: displayName } = useQuery({
    queryKey: ['briefing-live-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', user!.id).maybeSingle();
      return data?.display_name || user?.email?.split('@')[0] || 'Nutzer';
    },
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
  });

  const effectiveAppointmentId = appointmentId ?? preparation?.appointment_id;

  const ensureFeedbackCompleted = useCallback(async (): Promise<string | null> => {
    if (!user?.id || !currentTenant?.id || !effectiveAppointmentId) return null;

    const { data: existing } = await supabase
      .from('appointment_feedback')
      .select('id, feedback_status')
      .eq('appointment_id', effectiveAppointmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      if (existing.feedback_status !== 'completed') {
        await supabase.from('appointment_feedback').update({
          feedback_status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      }
      return existing.id;
    }

    const { data: newFeedback } = await supabase
      .from('appointment_feedback')
      .insert({
        appointment_id: effectiveAppointmentId,
        user_id: user.id,
        tenant_id: currentTenant.id,
        feedback_status: 'completed',
        completed_at: new Date().toISOString(),
        priority_score: 0,
      })
      .select('id')
      .single();

    return newFeedback?.id ?? null;
  }, [user?.id, currentTenant?.id, effectiveAppointmentId]);

  const handleSaveNote = async () => {
    if (!noteText || noteText === '<p></p>') {
      toast({ title: 'Fehler', description: 'Bitte geben Sie eine Notiz ein.', variant: 'destructive' });
      return;
    }
    setNoteSaving(true);
    try {
      const feedbackId = await ensureFeedbackCompleted();
      if (!feedbackId) throw new Error('Feedback konnte nicht erstellt werden');

      const noteWithAuthor = `<p><strong>Rückmeldung ${displayName}:</strong></p>${noteText}`;
      await supabase.from('appointment_feedback').update({
        notes: noteWithAuthor,
        updated_at: new Date().toISOString(),
      }).eq('id', feedbackId);

      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      setNoteSaved(true);
      toast({ title: 'Notiz gespeichert', description: 'Ihre Rückmeldung wurde gespeichert.' });
    } catch (err) {
      debugConsole.error('Error saving note:', err);
      toast({ title: 'Fehler', description: 'Notiz konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      toast({ title: 'Fehler', description: 'Bitte geben Sie einen Aufgabentitel ein.', variant: 'destructive' });
      return;
    }
    if (!user?.id || !currentTenant?.id) return;
    setTaskSaving(true);
    try {
      const feedbackId = await ensureFeedbackCompleted();

      const { data: created, error } = await supabase.from('tasks').insert({
        title: taskTitle,
        description: taskDescription || `Follow-up zu Termin: ${appointmentInfo?.title || preparation?.title || ''}`,
        category: 'personal',
        user_id: user.id,
        tenant_id: currentTenant.id,
        due_date: taskDueDate || null,
        status: 'todo',
        priority: taskPriority,
        source_type: feedbackId ? 'appointment_feedback' : null,
        source_id: feedbackId,
      }).select('id').single();

      if (error) throw error;

      if (feedbackId) {
        await supabase.from('appointment_feedback').update({
          has_tasks: true,
          updated_at: new Date().toISOString(),
        }).eq('id', feedbackId);
      }

      setCreatedTasks(prev => [...prev, {
        id: created.id,
        title: taskTitle,
        priority: taskPriority,
        due_date: taskDueDate || null,
      }]);

      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setTaskPriority('medium');
      toast({ title: 'Aufgabe erstellt' });
    } catch (err) {
      debugConsole.error('Error creating task:', err);
      toast({ title: 'Fehler', description: 'Aufgabe konnte nicht erstellt werden.', variant: 'destructive' });
    } finally {
      setTaskSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    setCompletingSaving(true);
    try {
      await ensureFeedbackCompleted();
      setFeedbackCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      toast({ title: 'Termin als erledigt markiert' });
    } catch (err) {
      debugConsole.error('Error marking completed:', err);
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setCompletingSaving(false);
    }
  };

  const priorityLabels: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };

  if (prepLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!preparation) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Briefing nicht gefunden.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Zurück
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1">LIVE BRIEFING</h1>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => navigate(`/appointment-preparation/${preparation.id}`)}
        >
          <FileDown className="h-4 w-4 mr-1" />
          Detail
        </Button>
      </div>

      {/* Appointment info bar */}
      {appointmentInfo && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <h2 className="font-semibold text-base mb-1">{appointmentInfo.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(appointmentInfo.start_time), 'EEEE, dd. MMMM', { locale: de })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(appointmentInfo.start_time), 'HH:mm', { locale: de })}
                {' – '}
                {format(new Date(appointmentInfo.end_time), 'HH:mm', { locale: de })}
              </span>
              {appointmentInfo.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {appointmentInfo.location}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Briefing View */}
      <AppointmentBriefingView
        preparation={preparation}
        appointmentInfo={appointmentInfo ? {
          title: appointmentInfo.title,
          start_time: appointmentInfo.start_time,
          end_time: appointmentInfo.end_time,
          location: appointmentInfo.location,
        } : undefined}
      />

      <Separator />

      {/* Inline Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            Meine Notizen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-md min-h-[120px]">
            <SimpleRichTextEditor
              initialContent={noteText}
              onChange={setNoteText}
              placeholder="Notizen zum Termin …"
              minHeight="120px"
              showToolbar
            />
          </div>
          <Button
            onClick={handleSaveNote}
            disabled={noteSaving}
            className="w-full h-12 text-base"
          >
            {noteSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : noteSaved ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <StickyNote className="h-4 w-4 mr-2" />
            )}
            {noteSaved ? 'Erneut speichern' : 'Notiz speichern'}
          </Button>
        </CardContent>
      </Card>

      {/* Inline Task Creation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" />
            Aufgabe erstellen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Titel</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Aufgabentitel …"
              className="h-12 text-base mt-1"
            />
          </div>
          <div>
            <Label>Beschreibung (optional)</Label>
            <Input
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Details …"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priorität</Label>
              <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as 'low' | 'medium' | 'high')}>
                <SelectTrigger className="mt-1 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fällig am</Label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="mt-1 h-11"
              />
            </div>
          </div>
          <Button
            onClick={handleCreateTask}
            disabled={taskSaving}
            variant="outline"
            className="w-full h-12 text-base"
          >
            {taskSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Aufgabe erstellen
          </Button>

          {/* Created tasks list */}
          {createdTasks.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Erstellte Aufgaben</p>
              {createdTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{priorityLabels[t.priority] || t.priority}</span>
                  {t.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.due_date), 'dd.MM.', { locale: de })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Mark as completed */}
      <Button
        onClick={handleMarkCompleted}
        disabled={completingSaving || feedbackCompleted}
        className="w-full h-14 text-base"
        variant={feedbackCompleted ? 'outline' : 'default'}
      >
        {completingSaving ? (
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        ) : (
          <CheckCircle2 className="h-5 w-5 mr-2" />
        )}
        {feedbackCompleted ? 'Termin als erledigt markiert ✓' : 'Termin als erledigt markieren'}
      </Button>
    </div>
  );
}
