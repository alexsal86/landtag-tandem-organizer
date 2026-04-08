import { useMemo } from 'react';
import { TypewriterText } from './TypewriterText';
import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import type { DashboardContext } from '@/utils/dashboard/messageGenerator';
import { useDashboardMessages } from '@/hooks/useDashboardMessages';

interface DynamicGreetingProps {
  appointmentsCount: number;
  tasksCount: number;
  completedTasksCount: number;
}

export const DynamicGreeting = ({ appointmentsCount, tasksCount, completedTasksCount }: DynamicGreetingProps) => {
  const { messages } = useDashboardMessages();

  const message = useMemo(() => {
    const now = new Date();
    const context: DashboardContext = {
      timeSlot: getCurrentTimeSlot(),
      dayOfWeek: getCurrentDayOfWeek(),
      appointmentsCount,
      tasksCount,
      completedTasks: completedTasksCount,
      isHoliday: false, // Can be extended with holiday detection
      month: now.getMonth() + 1
    };
    
    return selectMessage(context, messages);
  }, [appointmentsCount, tasksCount, completedTasksCount, messages]);
  
  const greeting = getGreeting(getCurrentTimeSlot());
  const fullMessage = `${greeting}! ${message.text}`;
  
  return (
    <div className="space-y-2">
      <TypewriterText 
        text={fullMessage}
        speed={30}
        className="text-2xl font-semibold text-foreground"
      />
    </div>
  );
};
