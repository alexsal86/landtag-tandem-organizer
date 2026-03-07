import { useEffect, useState, useMemo } from 'react';
import { GripVertical, CheckSquare, StickyNote, Briefcase, Vote } from 'lucide-react';
import { format, isToday, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useNavigate } from 'react-router-dom';

interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  type: 'task' | 'note' | 'case' | 'decision';
}

const TYPE_CONFIG = {
  task: { icon: CheckSquare, label: 'Aufgabe', tab: '/mywork?tab=tasks', color: 'text-blue-500' },
  note: { icon: StickyNote, label: 'Notiz', tab: '/mywork?tab=capture', color: 'text-amber-500' },
  case: { icon: Briefcase, label: 'Vorgang', tab: '/mywork?tab=cases', color: 'text-emerald-500' },
  decision: { icon: Vote, label: 'Entscheidung', tab: '/mywork?tab=decisions', color: 'text-purple-500' },
};

export const DashboardTasksSection = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [items, setItems] = useState<DeadlineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleDragStart = (event: React.DragEvent<HTMLElement>, title: string, id?: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', title);
    event.dataTransfer.setData('application/x-mywork-task-title', title);
    if (id) event.dataTransfer.setData('application/x-mywork-task-id', id);
    const ghost = document.createElement('div');
    ghost.className = 'pointer-events-none bg-transparent px-0 py-0 text-lg font-medium text-foreground';
    ghost.textContent = title;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  };

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setIsLoading(true);
      const tenantId = currentTenant?.id;

      const [tasksRes, notesRes, casesRes, decisionsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, due_date')
          .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
          .neq('status', 'completed')
          .not('due_date', 'is', null),
        supabase.from('quick_notes').select('id, title, content, follow_up_date')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .or('is_archived.is.null,is_archived.eq.false')
          .not('follow_up_date', 'is', null),
        tenantId
          ? supabase.from('case_items').select('id, subject, due_at')
              .eq('tenant_id', tenantId)
              .not('due_at', 'is', null)
              .neq('status', 'erledigt')
          : Promise.resolve({ data: [] }),
        supabase.from('task_decisions').select('id, title, response_deadline')
          .neq('status', 'resolved')
          .is('archived_at', null)
          .not('response_deadline', 'is', null),
      ]);

      const all: DeadlineItem[] = [
        ...(tasksRes.data || []).filter((t: any) => t.due_date && t.title?.trim()).map((t: any) => ({
          id: t.id, title: t.title.trim(), dueDate: t.due_date, type: 'task' as const,
        })),
        ...(notesRes.data || []).filter((n: any) => n.follow_up_date).map((n: any) => ({
          id: n.id, title: (n.title || n.content || '').trim().substring(0, 80), dueDate: n.follow_up_date, type: 'note' as const,
        })),
        ...(casesRes.data || []).filter((c: any) => c.due_at).map((c: any) => ({
          id: c.id, title: (c.subject || 'Vorgang').trim(), dueDate: c.due_at, type: 'case' as const,
        })),
        ...(decisionsRes.data || []).filter((d: any) => d.response_deadline && d.title?.trim()).map((d: any) => ({
          id: d.id, title: d.title.trim(), dueDate: d.response_deadline, type: 'decision' as const,
        })),
      ];

      all.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setItems(all);
      setIsLoading(false);
    };
    load();
  }, [user, currentTenant]);

  const grouped = useMemo(() => {
    const overdue: DeadlineItem[] = [];
    const today: DeadlineItem[] = [];
    const thisWeek: DeadlineItem[] = [];
    const later: DeadlineItem[] = [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const sevenDaysOut = addDays(todayStart, 7);

    for (const item of items) {
      const d = new Date(item.dueDate);
      if (isBefore(d, todayStart)) overdue.push(item);
      else if (isToday(d)) today.push(item);
      else if (!isAfter(d, sevenDaysOut)) thisWeek.push(item);
      else later.push(item);
    }
    return { overdue, today, thisWeek, later };
  }, [items]);

  const renderItem = (item: DeadlineItem) => {
    const cfg = TYPE_CONFIG[item.type];
    const Icon = cfg.icon;
    return (
      <div
        key={`${item.type}-${item.id}`}
        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-foreground/90 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => navigate(cfg.tab)}
        title={`${cfg.label} – Klicken zum Öffnen, oder per Handle in den Tageszettel ziehen`}
      >
        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.title, item.id); }}
          className="cursor-grab rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
        <span className="flex-1 truncate">{item.title}</span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {format(new Date(item.dueDate), 'dd.MM.', { locale: de })}
        </span>
      </div>
    );
  };

  const renderGroup = (label: string, groupItems: DeadlineItem[], headerClass?: string) => {
    if (groupItems.length === 0) return null;
    return (
      <div key={label}>
        <h4 className={`text-xs font-medium uppercase tracking-wide mb-1 ${headerClass || 'text-muted-foreground'}`}>{label}</h4>
        <div className="space-y-0.5">{groupItems.map(renderItem)}</div>
      </div>
    );
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">📋 Fristen</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine offenen Fristen.</p>
      ) : (
        <div className="space-y-4">
          {renderGroup('Überfällig', grouped.overdue, 'text-destructive')}
          {renderGroup('Heute', grouped.today)}
          {renderGroup('Nächste 7 Tage', grouped.thisWeek)}
          {renderGroup('Später', grouped.later)}
        </div>
      )}
    </div>
  );
};
