-- Add icon and color columns to task_categories table for unified type management
ALTER TABLE public.task_categories 
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color varchar(255) DEFAULT '#3b82f6';

-- Update existing task categories with default colors
UPDATE public.task_categories SET color = '#3b82f6' WHERE color IS NULL;
UPDATE public.task_categories SET icon = 'CheckSquare' WHERE icon IS NULL;