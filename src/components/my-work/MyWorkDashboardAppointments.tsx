import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, ChevronRight, FileText, Video } from 'lucide-react';
import { getLucideIcon } from '@/utils/iconUtils';
import { Separator } from '@/components/ui/separator';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import { generateBriefingPdf } from '@/components/appointment-preparations/briefingPdfGenerator';
import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const { currentTenant } = useTenant();
  const {
    appointments, isShowingTomorrow, specialDays, isLoading,
  } = data;

  const [preparations, setPreparations] = useState<Map<string, AppointmentPreparation>>(new Map());
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);


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
      <div>
        {(isShowingTomorrow || appointments.length === 0) && (
          <p className="mb-3 text-sm text-muted-foreground">
            Heute stehen keine weiteren Termine an.
          </p>
        )}
        {appointments.length === 0 ? (
          isShowingTomorrow && <p className="text-sm text-muted-foreground">Auch morgen stehen keine Termine an.</p>
        ) : (
          <div className="space-y-1.5">
            <h3 className="mb-2 text-sm font-medium">
              {isShowingTomorrow ? 'Morgen' : 'Heute'}, {format(isShowingTomorrow ? addDays(new Date(), 1) : new Date(), 'd. MMMM', { locale: de })}
            </h3>
            {appointments.map((apt) => {
              const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd');
              const active = !isShowingTomorrow && isCurrentlyActive(apt);
              const hasPrep = preparations.has(apt.id);
              const prep = preparations.get(apt.id);
              const isBriefingExpanded = expandedBriefingId === apt.id;
              const start = new Date(apt.start_time);
              const end = apt.end_time ? new Date(apt.end_time) : null;
              let meetingUrl: string | null = null;
              try {
                const locationUrl = new URL(apt.location?.trim() ?? '');
                if (locationUrl.protocol === 'https:' && /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|meet\.jit\.si)$/.test(locationUrl.hostname)) {
                  meetingUrl = locationUrl.href;
                }
              } catch { /* Location is a place rather than a meeting URL. */ }
              return (
                <div key={apt.id}>
                  <div
                    className={`flex flex-wrap items-center gap-2 text-sm rounded px-1 py-2 transition-colors ${
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
                    <div className="min-w-0 flex-1 basis-40">
                      <button
                        type="button"
                        className={`block max-w-full truncate text-left hover:underline focus-visible:outline-primary ${active ? 'text-foreground font-medium' : 'text-foreground'}`}
                        onClick={() => navigate(`/calendar?date=${aptDate}&event=${apt.id}`)}
                        aria-label={`Termindetails öffnen: ${apt.title}`}
                      >
                        {apt.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {apt.is_all_day ? 'Ganztägig' : <>
                          <span className="font-mono">{format(start, 'HH:mm')}{end && end > start ? `–${isSameDay(start, end) ? '' : format(end, 'd. MMM. ', { locale: de })}${format(end, 'HH:mm')}` : ''}</span>
                          {end && end > start && <span> · {Math.round((end.getTime() - start.getTime()) / 60000)} Min.</span>}
                        </>}
                      </p>
                      {apt.location && !meetingUrl && <p className="truncate text-xs text-muted-foreground">{apt.location}</p>}
                    </div>
                    {meetingUrl && (
                      <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs text-primary hover:underline focus-visible:outline-primary">
                        <Video className="h-4 w-4" aria-hidden="true" />Meeting beitreten
                      </a>
                    )}
                    {hasPrep && (
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap items-center gap-1 ml-auto shrink-0">
                          <Tooltip>
                          <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs hover:bg-muted/60 transition-colors focus-visible:outline-primary"
                          aria-label="Briefing-PDF herunterladen"
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
                          <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Briefing-PDF
                        </button>
                          </TooltipTrigger>
                          <TooltipContent>Briefing als PDF herunterladen</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                          <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs hover:bg-muted/60 transition-colors focus-visible:outline-primary"
                          aria-label={isBriefingExpanded ? 'Briefing einklappen' : 'Briefing anzeigen'}
                          aria-expanded={isBriefingExpanded}
                          aria-controls={`dashboard-briefing-${apt.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedBriefingId(prev => prev === apt.id ? null : apt.id);
                          }}
                        >
                          Briefing
                          {isBriefingExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </button>
                          </TooltipTrigger>
                          <TooltipContent>{isBriefingExpanded ? 'Briefing einklappen' : 'Briefing zum Termin anzeigen'}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    )}
                  </div>
                  {isBriefingExpanded && prep && (
                    <div id={`dashboard-briefing-${apt.id}`} className="mt-1 ml-4">
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
        <div className="group relative bg-palette-amber/10 border-l-2 border-palette-amber/60 px-3 py-1.5 pr-9 rounded text-sm text-foreground flex items-start gap-2">
          {HintIcon && <HintIcon className="h-4 w-4 mt-0.5 shrink-0 text-palette-amber" />}
          <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(specialDayHint.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')) }} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full text-palette-amber opacity-0 transition-opacity hover:bg-palette-amber/20 hover:text-palette-amber focus-visible:opacity-100 group-hover:opacity-100"
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
