-- Add dashboard cover image fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dashboard_cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_cover_image_position TEXT DEFAULT 'center';

-- Add default dashboard cover settings for admin override
INSERT INTO public.app_settings (setting_key, setting_value) 
VALUES ('default_dashboard_cover_url', NULL)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value) 
VALUES ('default_dashboard_cover_position', 'center')
ON CONFLICT (setting_key) DO NOTHING;

-- Create storage bucket for user-uploaded dashboard covers
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dashboard-covers', 'dashboard-covers', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own covers
CREATE POLICY "Users can upload their own dashboard covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dashboard-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can update their own covers
CREATE POLICY "Users can update their own dashboard covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dashboard-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can delete their own covers
CREATE POLICY "Users can delete their own dashboard covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dashboard-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Everyone can view dashboard covers (public bucket)
CREATE POLICY "Dashboard covers are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dashboard-covers');