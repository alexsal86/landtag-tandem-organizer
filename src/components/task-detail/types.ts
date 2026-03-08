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
  call_log_id?: string | null;
  tenant_id?: string | null;
}

export interface TaskDocument {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  description: string;
  assigned_to?: string;
  due_date?: string | null;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string;
  completed_at?: string;
}

export interface TaskDetailSidebarProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskRestored: (restoredTask: Task) => void;
  taskCategories: Array<{ name: string; label: string }>;
  taskStatuses: Array<{ name: string; label: string }>;
}

export const getPriorityColor = (priority: Task["priority"]) => {
  switch (priority) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "medium": return "bg-government-gold text-white";
    case "low": return "bg-muted text-muted-foreground";
  }
};

export const getCategoryColor = (category: Task["category"]) => {
  switch (category) {
    case "legislation": return "bg-primary text-primary-foreground";
    case "committee": return "bg-government-blue text-white";
    case "constituency": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "personal": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  }
};

export const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
