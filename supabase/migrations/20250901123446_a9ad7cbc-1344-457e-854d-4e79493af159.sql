-- Extend letter_templates table with structured header fields
ALTER TABLE public.letter_templates 
ADD COLUMN IF NOT EXISTS header_image_url text,
ADD COLUMN IF NOT EXISTS header_image_position jsonb DEFAULT '{"x": 0, "y": 0, "width": 200, "height": 100}'::jsonb,
ADD COLUMN IF NOT EXISTS header_text_elements jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS header_layout_type text DEFAULT 'html'::text; -- 'html', 'structured', 'hybrid'

-- Create table for managing header assets
CREATE TABLE IF NOT EXISTS public.letter_template_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.letter_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('image', 'logo', 'signature')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  position_data jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on letter_template_assets
ALTER TABLE public.letter_template_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for letter_template_assets
CREATE POLICY "Users can view assets in their tenant"
  ON public.letter_template_assets FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage assets"
  ON public.letter_template_assets FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Create storage bucket for letter assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('letter-assets', 'letter-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for letter assets
CREATE POLICY "Public access to letter assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'letter-assets');

CREATE POLICY "Authenticated users can upload letter assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'letter-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploaded letter assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'letter-assets' AND auth.uid()::text = (metadata->>'uploadedBy'));

CREATE POLICY "Users can delete their uploaded letter assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'letter-assets' AND auth.uid()::text = (metadata->>'uploadedBy'));

-- Create updated_at trigger for letter_template_assets
CREATE TRIGGER update_letter_template_assets_updated_at
  BEFORE UPDATE ON public.letter_template_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();