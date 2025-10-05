-- Add attribution fields for dashboard cover images

-- Add attribution field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dashboard_cover_image_attribution jsonb DEFAULT NULL;

-- Add attribution setting for default cover
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('default_dashboard_cover_attribution', NULL)
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON COLUMN profiles.dashboard_cover_image_attribution IS 'Unsplash attribution data: {photographer: string, photographer_url: string, unsplash_url: string}';