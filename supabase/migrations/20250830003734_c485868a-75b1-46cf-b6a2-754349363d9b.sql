-- Add missing columns to letter_collaborators table
ALTER TABLE public.letter_collaborators 
ADD COLUMN IF NOT EXISTS assigned_by uuid,
ADD COLUMN IF NOT EXISTS role text DEFAULT 'reviewer';

-- Update existing permission_type to role for consistency
UPDATE public.letter_collaborators SET role = permission_type WHERE role IS NULL;

-- Optionally drop permission_type if we're replacing it with role
-- ALTER TABLE public.letter_collaborators DROP COLUMN IF EXISTS permission_type;