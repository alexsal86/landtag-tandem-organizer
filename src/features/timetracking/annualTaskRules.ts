export interface AnnualDeadline {
  due_month: number;
  due_day: number | null;
}

/** Month-only routines are due on the last day; impossible dates clamp to month end. */
export function annualDueDay(task: AnnualDeadline, year: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(task.due_month) || task.due_month < 1 || task.due_month > 12
    || (task.due_day !== null && (!Number.isInteger(task.due_day) || task.due_day < 1 || task.due_day > 31))) {
    throw new Error("Ungültiger Stichtag");
  }
  const lastDay = new Date(year, task.due_month, 0).getDate();
  return `${year}-${String(task.due_month).padStart(2, "0")}-${String(Math.min(task.due_day ?? lastDay, lastDay)).padStart(2, "0")}`;
}

export function annualTaskStatus(task: AnnualDeadline, year: number, completedAt: string | null | undefined, now = new Date()): "completed" | "due" | "upcoming" | "overdue" {
  if (completedAt) return "completed";
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const due = annualDueDay(task, year);
  return due < today ? "overdue" : due === today ? "due" : "upcoming";
}

export function canDelegateAnnualTask(task: { is_system_task: boolean | null; execute_function: string | null }, completion?: { completed_at: string | null; linked_task_id: string | null }): boolean {
  return !task.is_system_task && !task.execute_function && !completion?.completed_at && !completion?.linked_task_id;
}