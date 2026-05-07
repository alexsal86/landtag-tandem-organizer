import { useState } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DeadlineItem, GroupedDeadlineItems } from '@/types/dashboardDeadlines';
import { DeadlineSnoozeButton } from './DeadlineSnoozeButton';
import {
  formatDeadlineDateLabel,
  getDeadlineContextLabel,
} from '@/utils/deadlineFormatting';

const TYPE_CONFIG = {
  task: { label: 'Aufgabe', tabBase: '/mywork?tab=tasks', barClass: 'bg-palette-blue' },
  note: { label: 'Notiz', tabBase: '/mywork?tab=capture', barClass: 'bg-palette-amber' },
  case: { label: 'Vorgang', tabBase: '/mywork?tab=cases', barClass: 'bg-palette-green' },
  decision: { label: 'Entscheidung', tabBase: '/mywork?tab=decisions', barClass: 'bg-palette-purple' },
  eventPlanning: { label: 'Veranstaltungsplanung', tabBase: '/eventplanning', barClass: 'bg-palette-rose' },
};

type GroupKey = 'overdue' | 'today' | 'thisWeek' | 'later';
const PAGE_SIZE = 5;

interface DashboardTasksSectionProps {
  items: DeadlineItem[];
  grouped: GroupedDeadlineItems;
}

const stripOverduePrefix = (label: string) => label.replace(/^überfällig\s·\s/, '');

export const DashboardTasksSection = ({ items, grouped }: DashboardTasksSectionProps) => {
  const navigate = useNavigate();
  const [showLater, setShowLater] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<GroupKey, number>>({
    overdue: PAGE_SIZE,
    today: PAGE_SIZE,
    thisWeek: PAGE_SIZE,
    later: PAGE_SIZE,
  });

  const showMore = (key: GroupKey) =>
    setVisibleCounts((v) => ({ ...v, [key]: v[key] + PAGE_SIZE }));

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

  const renderItem = (item: DeadlineItem, index: number) => {
    const cfg = TYPE_CONFIG[item.type];
    const dateLabel = stripOverduePrefix(formatDeadlineDateLabel(item.dueDate));
    const contextLabel = getDeadlineContextLabel(item.type);

    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`group relative flex items-start gap-3 py-1.5 pl-3 pr-2 cursor-pointer hover:bg-muted/30 transition-colors ${index > 0 ? 'border-t border-border/40' : ''}`}
        onClick={() =>
          navigate(
            item.type === 'eventPlanning' && item.planningId
              ? `${cfg.tabBase}/${item.planningId}`
              : `${cfg.tabBase}&highlight=${item.id}`,
          )
        }
        title={`${cfg.label} – Klicken zum Öffnen, oder per Handle in den Tageszettel ziehen`}
      >
        <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r ${cfg.barClass}`} />

        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.title, item.id, item.type); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Ziehen"
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing overflow-hidden inline-flex items-center max-w-0 -ml-1 opacity-0 group-hover:max-w-4 group-hover:ml-0 group-hover:opacity-100 transition-all duration-200 ease-out pt-0.5"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate leading-tight">{item.title}</div>
          <div className="text-xs text-muted-foreground/80 tabular-nums leading-tight mt-0.5">
            {dateLabel} · {contextLabel}
          </div>
        </div>

        {item.canSnooze ? <DeadlineSnoozeButton item={item} /> : null}
      </div>
    );
  };

  const renderGroup = (key: GroupKey, label: string, list: DeadlineItem[], labelClass = 'text-muted-foreground') => {
    if (list.length === 0) return null;
    const visible = visibleCounts[key];
    const slice = list.slice(0, visible);
    const remaining = list.length - slice.length;
    return (
      <div className="mt-3 first:mt-0">
        <div className={`section-label flex items-center gap-2 px-3 pb-1 ${labelClass}`}>
          <span>{label}</span>
          <span className="tabular-nums opacity-70">{list.length}</span>
          <span className="flex-1 h-px bg-border/60" aria-hidden />
        </div>
        <div>{slice.map(renderItem)}</div>
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => showMore(key)}
            className="ml-3 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            +{remaining} weitere anzeigen
          </button>
        )}
      </div>
    );
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine offenen Fristen.</p>;
  }

  const laterVisible = visibleCounts.later;
  const laterSlice = grouped.later.slice(0, laterVisible);
  const laterRemaining = grouped.later.length - laterSlice.length;

  return (
    <div>
      <div className="flex justify-end mb-2 text-xs text-muted-foreground tabular-nums">
        {activeCount} aktiv
        {overdueCount > 0 && <> · <span className="text-destructive ml-1">{overdueCount} überfällig</span></>}
      </div>

      {renderGroup('overdue', 'Überfällig', grouped.overdue, 'text-destructive')}
      {renderGroup('today', 'Heute', grouped.today, 'text-palette-green')}
      {renderGroup('thisWeek', 'Diese Woche', grouped.thisWeek)}

      {grouped.later.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowLater((v) => !v)}
            className="section-label flex w-full items-center gap-2 px-3 pb-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showLater}
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showLater ? 'rotate-90' : ''}`}
              aria-hidden
            />
            <span>Später</span>
            <span className="tabular-nums opacity-70">{grouped.later.length}</span>
            <span className="flex-1 h-px bg-border/60" aria-hidden />
          </button>
          {showLater && (
            <>
              <div>{laterSlice.map(renderItem)}</div>
              {laterRemaining > 0 && (
                <button
                  type="button"
                  onClick={() => showMore('later')}
                  className="ml-3 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  +{laterRemaining} weitere anzeigen
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
