import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ClipboardList,
  ChevronDown,
  StickyNote,
  ListTodo,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import SimpleRichTextEditor from '@/components/ui/SimpleRichTextEditor';
import { createFeedbackContext } from '@/types/feedbackContext';
import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import type { AppointmentData } from '@/hooks/useDashboardAppointmentsData';

interface Props {
  appointments: AppointmentData[];
  isShowingTomorrow: boolean;
}

export function DashboardAppointmentList({ appointments, isShowingTomorrow }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const [openBriefings, setOpenBriefings] = useState<Set<string>>(new Set());
  const [noteDialogAppointment, setNoteDialogAppointment] = useState<AppointmentData | null>(null);
  const [taskDialogAppointment, setTaskDialogAppointment] = useState<AppointmentData | null>(null);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Fetch preparations for displayed appointments
  const appointmentIds = useMemo(() => appointments.map(a => a.id), [appointments]);

  const { data: preparationsMap } = useQuery({
    queryKey: ['dashboard-briefing-preparations', appointmentIds],
    queryFn: async () => {
      if (appointmentIds.length === 0) return new Map<string, AppointmentPreparation>();
      const { data, error } = await supabase
        .from('appointment_preparations')
        .select('*')
        .in('appointment_id', appointmentIds)
        .eq('is_archived', false);

      if (error) return new Map<string, AppointmentPreparation>();

      const map = new Map<string, AppointmentPreparation>();
      for (const row of data || []) {
        map.set(row.appointment_id, {
          id: row.id,
          title: row.title,
          status: row.status,
          notes: row.notes,
          appointment_id: row.appointment_id,
          template_id: row.template_id,
          tenant_id: row.tenant_id,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_archived: row.is_archived,
          archived_at: row.archived_at,
          preparation_data: (row.preparation_data as AppointmentPreparation['preparation_data']) ?? {},
          checklist_items: (row.checklist_items as AppointmentPreparation['checklist_items']) ?? [],
        });
      }
      return map;
    },
    enabled: appointmentIds.length > 0,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Fetch display name for note prefix
  const { data: displayName } = useQuery({
    queryKey: ['dashboard-profile-name', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', user!.id).maybeSingle();
      return data?.display_name || user?.email?.split('@')[0] || 'Nutzer';
    },
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
  });

  const ensureFeedbackCompleted = useCallback(async (appointmentId: string) => {
    if (!user?.id || !currentTenant?.id) return null;

    // Check if feedback entry already exists
    const { data: existing } = await supabase
      .from('appointment_feedback')
      .select('id, feedback_status')
      .eq('appointment_id', appointmentId)
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

    // Create new feedback entry as completed
    const { data: newFeedback } = await supabase
      .from('appointment_feedback')
      .insert({
        appointment_id: appointmentId,
        user_id: user.id,
        tenant_id: currentTenant.id,
        feedback_status: 'completed',
        completed_at: new Date().toISOString(),
        priority_score: 0,
      })
      .select('id')
      .single();

    return newFeedback?.id ?? null;
  }, [user?.id, currentTenant?.id]);

  const handleSaveNote = async () => {
    if (!noteDialogAppointment || !noteText || noteText === '<p></p>') {
      toast({ title: 'Fehler', description: 'Bitte geben Sie eine Notiz ein.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const feedbackId = await ensureFeedbackCompleted(noteDialogAppointment.id);
      if (!feedbackId) throw new Error('Feedback konnte nicht erstellt werden');

      const noteWithAuthor = `<p><strong>Rückmeldung ${displayName}:</strong></p>${noteText}`;
      await supabase.from('appointment_feedback').update({
        notes: noteWithAuthor,
        updated_at: new Date().toISOString(),
      }).eq('id', feedbackId);

      setCompletedIds(prev => new Set(prev).add(noteDialogAppointment.id));
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      setNoteText('');
      setNoteDialogAppointment(null);
      toast({ title: 'Notiz gespeichert', description: 'Die Rückmeldung wurde gespeichert.' });
    } catch {
      toast({ title: 'Fehler', description: 'Notiz konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskDialogAppointment || !taskTitle.trim()) {
      toast({ title: 'Fehler', description: 'Bitte geben Sie einen Aufgabentitel ein.', variant: 'destructive' });
      return;
    }
    if (!user?.id || !currentTenant?.id) return;
    setSaving(true);
    try {
      const feedbackId = await ensureFeedbackCompleted(taskDialogAppointment.id);

      await supabase.from('tasks').insert({
        title: taskTitle,
        description: taskDescription || `Follow-up zu Termin: ${taskDialogAppointment.title}`,
        category: 'personal',
        user_id: user.id,
        tenant_id: currentTenant.id,
        due_date: taskDueDate || null,
        status: 'todo',
        priority: taskPriority,
        source_type: feedbackId ? 'appointment_feedback' : null,
        source_id: feedbackId,
      });

      if (feedbackId) {
        await supabase.from('appointment_feedback').update({
          has_tasks: true,
          updated_at: new Date().toISOString(),
        }).eq('id', feedbackId);
      }

      setCompletedIds(prev => new Set(prev).add(taskDialogAppointment.id));
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setTaskPriority('medium');
      setTaskDialogAppointment(null);
      toast({ title: 'Aufgabe erstellt', description: 'Die Aufgabe wurde erstellt.' });
    } catch {
      toast({ title: 'Fehler', description: 'Die Aufgabe konnte nicht erstellt werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRead = async (appointment: AppointmentData) => {
    setSaving(true);
    try {
      await ensureFeedbackCompleted(appointment.id);
      setCompletedIds(prev => new Set(prev).add(appointment.id));
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      toast({ title: 'Erledigt', description: 'Briefing als gelesen markiert.' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (appointments.length === 0) {
    return (
      <span className="block text-foreground/90">
        {isShowingTomorrow ? 'Keine Termine morgen.' : 'Keine Termine heute.'}
      </span>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {appointments.map((apt) => {
          const time = apt.is_all_day
            ? 'Ganztägig'
            : format(new Date(apt.start_time), 'HH:mm', { locale: de });
          const preparation = preparationsMap?.get(apt.id);
          const hasBriefing = !!preparation;
          const isCompleted = completedIds.has(apt.id);

          return (
            <div key={apt.id}>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-foreground/90">{time} - {apt.title}</span>
                {hasBriefing && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenBriefings(prev => {
                        const next = new Set(prev);
                        if (next.has(apt.id)) next.delete(apt.id);
                        else next.add(apt.id);
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    title="Briefing anzeigen"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <ChevronDown className={`h-3 w-3 transition-transform ${openBriefings.has(apt.id) ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {isCompleted && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                )}
              </div>

              {hasBriefing && openBriefings.has(apt.id) && (
                <div className="ml-4 mt-2 mb-3 space-y-2">
                  <AppointmentBriefingView
                    preparation={preparation!}
                    appointmentInfo={{
                      title: apt.title,
                      start_time: apt.start_time,
                      end_time: apt.end_time ?? apt.start_time,
                      location: apt.location,
                    }}
                    compact
                  />

                  {/* Quick-Action Buttons */}
                  {!isCompleted && (
                    <div className="flex items-center gap-2 pt-1">
                      <Dialog open={noteDialogAppointment?.id === apt.id} onOpenChange={(open) => {
                        if (!open) setNoteDialogAppointment(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setNoteDialogAppointment(apt)}
                          >
                            <StickyNote className="h-3 w-3" />
                            Notiz
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Notiz zu „{apt.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <SimpleRichTextEditor
                              initialContent={noteText}
                              onChange={setNoteText}
                              placeholder="Ihre Notiz / Rückmeldung …"
                            />
                            <Button onClick={handleSaveNote} disabled={saving} className="w-full">
                              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Notiz speichern
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={taskDialogAppointment?.id === apt.id} onOpenChange={(open) => {
                        if (!open) setTaskDialogAppointment(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setTaskDialogAppointment(apt);
                              if (!taskTitle) setTaskTitle(`Follow-up: ${apt.title}`);
                            }}
                          >
                            <ListTodo className="h-3 w-3" />
                            Aufgabe
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Aufgabe aus „{apt.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label>Titel</Label>
                              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                            </div>
                            <div>
                              <Label>Beschreibung</Label>
                              <Input value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Optional" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Priorität</Label>
                                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as 'low' | 'medium' | 'high')}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Niedrig</SelectItem>
                                    <SelectItem value="medium">Mittel</SelectItem>
                                    <SelectItem value="high">Hoch</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Fällig am</Label>
                                <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />
                              </div>
                            </div>
                            <Button onClick={handleCreateTask} disabled={saving} className="w-full">
                              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Aufgabe erstellen
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => handleMarkRead(apt)}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Gelesen
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
