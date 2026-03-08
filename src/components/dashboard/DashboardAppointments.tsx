import { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { icons } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';

interface Props {
  data: DashboardData;
}

/** Check if an appointment is currently happening */
const isCurrentlyActive = (apt: { start_time: string; end_time?: string; is_all_day: boolean }) => {
  if (apt.is_all_day) return false;
  const now = new Date();
  const start = new Date(apt.start_time);
  const end = apt.end_time ? new Date(apt.end_time) : new Date(start.getTime() + 3600000);
  return start <= now && now < end;
};

export const DashboardAppointments = ({ data }: Props) => {
  const navigate = useNavigate();
  const {
    userRole, appointments, isShowingTomorrow,
    openTasksCount, completedTasksToday,
    specialDays, feedbackReminderVisible, pendingFeedbackCount, isLoading,
  } = data;

  const timeSlot = getCurrentTimeSlot();
  const isLateDay = timeSlot === 'evening' || timeSlot === 'night';
  const useTomorrowTone = isShowingTomorrow || isLateDay;

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

  const getRoleLeadLine = () => {
    if (userRole === 'abgeordneter') {
      if (hasPlenum || hasCommittee) return useTomorrowTone
        ? 'Für morgen stehen zentrale politische Termine und klare Entscheidungen im Fokus.'
        : 'Heute stehen zentrale politische Termine und klare Entscheidungen im Fokus.';
      if (appointments.length === 0) return useTomorrowTone
        ? 'Für morgen gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.'
        : 'Heute gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.';
      return useTomorrowTone
        ? 'Für morgen liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.'
        : 'Heute liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.';
    }
    if (userRole === 'mitarbeiter') {
      if (appointments.length >= 4) return useTomorrowTone
        ? 'Für morgen zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.'
        : 'Heute zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.';
      if (openTasksCount >= 8) return useTomorrowTone
        ? 'Für morgen lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.'
        : 'Heute lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.';
      return useTomorrowTone
        ? 'Für morgen geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.'
        : 'Heute geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.';
    }
    if (userRole === 'bueroleitung') return useTomorrowTone
      ? 'Für morgen zählt ein klarer Überblick über Team, Fristen und Prioritäten.'
      : 'Heute zählt ein klarer Überblick über Team, Fristen und Prioritäten.';
    if (userRole === 'praktikant') return useTomorrowTone
      ? 'Morgen ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.'
      : 'Heute ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.';
    return null;
  };

  const specialDayHint = getSpecialDayHint(new Date(), specialDays);
  const roleLine = getRoleLeadLine();

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  // Resolve the icon component for the special day hint
  const HintIcon = specialDayHint?.icon
    ? icons[specialDayHint.icon as keyof typeof icons]
    : null;

  return (
    <div className="space-y-4">
      {/* Rollenbasierte Zeile + kontextuelle Nachricht */}
      {(roleLine || contextMessage) && (
        <div className="text-sm text-muted-foreground space-y-1">
          {roleLine && <p className="italic">{roleLine}</p>}
          <p>{contextMessage.text}</p>
        </div>
      )}

      {/* Special Day */}
      {specialDayHint && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded text-sm text-foreground flex items-start gap-2">
          {HintIcon && <HintIcon className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span>{specialDayHint.text}</span>
        </div>
      )}

      {/* Termine */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          📅 {isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute'}
        </h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isShowingTomorrow ? 'Keine Termine morgen.' : 'Keine Termine heute.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {appointments.map(apt => {
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

      {/* Feedback Reminder */}
      {feedbackReminderVisible && (
        <button
          type="button"
          onClick={() => navigate('/mywork?tab=appointmentfeedback')}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
        </button>
      )}
    </div>
  );
};
