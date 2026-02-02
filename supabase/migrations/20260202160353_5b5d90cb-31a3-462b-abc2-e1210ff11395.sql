-- Remove the static check constraint that blocks dynamic task statuses
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;