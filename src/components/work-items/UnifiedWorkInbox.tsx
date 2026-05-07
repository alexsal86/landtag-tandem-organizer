/**
 * Unified inbox widget — pilot consumer of the WorkItem abstraction.
 *
 * Shows the current user's open work across tasks, decisions and Vorgänge
 * in one chronologically-sorted list. Each row is rendered by a single
 * shared component regardless of source domain.
 *
 * This widget validates that the WorkItem model + adapters cover the
 * common use case before we migrate existing per-domain UIs.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyWorkItems } from '@/hooks/work-items/useMyWorkItems';
import { WorkItemStatusBadge } from '@/components/work-items/WorkItemStatusBadge';
import type { WorkItem, WorkItemKind } from '@/types/workItem';
import { CheckSquare, GitBranch, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<WorkItemKind, string> = {
  task: 'Aufgabe',
  decision: 'Entscheidung',
  case_item: 'Vorgang',
  vorgang: 'Vorgang',
};

const KIND_ICON: Record<WorkItemKind, typeof CheckSquare> = {
  task: CheckSquare,
  decision: GitBranch,
  case_item: Inbox,
  vorgang: Inbox,
};

const KIND_ROUTE: Record<WorkItemKind, (id: string) => string> = {
  task: (id) => `/aufgaben/${id}`,
  decision: (id) => `/entscheidungen/${id}`,
  case_item: (id) => `/vorgaenge/${id}`,
  vorgang: (id) => `/vorgaenge/${id}`,
};

function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  limit?: number;
  className?: string;
}

export function UnifiedWorkInbox({ limit = 10, className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, loading, error } = useMyWorkItems(user?.id);

  const visible = items.filter((it) => it.status !== 'done' && it.status !== 'cancelled').slice(0, limit);

  return (
    <section
      className={cn('rounded-lg border bg-card p-4', className)}
      aria-label="Vereinheitlichter Posteingang"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-title">Mein Posteingang</h2>
        <span className="text-caption text-muted-foreground tabular-nums">{items.length}</span>
      </header>

      {loading && <p className="text-caption text-muted-foreground">Lade…</p>}
      {error && <p className="text-caption text-destructive">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="text-caption text-muted-foreground">Keine offenen Punkte. 🎉</p>
      )}

      <ul className="divide-y">
        {visible.map((item) => (
          <WorkInboxRow key={item.uid} item={item} onOpen={(it) => navigate(KIND_ROUTE[it.kind](it.id))} />
        ))}
      </ul>
    </section>
  );
}

function WorkInboxRow({ item, onOpen }: { item: WorkItem; onOpen: (item: WorkItem) => void }) {
  const Icon = KIND_ICON[item.kind];
  const due = formatDueDate(item.due_at);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-muted/40 rounded-sm transition-colors"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-caption uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[item.kind]}
            </span>
            <WorkItemStatusBadge status={item.status} />
          </div>
          <p className="truncate text-body">{item.title}</p>
        </div>
        {due && <span className="text-caption tabular-nums text-muted-foreground">{due}</span>}
      </button>
    </li>
  );
}
