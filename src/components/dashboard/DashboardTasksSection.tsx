import { useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { BriefcaseBusiness, CalendarDays, Check, ClipboardCheck, ListTodo, StickyNote, ChevronRight, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DeadlineItem, GroupedDeadlineItems } from '@/types/dashboardDeadlines';
import { useDeadlineActions } from '@/hooks/useDeadlineActions';
import { DeadlineReviewDialog } from './DeadlineReviewDialog';
import { DeadlineSnoozeButton } from './DeadlineSnoozeButton';
import {
  formatDeadlineDateLabel,
  getDeadlineContextLabel,
  getDeadlineStatus,
  DEADLINE_STATUS_BAR_CLASS,
} from '@/utils/deadlineFormatting';

const TYPE_CONFIG = {
  task: { label: 'Aufgabe', tabBase: '/mywork?tab=tasks', Icon: ListTodo },
  note: { label: 'Notiz', tabBase: '/mywork?tab=capture', Icon: StickyNote },
  case: { label: 'Vorgang', tabBase: '/mywork?tab=cases', Icon: BriefcaseBusiness },
  decision: { label: 'Entscheidung', tabBase: '/mywork?tab=decisions', Icon: ClipboardCheck },
  eventPlanning: { label: 'Veranstaltung', tabBase: '/eventplanning', Icon: CalendarDays },
};
const GROUP_CONFIG = {
  overdue: { label: 'Überfällig', color: 'bg-destructive' },
  today: { label: 'Heute', color: 'bg-palette-amber' },
  thisWeek: { label: 'Restliche Woche', color: 'bg-palette-blue' },
  later: { label: 'Später', color: 'bg-muted-foreground/50' },
};

type GroupKey = 'overdue' | 'today' | 'thisWeek' | 'later';
const PAGE_SIZE = 5;

interface DashboardTasksSectionProps {
  items: DeadlineItem[];
  grouped: GroupedDeadlineItems;
}

export const DashboardTasksSection = ({ items, grouped }: DashboardTasksSectionProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GroupKey | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const actions = useDeadlineActions();
  const oldItems = grouped.overdue.filter(item => differenceInCalendarDays(new Date(), new Date(item.dueDate)) > 30);
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

  const renderItem = (item: DeadlineItem, index: number) => {
    const cfg = TYPE_CONFIG[item.type];
    const dateLabel = formatDeadlineDateLabel(item.dueDate);
    const contextLabel = getDeadlineContextLabel(item.type);

    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`group relative flex items-start gap-3 py-1.5 pl-3 pr-2 cursor-pointer hover:bg-muted/30 transition-colors ${index > 0 ? 'border-t border-border/40' : ''}`}
      >
        <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r ${DEADLINE_STATUS_BAR_CLASS[getDeadlineStatus(item.dueDate)]}`} />

        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.title, item.id, item.type); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Ziehen"
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing overflow-hidden inline-flex items-center max-w-0 -ml-1 opacity-0 group-hover:max-w-4 group-hover:ml-0 group-hover:opacity-100 transition-all duration-200 ease-out pt-0.5"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </span>

        <button type="button" className="flex-1 min-w-0 text-left rounded focus-visible:outline-primary" onClick={() => navigate(item.type === 'eventPlanning' && item.planningId ? `${cfg.tabBase}/${item.planningId}` : `${cfg.tabBase}&highlight=${item.id}`)} title={`${cfg.label} öffnen`}>
          <div className="text-sm font-medium text-foreground truncate leading-tight">{item.title}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/80 tabular-nums leading-tight mt-1">
            <cfg.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {contextLabel} · {dateLabel}
          </div>
        </button>

        {item.canSnooze && <div className="inline-flex shrink-0 items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button type="button" disabled={actions.isPending} className="rounded p-2 hover:bg-muted focus-visible:outline-primary disabled:opacity-50" aria-label={`${item.title}: Erledigt`} title="Erledigt" onClick={() => actions.mutate({ items: [item], action: 'complete' })}><Check className="h-4 w-4" aria-hidden="true" /></button>
          <DeadlineSnoozeButton item={item} />
        </div>}
      </div>
    );
  };

  const renderGroup = (key: GroupKey, label: string, list: DeadlineItem[], labelClass = 'text-muted-foreground') => {
    if (list.length === 0 || (filter && filter !== key)) return null;
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
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Fristen nach Dringlichkeit filtern">
        {(Object.keys(GROUP_CONFIG) as GroupKey[]).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(current => current === key ? null : key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm focus-visible:outline-primary ${filter === key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
          <span className={`h-2 w-2 rounded-full ${GROUP_CONFIG[key].color}`} aria-hidden="true" />
          {GROUP_CONFIG[key].label} <span className="tabular-nums font-medium">{grouped[key].length}</span>
        </button>)}
      </div>

      {filter && grouped[filter].length === 0 && <p className="py-3 text-sm text-muted-foreground">Keine Fristen in diesem Bereich.</p>}
      {renderGroup('today', 'Heute', grouped.today, 'text-palette-amber')}
      {renderGroup('thisWeek', 'Restliche Woche', grouped.thisWeek, 'text-palette-blue')}
      {renderGroup('overdue', 'Überfällig · nach Priorität', grouped.overdue, 'text-destructive')}
      {oldItems.length > 0 && (!filter || filter === 'overdue') && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-palette-amber/15 p-3 text-sm">
        <span>{oldItems.length} {oldItems.length === 1 ? 'Frist ist' : 'Fristen sind'} seit mehr als 30 Tagen überfällig.</span>
        <button type="button" className="rounded border border-border px-3 py-2 font-medium hover:bg-background/60 focus-visible:outline-primary" onClick={() => setReviewOpen(true)}>Alte Fristen prüfen</button>
      </div>}
      <DeadlineReviewDialog items={oldItems} open={reviewOpen} onOpenChange={setReviewOpen} />

      {grouped.later.length > 0 && (!filter || filter === 'later') && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => { if (filter === 'later') { setFilter(null); setShowLater(false); } else setShowLater(v => !v); }}
            className="section-label flex w-full items-center gap-2 px-3 pb-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showLater || filter === 'later'}
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showLater || filter === 'later' ? 'rotate-90' : ''}`}
              aria-hidden
            />
            <span>Später</span>
            <span className="tabular-nums opacity-70">{grouped.later.length}</span>
            <span className="flex-1 h-px bg-border/60" aria-hidden />
          </button>
          {(showLater || filter === 'later') && (
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
