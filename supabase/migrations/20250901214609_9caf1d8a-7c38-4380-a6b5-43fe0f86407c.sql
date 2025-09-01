-- Add footer_blocks column to letter_templates table
ALTER TABLE letter_templates ADD COLUMN footer_blocks jsonb;