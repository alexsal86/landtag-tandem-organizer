import { useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getWeatherHint, WeatherToggle } from '@/components/dashboard/DashboardWeather';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';

interface Props {
  data: DashboardData;
}

export const DashboardGreetingSection = ({ data }: Props) => {
  const navigate = useNavigate();
  const {
    userName, userRole, appointments, isShowingTomorrow,
    openTasksCount, completedTasksToday, openTaskTitles,
    specialDays, feedbackReminderVisible, pendingFeedbackCount,
    isLoading, tenantLoading, hasTenant,
  } = data;

  const handleTaskTitleDragStart = (event: React.DragEvent<HTMLElement>, taskTitle: string, taskId?: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', taskTitle);
    event.dataTransfer.setData('application/x-mywork-task-title', taskTitle);
    if (taskId) event.dataTransfer.setData('application/x-mywork-task-id', taskId);
    const ghost = document.createElement('div');
    ghost.className = 'pointer-events-none bg-transparent px-0 py-0 text-lg font-medium text-foreground';
    ghost.textContent = taskTitle;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  };

  const fullText = useMemo(() => {
    if (isLoading) return '';
    const timeSlot = getCurrentTimeSlot();
    const greeting = getGreeting(timeSlot);
    const isLateDay = timeSlot === 'evening' || timeSlot === 'night';
    const useTomorrowTone = isShowingTomorrow || isLateDay;

    const hasPlenum = appointments.some(a => a.title.toLowerCase().includes('plenum'));
    const hasCommittee = appointments.some(a => a.title.toLowerCase().match(/ausschuss|ak\s/i));
    const multipleSessions = (hasPlenum && hasCommittee) ||
      (appointments.filter(a => a.title.toLowerCase().includes('plenum') || a.title.toLowerCase().match(/ausschuss|ak\s/i)).length >= 2);

    const message = selectMessage({
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
      multipleSessions,
    });

    const getRoleLeadLine = () => {
      if (userRole === 'abgeordneter') {
        if (hasPlenum || hasCommittee || multipleSessions)
          return useTomorrowTone ? 'Für morgen stehen zentrale politische Termine und klare Entscheidungen im Fokus.' : 'Heute stehen zentrale politische Termine und klare Entscheidungen im Fokus.';
        if (appointments.length === 0)
          return useTomorrowTone ? 'Für morgen gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.' : 'Heute gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.';
        return useTomorrowTone ? 'Für morgen liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.' : 'Heute liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.';
      }
      if (userRole === 'mitarbeiter') {
        if (appointments.length >= 4) return useTomorrowTone ? 'Für morgen zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.' : 'Heute zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.';
        if (openTasksCount >= 8) return useTomorrowTone ? 'Für morgen lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.' : 'Heute lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.';
        return useTomorrowTone ? 'Für morgen geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.' : 'Heute geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.';
      }
      if (userRole === 'bueroleitung') return useTomorrowTone ? 'Für morgen zählt ein klarer Überblick über Team, Fristen und Prioritäten.' : 'Heute zählt ein klarer Überblick über Team, Fristen und Prioritäten.';
      if (userRole === 'praktikant') return useTomorrowTone ? 'Morgen ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.' : 'Heute ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.';
      return undefined;
    };

    const roleLine = getRoleLeadLine();
    let text = `${greeting}, ${userName}!\n\n`;
    if (roleLine) text += `${roleLine}\n\n`;
    text += `${message.text}\n\n`;

    const specialDayHint = getSpecialDayHint(new Date(), specialDays);
    if (specialDayHint) text += `${specialDayHint}\n\n`;

    text += '✅ **Aufgabenstatus:**\n';
    text += '{{TASK_LIST_PLACEHOLDER}}\n';

    text += isShowingTomorrow ? '\n📅 **Deine Termine morgen:**\n' : '\n📅 **Deine Termine heute:**\n';
    if (appointments.length === 0) {
      text += isShowingTomorrow ? 'Keine Termine morgen.\n' : 'Keine Termine heute.\n';
    } else {
      appointments.forEach(apt => {
        const time = apt.is_all_day ? 'Ganztägig' : format(new Date(apt.start_time), 'HH:mm', { locale: de });
        text += `${time} - ${apt.title}\n`;
      });
    }
    return text;
  }, [isLoading, userName, userRole, appointments, isShowingTomorrow, openTasksCount, completedTasksToday, specialDays]);

  const parsedContent = useMemo(() => {
    const sections = fullText.split('{{TASK_LIST_PLACEHOLDER}}\n');
    const parseTextSection = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        return part;
      });
    };
    if (sections.length < 2) return parseTextSection(fullText.replace('{{TASK_LIST_PLACEHOLDER}}\n', ''));
    return (
      <>
        {parseTextSection(sections[0])}
        {openTaskTitles.length > 0 && (
          <span className="block">
            {openTaskTitles.map((task, index) => (
              <span key={`${task.id}-${index}`} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-foreground/90 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate('/mywork?tab=tasks')} title="Klicken um zur Aufgabe zu gehen, oder per Handle in den Tageszettel ziehen">
                <span draggable onDragStart={(e) => { e.stopPropagation(); handleTaskTitleDragStart(e, task.title, task.id); }} className="cursor-grab rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="flex-1">{task.title}</span>
              </span>
            ))}
          </span>
        )}
        {parseTextSection(sections[1])}
      </>
    );
  }, [fullText, openTaskTitles, navigate]);

  if (tenantLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg mb-6" />;
  if (!hasTenant) return null;

  return (
    <div>
      <span className="text-xl lg:text-2xl font-light tracking-tight text-foreground/90 block whitespace-pre-wrap">
        {parsedContent}
      </span>
      {feedbackReminderVisible && (
        <div className="mt-3">
          <button type="button" onClick={() => navigate('/mywork?tab=appointmentfeedback')} className="text-sm text-primary hover:underline flex items-center gap-1">
            🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
          </button>
        </div>
      )}
      <WeatherToggle />
    </div>
  );
};
