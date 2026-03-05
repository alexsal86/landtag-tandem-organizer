-- Add case_scale to case_files and case_items
ALTER TABLE case_files ADD COLUMN IF NOT EXISTS case_scale text;
ALTER TABLE case_items ADD COLUMN IF NOT EXISTS case_scale text;

-- Add new columns to case_item_interactions
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS is_resolution boolean DEFAULT false;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS case_file_id uuid REFERENCES case_files(id) ON DELETE SET NULL;
ALTER TABLE case_item_interactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Make case_item_id nullable (interactions can now be linked at case_file level)
ALTER TABLE case_item_interactions ALTER COLUMN case_item_id DROP NOT NULL;

-- Make tenant_id nullable for case_file-level interactions
ALTER TABLE case_item_interactions ALTER COLUMN tenant_id DROP NOT NULL;