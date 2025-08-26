export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assignedTo?: string; // comma-separated values
  progress?: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  call_log_id?: string;
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
  task_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  assigned_to?: string[];
  due_date?: string;
  order_index: number;
  completed_at?: string;
  result_text?: string;
  planning_item_id?: string;
  source_type?: 'task' | 'planning' | 'call_followup';
  checklist_item_title?: string;
  call_log_id?: string;
  contact_name?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssignedSubtask extends Subtask {
  task_title: string;
}

export interface Todo {
  id: string;
  title: string;
  category_label: string;
  category_color: string;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
}

export interface TaskSnooze {
  id: string;
  task_id?: string;
  subtask_id?: string;
  snoozed_until: string;
  task_title?: string;
  subtask_description?: string;
}

export interface RecentActivity {
  id: string;
  type: 'completed' | 'updated' | 'created';
  taskTitle: string;
  timestamp: string;
}

export interface User {
  user_id: string;
  display_name?: string;
}

export interface TaskConfiguration {
  name: string;
  label: string;
}