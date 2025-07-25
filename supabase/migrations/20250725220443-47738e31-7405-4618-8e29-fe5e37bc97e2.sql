-- Add missing fields to contacts table to match the UI
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS organization text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'citizen' CHECK (category IN ('citizen', 'colleague', 'lobbyist', 'media', 'business')),
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS last_contact text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update company field to be organization for consistency
UPDATE public.contacts SET organization = company WHERE organization IS NULL AND company IS NOT NULL;