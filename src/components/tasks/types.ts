export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string | null;
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assignedTo?: string;
  progress?: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  call_log_id?: string | null;
  tenant_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  userId: string;
  userName?: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  task_id: string | null;
  title: string;
  description?: string | null;
  is_completed: boolean;
  assigned_to?: string[] | null;
  assigned_to_names?: string;
  due_date?: string | null;
  order_index: number;
  completed_at?: string | null;
  result_text?: string | null;
  planning_item_id?: string | null;
  source_type?: 'task_child' | 'planning' | 'call_followup';
  checklist_item_title?: string | null;
  call_log_id?: string | null;
  contact_name?: string;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TodoItem {
  id: string;
  title: string;
  category_label: string;
  category_color: string;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
}

export interface SnoozeEntry {
  id: string;
  task_id?: string;
  subtask_id?: string;
  snoozed_until: string;
  task_title?: string;
  subtask_description?: string;
}
