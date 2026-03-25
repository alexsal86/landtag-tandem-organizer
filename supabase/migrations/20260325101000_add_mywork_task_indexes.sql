create index if not exists idx_tasks_tenant_status_parent_task
  on public.tasks (tenant_id, status, parent_task_id);

create index if not exists idx_task_assignees_user_task
  on public.task_assignees (user_id, task_id);

create index if not exists idx_task_comments_task_id
  on public.task_comments (task_id);
