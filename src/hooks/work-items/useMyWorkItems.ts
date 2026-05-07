/**
 * MyWork → WorkItem projection (Phase 2a).
 *
 * Wraps the existing per-domain MyWork hooks and exposes their data through
 * the unified WorkItem abstraction. Existing UIs keep using their native
 * hooks unchanged; new shared UI (combined inboxes, cross-domain widgets,
 * notification badges) consumes this projection instead.
 *
 * No queries are duplicated — this is a pure in-memory mapping over the
 * already-cached domain data.
 */

import { useMemo } from 'react';
import { useMyWorkTasksData } from '@/hooks/useMyWorkTasksData';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { taskToWorkItem, decisionToWorkItem } from '@/hooks/work-items/adapters';
import type { WorkItem } from '@/types/workItem';

interface UseMyWorkItemsResult {
  items: WorkItem[];
  loading: boolean;
  error: string | null;
  byKind: {
    task: WorkItem[];
    decision: WorkItem[];
  };
}

/**
 * Combined, normalized view of the current user's open work
 * (assigned/created tasks + open decisions) as `WorkItem[]`.
 *
 * Sorted: items with a due date first (ascending), undated last.
 */
export function useMyWorkItems(userId?: string): UseMyWorkItemsResult {
  const tasksHook = useMyWorkTasksData(userId);
  const decisionsHook = useMyWorkDecisionsData(userId);

  return useMemo(() => {
    const taskRows = [
      ...(tasksHook.assignedTasks ?? []),
      ...(tasksHook.createdTasks ?? []),
    ];

    // Dedupe (task can appear as both assigned + created).
    const seen = new Set<string>();
    const taskItems: WorkItem[] = [];
    for (const row of taskRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      taskItems.push(taskToWorkItem(row));
    }

    const decisionItems = (decisionsHook.decisions ?? []).map(decisionToWorkItem);

    const items = [...taskItems, ...decisionItems].sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return b.created_at.localeCompare(a.created_at);
    });

    return {
      items,
      loading: Boolean(tasksHook.loading || decisionsHook.loading),
      error: tasksHook.error ?? decisionsHook.error ?? null,
      byKind: { task: taskItems, decision: decisionItems },
    };
  }, [
    tasksHook.assignedTasks,
    tasksHook.createdTasks,
    tasksHook.loading,
    tasksHook.error,
    decisionsHook.decisions,
    decisionsHook.loading,
    decisionsHook.error,
  ]);
}
