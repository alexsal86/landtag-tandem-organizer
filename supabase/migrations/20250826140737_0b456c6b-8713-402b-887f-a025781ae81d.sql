-- Update subtasks table to use TEXT for assigned_to
ALTER TABLE subtasks ALTER COLUMN assigned_to TYPE TEXT;

-- Update archived_tasks table to use TEXT for assigned_to  
ALTER TABLE archived_tasks ALTER COLUMN assigned_to TYPE TEXT;