
-- Add image_url to social_content_items
ALTER TABLE social_content_items ADD COLUMN IF NOT EXISTS image_url text;

-- Create social_planner_notes table
CREATE TABLE IF NOT EXISTS public.social_planner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  note_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_planner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their tenant"
  ON public.social_planner_notes FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert notes in their tenant"
  ON public.social_planner_notes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update notes in their tenant"
  ON public.social_planner_notes FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete notes in their tenant"
  ON public.social_planner_notes FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
