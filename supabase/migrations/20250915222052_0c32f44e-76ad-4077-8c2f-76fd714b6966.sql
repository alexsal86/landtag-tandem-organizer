-- Add administrative_level field to election_districts table
ALTER TABLE public.election_districts 
ADD COLUMN IF NOT EXISTS administrative_level text;