-- Add badge_color column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_badge_color 
ON public.profiles(badge_color);

-- Add comment
COMMENT ON COLUMN public.profiles.badge_color IS 'User badge color for consistent visual identification across the app';