-- Create user status system
CREATE TYPE user_status_type AS ENUM ('online', 'meeting', 'break', 'away', 'offline', 'custom');

-- Create admin configurable status options
CREATE TABLE public.admin_status_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  color TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default status options
INSERT INTO public.admin_status_options (name, emoji, color, sort_order) VALUES
('Online', '🟢', 'hsl(142, 76%, 36%)', 1),
('In Besprechung', '🔴', 'hsl(0, 84%, 60%)', 2),
('Pause', '🟡', 'hsl(48, 96%, 53%)', 3),
('Abwesend', '🟠', 'hsl(25, 95%, 53%)', 4),
('Nicht stören', '⚫', 'hsl(0, 0%, 20%)', 5);

-- Create user status table
CREATE TABLE public.user_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status_type user_status_type NOT NULL DEFAULT 'online',
  custom_message TEXT,
  emoji TEXT,
  color TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_away_enabled BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_status_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_status_options
CREATE POLICY "Everyone can view status options" 
ON public.admin_status_options 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage status options" 
ON public.admin_status_options 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_status
CREATE POLICY "Users can view all statuses" 
ON public.user_status 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own status" 
ON public.user_status 
FOR ALL 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_status_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status_type != OLD.status_type OR NEW.custom_message != OLD.custom_message THEN
    NEW.last_activity = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_status_activity_trigger
BEFORE UPDATE ON public.user_status
FOR EACH ROW
EXECUTE FUNCTION public.update_user_status_activity();

-- Create function to auto-create user status on first login
CREATE OR REPLACE FUNCTION public.create_user_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_status (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-creating user status
CREATE TRIGGER create_user_status_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_user_status();

-- Add realtime
ALTER TABLE public.user_status REPLICA IDENTITY FULL;
ALTER TABLE public.admin_status_options REPLICA IDENTITY FULL;