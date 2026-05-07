import { GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DeadlineItem, GroupedDeadlineItems } from '@/types/dashboardDeadlines';
import { DeadlineSnoozeButton } from './DeadlineSnoozeButton';
import {
  formatDeadlineDateLabel,
  getDeadlineContextLabel,
  getDeadlineStatus,
} from '@/utils/deadlineFormatting';

const TYPE_CONFIG = {
  task: { label: 'Aufgabe', tabBase: '/mywork?tab=tasks', barClass: 'bg-blue-500' },
  note: { label: 'Notiz', tabBase: '/mywork?tab=capture', barClass: 'bg-amber-500' },
  case: { label: 'Vorgang', tabBase: '/mywork?tab=cases', barClass: 'bg-emerald-500' },
  decision: { label: 'Entscheidung', tabBase: '/mywork?tab=decisions', barClass: 'bg-purple-500' },
  eventPlanning: { label: 'Veranstaltungsplanung', tabBase: '/eventplanning', barClass: 'bg-rose-500' },
};

interface DashboardTasksSectionProps {
  items: DeadlineItem[];
  grouped: GroupedDeadlineItems;
}

const stripOverduePrefix = (label: string) => label.replace(/^überfällig\s·\s/, '');

export const DashboardTasksSection = ({ items, grouped }: DashboardTasksSectionProps) => {
  const navigate = useNavigate();

  const handleDragStart = (event: React.DragEvent<HTMLElement>, title: string, id?: string, type?: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', title);
    event.dataTransfer.setData('application/x-mywork-task-title', title);
    if (id) event.dataTransfer.setData('application/x-mywork-task-id', id);
    if (type) event.dataTransfer.setData('application/x-mywork-item-type', type);
    const ghost = document.createElement('div');
    ghost.className = 'pointer-events-none bg-transparent px-0 py-0 text-lg font-medium text-foreground';
    ghost.textContent = title;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  };

  const overdueCount = grouped.overdue.length;
  const activeCount = items.length;

  // Flatten in priority order
  const ordered: DeadlineItem[] = [
    ...grouped.overdue,
    ...grouped.today,
    ...grouped.thisWeek,
    ...grouped.later,
  ];

  const renderItem = (item: DeadlineItem, index: number) => {
    const cfg = TYPE_CONFIG[item.type];
    const status = getDeadlineStatus(item.dueDate);
    const dateLabel = stripOverduePrefix(formatDeadlineDateLabel(item.dueDate));
    const contextLabel = getDeadlineContextLabel(item.type);

    const badge =
      status === 'overdue'
        ? { label: 'überfällig', className: 'bg-destructive/10 text-destructive' }
        : status === 'today'
          ? { label: 'heute', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
          : null;

    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`group relative flex items-start gap-3 py-3 pl-3 pr-2 cursor-pointer hover:bg-muted/30 transition-colors ${index > 0 ? 'border-t border-border/60' : ''}`}
        onClick={() =>
          navigate(
            item.type === 'eventPlanning' && item.planningId
              ? `${cfg.tabBase}/${item.planningId}`
              : `${cfg.tabBase}&highlight=${item.id}`,
          )
        }
        title={`${cfg.label} – Klicken zum Öffnen, oder per Handle in den Tageszettel ziehen`}
      >
        <span aria-hidden className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r ${cfg.barClass}`} />

        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.title, item.id, item.type); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Ziehen"
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing overflow-hidden inline-flex items-center max-w-0 -ml-1 opacity-0 group-hover:max-w-4 group-hover:ml-0 group-hover:opacity-100 transition-all duration-200 ease-out pt-0.5"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </span>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="text-sm font-semibold text-foreground truncate">{item.title}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {dateLabel} · {contextLabel}
          </div>
        </div>

        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
        {item.canSnooze ? <DeadlineSnoozeButton item={item} /> : null}
      </div>
    );
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine offenen Fristen.</p>;
  }

  return (
    <div>
      <div className="flex justify-end mb-2 text-xs text-muted-foreground tabular-nums">
        {activeCount} aktiv
        {overdueCount > 0 && <> · <span className="text-destructive ml-1">{overdueCount} überfällig</span></>}
      </div>
      <div>{ordered.map(renderItem)}</div>
    </div>
  );
};
