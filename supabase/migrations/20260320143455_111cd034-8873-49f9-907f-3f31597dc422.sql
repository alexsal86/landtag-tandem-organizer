DROP FUNCTION IF EXISTS public.get_case_files_with_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_case_files_with_counts(p_tenant_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, tenant_id uuid, title text, description text, case_type text, case_scale text, status text, priority text, reference_number text, start_date date, target_date date, tags text[], is_private boolean, visibility text, current_status_note text, current_status_updated_at timestamp with time zone, risks_and_opportunities jsonb, assigned_to uuid, created_at timestamp with time zone, updated_at timestamp with time zone, processing_status text, processing_statuses text[], contacts_count integer, documents_count integer, tasks_count integer, appointments_count integer, letters_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from user_tenant_memberships utm
    where utm.tenant_id = p_tenant_id
      and utm.user_id = v_user_id
      and utm.is_active = true
  ) then
    raise exception 'No tenant access';
  end if;

  return query
  with base_case_files as (
    select
      cf.id,
      cf.user_id,
      cf.tenant_id,
      cf.title,
      cf.description,
      cf.case_type,
      cf.case_scale,
      cf.status,
      cf.priority,
      cf.reference_number,
      cf.start_date,
      cf.target_date,
      cf.tags,
      cf.is_private,
      cf.visibility,
      cf.current_status_note,
      cf.current_status_updated_at,
      cf.risks_and_opportunities,
      cf.assigned_to,
      cf.created_at,
      cf.updated_at,
      cf.processing_status,
      cf.processing_statuses
    from case_files cf
    where cf.tenant_id = p_tenant_id
      and (
        cf.visibility = 'public'
        or cf.user_id = v_user_id
        or cf.assigned_to = v_user_id
        or exists (
          select 1 from case_file_participants cfp
          where cfp.case_file_id = cf.id
            and cfp.user_id = v_user_id
        )
      )
  ),
  contact_counts as (
    select case_file_id, count(*)::int as total
    from case_file_contacts
    where case_file_id in (select bcf.id from base_case_files bcf)
    group by case_file_id
  ),
  document_counts as (
    select case_file_id, count(*)::int as total
    from case_file_documents
    where case_file_id in (select bcf.id from base_case_files bcf)
    group by case_file_id
  ),
  task_counts as (
    select case_file_id, count(*)::int as total
    from case_file_tasks
    where case_file_id in (select bcf.id from base_case_files bcf)
    group by case_file_id
  ),
  appointment_counts as (
    select case_file_id, count(*)::int as total
    from case_file_appointments
    where case_file_id in (select bcf.id from base_case_files bcf)
    group by case_file_id
  ),
  letter_counts as (
    select case_file_id, count(*)::int as total
    from case_file_letters
    where case_file_id in (select bcf.id from base_case_files bcf)
    group by case_file_id
  )
  select
    bcf.id,
    bcf.user_id,
    bcf.tenant_id,
    bcf.title,
    bcf.description,
    bcf.case_type,
    bcf.case_scale,
    bcf.status,
    bcf.priority,
    bcf.reference_number,
    bcf.start_date,
    bcf.target_date,
    bcf.tags,
    bcf.is_private,
    bcf.visibility,
    bcf.current_status_note,
    bcf.current_status_updated_at,
    bcf.risks_and_opportunities,
    bcf.assigned_to,
    bcf.created_at,
    bcf.updated_at,
    bcf.processing_status,
    bcf.processing_statuses,
    coalesce(cc.total, 0) as contacts_count,
    coalesce(dc.total, 0) as documents_count,
    coalesce(tc.total, 0) as tasks_count,
    coalesce(ac.total, 0) as appointments_count,
    coalesce(lc.total, 0) as letters_count
  from base_case_files bcf
  left join contact_counts cc on cc.case_file_id = bcf.id
  left join document_counts dc on dc.case_file_id = bcf.id
  left join task_counts tc on tc.case_file_id = bcf.id
  left join appointment_counts ac on ac.case_file_id = bcf.id
  left join letter_counts lc on lc.case_file_id = bcf.id
  order by bcf.updated_at desc;
end;
$function$;