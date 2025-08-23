-- Fix infinite recursion in team_dashboards RLS policies
-- Remove existing problematic policies
DROP POLICY IF EXISTS "Users can view dashboards they have access to" ON public.team_dashboards;
DROP POLICY IF EXISTS "Users can manage their own dashboards" ON public.team_dashboards;

-- Create simple, non-recursive policies
CREATE POLICY "Users can manage their own dashboards" 
ON public.team_dashboards 
FOR ALL 
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can view public dashboards" 
ON public.team_dashboards 
FOR SELECT 
USING (is_public = true OR owner_id = auth.uid());