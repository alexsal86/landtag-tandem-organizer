-- Make due_date optional in tasks table
ALTER TABLE public.tasks ALTER COLUMN due_date DROP NOT NULL;