import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { icons, X, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import { generateBriefingPdf } from '@/components/appointment-preparations/briefingPdfGenerator';
import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

interface DayTimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  simulated?: boolean;
}

interface TimelineLayoutItem {
  item: DayTimelineItem;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  column: number;
  totalColumns: number;
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

  const [isQuickRequestOpen, setIsQuickRequestOpen] = useState(false);
  const [timelineItems, setTimelineItems] = useState<DayTimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [preparations, setPreparations] = useState<Map<string, AppointmentPreparation>>(new Map());
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);
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
      setTimelineItems([]);
    }
  }, [isQuickRequestOpen, resetForm]);

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

  const requestedStart = useMemo(() => {
    if (!requestDate || !requestTime) return null;
    const parsed = new Date(`${requestDate}T${requestTime}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [requestDate, requestTime]);

  const shouldShowTimeline = Boolean(isQuickRequestOpen && requestedStart && currentTenant?.id);
  const timelineWindowMinutes = 6 * 60 + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES;
  const timelineHeight = 220;
  const pixelsPerMinute = timelineHeight / timelineWindowMinutes;

  const timelineBounds = useMemo(() => {
    if (!requestedStart) return [];

    const windowStart = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000);
    windowStart.setMinutes(0, 0, 0);
    const requestedEnd = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000);
    const windowEnd = new Date(requestedEnd.getTime() + 3 * 60 * 60 * 1000);
    windowEnd.setMinutes(0, 0, 0);
    if (windowEnd.getTime() <= requestedEnd.getTime() + 3 * 60 * 60 * 1000 - 1) {
      windowEnd.setHours(windowEnd.getHours() + 1);
    }

    return [windowStart, windowEnd] as const;
  }, [requestedStart]);

  const timelineHourSlots = useMemo(() => {
    if (!timelineBounds.length) return [];
    const [windowStart] = timelineBounds;

    const [, windowEnd] = timelineBounds;
    const hourCount = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (60 * 60 * 1000)) + 1;
    return Array.from({ length: hourCount }, (_, index) => {
      const slot = new Date(windowStart);
      slot.setHours(windowStart.getHours() + index);
      return slot;
    });
  }, [timelineBounds]);

  const timelineLayoutItems = useMemo(() => {
    if (!timelineBounds.length) return [];

    const [windowStart, windowEnd] = timelineBounds;
    const windowStartMs = windowStart.getTime();
    const windowEndMs = windowEnd.getTime();

    const normalized = timelineItems
      .map((item) => {
        const itemStart = new Date(item.start);
        const itemEnd = new Date(item.end || item.start);
        const safeEnd = itemEnd.getTime() > itemStart.getTime()
          ? itemEnd
          : new Date(itemStart.getTime() + 60 * 60 * 1000);

        const clippedStart = Math.max(itemStart.getTime(), windowStartMs);
        const clippedEnd = Math.min(safeEnd.getTime(), windowEndMs);
        if (clippedEnd <= clippedStart) return null;

        const startMinutes = Math.max(0, Math.floor((clippedStart - windowStartMs) / 60000));
        const endMinutes = Math.min(timelineWindowMinutes, Math.ceil((clippedEnd - windowStartMs) / 60000));
        const durationMinutes = Math.max(15, endMinutes - startMinutes);

        return { item, startMinutes, endMinutes, durationMinutes };
      })
      .filter((entry): entry is Omit<TimelineLayoutItem, 'column' | 'totalColumns'> => Boolean(entry))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const layout: TimelineLayoutItem[] = [];
    const active: Array<{ endMinutes: number; column: number }> = [];

    normalized.forEach((entry) => {
      for (let idx = active.length - 1; idx >= 0; idx -= 1) {
        if (active[idx].endMinutes <= entry.startMinutes) {
          active.splice(idx, 1);
        }
      }

      let column = 0;
      while (active.some((a) => a.column === column)) {
        column += 1;
      }

      active.push({ endMinutes: entry.endMinutes, column });
      const totalColumns = Math.max(...active.map((a) => a.column)) + 1;
      layout.push({ ...entry, column, totalColumns });
    });

    return layout.map((entry) => {
      const overlapping = layout.filter(
        (other) => other.startMinutes < entry.endMinutes && entry.startMinutes < other.endMinutes,
      );
      const totalColumns = Math.max(...overlapping.map((overlap) => overlap.column)) + 1;
      return { ...entry, totalColumns };
    });
  }, [timelineBounds, timelineItems]);

  useEffect(() => {
    const loadTimeline = async () => {
      if (!shouldShowTimeline || !requestedStart || !currentTenant?.id) return;

      setIsTimelineLoading(true);
      try {
        const contextStart = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000);
        const requestedEndTime = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000);
        const contextEnd = new Date(requestedEndTime.getTime() + 3 * 60 * 60 * 1000);

        const { data: timelineData, error } = await supabase
          .from('appointments')
          .select('id, title, start_time, end_time')
          .eq('tenant_id', currentTenant.id)
          .lt('start_time', contextEnd.toISOString())
          .gt('end_time', contextStart.toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;

        const existingItems: DayTimelineItem[] = (timelineData || []).map((item) => ({
          id: item.id,
          title: item.title,
          start: item.start_time,
          end: item.end_time,
        }));

        const simulatedStart = requestedStart.toISOString();
        const simulatedEnd = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000).toISOString();
        const simulatedTitle = requestTitle.trim() || 'Angefragter Termin';

        setTimelineItems([
          ...existingItems,
          {
            id: 'simulated-request-slot',
            title: `${simulatedTitle} (angefragt)`,
            start: simulatedStart,
            end: simulatedEnd,
            simulated: true,
          },
        ]);
      } catch {
        setTimelineItems([]);
      } finally {
        setIsTimelineLoading(false);
      }
    };

    void loadTimeline();
  }, [currentTenant?.id, requestTitle, requestedStart, shouldShowTimeline]);

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
    ? icons[specialDayHint.icon as keyof typeof icons]
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
        )}
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
