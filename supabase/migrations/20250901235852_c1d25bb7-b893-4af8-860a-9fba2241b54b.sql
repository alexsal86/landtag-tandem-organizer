-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key text PRIMARY KEY,
  setting_value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for app_settings
DROP POLICY IF EXISTS "Authenticated users can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin users can manage app settings" ON public.app_settings;

CREATE POLICY "Authenticated users can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin users can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter') OR has_role(auth.uid(), 'bueroleitung'))
WITH CHECK (has_role(auth.uid(), 'abgeordneter') OR has_role(auth.uid(), 'bueroleitung'));

-- Insert default settings if they don't exist
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES 
  ('app_name', 'LandtagsOS'),
  ('app_subtitle', 'Koordinationssystem'),
  ('app_logo_url', '')
ON CONFLICT (setting_key) DO NOTHING;