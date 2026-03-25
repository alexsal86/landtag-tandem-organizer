import type { CaseItemSortKey, SortDirection } from "@/components/my-work/cases/workspace/CaseItemList";

export interface PlanningChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
}

export interface PlanningCard {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  confirmed_date: string | null;
  created_at: string;
  user_id: string;
  isCollaborator: boolean;
  is_completed: boolean;
  checklistProgress: {
    completed: number;
    total: number;
  };
  checklistItems: PlanningChecklistItem[];
}

export interface PlanningFilters {
  searchQuery: string;
}

export interface CaseWorkspaceSort {
  primary: { key: CaseItemSortKey; direction: SortDirection };
  secondary: { enabled: boolean; direction: SortDirection };
}

export interface CaseWorkspaceFilters {
  itemQuery: string;
  fileQuery: string;
}

export interface EventPlanningChecklistItemRow {
  id: string;
  title: string;
  is_completed: boolean | null;
  order_index: number | null;
}

export interface EventPlanningRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  confirmed_date: string | null;
  created_at: string;
  user_id: string;
  is_completed: boolean | null;
  is_archived?: boolean | null;
  event_planning_checklist_items: EventPlanningChecklistItemRow[] | null;
}

export interface EventPlanningCollaborationRow {
  event_planning_id: string;
  event_plannings: EventPlanningRow | null;
}
