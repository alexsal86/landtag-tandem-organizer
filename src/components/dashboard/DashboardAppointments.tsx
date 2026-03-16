import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { icons } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppointmentRequest } from '@/hooks/useAppointmentRequest';
import {
  APPOINTMENT_REQUEST_APPOINTMENT_MARKER,
  APPOINTMENT_REQUEST_LOCATION_MARKER,
  APPOINTMENT_REQUEST_REQUESTER_MARKER,
  APPOINTMENT_REQUEST_START_MARKER,
  APPOINTMENT_REQUEST_TITLE_MARKER,
} from '@/features/appointments/requestMarkers';

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

/** Check if an appointment is currently happening */
const isCurrentlyActive = (apt: { start_time: string; end_time?: string; is_all_day: boolean }) => {
  if (apt.is_all_day) return false;
  const now = new Date();
  const start = new Date(apt.start_time);
  const end = apt.end_time ? new Date(apt.end_time) : new Date(start.getTime() + 3600000);
  return start <= now && now < end;
};

const extractMarkerValue = (description: string | null | undefined, marker: string): string | null => {
  if (!description) return null;
  const line = description.split('\n').find(l => l.startsWith(marker));
  return line ? line.slice(marker.length).trim() || null : null;
};

const getAppointmentIdFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_APPOINTMENT_MARKER);

const getRequestedStartFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_START_MARKER);

const getRequestedTitleFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_TITLE_MARKER);

const getRequestedLocationFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_LOCATION_MARKER);

const getRequesterFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_REQUESTER_MARKER);


export const DashboardAppointments = ({ data }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    userRole, appointments, isShowingTomorrow,
    openTasksCount, completedTasksToday,
    specialDays, feedbackReminderVisible, pendingFeedbackCount, isLoading,
  } = data;

  const [isQuickRequestOpen, setIsQuickRequestOpen] = useState(false);
  const {
    requestTitle,
    setRequestTitle,
    requestDate,
    setRequestDate,
    requestTime,
    setRequestTime,
    requestLocation,
    setRequestLocation,
    requestRequester,
    setRequestRequester,
    isSubmittingRequest,
    resetForm,
    createRequest,
  } = useAppointmentRequest({
    onSuccess: (message, description) => {
      toast({ title: message, description });
    },
    onError: (message, description) => {
      toast({ title: message, description, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (isQuickRequestOpen) {
      resetForm();
    }
  }, [isQuickRequestOpen, resetForm]);

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
      <div>
        {isShowingTomorrow && (
          <div className="mb-3 rounded-md border border-blue-200/70 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <p className="font-medium">Heute stehen keine Termine mehr an.</p>
            <p className="text-xs text-blue-800/90 dark:text-blue-200/90">Darunter siehst du zur Orientierung bereits die Termine für morgen.</p>
          </div>
        )}

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

      {(contextMessage || specialDayHint) && <Separator className="my-2" />}

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

      <Separator className="my-2" />

      <Collapsible open={isQuickRequestOpen} onOpenChange={setIsQuickRequestOpen}>
        <div className="space-y-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-start justify-between gap-3 text-left rounded-md px-2 py-1 hover:bg-muted/40 transition-colors"
            >
              <div>
                <h4 className="text-sm font-semibold">Terminanfrage (schnell)</h4>
                <p className="text-xs text-muted-foreground">Direkt im Dashboard erfassen und Reaktion des Abgeordneten abfragen. Der Termin wird erst nach Zustimmung angelegt.</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                {isQuickRequestOpen ? 'Einklappen' : 'Ausklappen'}
                <icons.ChevronDown className={`h-4 w-4 transition-transform ${isQuickRequestOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-3 pt-1">
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
              <Button type="button" onClick={createRequest} disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Erstelle…' : 'Terminanfrage anlegen'}
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
