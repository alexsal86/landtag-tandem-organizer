-- Add missing fields to letters table for DIN 5008
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS sender_info_id uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS information_block_ids text[];
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS letter_date date DEFAULT CURRENT_DATE;