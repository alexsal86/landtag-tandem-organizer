-- Add is_default column to meeting_templates
ALTER TABLE meeting_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Ensure only one template can be default at a time (function for trigger)
CREATE OR REPLACE FUNCTION public.ensure_single_default_meeting_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.meeting_templates 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_default_template ON meeting_templates;
CREATE TRIGGER ensure_single_default_template
  BEFORE INSERT OR UPDATE ON meeting_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_meeting_template();