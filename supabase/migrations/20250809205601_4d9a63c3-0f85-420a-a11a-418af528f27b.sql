-- Add file_path column to meeting_agenda_items table for file attachments
ALTER TABLE public.meeting_agenda_items ADD COLUMN IF NOT EXISTS file_path TEXT;