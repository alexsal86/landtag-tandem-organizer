-- Add missing fields to contacts table for comprehensive contact import
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS business_street text,
ADD COLUMN IF NOT EXISTS business_house_number text,
ADD COLUMN IF NOT EXISTS business_postal_code text,
ADD COLUMN IF NOT EXISTS business_city text,
ADD COLUMN IF NOT EXISTS business_country text,
ADD COLUMN IF NOT EXISTS private_street text,
ADD COLUMN IF NOT EXISTS private_house_number text,
ADD COLUMN IF NOT EXISTS private_postal_code text,
ADD COLUMN IF NOT EXISTS private_city text,
ADD COLUMN IF NOT EXISTS private_country text,
ADD COLUMN IF NOT EXISTS business_phone text,
ADD COLUMN IF NOT EXISTS business_phone_2 text,
ADD COLUMN IF NOT EXISTS private_phone text,
ADD COLUMN IF NOT EXISTS private_phone_2 text,
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS email_2 text,
ADD COLUMN IF NOT EXISTS email_3 text;

-- Update existing records to split name into first_name and last_name where possible
UPDATE public.contacts 
SET 
  first_name = CASE 
    WHEN name ~ '\s' THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name ~ '\s' THEN substring(name from position(' ' in name) + 1)
    ELSE null
  END
WHERE first_name IS NULL AND last_name IS NULL AND name IS NOT NULL;