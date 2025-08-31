-- Add display_name column to letter_attachments table for customizable display names
ALTER TABLE public.letter_attachments 
ADD COLUMN display_name TEXT;