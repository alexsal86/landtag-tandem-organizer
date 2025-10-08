-- Create table for Karlsruhe districts
CREATE TABLE IF NOT EXISTS public.karlsruhe_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  boundaries JSONB NOT NULL,
  center_coordinates JSONB,
  color TEXT NOT NULL,
  area_km2 NUMERIC,
  population INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.karlsruhe_districts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view districts
CREATE POLICY "Authenticated users can view karlsruhe districts"
ON public.karlsruhe_districts
FOR SELECT
TO authenticated
USING (true);

-- Policy: Service role can manage districts (for edge function)
CREATE POLICY "Service role can manage karlsruhe districts"
ON public.karlsruhe_districts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_karlsruhe_districts_name ON public.karlsruhe_districts(name);

-- Add trigger for updated_at
CREATE TRIGGER update_karlsruhe_districts_updated_at
BEFORE UPDATE ON public.karlsruhe_districts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();