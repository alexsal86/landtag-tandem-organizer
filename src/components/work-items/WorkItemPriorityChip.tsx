/**
 * Shared priority chip for the WorkItem abstraction.
 * Replaces per-domain priority pills (tasks, decisions, cases, vorgänge).
 */

import type { WorkItemPriority } from '@/types/workItem';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Equal, Flame } from 'lucide-react';

const PRIORITY_LABEL: Record<WorkItemPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

const PRIORITY_CLASS: Record<WorkItemPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-muted/60 text-muted-foreground',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

const PRIORITY_ICON: Record<WorkItemPriority, typeof Equal> = {
  low: ArrowDown,
  normal: Equal,
  high: ArrowUp,
  urgent: Flame,
};

interface Props {
  priority: WorkItemPriority;
  showLabel?: boolean;
  className?: string;
}

export function WorkItemPriorityChip({ priority, showLabel = true, className }: Props) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium',
        PRIORITY_CLASS[priority],
        className,
      )}
      title={PRIORITY_LABEL[priority]}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {showLabel && PRIORITY_LABEL[priority]}
    </span>
  );
}
