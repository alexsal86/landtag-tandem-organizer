-- Update RLS policies for external_calendars to allow tenant-wide access
DROP POLICY IF EXISTS "Users can view external events from their calendars" ON external_events;
DROP POLICY IF EXISTS "Service role can manage all external events" ON external_events;

-- Allow all users in the same tenant to view external calendars
CREATE POLICY "Users can view external calendars in their tenant" 
ON external_calendars 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_tenant_memberships utm
    WHERE utm.user_id = auth.uid() 
    AND utm.tenant_id = external_calendars.tenant_id
    AND utm.is_active = true
  )
);

-- Allow users to manage their own external calendars
CREATE POLICY "Users can manage their own external calendars" 
ON external_calendars 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Update external_events policies to allow tenant-wide access
CREATE POLICY "Users can view external events from tenant calendars" 
ON external_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM external_calendars ec
    JOIN user_tenant_memberships utm ON utm.tenant_id = ec.tenant_id
    WHERE ec.id = external_events.external_calendar_id 
    AND utm.user_id = auth.uid()
    AND utm.is_active = true
  )
);

-- Keep service role access for sync functions
CREATE POLICY "Service role can manage all external events" 
ON external_events 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);