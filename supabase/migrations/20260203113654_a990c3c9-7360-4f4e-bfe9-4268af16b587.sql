-- Create team_announcements table
CREATE TABLE public.team_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('critical', 'warning', 'info', 'success')),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create team_announcement_dismissals table
CREATE TABLE public.team_announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.team_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_team_announcements_tenant_id ON public.team_announcements(tenant_id);
CREATE INDEX idx_team_announcements_active ON public.team_announcements(is_active, starts_at, expires_at);
CREATE INDEX idx_team_announcement_dismissals_announcement ON public.team_announcement_dismissals(announcement_id);
CREATE INDEX idx_team_announcement_dismissals_user ON public.team_announcement_dismissals(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_team_announcements_updated_at
  BEFORE UPDATE ON public.team_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for team_announcements

-- SELECT: All authenticated users in the same tenant can read
CREATE POLICY "Users can read announcements in their tenant"
ON public.team_announcements FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- INSERT: Only abgeordneter and bueroleitung can create
CREATE POLICY "Admins can create announcements"
ON public.team_announcements FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- UPDATE: Only abgeordneter and bueroleitung can update
CREATE POLICY "Admins can update announcements"
ON public.team_announcements FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- DELETE: Only abgeordneter and bueroleitung can delete
CREATE POLICY "Admins can delete announcements"
ON public.team_announcements FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- RLS Policies for team_announcement_dismissals

-- SELECT: Users can read their own dismissals
CREATE POLICY "Users can read own dismissals"
ON public.team_announcement_dismissals FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create their own dismissals
CREATE POLICY "Users can create own dismissals"
ON public.team_announcement_dismissals FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own dismissals
CREATE POLICY "Users can delete own dismissals"
ON public.team_announcement_dismissals FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can also read all dismissals for their tenant's announcements (for progress tracking)
CREATE POLICY "Admins can read all dismissals for their announcements"
ON public.team_announcement_dismissals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
  AND announcement_id IN (
    SELECT id FROM public.team_announcements 
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);