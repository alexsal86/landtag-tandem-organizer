-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create search analytics table
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  result_types JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on search_analytics
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for search_analytics
CREATE POLICY "Users can view their own search analytics"
  ON public.search_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search analytics"
  ON public.search_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_trgm ON public.contacts USING gin (organization gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_appointments_title_trgm ON public.appointments USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON public.documents USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_letters_title_trgm ON public.letters USING gin (title gin_trgm_ops);

-- Create index for search analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_tenant ON public.search_analytics(user_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON public.search_analytics(search_query, tenant_id);