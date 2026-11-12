-- task_comments: tenant-scoped read
DROP POLICY IF EXISTS "Anyone can view task comments" ON public.task_comments;
CREATE POLICY "Tenant members can view task comments" ON public.task_comments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND t.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- task_documents: remove sign-in-only read (tenant policy remains)
DROP POLICY IF EXISTS "Users can view task documents they have access to" ON public.task_documents;

-- case_file_status_history: insert only as self, into own tenant's case files
DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.case_file_status_history;
CREATE POLICY "Tenant members can insert status history" ON public.case_file_status_history FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.case_files cf WHERE cf.id = case_file_status_history.case_file_id AND cf.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- subtasks: tenant-scoped via parent task
DROP POLICY IF EXISTS "Authenticated users can create all subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Authenticated users can delete all subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Authenticated users can update all subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Authenticated users can view all subtasks" ON public.subtasks;
CREATE POLICY "Tenant members can manage subtasks" ON public.subtasks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = subtasks.task_id AND t.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = subtasks.task_id AND t.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- appointment_polls: tenant-scoped read
DROP POLICY IF EXISTS "Authenticated users can view all polls" ON public.appointment_polls;
CREATE POLICY "Tenant members can view polls" ON public.appointment_polls FOR SELECT TO authenticated
USING (user_id = auth.uid() OR tenant_id = ANY (public.get_user_tenant_ids(auth.uid())));

-- case_file_participants: tenant-scoped read
DROP POLICY IF EXISTS "Authenticated users can view case file participants" ON public.case_file_participants;
CREATE POLICY "Tenant members can view case file participants" ON public.case_file_participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.case_files cf WHERE cf.id = case_file_participants.case_file_id AND cf.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- appointment_contacts: tenant-scoped via appointment
DROP POLICY IF EXISTS "Authenticated users can create all appointment contacts" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete all appointment contacts" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Authenticated users can update all appointment contacts" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Authenticated users can view all appointment contacts" ON public.appointment_contacts;
CREATE POLICY "Tenant members can manage appointment contacts" ON public.appointment_contacts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_contacts.appointment_id AND a.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_contacts.appointment_id AND a.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- appointment_documents: tenant-scoped via appointment
DROP POLICY IF EXISTS "Authenticated users can create appointment documents" ON public.appointment_documents;
DROP POLICY IF EXISTS "Authenticated users can delete appointment documents" ON public.appointment_documents;
DROP POLICY IF EXISTS "Authenticated users can update appointment documents" ON public.appointment_documents;
DROP POLICY IF EXISTS "Authenticated users can view appointment documents" ON public.appointment_documents;
CREATE POLICY "Tenant members can manage appointment documents" ON public.appointment_documents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_documents.appointment_id AND a.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_documents.appointment_id AND a.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- meeting_agenda_documents: tenant-scoped via agenda item -> meeting
DROP POLICY IF EXISTS "Authenticated users can create agenda documents" ON public.meeting_agenda_documents;
DROP POLICY IF EXISTS "Authenticated users can delete agenda documents" ON public.meeting_agenda_documents;
DROP POLICY IF EXISTS "Authenticated users can update agenda documents" ON public.meeting_agenda_documents;
DROP POLICY IF EXISTS "Authenticated users can view agenda documents" ON public.meeting_agenda_documents;
CREATE POLICY "Tenant members can manage agenda documents" ON public.meeting_agenda_documents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.meeting_agenda_items i JOIN public.meetings m ON m.id = i.meeting_id WHERE i.id = meeting_agenda_documents.meeting_agenda_item_id AND m.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_agenda_items i JOIN public.meetings m ON m.id = i.meeting_id WHERE i.id = meeting_agenda_documents.meeting_agenda_item_id AND m.tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))));

-- create_default_checklist_items: guard with planning access check
ALTER FUNCTION public.create_default_checklist_items(uuid, uuid) RENAME TO _create_default_checklist_items_impl;
REVOKE ALL ON FUNCTION public._create_default_checklist_items_impl(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_default_checklist_items(planning_id uuid, template_id_param uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_plannings ep
    WHERE ep.id = create_default_checklist_items.planning_id
      AND (ep.user_id = auth.uid() OR ep.tenant_id = ANY (public.get_user_tenant_ids(auth.uid())))
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF template_id_param IS NOT NULL AND auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.planning_templates pt
    WHERE pt.id = template_id_param
      AND (pt.user_id = auth.uid() OR pt.tenant_id IS NULL OR pt.tenant_id = ANY (public.get_user_tenant_ids(auth.uid())))
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  PERFORM public._create_default_checklist_items_impl(planning_id, template_id_param);
END;
$$;
REVOKE ALL ON FUNCTION public.create_default_checklist_items(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_default_checklist_items(uuid, uuid) TO authenticated, service_role;