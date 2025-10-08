-- Add icon field to tags table
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS icon text;

-- Add comment explaining the icon field
COMMENT ON COLUMN public.tags.icon IS 'Lucide icon name (e.g., "star", "heart", "briefcase")';