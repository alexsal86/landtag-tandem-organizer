-- Fix the team_dashboards table constraints and RLS policies
-- Add unique constraint to prevent duplicate layouts
ALTER TABLE team_dashboards ADD CONSTRAINT unique_owner_name UNIQUE (owner_id, name);

-- Update RLS policies to fix the infinite recursion
DROP POLICY IF EXISTS "Users can manage their own dashboards" ON team_dashboards;
DROP POLICY IF EXISTS "Users can view public dashboards" ON team_dashboards;

-- Create security definer function for better performance
CREATE OR REPLACE FUNCTION public.can_manage_dashboard(dashboard_id uuid, user_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_dashboards 
    WHERE id = dashboard_id AND owner_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new RLS policies without recursion
CREATE POLICY "Users can manage their own dashboards" ON team_dashboards
FOR ALL USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can view public dashboards" ON team_dashboards
FOR SELECT USING (is_public = true OR owner_id = auth.uid());