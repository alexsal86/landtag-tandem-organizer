-- Create table for district municipalities
CREATE TABLE public.election_district_municipalities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id UUID NOT NULL REFERENCES public.election_districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'municipality', 'city_district', 'county'
  county TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.election_district_municipalities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view district municipalities" 
ON public.election_district_municipalities 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage district municipalities" 
ON public.election_district_municipalities 
FOR ALL 
USING ((auth.jwt() ->> 'role') = 'service_role');

-- Create index for performance
CREATE INDEX idx_election_district_municipalities_district_id 
ON public.election_district_municipalities(district_id);

-- Update trigger for updated_at
CREATE TRIGGER update_election_district_municipalities_updated_at
BEFORE UPDATE ON public.election_district_municipalities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();