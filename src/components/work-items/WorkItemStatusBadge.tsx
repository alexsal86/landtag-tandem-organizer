/**
 * Shared status badge for the WorkItem abstraction.
 * Replaces per-domain status pills (tasks, decisions, cases, vorgänge).
 */

import type { WorkItemStatus } from '@/types/workItem';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting: 'Wartet',
  done: 'Erledigt',
  cancelled: 'Abgebrochen',
};

const STATUS_CLASS: Record<WorkItemStatus, string> = {
  open: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  waiting: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

interface Props {
  status: WorkItemStatus;
  className?: string;
}

export function WorkItemStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium',
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
