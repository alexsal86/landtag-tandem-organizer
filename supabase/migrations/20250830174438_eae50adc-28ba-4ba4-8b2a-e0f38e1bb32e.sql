-- Add template_id field to letters table
ALTER TABLE letters ADD COLUMN template_id uuid REFERENCES letter_templates(id);