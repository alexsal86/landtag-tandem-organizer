-- Add default_visibility to meeting_templates
ALTER TABLE meeting_templates ADD COLUMN IF NOT EXISTS default_visibility TEXT DEFAULT 'private';

-- Add comment
COMMENT ON COLUMN meeting_templates.default_visibility IS 'Default visibility for meetings created from this template: private or public';