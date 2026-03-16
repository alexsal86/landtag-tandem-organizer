import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { icons } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskDecisionResponse } from '@/components/task-decisions/TaskDecisionResponse';
import { debugConsole } from '@/utils/debugConsole';

interface Props {
  data: DashboardData;
}

interface AppointmentRequestItem {
  decisionId: string;
  decisionDescription: string | null;
  appointmentId: string | null;
  appointmentTitle: string;
  appointmentStart: string | null;
  appointmentLocation: string | null;
  requester: string | null;
  responseType: 'yes' | 'no' | 'question' | null;
  myParticipantId: string | null;
  myHasResponded: boolean;
}

const APPOINTMENT_REQUEST_APPOINTMENT_MARKER = 'appointment_request_appointment_id:';
const APPOINTMENT_REQUEST_TITLE_MARKER = 'appointment_request_title:';
const APPOINTMENT_REQUEST_START_MARKER = 'appointment_request_start:';
const APPOINTMENT_REQUEST_LOCATION_MARKER = 'appointment_request_location:';
const APPOINTMENT_REQUEST_REQUESTER_MARKER = 'appointment_request_requester:';
const APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER = 'appointment_request_target_deputy:';

/** Check if an appointment is currently happening */
const isCurrentlyActive = (apt: { start_time: string; end_time?: string; is_all_day: boolean }) => {
  if (apt.is_all_day) return false;
  const now = new Date();
  const start = new Date(apt.start_time);
  const end = apt.end_time ? new Date(apt.end_time) : new Date(start.getTime() + 3600000);
  return start <= now && now < end;
};

const extractMarkerValue = (description: string | null, marker: string): string | null => {
  if (!description) return null;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}(.+)`, 'i'));
  return match?.[1]?.trim() ?? null;
};

const getAppointmentIdFromDescription = (description: string | null): string | null => {
  const raw = extractMarkerValue(description, APPOINTMENT_REQUEST_APPOINTMENT_MARKER);
  return raw && /^[a-f0-9-]{36}$/i.test(raw) ? raw : null;
};

const getRequesterFromDescription = (description: string | null): string | null => {
  return extractMarkerValue(description, APPOINTMENT_REQUEST_REQUESTER_MARKER)
    ?? extractMarkerValue(description, 'Angefragt von:');
};

const getRequestedStartFromDescription = (description: string | null): string | null => {
  const value = extractMarkerValue(description, APPOINTMENT_REQUEST_START_MARKER);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getRequestedTitleFromDescription = (description: string | null): string | null => {
  return extractMarkerValue(description, APPOINTMENT_REQUEST_TITLE_MARKER);
};

const getRequestedLocationFromDescription = (description: string | null): string | null => {
  return extractMarkerValue(description, APPOINTMENT_REQUEST_LOCATION_MARKER);
};

const responseBadge = (responseType: AppointmentRequestItem['responseType']) => {
  if (responseType === 'yes') return <Badge className="bg-green-600">Zusage</Badge>;
  if (responseType === 'no') return <Badge variant="destructive">Absage</Badge>;
  if (responseType === 'question') return <Badge className="bg-orange-500">Rückfrage</Badge>;
  return <Badge variant="secondary">Wartet auf Reaktion</Badge>;
};

export const DashboardAppointments = ({ data }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const {
    userRole, appointments, isShowingTomorrow,
    openTasksCount, completedTasksToday,
    specialDays, feedbackReminderVisible, pendingFeedbackCount, isLoading,
  } = data;

  const [requestTitle, setRequestTitle] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [requestLocation, setRequestLocation] = useState('');
  const [requestRequester, setRequestRequester] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requests, setRequests] = useState<AppointmentRequestItem[]>([]);

  const createApprovedAppointment = useCallback(async (request: AppointmentRequestItem): Promise<string | null> => {
    if (!user?.id || !currentTenant?.id) return null;
    if (request.appointmentId) return request.appointmentId;
    if (request.responseType !== 'yes') return null;

    const startIso = request.appointmentStart;
    if (!startIso) return null;

    const startDate = new Date(startIso);
    if (Number.isNaN(startDate.getTime())) return null;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const { data: createdAppointment, error: createError } = await supabase
      .from('appointments')
      .insert([{
        title: request.appointmentTitle,
        location: request.appointmentLocation,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        user_id: user.id,
        tenant_id: currentTenant.id,
        is_all_day: false,
      }])
      .select('id')
      .single();

    if (createError || !createdAppointment?.id) {
      debugConsole.error('Error creating approved appointment:', createError);
      return null;
    }

    const nextDescription = [
      request.decisionDescription || '',
      `${APPOINTMENT_REQUEST_APPOINTMENT_MARKER}${createdAppointment.id}`,
    ].filter(Boolean).join('\n');

    const { error: updateError } = await supabase
      .from('task_decisions')
      .update({ description: nextDescription })
      .eq('id', request.decisionId);

    if (updateError) {
      debugConsole.error('Error linking approved appointment to decision:', updateError);
      return null;
    }

    return createdAppointment.id;
  }, [currentTenant?.id, user?.id]);

  const loadAppointmentRequests = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) return;

    setRequestsLoading(true);
    try {
      const { data: decisions, error } = await supabase
        .from('task_decisions')
        .select(`
          id,
          title,
          description,
          response_deadline,
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              response_type,
              created_at
            )
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .ilike('title', 'Terminanfrage:%')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const appointmentIds = Array.from(new Set((decisions || [])
        .map((decision: any) => getAppointmentIdFromDescription(decision.description))
        .filter((id): id is string => Boolean(id))));

      let appointmentsById = new Map<string, { title: string; start_time: string; location: string | null }>();
      if (appointmentIds.length > 0) {
        const { data: linkedAppointments, error: linkedError } = await supabase
          .from('appointments')
          .select('id, title, start_time, location')
          .eq('tenant_id', currentTenant.id)
          .in('id', appointmentIds);

        if (linkedError) throw linkedError;

        appointmentsById = new Map((linkedAppointments || []).map((apt) => [
          apt.id,
          { title: apt.title, start_time: apt.start_time, location: apt.location },
        ]));
      }

      const mapped: AppointmentRequestItem[] = (decisions || []).map((decision: any) => {
        const participants = decision.task_decision_participants || [];
        const allResponses = participants
          .flatMap((participant: any) => participant.task_decision_responses || [])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestResponseRaw = allResponses[0]?.response_type || null;
        const latestResponse = latestResponseRaw === 'yes' || latestResponseRaw === 'no' || latestResponseRaw === 'question'
          ? latestResponseRaw
          : null;

        const appointmentId = getAppointmentIdFromDescription(decision.description);
        const linkedAppointment = appointmentId ? appointmentsById.get(appointmentId) : null;
        const myParticipant = participants.find((participant: any) => participant.user_id === user.id) || null;

        const requestedStart = getRequestedStartFromDescription(decision.description);
        const requestedTitle = getRequestedTitleFromDescription(decision.description)
          || decision.title.replace(/^Terminanfrage:\s*/i, '');
        const requestedLocation = getRequestedLocationFromDescription(decision.description);

        return {
          decisionId: decision.id,
          decisionDescription: decision.description,
          appointmentId,
          appointmentTitle: linkedAppointment?.title || requestedTitle,
          appointmentStart: linkedAppointment?.start_time || requestedStart || decision.response_deadline || null,
          appointmentLocation: linkedAppointment?.location || requestedLocation || null,
          requester: getRequesterFromDescription(decision.description),
          responseType: latestResponse,
          myParticipantId: myParticipant?.id || null,
          myHasResponded: Boolean((myParticipant?.task_decision_responses || []).length),
        };
      });

      const approvalsWithoutAppointment = mapped.filter((request) => request.responseType === 'yes' && !request.appointmentId);
      if (approvalsWithoutAppointment.length > 0) {
        let created = 0;
        for (const request of approvalsWithoutAppointment) {
          const createdId = await createApprovedAppointment(request);
          if (createdId) created += 1;
        }

        if (created > 0) {
          await loadAppointmentRequests();
          return;
        }
      }

      setRequests(mapped);
    } catch (error) {
      debugConsole.error('Error loading dashboard appointment requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  }, [createApprovedAppointment, currentTenant?.id, user?.id]);

  useEffect(() => {
    loadAppointmentRequests();
  }, [loadAppointmentRequests]);

  const createFollowUpTask = useCallback(async (request: AppointmentRequestItem, responseType?: string) => {
    if (!responseType || !user?.id || !currentTenant?.id) return;

    const sourceId = `${request.decisionId}:${responseType}`;
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('source_type', 'appointment_request_dashboard_followup')
      .eq('source_id', sourceId)
      .maybeSingle();

    if (existingTask?.id) return;

    const baseDescription = `Automatisch aus Terminanfrage erzeugt (${request.appointmentTitle}).`;

    const mapping: Record<string, { title: string; priority: string }> = {
      yes: { title: `Termin vorbereiten: ${request.appointmentTitle}`, priority: 'high' },
      no: { title: `Absage/Alternativtermin senden: ${request.appointmentTitle}`, priority: 'medium' },
      question: { title: `Rückfrage klären: ${request.appointmentTitle}`, priority: 'urgent' },
    };

    const selected = mapping[responseType];
    if (!selected) return;

    const { error } = await supabase.from('tasks').insert([{
      title: selected.title,
      description: baseDescription,
      user_id: user.id,
      tenant_id: currentTenant.id,
      assigned_to: user.id,
      category: 'follow-up',
      status: 'todo',
      priority: selected.priority,
      source_type: 'appointment_request_dashboard_followup',
      source_id: sourceId,
    }]);

    if (error) {
      debugConsole.error('Error creating dashboard follow-up task:', error);
      return;
    }

    toast({ title: 'Folgeaufgabe erstellt', description: selected.title });
  }, [currentTenant?.id, toast, user?.id]);

  const handleCreateRequest = async () => {
    if (!user?.id || !currentTenant?.id) return;
    if (!requestTitle.trim() || !requestDate) {
      toast({ title: 'Bitte Titel und Datum angeben', variant: 'destructive' });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const requestedStart = requestTime ? `${requestDate}T${requestTime}:00` : `${requestDate}T09:00:00`;
      const requestedStartIso = new Date(requestedStart).toISOString();

      const { data: deputyMemberships, error: deputyError } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .eq('role', 'abgeordneter');

      if (deputyError) throw deputyError;

      const deputyIds = Array.from(new Set((deputyMemberships || []).map((item) => item.user_id)));
      if (deputyIds.length === 0) {
        toast({ title: 'Keine Abgeordneten gefunden', description: 'Es wurde keine aktive Rolle "abgeordneter" gefunden.', variant: 'destructive' });
        return;
      }

      const targetDeputyId = deputyIds.sort()[0];

      const { data: decision, error: decisionError } = await supabase
        .from('task_decisions')
        .insert([{
          title: `Terminanfrage: ${requestTitle.trim()}`,
          description: [
            'Bitte reagieren: Zusage, Absage oder Rückfrage.',
            `${APPOINTMENT_REQUEST_TITLE_MARKER}${requestTitle.trim()}`,
            `${APPOINTMENT_REQUEST_START_MARKER}${requestedStartIso}`,
            `${APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER}${targetDeputyId}`,
            requestRequester.trim() ? `${APPOINTMENT_REQUEST_REQUESTER_MARKER}${requestRequester.trim()}` : null,
            requestLocation.trim() ? `${APPOINTMENT_REQUEST_LOCATION_MARKER}${requestLocation.trim()}` : null,
          ].filter(Boolean).join('\n'),
          created_by: user.id,
          tenant_id: currentTenant.id,
          response_deadline: requestedStartIso,
          status: 'open',
          visible_to_all: false,
          response_options: [
            { key: 'yes', label: 'Zusage', color: 'green', icon: 'check', order: 1 },
            { key: 'no', label: 'Absage', color: 'red', icon: 'x', order: 2 },
            { key: 'question', label: 'Rückfrage', color: 'orange', icon: 'message-circle', order: 3 },
          ],
        }])
        .select('id')
        .single();

      if (decisionError) throw decisionError;

      const { error: participantError } = await supabase
        .from('task_decision_participants')
        .insert([{
          decision_id: decision.id,
          user_id: targetDeputyId,
        }]);

      if (participantError) throw participantError;

      toast({ title: 'Terminanfrage erstellt', description: 'Anfrage wurde an den Abgeordneten gesendet. Termin wird erst nach Zustimmung angelegt.' });
      setRequestTitle('');
      setRequestDate('');
      setRequestTime('');
      setRequestLocation('');
      setRequestRequester('');
      await loadAppointmentRequests();
    } catch (error: any) {
      debugConsole.error('Error creating dashboard appointment request:', error);
      const errorMessage = typeof error?.message === 'string' ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Terminanfrage konnte nicht erstellt werden', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const timeSlot = getCurrentTimeSlot();
  const hasPlenum = appointments.some(a => a.title.toLowerCase().includes('plenum'));
  const hasCommittee = appointments.some(a => a.title.toLowerCase().match(/ausschuss|ak\s/i));

  const contextMessage = useMemo(() => {
    return selectMessage({
      timeSlot,
      dayOfWeek: getCurrentDayOfWeek(),
      appointmentsCount: appointments.length,
      tasksCount: openTasksCount,
      completedTasks: completedTasksToday,
      isHoliday: false,
      month: new Date().getMonth() + 1,
      userRole,
      hasPlenum,
      hasCommittee,
      multipleSessions: (hasPlenum && hasCommittee),
    });
  }, [appointments, openTasksCount, completedTasksToday, userRole, hasPlenum, hasCommittee, timeSlot]);

  const specialDayHint = getSpecialDayHint(new Date(), specialDays);

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  const HintIcon = specialDayHint?.icon
    ? icons[specialDayHint.icon as keyof typeof icons]
    : null;

  return (
    <div className="space-y-4">
      {contextMessage && (
        <div className="text-sm text-muted-foreground">
          <p>{contextMessage.text}</p>
        </div>
      )}

      {specialDayHint && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded text-sm text-foreground flex items-start gap-2">
          {HintIcon && <HintIcon className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(specialDayHint.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')) }} />
        </div>
      )}

      {(contextMessage || specialDayHint) && <Separator className="my-2" />}

      <div>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isShowingTomorrow ? 'Keine Termine morgen.' : 'Keine Termine heute.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {appointments.map((apt) => {
              const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd');
              const active = !isShowingTomorrow && isCurrentlyActive(apt);
              return (
                <div
                  key={apt.id}
                  className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 transition-colors ${
                    active
                      ? 'bg-primary/10 ring-1 ring-primary/30'
                      : 'hover:bg-muted/40'
                  }`}
                  onClick={() => navigate(`/calendar?date=${aptDate}&event=${apt.id}`)}
                >
                  {active && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  )}
                  <span className="text-muted-foreground font-mono text-xs w-12 shrink-0">
                    {apt.is_all_day ? 'Ganzt.' : format(new Date(apt.start_time), 'HH:mm', { locale: de })}
                  </span>
                  <span className={`truncate hover:underline ${active ? 'text-foreground font-medium' : 'text-foreground'}`}>
                    {apt.title}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="my-2" />

      <div className="space-y-3 rounded-md border p-3">
        <div>
          <h4 className="text-sm font-semibold">Terminanfrage (schnell)</h4>
          <p className="text-xs text-muted-foreground">Direkt im Dashboard erfassen und Reaktion des Abgeordneten abfragen. Der Termin wird erst nach Zustimmung angelegt.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="dashboard-request-title" className="text-xs">Titel</Label>
            <Input id="dashboard-request-title" value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="z. B. Gespräch mit Verband" />
          </div>
          <div>
            <Label htmlFor="dashboard-request-date" className="text-xs">Datum</Label>
            <Input id="dashboard-request-date" type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="dashboard-request-time" className="text-xs">Uhrzeit</Label>
            <Input id="dashboard-request-time" type="time" value={requestTime} onChange={(event) => setRequestTime(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="dashboard-request-location" className="text-xs">Ort / Format</Label>
            <Input id="dashboard-request-location" value={requestLocation} onChange={(event) => setRequestLocation(event.target.value)} placeholder="Landtag / Digital" />
          </div>
          <div>
            <Label htmlFor="dashboard-request-requester" className="text-xs">Anfragende Stelle</Label>
            <Input id="dashboard-request-requester" value={requestRequester} onChange={(event) => setRequestRequester(event.target.value)} placeholder="Name / Organisation" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={handleCreateRequest} disabled={isSubmittingRequest}>
            {isSubmittingRequest ? 'Erstelle…' : 'Terminanfrage anlegen'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Offene/letzte Terminanfragen</h4>
        {requestsLoading && <p className="text-xs text-muted-foreground">Lade Terminanfragen…</p>}
        {!requestsLoading && requests.length === 0 && (
          <p className="text-xs text-muted-foreground">Keine Terminanfragen vorhanden.</p>
        )}
        {requests.map((request) => (
          <div key={request.decisionId} className="rounded border p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{request.appointmentTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {request.appointmentStart ? format(new Date(request.appointmentStart), 'dd.MM.yyyy HH:mm', { locale: de }) : 'ohne Terminzeit'}
                  {request.appointmentLocation ? ` · ${request.appointmentLocation}` : ''}
                  {request.requester ? ` · von ${request.requester}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {request.appointmentId && <Badge variant="outline">Termin angelegt</Badge>}
                {responseBadge(request.responseType)}
              </div>
            </div>

            {request.myParticipantId && !request.myHasResponded && (
              <TaskDecisionResponse
                decisionId={request.decisionId}
                participantId={request.myParticipantId}
                hasResponded={request.myHasResponded}
                onResponseSubmitted={async (meta) => {
                  await createFollowUpTask(request, meta?.responseType);
                  await loadAppointmentRequests();
                }}
              />
            )}
          </div>
        ))}
      </div>

      {feedbackReminderVisible && (
        <>
          <Separator className="my-2" />
          <button
            type="button"
            onClick={() => navigate('/mywork?tab=appointmentfeedback')}
            className="text-sm text-destructive font-semibold hover:underline flex items-center gap-1"
          >
            🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
          </button>
        </>
      )}
    </div>
  );
};
