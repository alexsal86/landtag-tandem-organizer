import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface TaskStats {
  completed: number;
  inProgress: number;
  open: number;
  overdue: number;
}

export function TaskProgressChart() {
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState<TaskStats>({
    completed: 0,
    inProgress: 0,
    open: 0,
    overdue: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentTenant?.id) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch completed tasks
      const { count: completedCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'completed');

      // Fetch in-progress tasks
      const { count: inProgressCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'in_progress');

      // Fetch open tasks
      const { count: openCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'todo');

      // Fetch overdue tasks
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .neq('status', 'completed')
        .lt('due_date', today.toISOString());

      setStats({
        completed: completedCount || 0,
        inProgress: inProgressCount || 0,
        open: openCount || 0,
        overdue: overdueCount || 0
      });
    };

    fetchStats();
  }, [currentTenant]);

  const chartData = [
    { name: 'Erledigt', value: stats.completed, color: 'hsl(var(--primary))' },
    { name: 'In Bearbeitung', value: stats.inProgress, color: 'hsl(var(--accent))' },
    { name: 'Offen', value: stats.open, color: 'hsl(var(--muted))' },
    { name: 'Überfällig', value: stats.overdue, color: 'hsl(var(--secondary))' }
  ].filter(item => item.value > 0);

  const total = stats.completed + stats.inProgress + stats.open + stats.overdue;

  if (total === 0) {
    return null;
  }

  return (
    <Card className="transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 animate-scale-in-bounce">
      <CardHeader>
        <CardTitle className="font-headline">Aufgabenübersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
