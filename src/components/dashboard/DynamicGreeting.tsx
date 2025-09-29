import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TypewriterText } from './TypewriterText';
import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import type { DashboardContext } from '@/utils/dashboard/messageGenerator';

interface DynamicGreetingProps {
  appointmentsCount: number;
  tasksCount: number;
}

export const DynamicGreeting = ({ appointmentsCount, tasksCount }: DynamicGreetingProps) => {
  const message = useMemo(() => {
    const context: DashboardContext = {
      timeSlot: getCurrentTimeSlot(),
      dayOfWeek: getCurrentDayOfWeek(),
      appointmentsCount,
      tasksCount
    };
    
    return selectMessage(context);
  }, [appointmentsCount, tasksCount]);
  
  const greeting = getGreeting(getCurrentTimeSlot());
  const fullMessage = `${greeting}! ${message.text}`;
  
  const variantStyles = {
    motivational: 'border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent',
    encouraging: 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/5 to-transparent',
    relaxed: 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/5 to-transparent',
    celebration: 'border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-500/5 to-transparent'
  };
  
  const variantStyle = message.variant ? variantStyles[message.variant] : '';
  
  return (
    <Card className={`${variantStyle} border-border/50`}>
      <CardContent className="p-6">
        <TypewriterText 
          text={fullMessage}
          speed={30}
          className="text-2xl font-semibold text-foreground"
        />
      </CardContent>
    </Card>
  );
};
