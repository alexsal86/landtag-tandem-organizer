-- Update sender_information table structure
-- Remove old columns that are no longer needed
ALTER TABLE public.sender_information 
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS department,
DROP COLUMN IF EXISTS street,
DROP COLUMN IF EXISTS house_number,
DROP COLUMN IF EXISTS postal_code,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS email;

-- Add new columns for Instagram and Facebook profiles
ALTER TABLE public.sender_information 
ADD COLUMN IF NOT EXISTS instagram_profile TEXT,
ADD COLUMN IF NOT EXISTS facebook_profile TEXT;

-- Add new columns for Landtag address
ALTER TABLE public.sender_information 
ADD COLUMN IF NOT EXISTS landtag_street TEXT,
ADD COLUMN IF NOT EXISTS landtag_house_number TEXT,
ADD COLUMN IF NOT EXISTS landtag_postal_code TEXT,
ADD COLUMN IF NOT EXISTS landtag_city TEXT,
ADD COLUMN IF NOT EXISTS landtag_email TEXT;

-- Add new columns for Wahlkreis address
ALTER TABLE public.sender_information 
ADD COLUMN IF NOT EXISTS wahlkreis_street TEXT,
ADD COLUMN IF NOT EXISTS wahlkreis_house_number TEXT,
ALTER TABLE public.sender_information 
ADD COLUMN IF NOT EXISTS wahlkreis_postal_code TEXT,
ADD COLUMN IF NOT EXISTS wahlkreis_city TEXT,
ADD COLUMN IF NOT EXISTS wahlkreis_email TEXT;