-- Add show_pagination column to letters table
ALTER TABLE public.letters 
ADD COLUMN show_pagination BOOLEAN DEFAULT false;