GRANT INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
CREATE POLICY "Büroleitung verwaltet Aufgabenpakete" ON public.task_templates
FOR ALL TO authenticated USING (public.is_tenant_admin(auth.uid(),tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(),tenant_id));
ALTER FUNCTION public.save_task_template(uuid,uuid,text,text,text,integer,jsonb,boolean) SECURITY INVOKER;
ALTER FUNCTION public.delete_task_template(uuid) SECURITY INVOKER;
ALTER FUNCTION public.apply_task_template(uuid,date) SECURITY INVOKER;