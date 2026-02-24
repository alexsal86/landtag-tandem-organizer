-- Add block element columns to letter_templates for canvas-based block rendering
ALTER TABLE public.letter_templates 
  ADD COLUMN IF NOT EXISTS address_field_elements jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_address_elements jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS info_block_elements jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subject_elements jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_elements jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS footer_text_elements jsonb DEFAULT NULL;