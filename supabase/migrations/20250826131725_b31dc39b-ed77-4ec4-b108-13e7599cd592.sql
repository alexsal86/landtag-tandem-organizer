-- Update assigned_to fields to support multiple users
-- Convert existing single assignments to arrays and change column types

-- Update tasks table
ALTER TABLE public.tasks 
ALTER COLUMN assigned_to TYPE TEXT[] 
USING CASE 
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;

-- Update meeting_agenda_items table  
ALTER TABLE public.meeting_agenda_items
ALTER COLUMN assigned_to TYPE TEXT[]
USING CASE
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;

-- Update subtasks table (this is the correct table name)
ALTER TABLE public.subtasks
ALTER COLUMN assigned_to TYPE TEXT[]
USING CASE
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;

-- Update event_planning_checklist_items table
ALTER TABLE public.event_planning_checklist_items
ALTER COLUMN assigned_to TYPE TEXT[]
USING CASE
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;

-- Update todos table
ALTER TABLE public.todos
ALTER COLUMN assigned_to TYPE TEXT[]
USING CASE
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;

-- Update archived_tasks table
ALTER TABLE public.archived_tasks
ALTER COLUMN assigned_to TYPE TEXT[]
USING CASE
  WHEN assigned_to IS NULL OR assigned_to = '' THEN NULL
  ELSE ARRAY[assigned_to]
END;