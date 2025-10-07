import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// CountUp Hook for number animations
const useCountUp = (end: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      setCount(Math.floor(end * percentage));
      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return count;
};

interface TasksSummaryProps {
  onCountChange?: (count: number) => void;
  onCompletedCountChange?: (count: number) => void;
}

export const TasksSummary = ({ onCountChange, onCompletedCountChange }: TasksSummaryProps) => {
  const [tasksCount, setTasksCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const animatedTasksCount = useCountUp(tasksCount, 800);
  
  useEffect(() => {
    const fetchTasksCount = async () => {
      try {
        const { count: openCount, error: openError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'completed');
        
        const { count: completedTasksCount, error: completedError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
        
        if (!openError && openCount !== null) {
          setTasksCount(openCount);
          if (onCountChange) {
            onCountChange(openCount);
          }
        }
        
        if (!completedError && completedTasksCount !== null) {
          setCompletedCount(completedTasksCount);
          if (onCompletedCountChange) {
            onCompletedCountChange(completedTasksCount);
          }
        }
      } catch (error) {
        console.error('Error fetching tasks count:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasksCount();
  }, [onCountChange, onCompletedCountChange]);
  
  if (loading) {
    return null;
  }
  
  return (
    <Card className="transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 animate-scale-in-bounce">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <div className="p-2 rounded-lg bg-primary/10">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          Offene Aufgaben
          <Badge 
            variant="secondary" 
            className="ml-auto text-base font-bold"
          >
            {animatedTasksCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {tasksCount === 0 && '✅ Alle Aufgaben erledigt! 🎉'}
          {tasksCount === 1 && '📝 Eine Aufgabe wartet auf dich'}
          {tasksCount > 1 && `📝 ${tasksCount} Aufgaben warten auf dich`}
        </p>
        {completedCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            🎯 {completedCount} erledigt
          </p>
        )}
      </CardContent>
    </Card>
  );
};
