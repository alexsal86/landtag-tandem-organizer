-- Create party associations table for Green Party district associations
CREATE TABLE public.party_associations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  party_name TEXT NOT NULL DEFAULT 'GRÜNE',
  party_type TEXT NOT NULL DEFAULT 'kreisverband',
  
  -- Contact information
  phone TEXT,
  website TEXT,
  email TEXT,
  social_media JSONB DEFAULT '{}',
  
  -- Address information
  address_street TEXT,
  address_number TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  full_address TEXT,
  
  -- Geographic coverage
  coverage_areas JSONB DEFAULT '[]',
  administrative_boundaries JSONB,
  
  -- Additional data
  contact_info JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.party_associations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view party associations in their tenant"
ON public.party_associations
FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create party associations in their tenant"
ON public.party_associations  
FOR INSERT
WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update party associations in their tenant"
ON public.party_associations
FOR UPDATE
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete party associations in their tenant"
ON public.party_associations
FOR DELETE
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- Create trigger for updated_at
CREATE TRIGGER update_party_associations_updated_at
BEFORE UPDATE ON public.party_associations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();