import { useEffect, useMemo, useState } from 'react';
import { GripVertical, CheckSquare, StickyNote, Briefcase, Vote, CalendarPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { DeadlineItem, GroupedDeadlineItems } from '@/types/dashboardDeadlines';

const TYPE_CONFIG = {
  task: { icon: CheckSquare, label: 'Aufgabe', tabBase: '/mywork?tab=tasks', color: 'text-blue-500' },
  note: { icon: StickyNote, label: 'Notiz', tabBase: '/mywork?tab=capture', color: 'text-amber-500' },
  case: { icon: Briefcase, label: 'Vorgang', tabBase: '/mywork?tab=cases', color: 'text-emerald-500' },
  decision: { icon: Vote, label: 'Entscheidung', tabBase: '/mywork?tab=decisions', color: 'text-purple-500' },
  eventPlanning: { icon: CalendarPlus, label: 'Veranstaltungsplanung', tabBase: '/eventplanning', color: 'text-rose-500' },
};

interface DashboardTasksSectionProps {
  items: DeadlineItem[];
  grouped: GroupedDeadlineItems;
}

export const DashboardTasksSection = ({ items, grouped }: DashboardTasksSectionProps) => {
  const navigate = useNavigate();
  const shouldCollapseLaterByDefault = useMemo(
    () => items.length > 5 && grouped.later.length > 0,
    [items.length, grouped.later.length],
  );
  const [isLaterExpanded, setIsLaterExpanded] = useState(!shouldCollapseLaterByDefault);

  useEffect(() => {
    setIsLaterExpanded(!shouldCollapseLaterByDefault);
  }, [shouldCollapseLaterByDefault]);

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

  const renderItem = (item: DeadlineItem) => {
    const cfg = TYPE_CONFIG[item.type];
    const Icon = cfg.icon;
    return (
      <div
        key={`${item.type}-${item.id}`}
        className="group flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-foreground/90 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => navigate(item.type === 'eventPlanning' && item.planningId ? `${cfg.tabBase}/${item.planningId}` : `${cfg.tabBase}&highlight=${item.id}`)}
        title={`${cfg.label} – Klicken zum Öffnen, oder per Handle in den Tageszettel ziehen`}
      >
        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, item.title, item.id, item.type); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Ziehen"
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing overflow-hidden inline-flex items-center max-w-0 -ml-1.5 opacity-0 group-hover:max-w-4 group-hover:ml-0 group-hover:opacity-100 transition-all duration-200 ease-out"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
        <span className="flex-1 truncate">{item.title}</span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {format(new Date(item.dueDate), 'dd.MM.', { locale: de })}
        </span>
      </div>
    );
  };

  const renderGroup = (
    label: string,
    groupItems: DeadlineItem[],
    headerClass?: string,
    options?: { collapsible?: boolean; expanded?: boolean; onToggle?: () => void },
  ) => {
    if (groupItems.length === 0) return null;

    const isCollapsible = options?.collapsible ?? false;
    const isExpanded = options?.expanded ?? true;
    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
      <div key={label}>
        {isCollapsible ? (
          <button
            type="button"
            onClick={options?.onToggle}
            className="mb-1 flex w-full items-center gap-1 text-left"
            aria-expanded={isExpanded}
            aria-controls={`deadline-group-${label.toLowerCase()}`}
          >
            <ChevronIcon className={`h-3.5 w-3.5 shrink-0 ${headerClass || 'text-muted-foreground'}`} />
            <h4 className={`text-xs font-bold uppercase tracking-wide ${headerClass || 'text-muted-foreground'}`}>
              {label}
            </h4>
          </button>
        ) : (
          <h4 className={`mb-1 text-xs font-bold uppercase tracking-wide ${headerClass || 'text-muted-foreground'}`}>{label}</h4>
        )}
        {isExpanded ? <div id={`deadline-group-${label.toLowerCase()}`} className="space-y-0.5">{groupItems.map(renderItem)}</div> : null}
      </div>
    );
  };

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine offenen Fristen.</p>
      ) : (
        <div className="space-y-4">
          {renderGroup('Überfällig', grouped.overdue, 'text-destructive')}
          {renderGroup('Heute', grouped.today)}
          {renderGroup('Nächste 7 Tage', grouped.thisWeek)}
          {renderGroup('Später', grouped.later, undefined, {
            collapsible: shouldCollapseLaterByDefault,
            expanded: isLaterExpanded,
            onToggle: () => setIsLaterExpanded((current) => !current),
          })}
        </div>
      )}
    </div>
  );
};
