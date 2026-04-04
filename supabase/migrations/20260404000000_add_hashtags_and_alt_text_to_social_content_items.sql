-- Add hashtags, hashtags_in_comment, and alt_text to social_content_items
ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hashtags_in_comment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_text text;
