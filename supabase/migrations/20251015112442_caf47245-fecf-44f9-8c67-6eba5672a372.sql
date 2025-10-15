-- Add description column to map_flag_types for better documentation
ALTER TABLE public.map_flag_types 
ADD COLUMN description text;

-- Add comment for documentation
COMMENT ON COLUMN public.map_flag_types.description IS 'Beschreibung des Flaggentyps zur Erklärung des Verwendungszwecks';