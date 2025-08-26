-- Create appointment locations table for venue management
CREATE TABLE IF NOT EXISTS public.appointment_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment locations
CREATE POLICY "Admin roles can manage appointment locations" 
ON public.appointment_locations 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

CREATE POLICY "Authenticated users can view appointment locations" 
ON public.appointment_locations 
FOR SELECT 
USING ((auth.role() = 'authenticated'::text) AND (is_active = true));

-- Add updated_at trigger
CREATE TRIGGER update_appointment_locations_updated_at
BEFORE UPDATE ON public.appointment_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default locations
INSERT INTO public.appointment_locations (name, address, description, order_index) VALUES
('Hauptbüro', 'Hauptstraße 1, 12345 Stadt', 'Hauptbüro des Abgeordneten', 0),
('Wahlkreisbüro', 'Wahlkreisstraße 10, 54321 Ort', 'Büro im Wahlkreis', 1),
('Bundestag', 'Platz der Republik 1, 11011 Berlin', 'Deutscher Bundestag', 2),
('Rathaus', 'Rathausplatz 1, 12345 Stadt', 'Städtisches Rathaus', 3)
ON CONFLICT DO NOTHING;