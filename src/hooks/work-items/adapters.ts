/**
 * Adapter functions: raw DB rows → WorkItem.
 *
 * Each adapter takes the minimal column set actually selected by the
 * domain hooks today, so we can drop these adapters into existing
 * pipelines without changing queries.
 */

import {
  WorkItem,
  WorkItemKind,
  buildUid,
  normalizePriority,
  normalizeStatus,
} from '@/types/workItem';

interface RawTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at?: string | null;
  user_id: string;
  assigned_to: string | null;
  tenant_id?: string | null;
  task_assignees?: Array<{ user_id: string }> | null;
}

export function taskToWorkItem(row: RawTask): WorkItem {
  const assignees = (row.task_assignees ?? []).map((a) => ({ user_id: a.user_id }));
  if (assignees.length === 0 && row.assigned_to) {
    // Legacy CSV column fallback.
    row.assigned_to.split(',').map((s) => s.trim()).filter(Boolean).forEach((user_id) => {
      assignees.push({ user_id });
    });
  }
  return {
    uid: buildUid('task', row.id),
    id: row.id,
    kind: 'task',
    title: row.title,
    description: row.description,
    status: normalizeStatus('task', row.status),
    priority: normalizePriority(row.priority),
    due_at: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    created_by: row.user_id,
    assignees,
    tenant_id: row.tenant_id ?? null,
    meta: { raw: row },
  };
}

interface RawDecision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  response_deadline: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by: string;
  tenant_id?: string | null;
  assignees?: Array<{ user_id: string }> | null;
}

export function decisionToWorkItem(row: RawDecision): WorkItem {
  return {
    uid: buildUid('decision', row.id),
    id: row.id,
    kind: 'decision',
    title: row.title,
    description: row.description,
    status: normalizeStatus('decision', row.status),
    priority: 'normal',
    due_at: row.response_deadline,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    created_by: row.created_by,
    assignees: (row.assignees ?? []).map((a) => ({ user_id: a.user_id })),
    tenant_id: row.tenant_id ?? null,
    meta: { raw: row },
  };
}

interface RawCaseItem {
  id: string;
  title: string;
  description: string | null;
  status: string | string[] | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by: string;
  assigned_to: string | null;
  tenant_id?: string | null;
}

export function caseItemToWorkItem(row: RawCaseItem): WorkItem {
  // Cases use a status array (multi-status memory). Pick the most active one.
  const statusRaw = Array.isArray(row.status)
    ? (row.status.find((s) => !['closed', 'archived', 'done'].includes(s)) ?? row.status[0])
    : row.status;
  return {
    uid: buildUid('case_item', row.id),
    id: row.id,
    kind: 'case_item',
    title: row.title,
    description: row.description,
    status: normalizeStatus('case_item', statusRaw ?? null),
    priority: normalizePriority(row.priority),
    due_at: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    created_by: row.created_by,
    assignees: row.assigned_to ? [{ user_id: row.assigned_to }] : [],
    tenant_id: row.tenant_id ?? null,
    meta: { raw: row, allStatuses: row.status },
  };
}

interface RawVorgang {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  deadline: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by: string;
  assigned_to: string | null;
  tenant_id?: string | null;
}

export function vorgangToWorkItem(row: RawVorgang): WorkItem {
  return {
    uid: buildUid('vorgang', row.id),
    id: row.id,
    kind: 'vorgang',
    title: row.title,
    description: row.description,
    status: normalizeStatus('vorgang', row.status),
    priority: normalizePriority(row.priority),
    due_at: row.deadline,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    created_by: row.created_by,
    assignees: row.assigned_to ? [{ user_id: row.assigned_to }] : [],
    tenant_id: row.tenant_id ?? null,
    meta: { raw: row },
  };
}

export const workItemAdapters: Record<WorkItemKind, (row: never) => WorkItem> = {
  task: taskToWorkItem as (row: never) => WorkItem,
  decision: decisionToWorkItem as (row: never) => WorkItem,
  case_item: caseItemToWorkItem as (row: never) => WorkItem,
  vorgang: vorgangToWorkItem as (row: never) => WorkItem,
};
