/**
 * MyWork → WorkItem projection (Phase 2a/2c).
 *
 * Wraps the existing per-domain MyWork hooks and exposes their data through
 * the unified WorkItem abstraction. Existing UIs keep using their native
 * hooks unchanged; new shared UI consumes this projection instead.
 *
 * No DB queries are duplicated — pure in-memory mapping over already-cached
 * domain data (tasks, decisions, case_items / Vorgänge).
 */

import { useMemo } from 'react';
import { useMyWorkTasksData } from '@/hooks/useMyWorkTasksData';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { useMyWorkCaseItems } from '@/hooks/work-items/useMyWorkCaseItems';
import {
  taskToWorkItem,
  decisionToWorkItem,
  caseItemToWorkItem,
} from '@/hooks/work-items/adapters';
import type { WorkItem } from '@/types/workItem';

interface UseMyWorkItemsResult {
  items: WorkItem[];
  loading: boolean;
  error: string | null;
  byKind: {
    task: WorkItem[];
    decision: WorkItem[];
    case_item: WorkItem[];
  };
}

/**
 * Combined, normalized view of the current user's open work
 * (tasks + decisions + case_items/Vorgänge) as `WorkItem[]`.
 *
 * Sorted: items with a due date first (ascending), undated last.
 */
export function useMyWorkItems(userId?: string): UseMyWorkItemsResult {
  const tasksHook = useMyWorkTasksData(userId);
  const decisionsHook = useMyWorkDecisionsData(userId);
  const caseItemsQuery = useMyWorkCaseItems(userId);

  return useMemo(() => {
    const taskRows = [
      ...(tasksHook.assignedTasks ?? []),
      ...(tasksHook.createdTasks ?? []),
    ];

    // Dedupe (a task can appear as both assigned + created).
    const seen = new Set<string>();
    const taskItems: WorkItem[] = [];
    for (const row of taskRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      taskItems.push(taskToWorkItem(row));
    }

    const decisionItems = (decisionsHook.decisions ?? []).map(decisionToWorkItem);
    const caseItems = (caseItemsQuery.data ?? []).map(caseItemToWorkItem);

    const items = [...taskItems, ...decisionItems, ...caseItems].sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return b.created_at.localeCompare(a.created_at);
    });

    return {
      items,
      loading: Boolean(
        tasksHook.loading || decisionsHook.loading || caseItemsQuery.isLoading,
      ),
      error:
        tasksHook.error ??
        decisionsHook.error ??
        (caseItemsQuery.error instanceof Error ? caseItemsQuery.error.message : null),
      byKind: { task: taskItems, decision: decisionItems, case_item: caseItems },
    };
  }, [
    tasksHook.assignedTasks,
    tasksHook.createdTasks,
    tasksHook.loading,
    tasksHook.error,
    decisionsHook.decisions,
    decisionsHook.loading,
    decisionsHook.error,
    caseItemsQuery.data,
    caseItemsQuery.isLoading,
    caseItemsQuery.error,
  ]);
}
