-- Add icon column to appointment_categories
ALTER TABLE public.appointment_categories 
  ADD COLUMN IF NOT EXISTS icon text;

-- Add icon and color columns to appointment_statuses
ALTER TABLE public.appointment_statuses 
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color varchar(255) DEFAULT '#3b82f6';

-- Set default colors for existing statuses
UPDATE public.appointment_statuses SET color = '#22c55e', icon = 'CheckCircle' WHERE name = 'confirmed' AND color IS NULL;
UPDATE public.appointment_statuses SET color = '#eab308', icon = 'Clock' WHERE name = 'pending' AND color IS NULL;
UPDATE public.appointment_statuses SET color = '#ef4444', icon = 'XCircle' WHERE name = 'cancelled' AND color IS NULL;
UPDATE public.appointment_statuses SET color = '#3b82f6', icon = 'CircleDot' WHERE color IS NULL;

-- Add icon, color and label columns to appointment_locations
ALTER TABLE public.appointment_locations 
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color varchar(255) DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS label text;

-- Copy name to label for consistency
UPDATE public.appointment_locations SET label = name WHERE label IS NULL;

-- Set default icon for categories without icon
UPDATE public.appointment_categories SET icon = 'Calendar' WHERE icon IS NULL;