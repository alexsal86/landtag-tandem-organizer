-- Add type field to event_planning_checklist_items table
ALTER TABLE public.event_planning_checklist_items 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'item';

-- Update existing items to have type 'item' (default)
UPDATE public.event_planning_checklist_items 
SET type = 'item' 
WHERE type IS NULL;