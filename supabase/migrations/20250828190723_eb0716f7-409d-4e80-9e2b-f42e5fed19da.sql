-- Fix remaining tenant isolation issues for planning, knowledge, meetings, and profiles

-- Fix meetings table
DROP POLICY IF EXISTS "Authenticated users can view all meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can create all meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can update all meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can delete all meetings" ON public.meetings;

CREATE POLICY "Users can view meetings in their tenant" ON public.meetings
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create meetings in their tenant" ON public.meetings
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update meetings in their tenant" ON public.meetings
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete meetings in their tenant" ON public.meetings
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Fix meeting_agenda_items table
DROP POLICY IF EXISTS "Authenticated users can view all meeting agenda items" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Authenticated users can create all meeting agenda items" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Authenticated users can update all meeting agenda items" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Authenticated users can delete all meeting agenda items" ON public.meeting_agenda_items;

CREATE POLICY "Users can view meeting agenda items in their tenant" ON public.meeting_agenda_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_agenda_items.meeting_id 
    AND m.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can create meeting agenda items in their tenant" ON public.meeting_agenda_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_agenda_items.meeting_id 
    AND m.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can update meeting agenda items in their tenant" ON public.meeting_agenda_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_agenda_items.meeting_id 
    AND m.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete meeting agenda items in their tenant" ON public.meeting_agenda_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_agenda_items.meeting_id 
    AND m.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  ));

-- Fix planning_templates table
DROP POLICY IF EXISTS "Authenticated users can view all planning templates" ON public.planning_templates;
DROP POLICY IF EXISTS "Authenticated users can create all planning templates" ON public.planning_templates;
DROP POLICY IF EXISTS "Authenticated users can update all planning templates" ON public.planning_templates;
DROP POLICY IF EXISTS "Authenticated users can delete all planning templates" ON public.planning_templates;

CREATE POLICY "Users can view planning templates in their tenant" ON public.planning_templates
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create planning templates in their tenant" ON public.planning_templates
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update planning templates in their tenant" ON public.planning_templates
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete planning templates in their tenant" ON public.planning_templates
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Fix event_plannings - update existing policies to include tenant awareness
DROP POLICY IF EXISTS "Users can view non-private plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can view their own plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can create their own plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can update their own plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can delete their own plannings" ON public.event_plannings;

CREATE POLICY "Users can view plannings in their tenant" ON public.event_plannings
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create plannings in their tenant" ON public.event_plannings
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "Users can update their plannings in their tenant" ON public.event_plannings
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "Users can delete their plannings in their tenant" ON public.event_plannings
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND user_id = auth.uid());

-- Fix knowledge_documents - add tenant awareness
DROP POLICY IF EXISTS "view_documents_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "insert_documents_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "update_documents_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "delete_documents_policy" ON public.knowledge_documents;

CREATE POLICY "Users can view knowledge documents in their tenant" ON public.knowledge_documents
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create knowledge documents in their tenant" ON public.knowledge_documents
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "Users can update their knowledge documents in their tenant" ON public.knowledge_documents
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "Users can delete their knowledge documents in their tenant" ON public.knowledge_documents
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

-- Fix profiles - add tenant awareness
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm1, public.user_tenant_memberships utm2
    WHERE utm1.user_id = auth.uid() 
    AND utm2.user_id = profiles.user_id
    AND utm1.tenant_id = utm2.tenant_id
    AND utm1.is_active = true
    AND utm2.is_active = true
  ));

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());