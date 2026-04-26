import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ChevronDown,
  StickyNote,
  ListTodo,
  CheckCircle2,
  Loader2,
  ExternalLink,
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

import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import type { AppointmentData } from '@/hooks/useDashboardAppointmentsData';

interface Props {
  appointments: AppointmentData[];
  isShowingTomorrow: boolean;
  briefingSnippet?: { authorName: string | null; text: string } | null;
  motivationalText?: string;
}

export function DashboardAppointmentList({ appointments, isShowingTomorrow, briefingSnippet, motivationalText }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  // Compute meta info for header (number of appointments + next time)
  const now = new Date();
  const headerLabel = isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute';
  const upcoming = appointments
    .filter((a) => !a.is_all_day && new Date(a.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const nextTime = upcoming[0]
    ? format(new Date(upcoming[0].start_time), 'HH:mm', { locale: de })
    : null;
  const countLabel = `${appointments.length} Termin${appointments.length === 1 ? '' : 'e'}`;

  const isOngoing = (apt: AppointmentData) => {
    if (apt.is_all_day || isShowingTomorrow) return false;
    const start = new Date(apt.start_time);
    const end = apt.end_time
      ? new Date(apt.end_time)
      : new Date(start.getTime() + 60 * 60 * 1000);
    return start <= now && end > now;
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5 text-base font-normal tracking-normal not-italic">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-foreground">{headerLabel}</h3>
          {appointments.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {countLabel}
              {nextTime ? ` · nächster ${nextTime}` : ''}
            </span>
          )}
        </div>

        {/* Briefing + motivational text */}
        {(briefingSnippet || motivationalText) && (
          <div className="mb-4 space-y-1.5 text-sm leading-relaxed">
            {briefingSnippet && (
              <p className="text-foreground/90">
                {briefingSnippet.authorName && (
                  <span className="font-semibold">{briefingSnippet.authorName}: </span>
                )}
                <span className="line-clamp-2">{briefingSnippet.text}</span>
              </p>
            )}
            {motivationalText && (
              <p className="text-muted-foreground">{motivationalText}</p>
            )}
          </div>
        )}

        {/* Empty state */}
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isShowingTomorrow ? 'Keine Termine morgen.' : 'Keine Termine heute.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {appointments.map((apt) => {
              const time = apt.is_all_day
                ? 'ganztägig'
                : format(new Date(apt.start_time), 'HH:mm', { locale: de });
              const preparation = preparationsMap?.get(apt.id);
              const hasBriefing = !!preparation;
              const isCompleted = completedIds.has(apt.id);
              const ongoing = isOngoing(apt);
              const briefingOpen = openBriefings.has(apt.id);

              return (
                <div key={apt.id} className="group">
                  <div
                    className={`grid grid-cols-[60px_1fr_auto] gap-4 items-center py-3 ${
                      ongoing ? 'bg-muted/40 -mx-2 px-2 rounded' : ''
                    }`}
                  >
                    {/* Time column */}
                    <span
                      className={`font-mono text-sm ${
                        ongoing
                          ? 'text-primary font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {time}
                    </span>

                    {/* Title + location */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {ongoing && (
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse shrink-0"
                          />
                        )}
                        <span className="text-[15px] text-foreground truncate">
                          {apt.title}
                        </span>
                        {isCompleted && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      {apt.location && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {apt.location}
                        </div>
                      )}
                    </div>

                    {/* Briefing badge + actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasBriefing && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenBriefings((prev) => {
                                const next = new Set(prev);
                                if (next.has(apt.id)) next.delete(apt.id);
                                else next.add(apt.id);
                                return next;
                              });
                            }}
                            className="font-mono text-[10px] tracking-wider text-primary border border-primary/40 rounded px-2 py-1 hover:bg-primary/5 transition-colors inline-flex items-center gap-1"
                            title="Briefing anzeigen"
                          >
                            BRIEFING
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${
                                briefingOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/briefing-live?preparationId=${preparation!.id}&appointmentId=${apt.id}`,
                              )
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80 p-1"
                            title="Live-Briefing öffnen"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {hasBriefing && briefingOpen && (
                    <div className="pl-[76px] pb-3 space-y-2">
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

                      {!isCompleted && (
                        <div className="flex items-center gap-2 pt-1">
                          <Dialog
                            open={noteDialogAppointment?.id === apt.id}
                            onOpenChange={(open) => {
                              if (!open) setNoteDialogAppointment(null);
                            }}
                          >
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

                          <Dialog
                            open={taskDialogAppointment?.id === apt.id}
                            onOpenChange={(open) => {
                              if (!open) setTaskDialogAppointment(null);
                            }}
                          >
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
                                  <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                                </div>
                                <div>
                                  <Label>Beschreibung</Label>
                                  <Input
                                    value={taskDescription}
                                    onChange={(e) => setTaskDescription(e.target.value)}
                                    placeholder="Optional"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Priorität</Label>
                                    <Select
                                      value={taskPriority}
                                      onValueChange={(v) => setTaskPriority(v as 'low' | 'medium' | 'high')}
                                    >
                                      <SelectTrigger>
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
                                    />
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
        )}
      </div>
    </>
  );
}
