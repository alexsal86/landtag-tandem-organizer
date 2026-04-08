import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, ChevronRight, FileText, CalendarX2 } from 'lucide-react';
import { getLucideIcon } from '@/utils/iconUtils';
import { Separator } from '@/components/ui/separator';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import { generateBriefingPdf } from '@/components/appointment-preparations/briefingPdfGenerator';
import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { useDashboardMessages } from '@/hooks/useDashboardMessages';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
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


const SPECIAL_DAY_DISMISSALS_STORAGE_KEY = 'mywork-dashboard-special-day-dismissals';

interface StoredSpecialDayDismissal {
  hiddenUntilDate: string;
}

const getSpecialDayDismissals = (): Record<string, StoredSpecialDayDismissal> => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(SPECIAL_DAY_DISMISSALS_STORAGE_KEY);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<Record<string, StoredSpecialDayDismissal>>((acc, [key, value]) => {
      if (value && typeof value === 'object' && typeof (value as StoredSpecialDayDismissal).hiddenUntilDate === 'string') {
        acc[key] = { hiddenUntilDate: (value as StoredSpecialDayDismissal).hiddenUntilDate };
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const setSpecialDayDismissals = (dismissals: Record<string, StoredSpecialDayDismissal>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SPECIAL_DAY_DISMISSALS_STORAGE_KEY, JSON.stringify(dismissals));
};

const buildSpecialDayDismissalKey = (name: string, targetDate: string) => `${name}::${targetDate}`;

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
  const { currentTenant } = useTenant();
  const {
    userRole, appointments, isShowingTomorrow,
    openTasksCount, completedTasksToday,
    specialDays, feedbackReminderVisible, pendingFeedbackCount, isLoading,
  } = data;

  const [preparations, setPreparations] = useState<Map<string, AppointmentPreparation>>(new Map());
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);
  const { messages } = useDashboardMessages();


  // Fetch preparations for today's appointments
  useEffect(() => {
    const fetchPreparations = async () => {
      if (!currentTenant?.id || appointments.length === 0) return;
      const aptIds = appointments.map(a => a.id);
      try {
        const { data: preps } = await supabase
          .from('appointment_preparations')
          .select('*')
          .in('appointment_id', aptIds)
          .eq('is_archived', false);
        if (preps && preps.length > 0) {
          const prepMap = new Map<string, AppointmentPreparation>();
          for (const p of preps) {
            prepMap.set(p.appointment_id, {
              id: p.id,
              title: p.title,
              status: p.status,
              notes: p.notes,
              appointment_id: p.appointment_id,
              template_id: p.template_id,
              tenant_id: p.tenant_id,
              created_by: p.created_by,
              created_at: p.created_at,
              updated_at: p.updated_at,
              is_archived: p.is_archived,
              archived_at: p.archived_at,
              preparation_data: (p.preparation_data ?? {}) as AppointmentPreparation['preparation_data'],
              checklist_items: (p.checklist_items ?? []) as AppointmentPreparation['checklist_items'],
            });
          }
          setPreparations(prepMap);
        }
      } catch { /* ignore */ }
    };
    fetchPreparations();
  }, [currentTenant?.id, appointments]);

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
    }, messages);
  }, [appointments, openTasksCount, completedTasksToday, userRole, hasPlenum, hasCommittee, timeSlot, messages]);

  const specialDayHint = useMemo(() => getSpecialDayHint(new Date(), specialDays), [specialDays]);
  const [isSpecialDayHintVisible, setIsSpecialDayHintVisible] = useState(true);

  useEffect(() => {
    if (!specialDayHint) {
      setIsSpecialDayHintVisible(false);
      return;
    }

    const dismissalKey = buildSpecialDayDismissalKey(specialDayHint.name, specialDayHint.targetDate);
    const dismissals = getSpecialDayDismissals();
    const dismissal = dismissals[dismissalKey];

    if (!dismissal) {
      setIsSpecialDayHintVisible(true);
      return;
    }

    if (specialDayHint.isToday || dismissal.hiddenUntilDate < specialDayHint.targetDate) {
      delete dismissals[dismissalKey];
      setSpecialDayDismissals(dismissals);
      setIsSpecialDayHintVisible(true);
      return;
    }

    setIsSpecialDayHintVisible(false);
  }, [specialDayHint]);

  const dismissSpecialDayHint = useCallback(() => {
    if (!specialDayHint) return;

    const dismissalKey = buildSpecialDayDismissalKey(specialDayHint.name, specialDayHint.targetDate);
    const dismissals = getSpecialDayDismissals();
    dismissals[dismissalKey] = { hiddenUntilDate: specialDayHint.targetDate };
    setSpecialDayDismissals(dismissals);
    setIsSpecialDayHintVisible(false);
  }, [specialDayHint]);

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  const HintIcon = specialDayHint?.icon
    ? getLucideIcon(specialDayHint.icon)
    : null;

  return (
    <div className="space-y-4">
      {contextMessage && (
        <div className="text-sm text-muted-foreground">
          <p>{contextMessage.text}</p>
        </div>
      )}

      {contextMessage && <Separator className="my-2" />}

      <div>
        {isShowingTomorrow && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center mb-3">
            <div className="mb-3 rounded-full bg-background p-3 shadow-sm">
              <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">
              Keine Termine heute.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {appointments.length === 0
                ? 'Genieß den freien Slot – neue Termine erscheinen hier automatisch.'
                : 'Zur Orientierung siehst du unten bereits die Termine für morgen.'}
            </p>
          </div>
        )}

        {!isShowingTomorrow && appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <div className="mb-3 rounded-full bg-background p-3 shadow-sm">
              <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">
              Keine Termine heute.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Genieß den freien Slot – neue Termine erscheinen hier automatisch.
            </p>
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-1.5">
            {isShowingTomorrow && (
              <p className="text-xs font-medium text-muted-foreground mb-1">Morgen:</p>
            )}
            {appointments.map((apt) => {
              const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd');
              const active = !isShowingTomorrow && isCurrentlyActive(apt);
              const hasPrep = preparations.has(apt.id);
              const prep = preparations.get(apt.id);
              const isBriefingExpanded = expandedBriefingId === apt.id;
              return (
                <div key={apt.id}>
                  <div
                    className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 transition-colors ${
                      active
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted/40'
                    }`}
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
                    <span
                      className={`truncate hover:underline cursor-pointer ${active ? 'text-foreground font-medium' : 'text-foreground'}`}
                      onClick={() => navigate(`/calendar?date=${aptDate}&event=${apt.id}`)}
                    >
                      {apt.title}
                    </span>
                    {hasPrep && (
                      <div className="flex items-center gap-0.5 ml-auto shrink-0">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted/60 transition-colors"
                          title="Briefing-PDF herunterladen"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (prep) generateBriefingPdf({
                              preparation: prep,
                              appointmentTitle: apt.title,
                              appointmentStartTime: apt.start_time,
                              appointmentEndTime: apt.end_time || apt.start_time,
                              appointmentLocation: apt.location || undefined,
                            }).catch(console.error);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted/60 transition-colors"
                          title="Briefing anzeigen"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedBriefingId(prev => prev === apt.id ? null : apt.id);
                          }}
                        >
                          {isBriefingExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </button>
                      </div>
                    )}
                  </div>
                  {isBriefingExpanded && prep && (
                    <div className="mt-1 ml-4">
                      <AppointmentBriefingView
                        preparation={prep}
                        appointmentInfo={{
                          title: apt.title,
                          start_time: apt.start_time,
                          end_time: apt.end_time || apt.start_time,
                          location: apt.location || undefined,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {specialDayHint && isSpecialDayHintVisible && <Separator className="my-2" />}

      {specialDayHint && isSpecialDayHintVisible && (
        <div className="group relative bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 pr-9 rounded text-sm text-foreground flex items-start gap-2">
          {HintIcon && <HintIcon className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(specialDayHint.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')) }} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full text-amber-700 opacity-0 transition-opacity hover:bg-amber-100 hover:text-amber-900 focus-visible:opacity-100 group-hover:opacity-100 dark:text-amber-300 dark:hover:bg-amber-900/60 dark:hover:text-amber-100"
            onClick={dismissSpecialDayHint}
            aria-label="Hinweis ausblenden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}


      {/* Terminanfrage und Feedback-Reminder sind jetzt in der Navigation (Kalender-Panel) */}
    </div>
  );
};
