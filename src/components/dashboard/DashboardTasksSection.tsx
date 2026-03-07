import { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const DashboardTasksSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [completedTasksToday, setCompletedTasksToday] = useState(0);
  const [openTaskTitles, setOpenTaskTitles] = useState<{ id: string; title: string }[]>([]);

  const handleTaskTitleDragStart = (event: React.DragEvent<HTMLElement>, taskTitle: string, taskId?: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', taskTitle);
    event.dataTransfer.setData('application/x-mywork-task-title', taskTitle);
    if (taskId) {
      event.dataTransfer.setData('application/x-mywork-task-id', taskId);
    }
    const ghost = document.createElement('div');
    ghost.className = 'pointer-events-none bg-transparent px-0 py-0 text-lg font-medium text-foreground';
    ghost.textContent = taskTitle;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  };

  useEffect(() => {
    if (!user?.id) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq('status', 'completed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .eq('status', 'completed').gte('updated_at', today.toISOString()),
      supabase.from('tasks').select('id, title')
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq('status', 'completed').order('due_date', { ascending: true, nullsFirst: false }),
    ]).then(([open, completed, tasks]) => {
      setOpenTasksCount(open.count || 0);
      setCompletedTasksToday(completed.count || 0);
      setOpenTaskTitles(
        (tasks.data || []).filter(t => Boolean(t.title?.trim())).map(t => ({ id: t.id, title: t.title!.trim() }))
      );
    });
  }, [user]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">
        ✅ Aufgabenstatus
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        {openTasksCount} offen · {completedTasksToday} heute erledigt
      </p>
      {openTaskTitles.length > 0 && (
        <div className="space-y-0.5">
          {openTaskTitles.map((task, index) => (
            <div
              key={`${task.id}-${index}`}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-foreground/90 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => navigate('/mywork?tab=tasks')}
              title="Klicken um zur Aufgabe zu gehen, oder per Handle in den Tageszettel ziehen"
            >
              <span
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  handleTaskTitleDragStart(event, task.title, task.id);
                }}
                className="cursor-grab rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
                aria-label="Aufgabe in den Tageszettel ziehen"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
