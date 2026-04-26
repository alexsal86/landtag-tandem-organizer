import { useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { getLucideIcon } from '@/utils/iconUtils';
import { useNavigate } from 'react-router-dom';

import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getWeatherHint, WeatherToggle } from '@/components/dashboard/DashboardWeather';
import { getSpecialDayHint, type SpecialDayHint } from '@/utils/dashboard/specialDays';
import { type DashboardData } from '@/hooks/useDashboardData';
import { useDashboardMessages } from '@/hooks/useDashboardMessages';
import { Separator } from '@/components/ui/separator';
import { DashboardAppointmentList } from '@/components/dashboard/DashboardAppointmentList';
import { useTodayBriefings } from '@/features/briefings/hooks/useTodayBriefings';

interface Props {
  data: DashboardData;
}

export const DashboardGreetingSection = ({ data }: Props) => {
  const navigate = useNavigate();
  const { messages } = useDashboardMessages();
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

  const specialDayHint = useMemo(() => getSpecialDayHint(new Date(), specialDays), [specialDays]);

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
    }, messages);

    let text = `${greeting}, ${userName}!\n\n`;
    text += `${message.text}\n\n`;

    if (specialDayHint) text += `{{SPECIAL_DAY_PLACEHOLDER}}\n\n`;

    text += '✅ **Aufgabenstatus:**\n';
    text += '{{TASK_LIST_PLACEHOLDER}}\n';

    text += isShowingTomorrow ? '\n📅 **Deine Termine morgen:**\n' : '\n📅 **Deine Termine heute:**\n';
    text += '{{APPOINTMENTS_PLACEHOLDER}}\n';
    return text;
  }, [isLoading, userName, userRole, appointments, isShowingTomorrow, openTasksCount, completedTasksToday, specialDayHint, messages]);

  const parsedContent = useMemo(() => {
    const parseTextSection = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        return part;
      });
    };

    // Replace special day placeholder with icon + text inline
    const renderSpecialDay = () => {
      if (!specialDayHint) return null;
      const HintIcon = specialDayHint.icon
        ? getLucideIcon(specialDayHint.icon)
        : null;
      return (
        <span className="flex items-start gap-2 my-1">
          {HintIcon && <HintIcon className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span>{parseTextSection(specialDayHint.text)}</span>
        </span>
      );
    };

    // Split by both placeholders
    let textWithoutSpecial = fullText;
    const hasSpecialPlaceholder = fullText.includes('{{SPECIAL_DAY_PLACEHOLDER}}');
    if (hasSpecialPlaceholder) {
      textWithoutSpecial = fullText.replace('{{SPECIAL_DAY_PLACEHOLDER}}\n\n', '{{SPECIAL_DAY_PLACEHOLDER}}');
    }

    const specialParts = textWithoutSpecial.split('{{SPECIAL_DAY_PLACEHOLDER}}');
    const beforeSpecial = specialParts[0] || '';
    const afterSpecial = specialParts.length > 1 ? specialParts[1] : '';

    const combinedAfter = afterSpecial;
    const sections = combinedAfter.split('{{TASK_LIST_PLACEHOLDER}}\n');

    const beforeTasks = sections[0] || '';
    const afterTasksRaw = sections.length > 1 ? sections[1] : combinedAfter.replace('{{TASK_LIST_PLACEHOLDER}}\n', '');

    // Split around appointments placeholder
    const appointmentParts = afterTasksRaw.split('{{APPOINTMENTS_PLACEHOLDER}}\n');
    const beforeAppointments = appointmentParts[0] || '';
    const afterAppointments = appointmentParts.length > 1 ? appointmentParts[1] : '';

    return (
      <>
        {parseTextSection(beforeSpecial)}
        {hasSpecialPlaceholder && renderSpecialDay()}
        {parseTextSection(beforeTasks)}
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
        {parseTextSection(beforeAppointments)}
        <DashboardAppointmentList appointments={appointments} isShowingTomorrow={isShowingTomorrow} />
        {afterAppointments && parseTextSection(afterAppointments)}
      </>
    );
  }, [fullText, openTaskTitles, navigate, specialDayHint, appointments, isShowingTomorrow]);

  if (tenantLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg mb-6" />;
  if (!hasTenant) return null;

  return (
    <div>
      <span className="text-xl lg:text-2xl font-light tracking-tight text-foreground/90 block whitespace-pre-wrap">
        {parsedContent}
      </span>
      {feedbackReminderVisible && (
        <div className="mt-3">
          <Separator className="mb-3" />
          <button type="button" onClick={() => navigate('/mywork?tab=appointmentfeedback')} className="text-sm text-destructive font-semibold hover:underline flex items-center gap-1">
            🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
          </button>
        </div>
      )}
      <WeatherToggle />
    </div>
  );
};
