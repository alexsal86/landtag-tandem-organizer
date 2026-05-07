/**
 * Shared WorkItem abstraction (Phase 2 — Work-Item Unification).
 *
 * Goal: provide ONE common shape that the four work-management domains
 * (tasks, decisions, cases/case_items, vorgänge) can be normalized into so
 * shared UI (StatusBadge, AssigneePicker, list rows, MyWork aggregation, …)
 * can be implemented once instead of four times.
 *
 * This file is intentionally additive: existing domain hooks/types stay
 * intact. Adapters in src/hooks/work-items/ map raw rows → WorkItem.
 */

export type WorkItemKind = 'task' | 'decision' | 'case_item' | 'vorgang';

/** Canonical lifecycle status. Each domain maps its native enum into this. */
export type WorkItemStatus =
  | 'open'         // not yet started / new
  | 'in_progress'  // actively being worked on
  | 'waiting'      // blocked / waiting on someone
  | 'done'         // completed / resolved / archived
  | 'cancelled';   // dropped / declined

export type WorkItemPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkItemAssignee {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface WorkItem {
  /** Stable composite id: `${kind}:${nativeId}` — safe to use as React key across domains. */
  uid: string;
  /** Native primary key inside its source table. */
  id: string;
  kind: WorkItemKind;

  title: string;
  description: string | null;

  status: WorkItemStatus;
  priority: WorkItemPriority;

  /** Primary deadline (decisions: response_deadline, tasks: due_date, cases: due_date, vorgänge: deadline). */
  due_at: string | null;
  created_at: string;
  updated_at: string | null;

  /** Profile id of creator (profiles.id, NOT auth.users.id). */
  created_by: string;
  assignees: WorkItemAssignee[];

  tenant_id: string | null;

  /** Domain-specific extras kept around for adapters/UI without leaking into shared logic. */
  meta?: Record<string, unknown>;
}

/* --------------------------------------------------------------------------
 * Status normalization
 * -------------------------------------------------------------------------- */

const TASK_STATUS_MAP: Record<string, WorkItemStatus> = {
  todo: 'open',
  open: 'open',
  in_progress: 'in_progress',
  doing: 'in_progress',
  waiting: 'waiting',
  blocked: 'waiting',
  done: 'done',
  completed: 'done',
  cancelled: 'cancelled',
};

const DECISION_STATUS_MAP: Record<string, WorkItemStatus> = {
  pending: 'open',
  in_review: 'in_progress',
  approved: 'done',
  decided: 'done',
  rejected: 'cancelled',
  cancelled: 'cancelled',
};

const CASE_STATUS_MAP: Record<string, WorkItemStatus> = {
  // German (case_items / Vorgänge)
  neu: 'open',
  offen: 'open',
  in_bearbeitung: 'in_progress',
  wartet: 'waiting',
  warten: 'waiting',
  erledigt: 'done',
  abgeschlossen: 'done',
  archiviert: 'done',
  abgelehnt: 'cancelled',
  // English fallbacks
  open: 'open',
  in_progress: 'in_progress',
  waiting: 'waiting',
  closed: 'done',
  archived: 'done',
  cancelled: 'cancelled',
};

const VORGANG_STATUS_MAP = CASE_STATUS_MAP;

export function normalizeStatus(kind: WorkItemKind, raw: string | null | undefined): WorkItemStatus {
  if (!raw) return 'open';
  const key = raw.toLowerCase();
  switch (kind) {
    case 'task':      return TASK_STATUS_MAP[key]     ?? 'open';
    case 'decision':  return DECISION_STATUS_MAP[key] ?? 'open';
    case 'case_item': return CASE_STATUS_MAP[key]     ?? 'open';
    case 'vorgang':   return VORGANG_STATUS_MAP[key]  ?? 'open';
  }
}

const PRIORITY_MAP: Record<string, WorkItemPriority> = {
  low: 'low',
  niedrig: 'low',
  normal: 'normal',
  medium: 'normal',
  mittel: 'normal',
  high: 'high',
  hoch: 'high',
  urgent: 'urgent',
  dringend: 'urgent',
};

export function normalizePriority(raw: string | null | undefined): WorkItemPriority {
  if (!raw) return 'normal';
  return PRIORITY_MAP[raw.toLowerCase()] ?? 'normal';
}

export function buildUid(kind: WorkItemKind, id: string): string {
  return `${kind}:${id}`;
}
