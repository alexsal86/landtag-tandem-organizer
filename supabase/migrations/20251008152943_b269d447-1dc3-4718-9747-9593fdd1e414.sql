-- Add is_city_boundary column to karlsruhe_districts table
ALTER TABLE karlsruhe_districts 
ADD COLUMN IF NOT EXISTS is_city_boundary BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_karlsruhe_districts_city_boundary 
ON karlsruhe_districts(is_city_boundary);