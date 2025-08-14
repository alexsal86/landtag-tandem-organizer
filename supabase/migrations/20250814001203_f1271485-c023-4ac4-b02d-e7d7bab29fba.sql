-- Create a table for storing general application settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for app_settings (only admins can modify)
CREATE POLICY "App settings are viewable by everyone" 
ON public.app_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- Insert default values
INSERT INTO public.app_settings (setting_key, setting_value) VALUES
  ('app_name', 'LandtagsOS'),
  ('app_subtitle', 'Koordinationssystem'),
  ('app_logo_url', '');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();