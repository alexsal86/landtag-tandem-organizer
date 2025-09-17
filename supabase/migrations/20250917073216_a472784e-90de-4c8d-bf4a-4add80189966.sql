-- Create district support assignments table for managing "Betreuungswahlkreise"
CREATE TABLE public.district_support_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES election_districts(id) ON DELETE CASCADE,
  supporting_representative_id UUID NOT NULL REFERENCES election_representatives(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Add indexes for better performance
CREATE INDEX idx_district_support_assignments_district_id ON public.district_support_assignments(district_id);
CREATE INDEX idx_district_support_assignments_representative_id ON public.district_support_assignments(supporting_representative_id);
CREATE INDEX idx_district_support_assignments_active ON public.district_support_assignments(is_active) WHERE is_active = true;

-- Add unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX idx_district_support_assignments_unique ON public.district_support_assignments(district_id, supporting_representative_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.district_support_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for district support assignments
CREATE POLICY "Tenant admins can manage district support assignments"
ON public.district_support_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_tenant_memberships utm 
    WHERE utm.user_id = auth.uid() 
    AND utm.role IN ('abgeordneter', 'bueroleitung')
    AND utm.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_tenant_memberships utm 
    WHERE utm.user_id = auth.uid() 
    AND utm.role IN ('abgeordneter', 'bueroleitung')
    AND utm.is_active = true
  )
);

CREATE POLICY "Users can view district support assignments"
ON public.district_support_assignments
FOR SELECT
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_district_support_assignments_updated_at
  BEFORE UPDATE ON public.district_support_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();