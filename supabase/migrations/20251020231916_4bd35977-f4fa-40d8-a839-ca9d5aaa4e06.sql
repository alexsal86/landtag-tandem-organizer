-- Create fundings table
CREATE TABLE public.fundings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  total_amount numeric(12,2),
  start_date date,
  end_date date,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  funding_source text,
  category text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS Policies for fundings
ALTER TABLE public.fundings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fundings in their tenant"
  ON public.fundings FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create fundings in their tenant"
  ON public.fundings FOR INSERT
  WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "Users can update fundings in their tenant"
  ON public.fundings FOR UPDATE
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete fundings in their tenant"
  ON public.fundings FOR DELETE
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- Indexes for fundings
CREATE INDEX idx_fundings_tenant_id ON public.fundings(tenant_id);
CREATE INDEX idx_fundings_status ON public.fundings(status);
CREATE INDEX idx_fundings_start_date ON public.fundings(start_date);

-- Create funding_participants table
CREATE TABLE public.funding_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  funding_id uuid NOT NULL REFERENCES public.fundings(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  allocated_amount numeric(12,2),
  role text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(funding_id, contact_id)
);

-- RLS Policies for funding_participants
ALTER TABLE public.funding_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view funding participants through funding tenant"
  ON public.funding_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fundings f
    WHERE f.id = funding_participants.funding_id
    AND f.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can manage funding participants through funding tenant"
  ON public.funding_participants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM fundings f
    WHERE f.id = funding_participants.funding_id
    AND f.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Indexes for funding_participants
CREATE INDEX idx_funding_participants_funding_id ON public.funding_participants(funding_id);
CREATE INDEX idx_funding_participants_contact_id ON public.funding_participants(contact_id);