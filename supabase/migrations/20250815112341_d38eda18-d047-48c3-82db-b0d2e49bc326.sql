-- Add support for separators in planning and meeting templates
-- Update template items to support item type

-- For meeting templates
ALTER TABLE meeting_templates 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- For planning templates  
ALTER TABLE planning_templates
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Note: We'll use the existing JSONB structure but add a "type" field to each item
-- type can be "item" (default) or "separator"
-- separators will have title field for the separator text