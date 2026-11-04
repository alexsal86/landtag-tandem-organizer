import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { X, Download, MapPin, Check, CircleAlert, Video, Users, Clock, PencilLine } from 'lucide-react';
import { AvatarStack } from '@/components/ui/AvatarStack';
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

interface ParticipantItem {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_color: string | null;
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
    appointments, isShowingTomorrow, tomorrowAppointments, specialDays, isLoading,
  } = data;

  const [preparations, setPreparations] = useState<Map<string, AppointmentPreparation>>(new Map());
  const [preparationsError, setPreparationsError] = useState(false);
  const [preparationsLoaded, setPreparationsLoaded] = useState(false);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, ParticipantItem[]>>(new Map());
  const allAppointments = useMemo(() => [...appointments, ...tomorrowAppointments], [appointments, tomorrowAppointments]);

  // Fetch linked contacts as participants (only internal appointments have entries)
  useEffect(() => {
    let cancelled = false;
    const ids = allAppointments.map(a => a.id);
    if (ids.length === 0) { setParticipants(new Map()); return; }
    (async () => {
      const { data: rows, error } = await supabase
        .from('appointment_contacts')
        .select('appointment_id, contact_id, contacts(name, avatar_url)')
        .in('appointment_id', ids);
      if (cancelled || error) return;
      const map = new Map<string, ParticipantItem[]>();
      for (const r of rows ?? []) {
        const c = r.contacts as { name: string | null; avatar_url: string | null } | null;
        const list = map.get(r.appointment_id) ?? [];
        list.push({ user_id: r.contact_id, display_name: c?.name ?? null, avatar_url: c?.avatar_url ?? null, badge_color: null });
        map.set(r.appointment_id, list);
      }
      setParticipants(map);
    })();
    return () => { cancelled = true; };
  }, [allAppointments]);


  // Fetch preparations for today's appointments
  useEffect(() => {
    let cancelled = false;
    setPreparations(new Map());
    setPreparationsLoaded(false);
    setPreparationsError(false);
    const fetchPreparations = async () => {
      if (!currentTenant?.id || allAppointments.length === 0) return;
      const aptIds = allAppointments.map(a => a.id);
      try {
        const { data: preps, error } = await supabase
          .from('appointment_preparations')
          .select('*')
          .in('appointment_id', aptIds)
          .eq('is_archived', false);
        if (error) throw error;
        if (cancelled) return;
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
        setPreparationsLoaded(true);
      } catch {
        if (!cancelled) setPreparationsError(true);
      }
    };
    fetchPreparations();
    return () => { cancelled = true; };
  }, [currentTenant?.id, allAppointments]);

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

  const renderAppointment = (apt: DashboardData['appointments'][number], isTodayGroup: boolean) => {
              const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd');
              const active = isTodayGroup && isCurrentlyActive(apt);
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
              const participantList = participants.get(apt.id) ?? [];
              const isCompleted = hasPrep && prep?.status === 'completed';
              const badgeLabel = preparationsError ? 'Briefing-Status nicht verfügbar' : !preparationsLoaded ? 'Briefing wird geprüft' : !hasPrep ? 'Briefing fehlt' : isCompleted ? 'Briefing fertig' : 'Briefing in Bearbeitung';
              const badgeClass = preparationsError || !preparationsLoaded ? 'bg-muted text-muted-foreground' : !hasPrep ? 'bg-destructive/10 text-destructive' : isCompleted ? 'bg-palette-green/15 text-palette-green' : 'bg-palette-amber/15 text-palette-amber';
              const BadgeIcon = preparationsError || !hasPrep ? CircleAlert : !preparationsLoaded ? Clock : isCompleted ? Check : PencilLine;
              return (
                <div key={apt.id} className="border-b border-border/60 last:border-b-0">
                  <div className={`relative grid grid-cols-[4rem_minmax(0,1fr)] @min-[32rem]:grid-cols-[4rem_minmax(0,1fr)_auto] gap-x-3 gap-y-3 rounded-lg px-3 py-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 ${active ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}>
                    <button
                      type="button"
                      className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      aria-label={`Termindetails öffnen: ${apt.title}`}
                      onClick={() => navigate(`/calendar?date=${aptDate}&event=${apt.id}`)}
                    />
                    <div className="pointer-events-none relative tabular-nums">
                      <p className={apt.is_all_day ? 'text-sm font-semibold' : 'text-2xl font-semibold leading-8 tracking-tight text-foreground'}>
                        {apt.is_all_day ? 'Ganztägig' : format(start, 'HH:mm')}
                      </p>
                      {!apt.is_all_day && end && end > start && (
                        <p className="text-sm text-muted-foreground/80">{isSameDay(start, end) ? '' : format(end, 'd. MMM. ', { locale: de })}{format(end, 'HH:mm')}</p>
                      )}
                    </div>
                    <div className="pointer-events-none relative min-w-0">
                      <p className="break-words text-lg font-semibold leading-7 text-foreground">{apt.title}</p>
                      {((apt.location && !meetingUrl) || participantList.length > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
                          {apt.location && !meetingUrl && (
                            <span className="flex items-start gap-1.5">
                              <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="break-words">{apt.location}</span>
                            </span>
                          )}
                          {participantList.length > 0 && (
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{participantList.length} Teilnehmende</span>
                              <span className="pointer-events-auto">
                                <AvatarStack participants={participantList} maxVisible={4} size="sm" />
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-2.5">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm', badgeClass)}>
                          <BadgeIcon className="h-4 w-4" aria-hidden="true" />
                          {badgeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="relative z-10 col-start-2 @min-[32rem]:col-start-3 @min-[32rem]:row-start-1 @min-[32rem]:self-start flex flex-wrap items-center gap-2">
                      {meetingUrl && (
                        <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs text-primary hover:underline focus-visible:outline-primary">
                          <Video className="h-4 w-4" aria-hidden="true" />Meeting beitreten
                        </a>
                      )}
                      {hasPrep && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 rounded-lg border border-border bg-transparent px-4 text-base font-normal hover:bg-transparent hover:border-foreground/30"
                            aria-expanded={isBriefingExpanded}
                            aria-controls={`dashboard-briefing-${apt.id}`}
                            onClick={() => setExpandedBriefingId(prev => prev === apt.id ? null : apt.id)}
                          >
                            {isBriefingExpanded ? 'Briefing schließen' : 'Briefing öffnen'}
                          </Button>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 rounded-lg border border-border bg-transparent hover:bg-transparent hover:border-foreground/30"
                                  aria-label="Briefing als PDF herunterladen"
                                  onClick={() => {
                                    if (prep) generateBriefingPdf({
                                      preparation: prep,
                                      appointmentTitle: apt.title,
                                      appointmentStartTime: apt.start_time,
                                      appointmentEndTime: apt.end_time || apt.start_time,
                                      appointmentLocation: apt.location || undefined,
                                    }).catch(console.error);
                                  }}
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Briefing als PDF herunterladen</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
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
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  const HintIcon = specialDayHint?.icon
    ? getLucideIcon(specialDayHint.icon)
    : null;

  return (
    <div className="@container space-y-4">
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
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {isShowingTomorrow ? 'Morgen' : 'Heute'}, {format(isShowingTomorrow ? addDays(new Date(), 1) : new Date(), 'd. MMMM', { locale: de })}
            </h3>
            {appointments.map((apt) => renderAppointment(apt, !isShowingTomorrow))}
          </div>
        )}
        {tomorrowAppointments.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Morgen, {format(addDays(new Date(), 1), 'd. MMMM', { locale: de })}
            </h3>
            {tomorrowAppointments.map((apt) => renderAppointment(apt, false))}
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
