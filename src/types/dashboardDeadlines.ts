export type DeadlineKind = 'task' | 'note' | 'case' | 'caseAction' | 'decision' | 'eventPlanning';

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  type: DeadlineKind;
  planningId?: string;
  canSnooze: boolean;
  priority?: number;
  checklistItemId?: string;
}

export interface GroupedDeadlineItems {
  overdue: DeadlineItem[];
  today: DeadlineItem[];
  thisWeek: DeadlineItem[];
  later: DeadlineItem[];
}

export interface EventPlanningRelation {
  user_id?: string;
  id?: string;
  title?: string;
  is_archived?: boolean;
  is_completed?: boolean;
}

export interface ChecklistRelation {
  id?: string;
  title?: string;
  is_completed?: boolean;
}

export interface PlanningTimelineAssignment {
  id: string;
  due_date: string | null;
  event_planning_id?: string | null;
  event_plannings?: EventPlanningRelation | EventPlanningRelation[] | null;
  event_planning_checklist_items?: ChecklistRelation | ChecklistRelation[] | null;
}
