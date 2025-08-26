-- Remove the hardcoded category check constraint to allow dynamic categories
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_category_check;