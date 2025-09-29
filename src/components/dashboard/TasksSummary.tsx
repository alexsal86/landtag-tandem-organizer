import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TasksSummaryProps {
  onCountChange?: (count: number) => void;
  onCompletedCountChange?: (count: number) => void;
}

export const TasksSummary = ({ onCountChange, onCompletedCountChange }: TasksSummaryProps) => {
  const [tasksCount, setTasksCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          Offene Aufgaben
          <Badge variant="secondary">{tasksCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {tasksCount === 0 && 'Alle Aufgaben erledigt! 🎉'}
          {tasksCount === 1 && 'Eine Aufgabe wartet auf dich'}
          {tasksCount > 1 && `${tasksCount} Aufgaben warten auf dich`}
        </p>
      </CardContent>
    </Card>
  );
};
