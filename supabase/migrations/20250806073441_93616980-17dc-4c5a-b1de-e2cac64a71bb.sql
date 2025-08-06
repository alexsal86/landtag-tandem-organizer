-- Add new fields to contacts table for extended contact information
ALTER TABLE public.contacts 
ADD COLUMN address TEXT,
ADD COLUMN birthday DATE,
ADD COLUMN website TEXT,
ADD COLUMN linkedin TEXT,
ADD COLUMN twitter TEXT,
ADD COLUMN facebook TEXT,
ADD COLUMN instagram TEXT,
ADD COLUMN xing TEXT,
ADD COLUMN additional_info TEXT;