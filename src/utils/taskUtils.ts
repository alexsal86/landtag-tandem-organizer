import { Task, Subtask, TaskConfiguration } from "@/types/taskTypes";

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" }
];

export const STATUS_OPTIONS = [
  { value: "todo", label: "Zu erledigen" },
  { value: "in-progress", label: "In Bearbeitung" },
  { value: "completed", label: "Abgeschlossen" }
];

export const CATEGORY_OPTIONS = [
  { value: "legislation", label: "Gesetzgebung" },
  { value: "constituency", label: "Wahlkreis" },
  { value: "committee", label: "Ausschuss" },
  { value: "personal", label: "Persönlich" },
  { value: "call_followup", label: "Anruf Nachbereitung" },
  { value: "call_follow_up", label: "Anruf Follow-up" }
];

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE');
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE');
};

export const getPriorityColor = (priority: string): "default" | "destructive" | "outline" | "secondary" => {
  switch (priority) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'in-progress':
      return 'secondary';
    case 'todo':
      return 'outline';
    default:
      return 'outline';
  }
};

export const getCategoryLabel = (category: string, taskCategories: TaskConfiguration[]): string => {
  const categoryConfig = taskCategories.find(cat => cat.name === category);
  return categoryConfig?.label || category;
};

export const getStatusLabel = (status: string, taskStatuses: TaskConfiguration[]): string => {
  const statusConfig = taskStatuses.find(stat => stat.name === status);
  return statusConfig?.label || status;
};

export const isOverdue = (dueDate: string): boolean => {
  return new Date(dueDate) < new Date();
};

export const filterTasksByStatus = (tasks: Task[], filter: string): Task[] => {
  if (filter === "all") return tasks;
  return tasks.filter(task => task.status === filter);
};

export const filterTasksByCategory = (tasks: Task[], categoryFilter: string): Task[] => {
  if (categoryFilter === "all") return tasks;
  return tasks.filter(task => task.category === categoryFilter);
};

export const filterTasksByPriority = (tasks: Task[], priorityFilter: string): Task[] => {
  if (priorityFilter === "all") return tasks;
  return tasks.filter(task => task.priority === priorityFilter);
};

export const parseAssignedUsers = (assignedTo?: string): string[] => {
  if (!assignedTo) return [];
  return assignedTo.split(',').map(user => user.trim()).filter(Boolean);
};

export const formatAssignedUsers = (assignedUsers: string[]): string => {
  return assignedUsers.join(', ');
};

export const getUserDisplayName = (userId: string, users: Array<{ user_id: string; display_name?: string }>): string => {
  const user = users.find(u => u.user_id === userId);
  return user?.display_name || userId;
};