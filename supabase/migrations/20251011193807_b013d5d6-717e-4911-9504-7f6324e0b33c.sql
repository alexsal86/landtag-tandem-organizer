-- Add coordinates and geocoding metadata to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geocoding_source TEXT DEFAULT NULL;

-- Add comment to explain coordinates structure
COMMENT ON COLUMN public.contacts.coordinates IS 'Geocoded coordinates in format: {"lat": 48.123, "lng": 8.456}';

-- Create GIN index for efficient coordinate queries
CREATE INDEX IF NOT EXISTS idx_contacts_coordinates 
ON public.contacts USING GIN (coordinates);

-- Function to clear coordinates when address changes
CREATE OR REPLACE FUNCTION trigger_geocoding_on_address_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if business address fields have changed
  IF (NEW.business_street IS DISTINCT FROM OLD.business_street OR
      NEW.business_house_number IS DISTINCT FROM OLD.business_house_number OR
      NEW.business_postal_code IS DISTINCT FROM OLD.business_postal_code OR
      NEW.business_city IS DISTINCT FROM OLD.business_city OR
      NEW.business_country IS DISTINCT FROM OLD.business_country) AND
     (NEW.business_street IS NOT NULL OR NEW.business_city IS NOT NULL)
  THEN
    -- Clear existing coordinates to trigger re-geocoding
    NEW.coordinates := NULL;
    NEW.geocoded_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to contacts table
DROP TRIGGER IF EXISTS contacts_address_change_trigger ON public.contacts;
CREATE TRIGGER contacts_address_change_trigger
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_geocoding_on_address_change();