-- Create table for election district data
CREATE TABLE public.election_districts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  district_number INTEGER NOT NULL,
  district_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'Baden-Württemberg',
  boundaries JSONB, -- GeoJSON polygon data
  center_coordinates JSONB, -- {lat, lng} for map centering
  population INTEGER,
  area_km2 NUMERIC(10,2),
  representative_name TEXT,
  representative_party TEXT,
  contact_info JSONB, -- phone, email, office address
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.election_districts ENABLE ROW LEVEL SECURITY;

-- Create policies for election districts (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view election districts" 
ON public.election_districts 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create table for user notes on election districts
CREATE TABLE public.election_district_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  district_id UUID NOT NULL REFERENCES public.election_districts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'meeting', 'event', 'contact', 'issue')),
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notes
ALTER TABLE public.election_district_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for district notes
CREATE POLICY "Users can manage district notes in their tenant" 
ON public.election_district_notes 
FOR ALL 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Insert sample election districts around Karlsruhe
INSERT INTO public.election_districts (district_number, district_name, center_coordinates, population, representative_name, representative_party, contact_info) VALUES
(49, 'Karlsruhe I', '{"lat": 49.0120, "lng": 8.4037}', 85000, 'Dr. Yvonne Gebauer', 'FDP', '{"phone": "+49 721 12345", "email": "info@wahlkreis49.de"}'),
(50, 'Karlsruhe II', '{"lat": 48.9900, "lng": 8.3800}', 78000, 'Bettina Lisbach', 'GRÜNE', '{"phone": "+49 721 12346", "email": "info@wahlkreis50.de"}'),
(51, 'Ettlingen', '{"lat": 48.9447, "lng": 8.4062}', 65000, 'Moritz Oppelt', 'CDU', '{"phone": "+49 7243 12347", "email": "info@wahlkreis51.de"}'),
(52, 'Bruchsal', '{"lat": 49.1242, "lng": 8.5985}', 72000, 'Ulli Hockenberger', 'CDU', '{"phone": "+49 7251 12348", "email": "info@wahlkreis52.de"}');

-- Create trigger for updated_at
CREATE TRIGGER update_election_districts_updated_at
BEFORE UPDATE ON public.election_districts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_election_district_notes_updated_at
BEFORE UPDATE ON public.election_district_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();