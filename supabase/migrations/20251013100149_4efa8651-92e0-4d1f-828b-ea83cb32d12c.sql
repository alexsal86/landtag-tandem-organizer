-- Add tag_filter column to map_flag_types for automatic stakeholder filtering
ALTER TABLE public.map_flag_types 
ADD COLUMN tag_filter text;

-- Add comment for documentation
COMMENT ON COLUMN public.map_flag_types.tag_filter IS 'Tag used to automatically show stakeholders with matching tags on the map';
