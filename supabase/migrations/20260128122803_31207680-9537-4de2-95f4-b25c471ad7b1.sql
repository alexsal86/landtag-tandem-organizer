-- Add icon column to todo_categories table
ALTER TABLE todo_categories ADD COLUMN IF NOT EXISTS icon TEXT;