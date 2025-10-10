-- Add tags column to map_flags table for linking flags with stakeholder tags
ALTER TABLE map_flags 
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Create index for faster tag queries
CREATE INDEX idx_map_flags_tags ON map_flags USING GIN(tags);